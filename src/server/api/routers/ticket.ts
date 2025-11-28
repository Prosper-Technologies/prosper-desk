import { z } from "zod";
import {
  createTRPCRouter,
  companyProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { tickets, ticketComments, users, memberships } from "~/db/schema";
import { eq, desc, and, or, ilike, count, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const ticketRouter = createTRPCRouter({
  // Get paginated tickets with filters
  getAll: companyProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
        status: z
          .enum(["open", "in_progress", "resolved", "closed"])
          .optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedToId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        myTickets: z.boolean().default(false), // Filter for current user's tickets
        search: z.string().optional(),
        sortBy: z
          .enum(["created_at", "updated_at", "priority"])
          .default("created_at"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const whereConditions = [eq(tickets.company_id, ctx.company.id)];

      if (input.status) {
        whereConditions.push(eq(tickets.status, input.status));
      }

      if (input.priority) {
        whereConditions.push(eq(tickets.priority, input.priority));
      }

      if (input.assignedToId) {
        whereConditions.push(
          eq(tickets.assigned_to_membership_id, input.assignedToId),
        );
      }

      if (input.clientId) {
        whereConditions.push(eq(tickets.client_id, input.clientId));
      }

      if (input.myTickets) {
        // Show tickets assigned to current user or created by current user
        whereConditions.push(
          or(
            eq(tickets.assigned_to_membership_id, ctx.membership.id),
            eq(tickets.created_by_membership_id, ctx.membership.id),
          )!,
        );
      }

      if (input.search) {
        whereConditions.push(
          or(
            ilike(tickets.subject, `%${input.search}%`),
            ilike(tickets.description, `%${input.search}%`),
          )!,
        );
      }

      // Get total count
      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(tickets)
        .where(and(...whereConditions));

      // Get tickets with relations
      const ticketList = await ctx.db.query.tickets.findMany({
        where: and(...whereConditions),
        with: {
          createdByMembership: {
            with: {
              user: {
                columns: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  avatar_url: true,
                },
              },
            },
          },
          assignedToMembership: {
            with: {
              user: {
                columns: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  avatar_url: true,
                },
              },
            },
          },
          assignedToCustomerPortalAccess: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          client: {
            columns: { id: true, name: true, slug: true, logo_url: true },
          },
          slaPolicy: true,
          comments: {
            with: {
              membership: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      first_name: true,
                      last_name: true,
                      avatar_url: true,
                    },
                  },
                },
              },
              customerPortalAccess: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: (ticketComments, { asc }) => [
              asc(ticketComments.created_at),
            ],
          },
        },
        limit: input.limit,
        offset,
        orderBy: (tickets, { asc, desc }) => [
          input.sortOrder === "asc"
            ? asc(tickets[input.sortBy])
            : desc(tickets[input.sortBy]),
        ],
      });

      return {
        tickets: ticketList,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get single ticket with comments
  getById: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(eq(tickets.id, input.id), eq(tickets.company_id, ctx.company.id)),
        with: {
          createdByMembership: {
            with: {
              user: true,
            },
          },
          assignedToMembership: {
            with: {
              user: true,
            },
          },
          assignedToCustomerPortalAccess: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          slaPolicy: true,
          escalationPolicy: true,
          comments: {
            with: {
              membership: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      first_name: true,
                      last_name: true,
                      avatar_url: true,
                    },
                  },
                },
              },
              customerPortalAccess: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: (ticketComments, { asc }) => [
              asc(ticketComments.created_at),
            ],
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Get form submission if ticket was created from a form
      let formSubmission = null;
      if (ticket.external_type === "form_submission" && ticket.external_id) {
        formSubmission = await ctx.db.query.formSubmissions.findFirst({
          where: (formSubmissions, { eq }) =>
            eq(formSubmissions.id, ticket.external_id!),
          columns: {
            id: true,
            data: true,
            description: true,
            external_id: true,
            external_type: true,
            submitted_at: true,
            submitted_by_name: true,
            submitted_by_email: true,
          },
          with: {
            form: {
              columns: {
                id: true,
                name: true,
                slug: true,
                fields: true,
              },
            },
          },
        });
      }

      return {
        ...ticket,
        formSubmission,
      };
    }),

  // Create new ticket
  create: companyProcedure
    .input(
      z.object({
        subject: z.string().min(1),
        description: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assignedToId: z.string().uuid().optional(),
        assignedToCustomerPortalAccessId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        customerEmail: z.string().email().optional(),
        customerName: z.string().optional(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get default SLA policy
      const defaultSLA = await ctx.db.query.slaPolicies.findFirst({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.company_id, ctx.company.id),
            eq(slaPolicies.is_default, true),
          ),
      });

      const [ticket] = await ctx.db
        .insert(tickets)
        .values({
          company_id: ctx.company.id,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          created_by_membership_id: ctx.membership.id,
          assigned_to_membership_id: input.assignedToId,
          assigned_to_customer_portal_access_id:
            input.assignedToCustomerPortalAccessId,
          client_id: input.clientId,
          customer_email: input.customerEmail,
          customer_name: input.customerName,
          sla_policy_id: defaultSLA?.id,
          tags: input.tags,
        })
        .returning();

      return ticket;
    }),

  // Update ticket
  update: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        subject: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z
          .enum(["open", "in_progress", "resolved", "closed"])
          .optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedToId: z.string().uuid().optional(),
        assignedToCustomerPortalAccessId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ticket belongs to company
      const existingTicket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(eq(tickets.id, input.id), eq(tickets.company_id, ctx.company.id)),
      });

      if (!existingTicket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      const updateData: Record<string, any> = {};

      if (input.subject) updateData.subject = input.subject;
      if (input.description) updateData.description = input.description;
      if (input.status) {
        updateData.status = input.status;

        // Mark resolved timestamp
        if (
          input.status === "resolved" &&
          existingTicket.status !== "resolved"
        ) {
          updateData.resolved_at = new Date();
        }
      }
      if (input.priority) updateData.priority = input.priority;
      if (input.assignedToId !== undefined) {
        updateData.assigned_to_membership_id = input.assignedToId;
        // Clear customer portal access assignment if membership is assigned
        updateData.assigned_to_customer_portal_access_id = null;
      }
      if (input.assignedToCustomerPortalAccessId !== undefined) {
        updateData.assigned_to_customer_portal_access_id =
          input.assignedToCustomerPortalAccessId;
        // Clear membership assignment if customer portal access is assigned
        updateData.assigned_to_membership_id = null;
      }
      if (input.tags) updateData.tags = input.tags;

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();

        const [updatedTicket] = await ctx.db
          .update(tickets)
          .set(updateData)
          .where(eq(tickets.id, input.id))
          .returning();

        return updatedTicket;
      }

      return existingTicket;
    }),

  // Add comment to ticket
  addComment: companyProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().min(1),
        isInternal: z.boolean().default(false),
        attachments: z.array(z.string().url()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ticket exists and belongs to company
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.company_id, ctx.company.id),
          ),
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      const [comment] = await ctx.db
        .insert(ticketComments)
        .values({
          company_id: ctx.company.id,
          ticket_id: input.ticketId,
          membership_id: ctx.membership.id,
          content: input.content,
          is_internal: input.isInternal,
          attachments: input.attachments,
        })
        .returning();

      // Mark first response time if this is the first non-internal comment
      if (
        !input.isInternal &&
        !ticket.first_response_at &&
        ticket.created_by_membership_id !== ctx.membership.id
      ) {
        await ctx.db
          .update(tickets)
          .set({
            first_response_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(tickets.id, input.ticketId));
      }

      return comment;
    }),

  // Get ticket metrics for dashboard
  getMetrics: companyProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = [eq(tickets.company_id, ctx.company.id)];

      if (input.startDate) {
        whereConditions.push(gte(tickets.created_at, input.startDate));
      }

      if (input.endDate) {
        whereConditions.push(lte(tickets.created_at, input.endDate));
      }

      // Get status counts
      const statusCounts = await ctx.db
        .select({
          status: tickets.status,
          count: count(),
        })
        .from(tickets)
        .where(and(...whereConditions))
        .groupBy(tickets.status);

      // Get priority counts
      const priorityCounts = await ctx.db
        .select({
          priority: tickets.priority,
          count: count(),
        })
        .from(tickets)
        .where(and(...whereConditions))
        .groupBy(tickets.priority);

      return {
        statusCounts,
        priorityCounts,
      };
    }),
});
