import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "~/server/api/trpc";
import { tickets, users, memberships } from "~/db/schema";
import {
  eq,
  and,
  gte,
  lte,
  count,
  isNotNull,
  desc,
  or,
  sql,
} from "drizzle-orm";

export const dashboardRouter = createTRPCRouter({
  // Get dashboard metrics
  getMetrics: companyProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        clientId: z.string().uuid().optional(),
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

      if (input.clientId) {
        whereConditions.push(eq(tickets.client_id, input.clientId));
      }

      // Total tickets
      const [{ totalTickets }] = await ctx.db
        .select({ totalTickets: count() })
        .from(tickets)
        .where(and(...whereConditions));

      // Tickets by status
      const ticketsByStatus = await ctx.db
        .select({
          status: tickets.status,
          count: count(),
        })
        .from(tickets)
        .where(and(...whereConditions))
        .groupBy(tickets.status);

      // Tickets by priority
      const ticketsByPriority = await ctx.db
        .select({
          priority: tickets.priority,
          count: count(),
        })
        .from(tickets)
        .where(and(...whereConditions))
        .groupBy(tickets.priority);

      // SLA compliance metrics
      const slaMetrics = await ctx.db
        .select({
          totalWithSLA: count(),
          breachedResponse: sql<number>`count(case when ${tickets.sla_response_breach} = true then 1 end)`,
          breachedResolution: sql<number>`count(case when ${tickets.sla_resolution_breach} = true then 1 end)`,
          avgResponseTimeMinutes: sql<number>`
            avg(case
              when ${tickets.first_response_at} is not null
              then extract(epoch from (${tickets.first_response_at} - ${tickets.created_at})) / 60
              else null
            end)
          `,
        })
        .from(tickets)
        .where(and(...whereConditions, isNotNull(tickets.sla_policy_id)));

      // Recent tickets
      const recentTickets = await ctx.db.query.tickets.findMany({
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
        },
        orderBy: (tickets, { desc }) => [desc(tickets.created_at)],
        limit: 10,
      });

      // Top performing agents (by resolved tickets)
      const topAgents = await ctx.db
        .select({
          agentId: tickets.assigned_to_membership_id,
          resolvedCount: count(),
        })
        .from(tickets)
        .innerJoin(
          memberships,
          eq(tickets.assigned_to_membership_id, memberships.id),
        )
        .where(
          and(
            ...whereConditions,
            eq(tickets.status, "resolved"),
            isNotNull(tickets.assigned_to_membership_id),
          ),
        )
        .groupBy(tickets.assigned_to_membership_id)
        .orderBy(desc(count()))
        .limit(5);

      // Get agent details for top performers
      const agentIds = topAgents.map((a) => a.agentId!).filter(Boolean);
      const agentDetails =
        agentIds.length > 0
          ? await ctx.db.query.users.findMany({
              where: (users, { inArray }) => inArray(users.id, agentIds),
              columns: {
                id: true,
                first_name: true,
                last_name: true,
                avatar_url: true,
              },
            })
          : [];

      const topAgentsWithDetails = topAgents.map((agent) => ({
        ...agent,
        agent: agentDetails.find((a) => a.id === agent.agentId),
      }));

      return {
        totalTickets,
        ticketsByStatus,
        ticketsByPriority,
        slaMetrics: slaMetrics[0] || {
          totalWithSLA: 0,
          breachedResponse: 0,
          breachedResolution: 0,
          avgResponseTimeMinutes: 0,
        },
        recentTickets,
        topAgents: topAgentsWithDetails,
      };
    }),

  // Get ticket trends over time
  getTicketTrends: companyProcedure
    .input(
      z.object({
        days: z.number().min(7).max(90).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get daily ticket counts
      const dailyTickets = await ctx.db
        .select({
          date: tickets.created_at,
          count: count(),
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.company_id, ctx.company.id),
            gte(tickets.created_at, startDate),
          ),
        )
        .groupBy(tickets.created_at)
        .orderBy(tickets.created_at);

      // Process data to fill missing dates
      const trendData: { date: string; count: number }[] = [];
      const currentDate = new Date(startDate);
      const endDate = new Date();

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayData = dailyTickets.find(
          (d) => d.date?.toISOString().split("T")[0] === dateStr,
        );

        trendData.push({
          date: dateStr!,
          count: dayData?.count || 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return trendData;
    }),

  // Get agent workload distribution
  getAgentWorkload: companyProcedure.query(async ({ ctx }) => {
    const agentWorkload = await ctx.db
      .select({
        membershipId: memberships.id,
        agentId: users.id,
        firstName: users.first_name,
        lastName: users.last_name,
        avatarUrl: users.avatar_url,
        role: memberships.role,
        totalTickets: count(tickets.id),
        openTickets: sql<number>`count(case when ${tickets.status} = 'open' then ${tickets.id} end)`,
        inProgressTickets: sql<number>`count(case when ${tickets.status} = 'in_progress' then ${tickets.id} end)`,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.user_id))
      .leftJoin(
        tickets,
        and(
          eq(tickets.assigned_to_membership_id, memberships.id),
          eq(tickets.company_id, ctx.company.id),
        ),
      )
      .where(
        and(
          eq(memberships.company_id, ctx.company.id),
          eq(memberships.is_active, true),
          or(eq(memberships.role, "admin"), eq(memberships.role, "agent")),
        ),
      )
      .groupBy(
        memberships.id,
        users.id,
        users.first_name,
        users.last_name,
        users.avatar_url,
        memberships.role,
      )
      .orderBy(desc(count(tickets.id)));

    return agentWorkload;
  }),
});
