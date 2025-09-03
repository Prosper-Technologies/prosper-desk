import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "~/server/api/trpc";
import { clients, customerPortalAccess } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateAccessToken } from "~/lib/utils";

function calculateExpirationDate(expiration?: string): Date | null {
  if (!expiration || expiration === "never") {
    return null;
  }

  const now = new Date();
  switch (expiration) {
    case "1_day":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "1_week":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "1_month":
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "1_year":
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export const clientRouter = createTRPCRouter({
  // Get all clients for a company
  getAll: companyProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(25),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const whereConditions = [eq(clients.company_id, ctx.company.id)];

      if (input.search) {
        // Add search condition (would need to implement proper search)
        // For now, just return all clients
      }

      const clientsList = await ctx.db.query.clients.findMany({
        where: and(...whereConditions),
        with: {
          portalAccess: {
            where: eq(customerPortalAccess.is_active, true),
          },
          tickets: {
            columns: { id: true, status: true },
          },
        },
        limit: input.limit,
        offset,
        orderBy: (clients, { desc }) => [desc(clients.created_at)],
      });

      // Count total clients
      const totalClients = await ctx.db.query.clients.findMany({
        where: and(...whereConditions),
        columns: { id: true },
      });

      return {
        clients: clientsList.map((client) => ({
          ...client,
          ticketCount: client.tickets.length,
          activePortalUsers: client.portalAccess.length,
        })),
        pagination: {
          page: input.page,
          limit: input.limit,
          total: totalClients.length,
          totalPages: Math.ceil(totalClients.length / input.limit),
        },
      };
    }),

  // Get client by ID
  getById: companyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.id),
          eq(clients.company_id, ctx.company.id),
        ),
        with: {
          company: true,
          portalAccess: {
            orderBy: (portalAccess, { desc }) => [
              desc(portalAccess.created_at),
            ],
          },
          tickets: {
            with: {
              assignedToMembership: {
                with: {
                  user: {
                    columns: { id: true, first_name: true, last_name: true },
                  },
                },
              },
            },
            orderBy: (tickets, { desc }) => [desc(tickets.created_at)],
            limit: 10, // Recent tickets
          },
        },
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      return client;
    }),

  // Create new client
  create: companyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(
            /^[a-z0-9-]+$/,
            "Slug must contain only lowercase letters, numbers, and hyphens",
          ),
        email_domain: z.string().optional(),
        description: z.string().optional(),
        logo_url: z.string().url().optional(),
        portal_enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is unique within the company
      const existingClient = await ctx.db.query.clients.findFirst({
        where: and(
          eq(clients.company_id, ctx.company.id),
          eq(clients.slug, input.slug),
        ),
      });

      if (existingClient) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A client with this slug already exists",
        });
      }

      const [newClient] = await ctx.db
        .insert(clients)
        .values({
          company_id: ctx.company.id,
          name: input.name,
          slug: input.slug,
          email_domain: input.email_domain,
          description: input.description,
          logo_url: input.logo_url,
          portal_enabled: input.portal_enabled,
        })
        .returning();

      return newClient;
    }),

  // Update client
  update: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
        email_domain: z.string().optional(),
        description: z.string().optional(),
        logo_url: z.string().url().optional(),
        portal_enabled: z.boolean().optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Verify client belongs to company
      const existingClient = await ctx.db.query.clients.findFirst({
        where: and(eq(clients.id, id), eq(clients.company_id, ctx.company.id)),
      });

      if (!existingClient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      // If updating slug, check uniqueness
      if (input.slug && input.slug !== existingClient.slug) {
        const slugExists = await ctx.db.query.clients.findFirst({
          where: and(
            eq(clients.company_id, ctx.company.id),
            eq(clients.slug, input.slug),
          ),
        });

        if (slugExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A client with this slug already exists",
          });
        }
      }

      const [updatedClient] = await ctx.db
        .update(clients)
        .set({ ...updateData, updated_at: new Date() })
        .where(eq(clients.id, id))
        .returning();

      return updatedClient;
    }),

  // Delete client
  delete: companyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify client belongs to company
      const existingClient = await ctx.db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.id),
          eq(clients.company_id, ctx.company.id),
        ),
      });

      if (!existingClient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      await ctx.db.delete(clients).where(eq(clients.id, input.id));

      return { success: true };
    }),

  // Generate portal access for a customer (creates account for magic link)
  generatePortalAccess: companyProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        email: z.string().email(),
        name: z.string().min(1),
        expiration: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify client belongs to company
      const client = await ctx.db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.company_id, ctx.company.id),
        ),
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      if (!client.portal_enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Portal access is disabled for this client",
        });
      }

      // Check if access already exists
      let existingAccess = await ctx.db.query.customerPortalAccess.findFirst({
        where: and(
          eq(customerPortalAccess.client_id, input.clientId),
          eq(customerPortalAccess.email, input.email),
        ),
      });

      if (existingAccess) {
        // Generate new token for existing access
        const accessToken = generateAccessToken();
        const expiresAt = calculateExpirationDate(input.expiration);
        const [updatedAccess] = await ctx.db
          .update(customerPortalAccess)
          .set({
            name: input.name,
            access_token: accessToken,
            is_active: true,
            expires_at: expiresAt,
            updated_at: new Date(),
          })
          .where(eq(customerPortalAccess.id, existingAccess.id))
          .returning();

        return {
          accessToken,
          portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/${(ctx as any).company.slug}/${client.slug}/auth?token=${accessToken}`,
          message: "Portal access updated with new token.",
        };
      } else {
        // Create new access with token
        const accessToken = generateAccessToken();
        const expiresAt = calculateExpirationDate(input.expiration);

        const [newAccess] = await ctx.db
          .insert(customerPortalAccess)
          .values({
            company_id: ctx.company.id,
            client_id: input.clientId,
            email: input.email,
            name: input.name,
            access_token: accessToken,
            expires_at: expiresAt,
          })
          .returning();

        return {
          accessToken,
          portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/${(ctx as any).company.slug}/${client.slug}/auth?token=${accessToken}`,
          message: "Portal access created with token.",
        };
      }
    }),

  // Get portal access for a client
  getPortalAccess: companyProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify client belongs to company
      const client = await ctx.db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.company_id, ctx.company.id),
        ),
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      const portalAccess = await ctx.db.query.customerPortalAccess.findMany({
        where: eq(customerPortalAccess.client_id, input.clientId),
        orderBy: (portalAccess, { desc }) => [desc(portalAccess.created_at)],
      });

      return portalAccess;
    }),

  // Revoke portal access
  revokePortalAccess: companyProcedure
    .input(z.object({ accessId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Find the access record and verify it belongs to this company
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: and(
          eq(customerPortalAccess.id, input.accessId),
          eq(customerPortalAccess.company_id, (ctx as any).company.id),
        ),
      });

      if (!access) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal access not found",
        });
      }

      const [updatedAccess] = await ctx.db
        .update(customerPortalAccess)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(customerPortalAccess.id, input.accessId))
        .returning();

      return updatedAccess;
    }),

  // Completely delete portal access
  deletePortalAccess: companyProcedure
    .input(z.object({ accessId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Find the access record and verify it belongs to this company
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: and(
          eq(customerPortalAccess.id, input.accessId),
          eq(customerPortalAccess.company_id, (ctx as any).company.id),
        ),
      });

      if (!access) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal access not found",
        });
      }

      // Completely delete the record from the database
      await ctx.db
        .delete(customerPortalAccess)
        .where(eq(customerPortalAccess.id, input.accessId));

      return { success: true };
    }),

  // Update expiration for an existing portal access
  updatePortalAccessExpiration: companyProcedure
    .input(
      z.object({
        accessId: z.string().uuid(),
        expiration: z.string().optional(), // "1_day" | "1_week" | "1_month" | "1_year" | "never"
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: and(
          eq(customerPortalAccess.id, input.accessId),
          eq(customerPortalAccess.company_id, (ctx as any).company.id),
        ),
      });

      if (!access) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal access not found",
        });
      }

      const expiresAt = calculateExpirationDate(input.expiration);

      const [updated] = await ctx.db
        .update(customerPortalAccess)
        .set({ expires_at: expiresAt, updated_at: new Date() })
        .where(eq(customerPortalAccess.id, input.accessId))
        .returning();

      return updated;
    }),
});
