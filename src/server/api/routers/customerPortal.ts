import { z } from "zod"
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
import { customerPortalAccess, tickets, ticketComments } from "~/db/schema"
import { eq, inArray, and, or, asc } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import type { db } from "~/db"

// Helper function to verify portal access via Supabase session
async function verifyPortalAccess(
  ctx: { db: typeof db; supabase: any },
  input: { companySlug: string; clientSlug: string }
) {
  // Get the current user session
  const {
    data: { user },
    error: authError,
  } = await ctx.supabase.auth.getUser()

  if (authError || !user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated. Please log in to the customer portal.",
    })
  }

  // Find client by both company slug and client slug
  const clients = await ctx.db.query.clients.findMany({
    where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
    with: {
      company: true,
    },
  })

  const client = clients.find((c) => c.company.slug === input.companySlug)

  // Verify the client exists and portal is enabled
  if (!client || !client.portal_enabled) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Client not found or portal disabled",
    })
  }

  // First, check if user is a team member with access to this company
  const teamMember = await ctx.db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, user.email!),
  })

  if (teamMember) {
    // Check if they have an active membership in the company
    const membership = await ctx.db.query.memberships.findFirst({
      where: (memberships, { and, eq }) =>
        and(
          eq(memberships.user_id, teamMember.id),
          eq(memberships.company_id, client.company.id),
          eq(memberships.is_active, true)
        ),
    })

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
      }
    }
  }

  // If not a team member, check customer portal access
  const access = await ctx.db.query.customerPortalAccess.findFirst({
    where: (customerPortalAccess, { and, eq }) =>
      and(
        eq(customerPortalAccess.client_id, client.id),
        eq(customerPortalAccess.email, user.email!),
        eq(customerPortalAccess.is_active, true)
      ),
  })

  if (!access) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "You don't have access to this customer portal. Please use the correct customer portal login.",
    })
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
  }
}

export const customerPortalRouter = createTRPCRouter({
  // Request OTP for portal access
  requestOTP: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find client by both company slug and client slug
      const clients = await ctx.db.query.clients.findMany({
        where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
        with: {
          company: true,
        },
      })

      const client = clients.find((c) => c.company.slug === input.companySlug)

      if (!client || !client.portal_enabled) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal not found or disabled",
        })
      }

      // Check if this email has portal access
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: (customerPortalAccess, { and, eq }) =>
          and(
            eq(customerPortalAccess.client_id, client.id),
            eq(customerPortalAccess.email, input.email),
            eq(customerPortalAccess.is_active, true)
          ),
      })

      if (!access) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "This email does not have portal access. Please contact support.",
        })
      }

      // Send OTP email using Supabase Auth
      const { error } = await ctx.supabase.auth.signInWithOtp({
        email: input.email,
      })

      if (error) {
        console.error("Failed to send OTP:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send verification code. Please try again.",
        })
      }

      return {
        message: "Verification code sent! Please check your email.",
        email: input.email,
      }
    }),

  // Verify OTP and validate portal access
  verifyOTP: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the client exists and portal is enabled
      const clients = await ctx.db.query.clients.findMany({
        where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
        with: {
          company: true,
        },
      })

      const client = clients.find((c) => c.company.slug === input.companySlug)

      if (!client || !client.portal_enabled) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal not found or disabled",
        })
      }

      // Check if this email has portal access
      const access = await ctx.db.query.customerPortalAccess.findFirst({
        where: (customerPortalAccess, { and, eq }) =>
          and(
            eq(customerPortalAccess.client_id, client.id),
            eq(customerPortalAccess.email, input.email),
            eq(customerPortalAccess.is_active, true)
          ),
      })

      if (!access) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This email does not have portal access.",
        })
      }

      // Update last login time
      await ctx.db
        .update(customerPortalAccess)
        .set({ last_login_at: new Date() })
        .where(eq(customerPortalAccess.id, access.id))

      return {
        message: "Access validated!",
        accessId: access.id,
      }
    }),

  // Verify session access (replaces token verification)
  verifyToken: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
      })
    )
    .mutation(async ({ ctx, input }) => {
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Update last login only for customer portal access (not team members)
      if (!access.isTeamMember && access.portalAccessId) {
        await ctx.db
          .update(customerPortalAccess)
          .set({
            last_login_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(customerPortalAccess.id, access.portalAccessId))
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
      }
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
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      const offset = (input.page - 1) * input.limit

      // Get ALL tickets for this client (not filtered by customer email)
      const baseTickets = await ctx.db.query.tickets.findMany({
        where: (tickets, { eq }) => eq(tickets.client_id, access.clientId),
        limit: input.limit,
        offset,
        orderBy: (tickets, { desc }) => [desc(tickets.created_at)],
      })

      // If no tickets found, return empty array
      if (baseTickets.length === 0) {
        return []
      }

      // Get assigned memberships for tickets that have them
      const membershipIds = baseTickets
        .map((ticket) => ticket.assigned_to_membership_id)
        .filter((id): id is string => id !== null)

      let memberships: any[] = []
      if (membershipIds.length > 0) {
        const baseMemberships = await ctx.db.query.memberships.findMany({
          where: (memberships) => inArray(memberships.id, membershipIds),
        })

        const userIds = baseMemberships.map((m) => m.user_id)
        let users: any[] = []
        if (userIds.length > 0) {
          users = await ctx.db.query.users.findMany({
            where: (users) => inArray(users.id, userIds),
          })
        }

        memberships = baseMemberships.map((membership) => ({
          ...membership,
          user: users.find((u) => u.id === membership.user_id) || null,
        }))
      }

      // Get assigned customer portal accesses for tickets that have them
      const customerPortalAccessIds = baseTickets
        .map((ticket) => ticket.assigned_to_customer_portal_access_id)
        .filter((id): id is string => id !== null)

      let assignedCustomerPortalAccesses: any[] = []
      if (customerPortalAccessIds.length > 0) {
        assignedCustomerPortalAccesses =
          await ctx.db.query.customerPortalAccess.findMany({
            where: (customerPortalAccess) =>
              inArray(customerPortalAccess.id, customerPortalAccessIds),
          })
      }

      const ticketIds = baseTickets.map((ticket) => ticket.id)
      let baseComments: any[] = []
      if (ticketIds.length > 0) {
        try {
          baseComments = await ctx.db
            .select()
            .from(ticketComments)
            .where(
              and(
                inArray(ticketComments.ticket_id, ticketIds),
                eq(ticketComments.is_internal, false)
              )
            )
            .orderBy(asc(ticketComments.created_at))
        } catch (error) {
          console.error("Failed to fetch comments:", error)
          baseComments = []
        }
      }

      const commentMembershipIds = baseComments
        .map((comment) => comment.membership_id)
        .filter((id): id is string => id !== null)

      let commentMemberships: any[] = []
      let commentUsers: any[] = []
      if (commentMembershipIds.length > 0) {
        const baseMemberships = await ctx.db.query.memberships.findMany({
          where: (memberships) => inArray(memberships.id, commentMembershipIds),
        })

        const userIds = baseMemberships.map((m) => m.user_id)
        if (userIds.length > 0) {
          commentUsers = await ctx.db.query.users.findMany({
            where: (users) => inArray(users.id, userIds),
          })
        }

        commentMemberships = baseMemberships.map((membership) => ({
          ...membership,
          user: commentUsers.find((u) => u.id === membership.user_id) || null,
        }))
      }

      // Get customer portal access data for comments that have customer_portal_access_id
      const commentPortalAccessIds = baseComments
        .map((comment) => comment.customer_portal_access_id)
        .filter((id): id is string => id !== null)

      let commentPortalAccess: any[] = []
      if (commentPortalAccessIds.length > 0) {
        commentPortalAccess = await ctx.db.query.customerPortalAccess.findMany({
          where: (customerPortalAccess) =>
            inArray(customerPortalAccess.id, commentPortalAccessIds),
        })
      }

      // Combine comment data
      const comments = baseComments.map((comment) => ({
        ...comment,
        membership:
          commentMemberships.find((m) => m.id === comment.membership_id) ||
          null,
        customerPortalAccess:
          commentPortalAccess.find(
            (p) => p.id === comment.customer_portal_access_id
          ) || null,
      }))

      // Combine the data manually
      const customerTickets = baseTickets.map((ticket) => ({
        ...ticket,
        assignedToMembership:
          memberships.find((m) => m.id === ticket.assigned_to_membership_id) ||
          null,
        assignedToCustomerPortalAccess:
          assignedCustomerPortalAccesses.find(
            (cpa) => cpa.id === ticket.assigned_to_customer_portal_access_id
          ) || null,
        comments: comments.filter((comment) => comment.ticket_id === ticket.id),
      }))

      return customerTickets
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get default SLA policy for the company
      const defaultSLA = await ctx.db.query.slaPolicies.findFirst({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.company_id, access.companyId),
            eq(slaPolicies.is_default, true)
          ),
      })

      // Find a suitable agent to auto-assign (optional)
      const availableAgentMembership = await ctx.db.query.memberships.findFirst(
        {
          where: (memberships, { and, eq }) =>
            and(
              eq(memberships.company_id, access.companyId),
              eq(memberships.role, "agent"),
              eq(memberships.is_active, true)
            ),
          with: {
            user: true,
          },
          orderBy: (memberships, { asc }) => [asc(memberships.joined_at)], // Simple round-robin
        }
      )

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
      }

      const [ticket] = await ctx.db
        .insert(tickets)
        .values(ticketData)
        .returning()

      return ticket
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Verify ticket belongs to this client (not checking customer email)
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId)
          ),
      })

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found or access denied",
        })
      }

      // Get membership_id if this is a team member
      let membershipId = null
      if (access.isTeamMember) {
        const user = await ctx.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, access.customerEmail),
        })
        if (user) {
          const membership = await ctx.db.query.memberships.findFirst({
            where: (memberships, { and, eq }) =>
              and(
                eq(memberships.user_id, user.id),
                eq(memberships.company_id, access.companyId),
                eq(memberships.is_active, true)
              ),
          })
          membershipId = membership?.id || null
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
        .returning()

      // Update ticket to show activity
      await ctx.db
        .update(tickets)
        .set({ updated_at: new Date() })
        .where(eq(tickets.id, input.ticketId))

      return comment
    }),

  // Edit comment (only comment owner can edit)
  editComment: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        commentId: z.string().uuid(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get the comment
      const comment = await ctx.db.query.ticketComments.findFirst({
        where: (ticketComments, { eq }) =>
          eq(ticketComments.id, input.commentId),
        with: {
          ticket: true,
        },
      })

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        })
      }

      // Verify comment belongs to a ticket in this client
      if (comment.ticket.client_id !== access.clientId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        })
      }

      // Check ownership: user must be the comment owner
      let isOwner = false

      if (access.isTeamMember) {
        // If team member, check if they created this comment via membership
        const user = await ctx.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, access.customerEmail),
        })
        if (user) {
          const membership = await ctx.db.query.memberships.findFirst({
            where: (memberships, { and, eq }) =>
              and(
                eq(memberships.user_id, user.id),
                eq(memberships.company_id, access.companyId),
                eq(memberships.is_active, true)
              ),
          })
          isOwner = membership?.id === comment.membership_id
        }
      } else {
        // If portal user, check if they created this comment via portal access
        isOwner =
          access.portalAccessId === comment.customer_portal_access_id &&
          access.portalAccessId !== null
      }

      if (!isOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the comment owner can edit this comment",
        })
      }

      // Get the editor's ID (membership or portal access)
      let editorMembershipId = null
      let editorPortalAccessId = null

      if (access.isTeamMember) {
        const user = await ctx.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, access.customerEmail),
        })
        if (user) {
          const membership = await ctx.db.query.memberships.findFirst({
            where: (memberships, { and, eq }) =>
              and(
                eq(memberships.user_id, user.id),
                eq(memberships.company_id, access.companyId),
                eq(memberships.is_active, true)
              ),
          })
          editorMembershipId = membership?.id || null
        }
      } else {
        editorPortalAccessId = access.portalAccessId
      }

      // Update the comment with edit tracking
      const [updatedComment] = await ctx.db
        .update(ticketComments)
        .set({
          content: input.content,
          updated_at: new Date(),
          edited_at: new Date(),
          edited_by_membership_id: editorMembershipId,
          edited_by_customer_portal_access_id: editorPortalAccessId,
        })
        .where(eq(ticketComments.id, input.commentId))
        .returning()

      return updatedComment
    }),

  // Get customer portal knowledge base
  getKnowledgeBase: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // First get the client to find the company
      const client = await ctx.db.query.clients.findFirst({
        where: (clients, { eq }) => eq(clients.slug, input.clientSlug),
        with: {
          company: true,
        },
      })

      if (
        !client ||
        client.company.slug !== input.companySlug ||
        !client.portal_enabled
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found or portal disabled",
        })
      }

      // Get published knowledge base articles for the client's company
      const articles = await ctx.db.query.knowledgeBase.findMany({
        where: (knowledgeBase, { and, eq, ilike }) => {
          const conditions = [
            eq(knowledgeBase.company_id, client.company.id),
            eq(knowledgeBase.is_published, true),
            eq(knowledgeBase.is_public, true),
          ]

          if (input.search) {
            conditions.push(ilike(knowledgeBase.title, `%${input.search}%`))
          }

          return and(...conditions)
        },
        limit: input.limit,
        orderBy: (knowledgeBase, { desc }) => [desc(knowledgeBase.created_at)],
      })

      return articles
    }),

  // Get SLA metrics for customer portal
  getSLAMetrics: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        accessToken: z.string().optional(), // Kept for backwards compatibility, but not used
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get ALL tickets for this client with SLA data
      const customerTickets = await ctx.db.query.tickets.findMany({
        where: (tickets, { eq }) => eq(tickets.client_id, access.clientId),
        with: {
          slaPolicy: true,
        },
      })

      // Calculate SLA metrics
      const totalTickets = customerTickets.length
      const resolvedTickets = customerTickets.filter(
        (t) => t.status === "resolved" || t.status === "closed"
      )

      // Response time SLA compliance
      const ticketsWithResponseSLA = customerTickets.filter(
        (t) =>
          t.first_response_at && t.slaPolicy && t.sla_response_breach === false
      )

      // Resolution time SLA compliance
      const ticketsWithResolutionSLA = resolvedTickets.filter(
        (t) => t.resolved_at && t.slaPolicy && t.sla_resolution_breach === false
      )

      // Average response time (in hours)
      const responseTimesInHours = customerTickets
        .filter((t) => t.first_response_at)
        .map((t) => {
          const created = new Date(t.created_at)
          const responded = new Date(t.first_response_at!)
          return (responded.getTime() - created.getTime()) / (1000 * 60 * 60)
        })

      const avgResponseTime =
        responseTimesInHours.length > 0
          ? responseTimesInHours.reduce((a, b) => a + b, 0) /
            responseTimesInHours.length
          : 0

      // Average resolution time (in hours)
      const resolutionTimesInHours = resolvedTickets
        .filter((t) => t.resolved_at)
        .map((t) => {
          const created = new Date(t.created_at)
          const resolved = new Date(t.resolved_at!)
          return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
        })

      const avgResolutionTime =
        resolutionTimesInHours.length > 0
          ? resolutionTimesInHours.reduce((a, b) => a + b, 0) /
            resolutionTimesInHours.length
          : 0

      // Status breakdown
      const statusBreakdown = {
        open: customerTickets.filter((t) => t.status === "open").length,
        in_progress: customerTickets.filter((t) => t.status === "in_progress")
          .length,
        resolved: customerTickets.filter((t) => t.status === "resolved").length,
        closed: customerTickets.filter((t) => t.status === "closed").length,
      }

      // Priority breakdown
      const priorityBreakdown = {
        low: customerTickets.filter((t) => t.priority === "low").length,
        medium: customerTickets.filter((t) => t.priority === "medium").length,
        high: customerTickets.filter((t) => t.priority === "high").length,
        urgent: customerTickets.filter((t) => t.priority === "urgent").length,
      }

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
      }
    }),

  // Get a single ticket by ID
  getTicketById: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get the specific ticket
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId)
          ),
      })

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        })
      }

      // Get assigned membership if exists
      let assignedTo = null
      if (ticket.assigned_to_membership_id) {
        const membership = await ctx.db.query.memberships.findFirst({
          where: (memberships, { eq }) =>
            eq(memberships.id, ticket.assigned_to_membership_id!),
        })

        if (membership) {
          const user = await ctx.db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, membership.user_id),
          })

          assignedTo = {
            ...membership,
            user: user || null,
          }
        }
      }

      // Get assigned customer portal access if exists
      let assignedToCustomerPortalAccess = null
      if (ticket.assigned_to_customer_portal_access_id) {
        assignedToCustomerPortalAccess =
          await ctx.db.query.customerPortalAccess.findFirst({
            where: (customerPortalAccess, { eq }) =>
              eq(
                customerPortalAccess.id,
                ticket.assigned_to_customer_portal_access_id!
              ),
          })
      }

      // Get created by membership if exists
      let createdBy = null
      if (ticket.created_by_membership_id) {
        const membership = await ctx.db.query.memberships.findFirst({
          where: (memberships, { eq }) =>
            eq(memberships.id, ticket.created_by_membership_id!),
        })

        if (membership) {
          const user = await ctx.db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, membership.user_id),
          })

          createdBy = {
            ...membership,
            user: user || null,
          }
        }
      }

      // Get comments for this ticket
      const baseComments = await ctx.db.query.ticketComments.findMany({
        where: (ticketComments, { eq }) =>
          eq(ticketComments.ticket_id, input.ticketId),
        orderBy: (ticketComments, { asc }) => [asc(ticketComments.created_at)],
      })

      // Get membership info for comments
      const commentMembershipIds = baseComments
        .map((comment) => comment.membership_id)
        .filter((id): id is string => id !== null)

      let commentMemberships: any[] = []
      let commentUsers: any[] = []
      if (commentMembershipIds.length > 0) {
        const baseMemberships = await ctx.db.query.memberships.findMany({
          where: (memberships) => inArray(memberships.id, commentMembershipIds),
        })

        const userIds = baseMemberships.map((m) => m.user_id)
        if (userIds.length > 0) {
          commentUsers = await ctx.db.query.users.findMany({
            where: (users) => inArray(users.id, userIds),
          })
        }

        commentMemberships = baseMemberships.map((membership) => ({
          ...membership,
          user: commentUsers.find((u) => u.id === membership.user_id) || null,
        }))
      }

      // Get customer portal access data for comments
      const commentPortalAccessIds = baseComments
        .map((comment) => comment.customer_portal_access_id)
        .filter((id): id is string => id !== null)

      let commentPortalAccess: any[] = []
      if (commentPortalAccessIds.length > 0) {
        commentPortalAccess = await ctx.db.query.customerPortalAccess.findMany({
          where: (customerPortalAccess) =>
            inArray(customerPortalAccess.id, commentPortalAccessIds),
        })
      }

      // Get current user's membership if they are a team member
      let currentUserMembershipId = null
      if (access.isTeamMember) {
        const currentUser = await ctx.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, access.customerEmail),
        })
        if (currentUser) {
          const currentUserMembership =
            await ctx.db.query.memberships.findFirst({
              where: (memberships, { and, eq }) =>
                and(
                  eq(memberships.user_id, currentUser.id),
                  eq(memberships.company_id, access.companyId),
                  eq(memberships.is_active, true)
                ),
            })
          currentUserMembershipId = currentUserMembership?.id || null
        }
      }

      // Combine comment data with canEdit permission
      const comments = baseComments.map((comment) => {
        // Check if current user can edit this comment (they must be the owner)
        let canEditComment = false
        if (access.isTeamMember) {
          // Team member can edit if they created the comment
          canEditComment = currentUserMembershipId === comment.membership_id
        } else {
          // Portal user can edit if they created the comment
          canEditComment =
            access.portalAccessId === comment.customer_portal_access_id &&
            access.portalAccessId !== null
        }

        return {
          ...comment,
          membership:
            commentMemberships.find((m) => m.id === comment.membership_id) ||
            null,
          customerPortalAccess:
            commentPortalAccess.find(
              (p) => p.id === comment.customer_portal_access_id
            ) || null,
          canEdit: canEditComment,
        }
      })

      // Get form submission if ticket was created from a form
      let formSubmission = null
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
        })
      }

      // Everyone in the customer portal can edit tickets
      const canEdit = true

      // Check if user can unresolve the ticket
      // All company users (team members) can unresolve, or ticket owner can unresolve
      let canUnresolve = false
      if (access.isTeamMember) {
        canUnresolve = true // All company users can unresolve
      } else {
        // Portal users can unresolve only if they are the ticket owner
        canUnresolve = ticket.customer_email === access.customerEmail
      }

      return {
        ...ticket,
        assigned_to: assignedTo,
        assigned_to_customer_portal_access: assignedToCustomerPortalAccess,
        created_by: createdBy,
        comments,
        formSubmission,
        canEdit, // Add permission flag
        canUnresolve, // Add unresolve permission flag
        isTeamMember: access.isTeamMember, // Add team member flag
      }
    }),

  // Update ticket (subject, description, priority, assignee)
  updateTicket: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
        subject: z.string().min(1).max(255).optional(),
        description: z.string().min(1).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assigned_to_membership_id: z.string().uuid().nullable().optional(),
        assigned_to_customer_portal_access_id: z
          .string()
          .uuid()
          .nullable()
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get the ticket
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId)
          ),
      })

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        })
      }

      // Everyone in the customer portal can edit tickets
      // No permission check needed - just verify they have portal access (already done above)

      // Build update object
      const updateData: any = {
        updated_at: new Date(),
      }

      if (input.subject !== undefined) updateData.subject = input.subject
      if (input.description !== undefined)
        updateData.description = input.description
      if (input.priority !== undefined) updateData.priority = input.priority

      // Handle assignment - membership and customer portal access are mutually exclusive
      if (input.assigned_to_membership_id !== undefined) {
        updateData.assigned_to_membership_id = input.assigned_to_membership_id
        // Clear customer portal access assignment
        updateData.assigned_to_customer_portal_access_id = null
      }
      if (input.assigned_to_customer_portal_access_id !== undefined) {
        updateData.assigned_to_customer_portal_access_id =
          input.assigned_to_customer_portal_access_id
        // Clear membership assignment
        updateData.assigned_to_membership_id = null
      }

      // Update the ticket
      await ctx.db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, input.ticketId))

      return { success: true }
    }),

  // Resolve ticket (anyone logged in can resolve)
  resolveTicket: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get the ticket
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId)
          ),
      })

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        })
      }

      // Anyone with portal access can resolve
      await ctx.db
        .update(tickets)
        .set({
          status: "resolved",
          resolved_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(tickets.id, input.ticketId))

      return { success: true }
    }),

  // Unresolve ticket (ticket owner or any company user can unresolve)
  unresolveTicket: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        ticketId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get the ticket
      const ticket = await ctx.db.query.tickets.findFirst({
        where: (tickets, { and, eq }) =>
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.client_id, access.clientId)
          ),
      })

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        })
      }

      // Check permissions: all company users can unresolve, or ticket owner
      let canUnresolve = false

      // All company users (team members) can unresolve
      if (access.isTeamMember) {
        canUnresolve = true
      } else {
        // Portal users can only unresolve if they are the ticket owner
        // Check if ticket was created by this portal user
        const ticketCreatorAccess =
          await ctx.db.query.customerPortalAccess.findFirst({
            where: (customerPortalAccess, { and, eq }) =>
              and(
                eq(customerPortalAccess.id, access.portalAccessId!),
                eq(customerPortalAccess.email, ticket.customer_email!)
              ),
          })

        canUnresolve = !!ticketCreatorAccess
      }

      if (!canUnresolve) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the ticket owner or company users can unresolve this ticket",
        })
      }

      // Unresolve the ticket (set status back to in_progress)
      await ctx.db
        .update(tickets)
        .set({
          status: "in_progress",
          resolved_at: null,
          updated_at: new Date(),
        })
        .where(eq(tickets.id, input.ticketId))

      return { success: true }
    }),

  // Get available team members for assignment
  getTeamMembers: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get all active memberships for the company (agents, admins, and owners)
      const memberships = await ctx.db.query.memberships.findMany({
        where: (memberships, { and, eq, or }) =>
          and(
            eq(memberships.company_id, access.companyId),
            eq(memberships.is_active, true),
            or(
              eq(memberships.role, "agent"),
              eq(memberships.role, "admin"),
              eq(memberships.role, "owner")
            )
          ),
      })

      // Get user details for these memberships
      const userIds = memberships.map((m) => m.user_id)
      let users: any[] = []
      if (userIds.length > 0) {
        users = await ctx.db.query.users.findMany({
          where: (users) => inArray(users.id, userIds),
        })
      }

      // Combine and return
      return memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        user: users.find((u) => u.id === membership.user_id) || null,
      }))
    }),

  // Get all customer portal accesses for the client
  getAllPortalAccess: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get all active customer portal accesses for the client
      const portalAccesses = await ctx.db.query.customerPortalAccess.findMany({
        where: (customerPortalAccess, { and, eq }) =>
          and(
            eq(customerPortalAccess.client_id, access.clientId),
            eq(customerPortalAccess.is_active, true)
          ),
        with: {
          client: {
            columns: { id: true, name: true, slug: true },
          },
        },
        orderBy: (portalAccess, { desc }) => [desc(portalAccess.created_at)],
      })

      return portalAccesses
    }),

  // Get forms available for this client
  getForms: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get forms for this specific client only
      const clientForms = await ctx.db.query.forms.findMany({
        where: (forms, { and, eq }) =>
          and(
            eq(forms.company_id, access.companyId),
            eq(forms.is_published, true),
            eq(forms.client_id, access.clientId)
          ),
        orderBy: (forms, { desc }) => [desc(forms.created_at)],
      })

      return clientForms
    }),

  // Get form submissions for this client
  getFormSubmissions: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
        formId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      const { formSubmissions } = await import("~/db/schema")
      const { count } = await import("drizzle-orm")

      const offset = (input.page - 1) * input.limit

      // Get forms for this specific client only
      const clientForms = await ctx.db.query.forms.findMany({
        where: (forms, { and, eq }) =>
          and(
            eq(forms.company_id, access.companyId),
            eq(forms.client_id, access.clientId)
          ),
      })

      const formIds = clientForms.map((f) => f.id)

      if (formIds.length === 0) {
        return {
          submissions: [],
          total: 0,
          page: input.page,
          limit: input.limit,
        }
      }

      // Get submissions for these forms
      const submissions = await ctx.db.query.formSubmissions.findMany({
        where: (formSubmissions, { and, eq, or }) => {
          const conditions: any[] = [inArray(formSubmissions.form_id, formIds)]

          // Only apply "my submissions" filter for client portal users, not team members
          if (!access.isTeamMember) {
            // Client portal users only see their own submissions
            const userFilters = []
            if (access.portalAccessId) {
              userFilters.push(
                eq(
                  formSubmissions.submitted_by_customer_portal_access_id,
                  access.portalAccessId
                )
              )
            }
            userFilters.push(
              eq(formSubmissions.submitted_by_email, access.customerEmail)
            )
            conditions.push(or(...userFilters))
          }
          // Team members can see all submissions for this client (no additional filter needed)

          // Add form filter if specified
          if (input.formId) {
            conditions.push(eq(formSubmissions.form_id, input.formId))
          }

          return and(...conditions)
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
          ticket: {
            columns: {
              id: true,
              subject: true,
              status: true,
              priority: true,
            },
          },
        },
        limit: input.limit,
        offset,
        orderBy: (formSubmissions, { desc }) => [
          desc(formSubmissions.submitted_at),
        ],
      })

      // Get total count
      const countConditions: any[] = [inArray(formSubmissions.form_id, formIds)]

      // Only apply "my submissions" filter for client portal users, not team members
      if (!access.isTeamMember) {
        // Client portal users only see their own submissions
        const userFilters = []
        if (access.portalAccessId) {
          userFilters.push(
            eq(
              formSubmissions.submitted_by_customer_portal_access_id,
              access.portalAccessId
            )
          )
        }
        userFilters.push(
          eq(formSubmissions.submitted_by_email, access.customerEmail)
        )
        countConditions.push(or(...userFilters))
      }
      // Team members can see all submissions for this client (no additional filter needed)

      // Add form filter if specified
      if (input.formId) {
        countConditions.push(eq(formSubmissions.form_id, input.formId))
      }

      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(formSubmissions)
        .where(and(...countConditions))

      return {
        submissions,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      }
    }),

  // Create a ticket from a form submission
  createTicketFromSubmission: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        submissionId: z.string().uuid(),
        subject: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Import schemas
      const { formSubmissions } = await import("~/db/schema")

      // Get the submission
      const submission = await ctx.db.query.formSubmissions.findFirst({
        where: (formSubmissions, { and, eq }) =>
          and(
            eq(formSubmissions.id, input.submissionId),
            eq(formSubmissions.company_id, access.companyId)
          ),
        with: {
          form: true,
        },
      })

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        })
      }

      if (submission.ticket_id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A ticket has already been created for this submission",
        })
      }

      const [ticket] = await ctx.db
        .insert(tickets)
        .values({
          company_id: submission.company_id,
          client_id: submission.form.client_id,
          subject: input.subject || `Form submission: ${submission.form.name}`,
          description: `Created from form submission: ${submission.form.name}`,
          priority: input.priority || "medium",
          status: "open",
          customer_email: submission.submitted_by_email,
          customer_name: submission.submitted_by_name,
          assigned_to_customer_portal_access_id:
            submission.submitted_by_customer_portal_access_id,
          external_id: submission.id,
          external_type: "form_submission",
        })
        .returning()

      // Update submission with ticket reference
      await ctx.db
        .update(formSubmissions)
        .set({
          ticket_id: ticket.id,
          ticket_created: true,
          updated_at: new Date(),
        })
        .where(eq(formSubmissions.id, input.submissionId))

      return ticket
    }),

  // Download form submissions as CSV
  downloadSubmissionsCSV: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        clientSlug: z.string(),
        formId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify access first
      const access = await verifyPortalAccess(ctx, {
        companySlug: input.companySlug,
        clientSlug: input.clientSlug,
      })

      // Get the form
      const form = await ctx.db.query.forms.findFirst({
        where: (forms, { and, eq }) =>
          and(
            eq(forms.id, input.formId),
            eq(forms.company_id, access.companyId),
            eq(forms.client_id, access.clientId)
          ),
      })

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        })
      }

      // Get all submissions for this form from this user
      const submissions = await ctx.db.query.formSubmissions.findMany({
        where: (formSubmissions, { and, eq, or }) =>
          and(
            eq(formSubmissions.form_id, input.formId),
            or(
              eq(
                formSubmissions.submitted_by_customer_portal_access_id,
                access.portalAccessId!
              ),
              eq(formSubmissions.submitted_by_email, access.customerEmail)
            )
          ),
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
        orderBy: (formSubmissions, { desc }) => [
          desc(formSubmissions.submitted_at),
        ],
      })

      // Build CSV
      const fields = (form.fields as any[]) || []
      const headers = [
        "Submitted At",
        "Submitted By",
        ...fields.map((f) => f.label),
        "Description",
        "External ID",
        "External Type",
      ]

      const rows = submissions.map((submission) => {
        const row = [
          new Date(submission.submitted_at).toLocaleString(),
          submission.submitted_by_name || submission.submitted_by_email,
          ...fields.map((field) => {
            const value = (submission.data as any)?.[field.id]
            if (Array.isArray(value)) return value.join(", ")
            return value || ""
          }),
          submission.description || "",
          submission.external_id || "",
          submission.external_type || "",
        ]
        return row
      })

      // Convert to CSV string with proper formatting
      const csvRows = [headers, ...rows]
      const csvContent = csvRows
        .map((row) =>
          row
            .map((cell) => {
              // Convert to string and escape quotes
              const cellValue = String(cell ?? "").replace(/"/g, '""')
              // Always quote cells to handle special characters
              return `"${cellValue}"`
            })
            .join(",")
        )
        .join("\r\n") // Use Windows-style line endings for better compatibility

      // Add BOM for Excel UTF-8 compatibility
      return "\uFEFF" + csvContent
    }),
})
