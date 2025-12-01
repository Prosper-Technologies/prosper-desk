import { z } from "zod";
import {
  createTRPCRouter,
  adminCompanyProcedure,
  companyProcedure,
} from "~/server/api/trpc";
import { slaPolicies } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const slaRouter = createTRPCRouter({
  // Get SLA policies for a specific client
  getByClient: companyProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // First verify the client belongs to the company
      const client = await ctx.db.query.clients.findFirst({
        where: (clients, { and, eq }) =>
          and(
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

      return await ctx.db.query.slaPolicies.findMany({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.company_id, ctx.company.id),
            eq(slaPolicies.client_id, input.clientId),
          ),
        orderBy: (slaPolicies, { asc, desc }) => [
          desc(slaPolicies.is_default),
          asc(slaPolicies.priority),
        ],
      });
    }),

  // Get a single SLA policy by ID
  getById: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const slaPolicy = await ctx.db.query.slaPolicies.findFirst({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.id, input.id),
            eq(slaPolicies.company_id, ctx.company.id),
          ),
        with: {
          client: true,
        },
      });

      if (!slaPolicy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "SLA policy not found",
        });
      }

      return slaPolicy;
    }),

  // Create client-specific SLA policy (admin only)
  create: adminCompanyProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        name: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        responseTimeMinutes: z.number().min(1),
        resolutionTimeMinutes: z.number().min(1),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the client belongs to the company
      const client = await ctx.db.query.clients.findFirst({
        where: (clients, { and, eq }) =>
          and(
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

      // If this is set as default for the client, remove default from others for this client
      if (input.isDefault) {
        await ctx.db
          .update(slaPolicies)
          .set({ is_default: false, updated_at: new Date() })
          .where(
            and(
              eq(slaPolicies.company_id, ctx.company.id),
              eq(slaPolicies.client_id, input.clientId),
            ),
          );
      }

      const [slaPolicy] = await ctx.db
        .insert(slaPolicies)
        .values({
          company_id: ctx.company.id,
          client_id: input.clientId,
          name: input.name,
          priority: input.priority,
          response_time_minutes: input.responseTimeMinutes,
          resolution_time_minutes: input.resolutionTimeMinutes,
          is_default: input.isDefault,
        })
        .returning();

      return slaPolicy;
    }),

  // Update SLA policy (admin only)
  update: adminCompanyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        responseTimeMinutes: z.number().min(1).optional(),
        resolutionTimeMinutes: z.number().min(1).optional(),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the SLA policy belongs to the company
      const existingSLA = await ctx.db.query.slaPolicies.findFirst({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.id, input.id),
            eq(slaPolicies.company_id, ctx.company.id),
          ),
      });

      if (!existingSLA) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "SLA policy not found",
        });
      }

      const updateData: Record<string, any> = {};

      if (input.name) updateData.name = input.name;
      if (input.priority) updateData.priority = input.priority;
      if (input.responseTimeMinutes)
        updateData.response_time_minutes = input.responseTimeMinutes;
      if (input.resolutionTimeMinutes)
        updateData.resolution_time_minutes = input.resolutionTimeMinutes;

      if (typeof input.isDefault === "boolean") {
        updateData.is_default = input.isDefault;

        // If setting as default, remove default from others for this client
        if (input.isDefault && existingSLA.client_id) {
          await ctx.db
            .update(slaPolicies)
            .set({ is_default: false, updated_at: new Date() })
            .where(
              and(
                eq(slaPolicies.company_id, ctx.company.id),
                eq(slaPolicies.client_id, existingSLA.client_id),
              ),
            );
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();

        const [updatedSLA] = await ctx.db
          .update(slaPolicies)
          .set(updateData)
          .where(eq(slaPolicies.id, input.id))
          .returning();

        return updatedSLA;
      }

      return existingSLA;
    }),

  // Delete SLA policy (admin only)
  delete: adminCompanyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the SLA policy belongs to the company
      const existingSLA = await ctx.db.query.slaPolicies.findFirst({
        where: (slaPolicies, { and, eq }) =>
          and(
            eq(slaPolicies.id, input.id),
            eq(slaPolicies.company_id, ctx.company.id),
          ),
      });

      if (!existingSLA) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "SLA policy not found",
        });
      }

      await ctx.db.delete(slaPolicies).where(eq(slaPolicies.id, input.id));

      return { success: true };
    }),
});
