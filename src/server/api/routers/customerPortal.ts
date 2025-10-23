import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { customerPortalAccess, tickets, ticketComments } from "~/db/schema";
import { eq, inArray, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { db } from "~/db";

// Helper function to verify portal access via Supabase session
async function verifyPortalAccess(
  ctx: { db: typeof db; supabase: any },
  input: { companySlug: string; clientSlug: string },
) {
  // Get the current user session
  const {
    data: { user },
    error: authError,
  } = await ctx.supabase.auth.getUser();

  if (authError || !user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated. Please log in to the customer portal.",
    });
  }

  // Find client by both company slug and client slug
  const clients = await ctx.db.query.clients.findMany({
    where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
    with: {
      company: true,
    },
  });

  const client = clients.find((c) => c.company.slug === input.companySlug);

  // Verify the client exists and portal is enabled
  if (!client || !client.portal_enabled) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Client not found or portal disabled",
    });
  }

  // First, check if user is a team member with access to this company
  const teamMember = await ctx.db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, user.email!),
  });

  if (teamMember) {
    // Check if they have an active membership in the company
    const membership = await ctx.db.query.memberships.findFirst({
      where: (memberships, { and, eq }) =>
        and(
          eq(memberships.user_id, teamMember.id),
          eq(memberships.company_id, client.company.id),
          eq(memberships.is_active, true),
        ),
    });

    if (membership) {
      // Team member has access
      return {
        customerEmail: teamMember.email,
        customerName: `${teamMember.first_name} ${teamMember.last_name}`,
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        companyId: client.company.id,
        companyName: client.company.name,
        companySlug: client.company.slug,
        portalAccessId: null, // Team members don't have portal access records
        isTeamMember: true,
      };
    }
  }

  // If not a team member, check customer portal access
  const access = await ctx.db.query.customerPortalAccess.findFirst({
    where: (customerPortalAccess, { and, eq }) =>
      and(
        eq(customerPortalAccess.client_id, client.id),
        eq(customerPortalAccess.email, user.email!),
        eq(customerPortalAccess.is_active, true),
      ),
  });

  if (!access) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "You don't have access to this customer portal. Please use the correct customer portal login.",
    });
  }

  return {
    customerEmail: access.email,
    customerName: access.name,
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    companyId: client.company.id,
    companyName: client.company.name,
    companySlug: client.company.slug,
    portalAccessId: access.id,
    isTeamMember: false,
  };
}

export const customerPortalRouter = createTRPCRouter({
  // Request OTP for portal access
  requestOTP: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find client by both company slug and client slug
      const clients = await ctx.db.query.clients.findMany({
        where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
        with: {
          company: true,
        },
      });

      const client = clients.find((c) => c.company.slug === input.companySlug);

      if (!client || !client.portal_enabled) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal not found or disabled",
        });
      }

      // Check if this email has portal access
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: (customerPortalAccess, { and, eq }) =>
          and(
            eq(customerPortalAccess.client_id, client.id),
            eq(customerPortalAccess.email, input.email),
            eq(customerPortalAccess.is_active, true),
          ),
      });

      if (!access) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "This email does not have portal access. Please contact support.",
        });
      }

      // Send OTP email using Supabase Auth
      const { error } = await ctx.supabase.auth.signInWithOtp({
        email: input.email,
      });

      if (error) {
        console.error("Failed to send OTP:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send verification code. Please try again.",
        });
      }

      return {
        message: "Verification code sent! Please check your email.",
        email: input.email,
      };
    }),

  // Verify OTP and validate portal access
  verifyOTP: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the client exists and portal is enabled
      const clients = await ctx.db.query.clients.findMany({
        where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
        with: {
          company: true,
        },
      });

      const client = clients.find((c) => c.company.slug === input.companySlug);

      if (!client || !client.portal_enabled) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal not found or disabled",
        });
      }

      // Check if this email has portal access
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: (customerPortalAccess, { and, eq }) =>
          and(
            eq(customerPortalAccess.client_id, client.id),
            eq(customerPortalAccess.email, input.email),
            eq(customerPortalAccess.is_active, true),
          ),
      });

      if (!access) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This email does not have portal access.",
        });
      }

      // Update last login time
      await ctx.db
        .update(customerPortalAccess)
        .set({ last_login_at: new Date() })
        .where(eq(customerPortalAccess.id, access.id));

      return {
        message: "Access validated!",
        accessId: access.id,
      };
    }),

  // Verify session access (replaces token verification)
  verifyToken: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Update last login only for customer portal access (not team members)
      if (!access.isTeamMember && access.portalAccessId) {
        await ctx.db
          .update(customerPortalAccess)
          .set({
            last_login_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(customerPortalAccess.id, access.portalAccessId));
      }

      return {
        customerEmail: access.customerEmail,
        customerName: access.customerName,
        clientId: access.clientId,
        clientName: access.clientName,
        clientSlug: access.clientSlug,
        companyId: access.companyId,
        companyName: access.companyName,
        companySlug: access.companySlug,
      };
    }),

  // Get customer tickets
  getCustomerTickets: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      const offset = (input.page - 1) * input.limit;

      // Get ALL tickets for this client (not filtered by customer email)
      const baseTickets = await ctx.db.query.tickets.findMany({
        where: (tickets, { eq }) => eq(tickets.client_id, access.clientId),
        limit: input.limit,
        offset,
        orderBy: (tickets, { desc }) => [desc(tickets.created_at)],
      });

      // If no tickets found, return empty array
      if (baseTickets.length === 0) {
        return [];
      }

      // Get assigned memberships for tickets that have them
      const membershipIds = baseTickets
        .map((ticket) => ticket.assigned_to_membership_id)
        .filter((id): id is string => id !== null);

      let memberships: any[] = [];
      if (membershipIds.length > 0) {
        const baseMemberships = await ctx.db.query.memberships.findMany({
          where: (memberships) => inArray(memberships.id, membershipIds),
        });

        const userIds = baseMemberships.map((m) => m.user_id);
        let users: any[] = [];
        if (userIds.length > 0) {
          users = await ctx.db.query.users.findMany({
            where: (users) => inArray(users.id, userIds),
          });
        }

        memberships = baseMemberships.map((membership) => ({
          ...membership,
          user: users.find((u) => u.id === membership.user_id) || null,
        }));
      }

      const ticketIds = baseTickets.map((ticket) => ticket.id);
      let baseComments: any[] = [];
      if (ticketIds.length > 0) {
        try {
          baseComments = await ctx.db
            .select()
            .from(ticketComments)
            .where(
              and(
                inArray(ticketComments.ticket_id, ticketIds),
                eq(ticketComments.is_internal, false),
              ),
            )
            .orderBy(asc(ticketComments.created_at));
        } catch (error) {
          console.error("Failed to fetch comments:", error);
          baseComments = [];
        }
      }

      const commentMembershipIds = baseComments
        .map((comment) => comment.membership_id)
        .filter((id): id is string => id !== null);

      let commentMemberships: any[] = [];
      let commentUsers: any[] = [];
      if (commentMembershipIds.length > 0) {
        const baseMemberships = await ctx.db.query.memberships.findMany({
          where: (memberships) => inArray(memberships.id, commentMembershipIds),
        });

        const userIds = baseMemberships.map((m) => m.user_id);
        if (userIds.length > 0) {
          commentUsers = await ctx.db.query.users.findMany({
            where: (users) => inArray(users.id, userIds),
          });
        }

        commentMemberships = baseMemberships.map((membership) => ({
          ...membership,
          user: commentUsers.find((u) => u.id === membership.user_id) || null,
        }));
      }

      // Get customer portal access data for comments that have customer_portal_access_id
      const commentPortalAccessIds = baseComments
        .map((comment) => comment.customer_portal_access_id)
        .filter((id): id is string => id !== null);

      let commentPortalAccess: any[] = [];
      if (commentPortalAccessIds.length > 0) {
        commentPortalAccess = await ctx.db.query.customerPortalAccess.findMany({
          where: (customerPortalAccess) =>
            inArray(customerPortalAccess.id, commentPortalAccessIds),
        });
      }

      // Combine comment data
      const comments = baseComments.map((comment) => ({
        ...comment,
        membership:
          commentMemberships.find((m) => m.id === comment.membership_id) ||
          null,
        customerPortalAccess:
          commentPortalAccess.find(
            (p) => p.id === comment.customer_portal_access_id,
          ) || null,
      }));

      // Combine the data manually
      const customerTickets = baseTickets.map((ticket) => ({
        ...ticket,
        assignedToMembership:
          memberships.find((m) => m.id === ticket.assigned_to_membership_id) ||
          null,
        comments: comments.filter((comment) => comment.ticket_id === ticket.id),
      }));

      return customerTickets;
    }),

  // Create ticket from customer portal
  createTicket: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
        subject: z.string().min(1),
        description: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Get default SLA policy for the company
      const defaultSLA = await ctx.db.query.slaPolicies.findFirst({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.company_id, access.companyId),
            eq(slaPolicies.is_default, true),
          ),
      });

      // Find a suitable agent to auto-assign (optional)
      const availableAgentMembership = await ctx.db.query.memberships.findFirst(
        {
          where: (memberships, { and, eq }) =>
            and(
              eq(memberships.company_id, access.companyId),
              eq(memberships.role, "agent"),
              eq(memberships.is_active, true),
            ),
          with: {
            user: true,
          },
          orderBy: (memberships, { asc }) => [asc(memberships.joined_at)], // Simple round-robin
        },
      );

      const ticketData = {
        company_id: access.companyId,
        client_id: access.clientId,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        customer_email: access.customerEmail,
        customer_name: access.customerName,
        created_by_membership_id: null, // Customer created, not a member
        assigned_to_membership_id: availableAgentMembership?.id || null,
        sla_policy_id: defaultSLA?.id || null,
      };

      const [ticket] = await ctx.db
        .insert(tickets)
        .values(ticketData)
        .returning();

      return ticket;
    }),

  // Add comment to ticket from customer portal
  addComment: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
        ticketId: z.string().uuid(),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Verify ticket belongs to this client (not checking customer email)
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId),
          ),
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found or access denied",
        });
      }

      // Get membership_id if this is a team member
      let membershipId = null;
      if (access.isTeamMember) {
        const user = await ctx.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, access.customerEmail),
        });
        if (user) {
          const membership = await ctx.db.query.memberships.findFirst({
            where: (memberships, { and, eq }) =>
              and(
                eq(memberships.user_id, user.id),
                eq(memberships.company_id, access.companyId),
                eq(memberships.is_active, true),
              ),
          });
          membershipId = membership?.id || null;
        }
      }

      const [comment] = await ctx.db
        .insert(ticketComments)
        .values({
          company_id: access.companyId,
          ticket_id: input.ticketId,
          customer_portal_access_id: access.isTeamMember
            ? null
            : access.portalAccessId,
          membership_id: membershipId,
          content: input.content,
          is_internal: false,
          is_system: false,
        })
        .returning();

      // Update ticket to show activity
      await ctx.db
        .update(tickets)
        .set({ updated_at: new Date() })
        .where(eq(tickets.id, input.ticketId));

      return comment;
    }),

  // Get customer portal knowledge base
  getKnowledgeBase: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      // First get the client to find the company
      const client = await ctx.db.query.clients.findFirst({
        where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
        with: {
          company: true,
        },
      });

      if (
        !client ||
        client.company.slug !== input.companySlug ||
        !client.portal_enabled
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found or portal disabled",
        });
      }

      // Get published knowledge base articles for the client's company
      const articles = await ctx.db.query.knowledgeBase.findMany({
        where: (knowledgeBase, { and, eq, ilike }) => {
          const conditions = [
            eq(knowledgeBase.company_id, client.company.id),
            eq(knowledgeBase.is_published, true),
            eq(knowledgeBase.is_public, true),
          ];

          if (input.search) {
            conditions.push(ilike(knowledgeBase.title, `%${input.search}%`));
          }

          return and(...conditions);
        },
        limit: input.limit,
        orderBy: (knowledgeBase, { desc }) => [desc(knowledgeBase.created_at)],
      });

      return articles;
    }),

  // Get SLA metrics for customer portal
  getSLAMetrics: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Get ALL tickets for this client with SLA data
      const customerTickets = await ctx.db.query.tickets.findMany({
        where: (tickets, { eq }) => eq(tickets.client_id, access.clientId),
        with: {
          slaPolicy: true,
        },
      });

      // Calculate SLA metrics
      const totalTickets = customerTickets.length;
      const resolvedTickets = customerTickets.filter(
        (t) => t.status === "resolved" || t.status === "closed",
      );

      // Response time SLA compliance
      const ticketsWithResponseSLA = customerTickets.filter(
        (t) =>
          t.first_response_at && t.slaPolicy && t.sla_response_breach === false,
      );

      // Resolution time SLA compliance
      const ticketsWithResolutionSLA = resolvedTickets.filter(
        (t) =>
          t.resolved_at && t.slaPolicy && t.sla_resolution_breach === false,
      );

      // Average response time (in hours)
      const responseTimesInHours = customerTickets
        .filter((t) => t.first_response_at)
        .map((t) => {
          const created = new Date(t.created_at);
          const responded = new Date(t.first_response_at!);
          return (responded.getTime() - created.getTime()) / (1000 * 60 * 60);
        });

      const avgResponseTime =
        responseTimesInHours.length > 0
          ? responseTimesInHours.reduce((a, b) => a + b, 0) /
            responseTimesInHours.length
          : 0;

      // Average resolution time (in hours)
      const resolutionTimesInHours = resolvedTickets
        .filter((t) => t.resolved_at)
        .map((t) => {
          const created = new Date(t.created_at);
          const resolved = new Date(t.resolved_at!);
          return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
        });

      const avgResolutionTime =
        resolutionTimesInHours.length > 0
          ? resolutionTimesInHours.reduce((a, b) => a + b, 0) /
            resolutionTimesInHours.length
          : 0;

      // Status breakdown
      const statusBreakdown = {
        open: customerTickets.filter((t) => t.status === "open").length,
        in_progress: customerTickets.filter((t) => t.status === "in_progress")
          .length,
        resolved: customerTickets.filter((t) => t.status === "resolved").length,
        closed: customerTickets.filter((t) => t.status === "closed").length,
      };

      // Priority breakdown
      const priorityBreakdown = {
        low: customerTickets.filter((t) => t.priority === "low").length,
        medium: customerTickets.filter((t) => t.priority === "medium").length,
        high: customerTickets.filter((t) => t.priority === "high").length,
        urgent: customerTickets.filter((t) => t.priority === "urgent").length,
      };

      return {
        totalTickets,
        resolvedTickets: resolvedTickets.length,
        responseSLACompliance:
          totalTickets > 0
            ? (ticketsWithResponseSLA.length / totalTickets) * 100
            : 0,
        resolutionSLACompliance:
          resolvedTickets.length > 0
            ? (ticketsWithResolutionSLA.length / resolvedTickets.length) * 100
            : 0,
        avgResponseTimeHours: Number(avgResponseTime.toFixed(1)),
        avgResolutionTimeHours: Number(avgResolutionTime.toFixed(1)),
        statusBreakdown,
        priorityBreakdown,
      };
    }),

  // Get a single ticket by ID
  getTicketById: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Get the specific ticket
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId),
          ),
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Get assigned membership if exists
      let assignedTo = null;
      if (ticket.assigned_to_membership_id) {
        const membership = await ctx.db.query.memberships.findFirst({
          where: (memberships, { eq }) =>
            eq(memberships.id, ticket.assigned_to_membership_id!),
        });

        if (membership) {
          const user = await ctx.db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, membership.user_id),
          });

          assignedTo = {
            ...membership,
            user: user || null,
          };
        }
      }

      // Get comments for this ticket
      const baseComments = await ctx.db.query.ticketComments.findMany({
        where: (ticketComments, { eq }) =>
          eq(ticketComments.ticket_id, input.ticketId),
        orderBy: (ticketComments, { asc }) => [asc(ticketComments.created_at)],
      });

      // Get membership info for comments
      const commentMembershipIds = baseComments
        .map((comment) => comment.membership_id)
        .filter((id): id is string => id !== null);

      let commentMemberships: any[] = [];
      let commentUsers: any[] = [];
      if (commentMembershipIds.length > 0) {
        const baseMemberships = await ctx.db.query.memberships.findMany({
          where: (memberships) => inArray(memberships.id, commentMembershipIds),
        });

        const userIds = baseMemberships.map((m) => m.user_id);
        if (userIds.length > 0) {
          commentUsers = await ctx.db.query.users.findMany({
            where: (users) => inArray(users.id, userIds),
          });
        }

        commentMemberships = baseMemberships.map((membership) => ({
          ...membership,
          user: commentUsers.find((u) => u.id === membership.user_id) || null,
        }));
      }

      // Get customer portal access data for comments
      const commentPortalAccessIds = baseComments
        .map((comment) => comment.customer_portal_access_id)
        .filter((id): id is string => id !== null);

      let commentPortalAccess: any[] = [];
      if (commentPortalAccessIds.length > 0) {
        commentPortalAccess = await ctx.db.query.customerPortalAccess.findMany({
          where: (customerPortalAccess) =>
            inArray(customerPortalAccess.id, commentPortalAccessIds),
        });
      }

      // Combine comment data
      const comments = baseComments.map((comment) => ({
        ...comment,
        membership:
          commentMemberships.find((m) => m.id === comment.membership_id) ||
          null,
        customerPortalAccess:
          commentPortalAccess.find(
            (p) => p.id === comment.customer_portal_access_id,
          ) || null,
      }));

      // Check permissions - can the logged-in user edit this ticket?
      const {
        data: { user },
      } = await ctx.supabase.auth.getUser();

      const canEdit =
        // Customer who created the ticket
        ticket.customer_email === user?.email ||
        // Assigned agent
        (assignedTo && assignedTo.user?.email === user?.email);

      return {
        ...ticket,
        assigned_to: assignedTo,
        comments,
        canEdit, // Add permission flag
      };
    }),

  // Update ticket (subject, description, priority)
  updateTicket: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
        subject: z.string().min(1).max(255).optional(),
        description: z.string().min(1).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Get the ticket to check permissions
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId),
          ),
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Check if user has permission to edit
      const {
        data: { user },
      } = await ctx.supabase.auth.getUser();

      // Get assigned membership if exists to check email
      let assignedEmail = null;
      if (ticket.assigned_to_membership_id) {
        const membership = await ctx.db.query.memberships.findFirst({
          where: (memberships, { eq }) =>
            eq(memberships.id, ticket.assigned_to_membership_id!),
        });
        if (membership) {
          const assignedUser = await ctx.db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, membership.user_id),
          });
          assignedEmail = assignedUser?.email;
        }
      }

      const canEdit =
        ticket.customer_email === user?.email || assignedEmail === user?.email;

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this ticket",
        });
      }

      // Build update object
      const updateData: any = {
        updated_at: new Date(),
      };

      if (input.subject !== undefined) updateData.subject = input.subject;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.priority !== undefined) updateData.priority = input.priority;

      // Update the ticket
      await ctx.db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, input.ticketId));

      return { success: true };
    }),

  // Resolve ticket (anyone logged in can resolve)
  resolveTicket: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      });

      // Get the ticket
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId),
          ),
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Anyone with portal access can resolve
      await ctx.db
        .update(tickets)
        .set({
          status: "resolved",
          resolved_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(tickets.id, input.ticketId));

      return { success: true };
    }),
});
