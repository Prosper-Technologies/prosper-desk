import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { users, companies, memberships } from "~/db/schema";
import { eq } from "drizzle-orm";

export const authRouter = createTRPCRouter({
  completeOnboarding: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        companyName: z.string().min(1),
        companySlug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/),
        companySize: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]),
        authUserId: z.string().uuid(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if company slug is available
      const existingCompany = await ctx.db.query.companies.findFirst({
        where: eq(companies.slug, input.companySlug),
      });

      if (existingCompany) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Company slug already exists",
        });
      }

      // Check if user already exists
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.auth_user_id, input.authUserId),
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already onboarded",
        });
      }

      // Create company first
      const [company] = await ctx.db
        .insert(companies)
        .values({
          name: input.companyName,
          slug: input.companySlug,
          size: input.companySize,
        })
        .returning();

      if (!company) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create company",
        });
      }

      const [user] = await ctx.db
        .insert(users)
        .values({
          auth_user_id: input.authUserId,
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
        })
        .returning();

      // Create membership with owner role
      const [membership] = await ctx.db
        .insert(memberships)
        .values({
          user_id: user.id,
          company_id: company.id,
          role: "owner",
        })
        .returning();

      return {
        user,
        company,
        membership,
      };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    let user = await ctx.db.query.users.findFirst({
      where: eq(users.auth_user_id, ctx.session.user.id),
      with: {
        memberships: {
          where: (memberships, { eq }) => eq(memberships.is_active, true),
          with: {
            company: true,
          },
        },
      },
    });

    // If user doesn't exist, create one from Supabase auth data
    if (!user) {
      const [newUser] = await ctx.db
        .insert(users)
        .values({
          auth_user_id: ctx.session.user.id,
          email: ctx.session.user.email || "",
          first_name: ctx.session.user.user_metadata?.first_name || "",
          last_name: ctx.session.user.user_metadata?.last_name || "",
        })
        .returning();

      // Return user with empty memberships
      return {
        ...newUser,
        memberships: [],
      };
    }

    return user;
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        avatarUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.auth_user_id, ctx.session.user.id),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const updateData: Record<string, any> = {};
      if (input.firstName) updateData.first_name = input.firstName;
      if (input.lastName) updateData.last_name = input.lastName;
      if (input.avatarUrl) updateData.avatar_url = input.avatarUrl;

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();

        const [updatedUser] = await ctx.db
          .update(users)
          .set(updateData)
          .where(eq(users.id, user.id))
          .returning();

        return updatedUser;
      }

      return user;
    }),

  // Get user's companies/memberships for company switching
  getUserMemberships: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.auth_user_id, ctx.session.user.id),
      with: {
        memberships: {
          where: (memberships, { eq }) => eq(memberships.is_active, true),
          with: {
            company: true,
          },
          orderBy: (memberships, { asc }) => [asc(memberships.joined_at)],
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user.memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      joinedAt: membership.joined_at,
      company: membership.company,
    }));
  }),

  // Switch to a different company (for multi-tenant users)
  switchCompany: protectedProcedure
    .input(
      z.object({
        membershipId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.auth_user_id, ctx.session.user.id),
        with: {
          memberships: {
            where: (memberships, { and, eq }) =>
              and(
                eq(memberships.id, input.membershipId),
                eq(memberships.is_active, true),
              ),
            with: {
              company: true,
            },
          },
        },
      });

      if (!user || !user.memberships.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Membership not found or not accessible",
        });
      }

      const membership = user.memberships[0];

      // Return the selected membership and company for the frontend to use
      return {
        membership,
        company: membership.company,
        user,
      };
    }),
});
