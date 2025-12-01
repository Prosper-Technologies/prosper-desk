import { z } from "zod"
import {
  createTRPCRouter,
  adminCompanyProcedure,
  companyProcedure,
} from "~/server/api/trpc"
import { companies, slaPolicies, escalationPolicies } from "~/db/schema"
import { eq } from "drizzle-orm"

export const companyRouter = createTRPCRouter({
  // Get company settings
  getSettings: companyProcedure.query(async ({ ctx }) => {
    return ctx.company
  }),

  // Update company settings (admin only)
  updateSettings: adminCompanyProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        logoUrl: z.string().url().optional(),
        primaryColor: z
          .string()
          .regex(/^#[0-9A-F]{6}$/i)
          .optional(),
        settings: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, any> = {}

      if (input.name) updateData.name = input.name
      if (input.logoUrl) updateData.logo_url = input.logoUrl
      if (input.primaryColor) updateData.primary_color = input.primaryColor
      if (input.settings) updateData.settings = input.settings

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date()

        const [updatedCompany] = await ctx.db
          .update(companies)
          .set(updateData)
          .where(eq(companies.id, ctx.company.id))
          .returning()

        return updatedCompany
      }

      return ctx.company
    }),

  // Get SLA policies
  getSLAPolicies: companyProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.slaPolicies.findMany({
      where: (slaPolicies, { eq }) =>
        eq(slaPolicies.company_id, ctx.company.id),
      orderBy: (slaPolicies, { asc }) => [asc(slaPolicies.priority)],
    })
  }),

  // Create SLA policy (admin only)
  createSLAPolicy: adminCompanyProcedure
    .input(
      z.object({
        name: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        responseTimeMinutes: z.number().min(1),
        resolutionTimeMinutes: z.number().min(1),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If this is set as default, remove default from others
      if (input.isDefault) {
        await ctx.db
          .update(slaPolicies)
          .set({ is_default: false, updated_at: new Date() })
          .where(eq(slaPolicies.company_id, ctx.company.id))
      }

      const [slaPolicy] = await ctx.db
        .insert(slaPolicies)
        .values({
          company_id: ctx.company.id,
          name: input.name,
          priority: input.priority,
          response_time_minutes: input.responseTimeMinutes,
          resolution_time_minutes: input.resolutionTimeMinutes,
          is_default: input.isDefault,
        })
        .returning()

      return slaPolicy
    }),

  // Update SLA policy (admin only)
  updateSLAPolicy: adminCompanyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        responseTimeMinutes: z.number().min(1).optional(),
        resolutionTimeMinutes: z.number().min(1).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, any> = {}

      if (input.name) updateData.name = input.name
      if (input.responseTimeMinutes)
        updateData.response_time_minutes = input.responseTimeMinutes
      if (input.resolutionTimeMinutes)
        updateData.resolution_time_minutes = input.resolutionTimeMinutes
      if (typeof input.isDefault === "boolean") {
        updateData.is_default = input.isDefault

        // If setting as default, remove default from others
        if (input.isDefault) {
          await ctx.db
            .update(slaPolicies)
            .set({ is_default: false, updated_at: new Date() })
            .where(eq(slaPolicies.company_id, ctx.company.id))
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date()

        const [updatedSLA] = await ctx.db
          .update(slaPolicies)
          .set(updateData)
          .where(eq(slaPolicies.id, input.id))
          .returning()

        return updatedSLA
      }

      return null
    }),

  // Get escalation policies
  getEscalationPolicies: companyProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.escalationPolicies.findMany({
      where: (escalationPolicies, { eq }) =>
        eq(escalationPolicies.company_id, ctx.company.id),
      orderBy: (escalationPolicies, { desc }) => [
        desc(escalationPolicies.created_at),
      ],
    })
  }),

  // Create escalation policy (admin only)
  createEscalationPolicy: adminCompanyProcedure
    .input(
      z.object({
        name: z.string().min(1),
        escalationRules: z.array(
          z.object({
            level: z.number().min(1),
            timeoutMinutes: z.number().min(1),
            assignToUserId: z.string().uuid().optional(),
            assignToRole: z.enum(["admin", "agent"]).optional(),
            notifyEmails: z.array(z.string().email()).optional(),
          })
        ),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [escalationPolicy] = await ctx.db
        .insert(escalationPolicies)
        .values({
          company_id: ctx.company.id,
          name: input.name,
          escalation_rules: input.escalationRules,
          is_active: input.isActive,
        })
        .returning()

      return escalationPolicy
    }),

  // Delete company (owner only) - this will cascade delete all related data
  deleteCompany: adminCompanyProcedure
    .input(
      z.object({
        confirmSlug: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the user is the owner
      if (ctx.membership.role !== "owner") {
        throw new Error("Only the company owner can delete the organization")
      }

      // Verify the slug matches for safety
      if (input.confirmSlug !== ctx.company.slug) {
        throw new Error(
          "Company slug does not match. Please confirm the deletion."
        )
      }

      // Delete the company (cascade will handle all related records)
      await ctx.db.delete(companies).where(eq(companies.id, ctx.company.id))

      return { success: true }
    }),
})
