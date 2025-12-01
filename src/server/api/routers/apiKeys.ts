import { z } from "zod"
import { createTRPCRouter, companyProcedure } from "~/server/api/trpc"
import { apiKeys } from "~/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { generateApiKey } from "~/lib/auth-api"

export const apiKeysRouter = createTRPCRouter({
  // Get all API keys for the company
  getAll: companyProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.query.apiKeys.findMany({
      where: eq(apiKeys.company_id, ctx.company.id),
      orderBy: [desc(apiKeys.created_at)],
      columns: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        last_used_at: true,
        expires_at: true,
        is_active: true,
        created_at: true,
      },
    })

    return keys
  }),

  // Create new API key
  create: companyProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        permissions: z.array(z.string()).default([]),
        expires_at: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { key, id } = await generateApiKey(
        ctx.company.id,
        input.name,
        input.permissions,
        input.expires_at
      )

      // Return the full key only once (on creation)
      const apiKeyRecord = await ctx.db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, id),
        columns: {
          id: true,
          name: true,
          prefix: true,
          permissions: true,
          expires_at: true,
          is_active: true,
          created_at: true,
        },
      })

      return {
        ...apiKeyRecord,
        key, // Full key only shown on creation
      }
    }),

  // Update API key (name, permissions, expiration)
  update: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        permissions: z.array(z.string()).optional(),
        expires_at: z.date().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the API key belongs to the company
      const existingKey = await ctx.db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.id),
          eq(apiKeys.company_id, ctx.company.id)
        ),
      })

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        })
      }

      const updateData: Record<string, any> = {}

      if (input.name) updateData.name = input.name
      if (input.permissions) updateData.permissions = input.permissions
      if (input.expires_at !== undefined)
        updateData.expires_at = input.expires_at
      if (input.is_active !== undefined) updateData.is_active = input.is_active

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date()

        const [updatedKey] = await ctx.db
          .update(apiKeys)
          .set(updateData)
          .where(eq(apiKeys.id, input.id))
          .returning({
            id: apiKeys.id,
            name: apiKeys.name,
            prefix: apiKeys.prefix,
            permissions: apiKeys.permissions,
            last_used_at: apiKeys.last_used_at,
            expires_at: apiKeys.expires_at,
            is_active: apiKeys.is_active,
            created_at: apiKeys.created_at,
            updated_at: apiKeys.updated_at,
          })

        return updatedKey
      }

      return {
        id: existingKey.id,
        name: existingKey.name,
        prefix: existingKey.prefix,
        permissions: existingKey.permissions,
        last_used_at: existingKey.last_used_at,
        expires_at: existingKey.expires_at,
        is_active: existingKey.is_active,
        created_at: existingKey.created_at,
        updated_at: existingKey.updated_at,
      }
    }),

  // Delete API key
  delete: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the API key belongs to the company
      const existingKey = await ctx.db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.id),
          eq(apiKeys.company_id, ctx.company.id)
        ),
      })

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        })
      }

      await ctx.db.delete(apiKeys).where(eq(apiKeys.id, input.id))

      return { success: true }
    }),
})
