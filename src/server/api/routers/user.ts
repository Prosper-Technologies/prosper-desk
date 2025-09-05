import { z } from "zod";
import {
  adminCompanyProcedure,
  companyProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { memberships, users } from "~/db/schema";
import { TRPCError } from "@trpc/server";
import { emailService } from "~/lib/email";
import {
  createInvitationCode,
  useInvitationCode,
  validateInvitationCode,
} from "~/lib/invitation-codes";

export const userRouter = createTRPCRouter({
  // Get all users in company
  getAll: companyProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.memberships.findMany({
      where: and(
        eq(memberships.company_id, ctx.company.id),
        eq(memberships.is_active, true),
      ),
      with: {
        user: {
          columns: {
            auth_user_id: false, // Don't expose auth_user_id
          },
        },
      },
      orderBy: [asc(memberships.joined_at)],
    });
  }),

  // Get agents only (for ticket assignment)
  getAgents: companyProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.memberships.findMany({
      where: and(
        eq(memberships.company_id, ctx.company.id),
        eq(memberships.is_active, true),
      ),
      with: {
        user: {
          columns: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
      orderBy: [asc(memberships.role)],
    });
  }),

  // Get user by ID (membership ID)
  getById: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(), // This is now membership ID
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.query.memberships.findFirst({
        where: and(
          eq(memberships.id, input.id),
          eq(memberships.company_id, ctx.company.id),
          eq(memberships.is_active, true),
        ),
        with: {
          user: {
            columns: {
              auth_user_id: false,
            },
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return membership;
    }),

  // Invite new user (admin only)
  invite: adminCompanyProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(["admin", "agent"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user with this email already has a membership in this company
      const existingUser = await ctx.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, input.email),
        with: {
          memberships: {
            where: (memberships, { eq }) =>
              eq(memberships.company_id, ctx.company.id),
          },
        },
      });

      if (existingUser && existingUser.memberships.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists in company",
        });
      }

      // Check if user already exists with this email (across all companies)
      let user = await ctx.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, input.email),
      });

      // If user doesn't exist, create them
      if (!user) {
        const [newUser] = await ctx.db
          .insert(users)
          .values({
            email: input.email,
            first_name: input.firstName,
            last_name: input.lastName,
            is_active: false, // Will be activated when they complete signup
          })
          .returning();
        user = newUser!;
      }

      // Create membership for this company
      const [membership] = await ctx.db
        .insert(memberships)
        .values({
          user_id: user.id,
          company_id: ctx.company.id,
          role: input.role,
          is_active: false, // Will be activated when they accept invitation
        })
        .returning();

      // Generate and send invitation code
      try {
        const invitationCode = await createInvitationCode({
          companyId: ctx.company.id,
          userId: user.id,
          role: input.role,
          invitedByMembershipId: ctx.membership.id,
        });

        await emailService.sendInvitation({
          to: input.email,
          companyName: ctx.company.name,
          inviterName: `${ctx.user.first_name} ${ctx.user.last_name}`,
          invitationCode,
          companySlug: ctx.company.slug,
        });

        console.log(
          `Invitation email with code ${invitationCode} sent to ${input.email}`,
        );
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't fail the user creation if email fails
      }

      return {
        membership,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_active: user.is_active,
          created_at: user.created_at,
        },
      };
    }),

  // Update user/membership (admin only or own profile)
  update: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(), // membership ID
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        role: z.enum(["admin", "agent"]).optional(),
        isActive: z.boolean().optional(),
        avatarUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if membership exists and belongs to company
      const targetMembership = await ctx.db.query.memberships.findFirst({
        where: (memberships, { and, eq }) =>
          and(
            eq(memberships.id, input.id),
            eq(memberships.company_id, ctx.company.id),
          ),
        with: {
          user: true,
        },
      });

      if (!targetMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Check permissions: admin can edit anyone, users can edit themselves
      const canEdit = ctx.membership.role === "admin" ||
        ctx.membership.id === input.id;

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to edit this user",
        });
      }

      // Only admins can change role and active status
      if (
        (input.role || typeof input.isActive === "boolean") &&
        ctx.membership.role !== "admin"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can change user role or status",
        });
      }

      // Update user fields
      const userUpdateData: Record<string, any> = {};
      if (input.firstName) userUpdateData.first_name = input.firstName;
      if (input.lastName) userUpdateData.last_name = input.lastName;
      if (input.avatarUrl) userUpdateData.avatar_url = input.avatarUrl;

      // Update membership fields
      const membershipUpdateData: Record<string, any> = {};
      if (input.role) membershipUpdateData.role = input.role;
      if (typeof input.isActive === "boolean") {
        membershipUpdateData.is_active = input.isActive;
      }

      // Update user if needed
      if (Object.keys(userUpdateData).length > 0) {
        userUpdateData.updated_at = new Date();
        await ctx.db
          .update(users)
          .set(userUpdateData)
          .where(eq(users.id, targetMembership.user.id));
      }

      // Update membership if needed
      if (Object.keys(membershipUpdateData).length > 0) {
        membershipUpdateData.updated_at = new Date();
        await ctx.db
          .update(memberships)
          .set(membershipUpdateData)
          .where(eq(memberships.id, input.id));
      }

      // Return updated membership with user
      const updatedMembership = await ctx.db.query.memberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.id, input.id),
        with: {
          user: {
            columns: {
              auth_user_id: false,
            },
          },
        },
      });

      return updatedMembership;
    }),

  // Deactivate membership (admin only)
  deactivate: adminCompanyProcedure
    .input(
      z.object({
        id: z.string().uuid(), // membership ID
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Can't deactivate yourself
      if (ctx.membership.id === input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate your own account",
        });
      }

      const [deactivatedMembership] = await ctx.db
        .update(memberships)
        .set({
          is_active: false,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(memberships.id, input.id),
            eq(memberships.company_id, ctx.company.id),
          ),
        )
        .returning({
          id: memberships.id,
          is_active: memberships.is_active,
        });

      if (!deactivatedMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return deactivatedMembership;
    }),

  // Test email sending
  testEmail: companyProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await emailService.sendTest({
          to: input.email,
          fromDomain: "useblueos.com",
        });

        return {
          success: true,
          message: `Test email sent successfully to ${input.email}`,
        };
      } catch (error) {
        console.error("Test email failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to send test email. Please check your Resend configuration.",
        });
      }
    }),

  // Validate invitation code
  validateInvitationCode: publicProcedure
    .input(
      z.object({
        code: z.string().length(6),
      }),
    )
    .query(async ({ input }) => {
      const result = await validateInvitationCode(input.code);
      return result;
    }),

  // Accept invitation with code
  acceptInvitation: publicProcedure
    .input(
      z.object({
        code: z.string().length(6),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate the invitation code
      const validation = await validateInvitationCode(input.code);

      if (!validation.isValid || !validation.invitation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.error || "Invalid invitation code",
        });
      }

      const { invitation } = validation;

      try {
        // Create Supabase Auth user
        const { data: authData, error: authError } = await ctx.supabaseAdmin
          .auth
          .admin.createUser({
            email: invitation.userEmail!,
            password: input.password,
            email_confirm: true, // Auto-confirm email since they have a valid invitation
          });

        if (authError || !authData.user) {
          console.error("Supabase auth error:", authError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create user account: ${
              authError?.message || "Unknown error"
            }`,
          });
        }

        // Update the user record with the auth_user_id
        await ctx.db
          .update(users)
          .set({
            auth_user_id: authData.user.id,
            is_active: true,
            updated_at: new Date(),
          })
          .where(eq(users.id, invitation.userId));

        // Activate the membership
        await ctx.db
          .update(memberships)
          .set({
            is_active: true,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(memberships.user_id, invitation.userId),
              eq(memberships.company_id, invitation.companyId),
            ),
          );

        // Mark the invitation code as used
        await useInvitationCode(invitation.id);

        // Send welcome email
        try {
          await emailService.sendWelcome({
            to: invitation.userEmail!,
            firstName: invitation.userEmail!.split("@")[0], // Fallback name
            companyName: invitation.companyName!,
          });
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
          // Don't fail the process if welcome email fails
        }

        return {
          success: true,
          message: "Account created successfully! You can now log in.",
          redirectTo: `/auth/login?company=${invitation.companySlug}`,
        };
      } catch (error) {
        console.error("Failed to accept invitation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account. Please try again.",
        });
      }
    }),
});
