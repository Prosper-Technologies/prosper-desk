import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "~/server/api/trpc";
import { clients, customerPortalAccess } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
        email_domains: z.array(z.string()).optional(),
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
          email_domains: input.email_domains || [],
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
        email_domains: z.array(z.string()).optional(),
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

  // Generate portal access for a customer (sends magic link email)
  generatePortalAccess: companyProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        email: z.string().email(),
        name: z.string().min(1),
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

      // Validate email domain if client has restrictions
      const cleanedEmailDomains = client.email_domains.filter(
        (domain) => domain && domain.length > 0,
      );

      if (cleanedEmailDomains.length > 0) {
        const emailDomain = input.email.split("@")[1];
        if (!cleanedEmailDomains.includes(emailDomain)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Email must be from one of these domains: ${client.email_domains.join(", ")}`,
          });
        }
      }

      // Check if access already exists for this email and client
      const existingAccess = await ctx.db.query.customerPortalAccess.findFirst({
        where: and(
          eq(customerPortalAccess.client_id, input.clientId),
          eq(customerPortalAccess.email, input.email),
        ),
      });

      if (existingAccess) {
        // Update existing access
        await ctx.db
          .update(customerPortalAccess)
          .set({
            name: input.name,
            is_active: true,
            updated_at: new Date(),
          })
          .where(eq(customerPortalAccess.id, existingAccess.id));
      } else {
        // Create new access record
        await ctx.db.insert(customerPortalAccess).values({
          company_id: ctx.company.id,
          client_id: input.clientId,
          email: input.email,
          name: input.name,
        });
      }

      // Customer will request their own magic link via the portal
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${ctx.company.slug}/${client.slug}`;

      return {
        message: existingAccess
          ? `Portal access updated for ${input.email}. Share this link: ${portalUrl}`
          : `Portal access granted to ${input.email}. Share this link: ${portalUrl}`,
        email: input.email,
        portalUrl,
      };
    }),

  // Get all portal accesses for a company
  getAllPortalAccess: companyProcedure.query(async ({ ctx }) => {
    const portalAccesses = await ctx.db.query.customerPortalAccess.findMany({
      where: and(
        eq(customerPortalAccess.company_id, ctx.company.id),
        eq(customerPortalAccess.is_active, true),
      ),
      with: {
        client: {
          columns: { id: true, name: true, slug: true },
        },
      },
      orderBy: (portalAccess, { desc }) => [desc(portalAccess.created_at)],
    });

    return portalAccesses;
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
});
