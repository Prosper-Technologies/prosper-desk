import { z } from "zod";
import {
  companyProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { knowledgeBase } from "~/db/schema";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const knowledgeBaseRouter = createTRPCRouter({
  // Get all articles (internal - shows unpublished for admins/agents)
  getAll: companyProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
        search: z.string().optional(),
        isPublished: z.boolean().optional(),
        authorId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const whereConditions = [eq(knowledgeBase.company_id, ctx.company.id)];

      // For non-admins, only show published articles or their own
      if (
        !ctx.user.memberships.some((membership) => membership.role === "admin")
      ) {
        whereConditions.push(
          or(
            eq(knowledgeBase.is_published, true),
            eq(knowledgeBase.author_membership_id, ctx.membership.id),
          )!,
        );
      }

      if (typeof input.isPublished === "boolean") {
        whereConditions.push(eq(knowledgeBase.is_published, input.isPublished));
      }

      if (input.authorId) {
        whereConditions.push(
          eq(knowledgeBase.author_membership_id, input.authorId),
        );
      }

      if (input.search) {
        whereConditions.push(
          or(
            ilike(knowledgeBase.title, `%${input.search}%`),
            ilike(knowledgeBase.content, `%${input.search}%`),
          )!,
        );
      }

      // Get total count
      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(knowledgeBase)
        .where(and(...whereConditions));

      // Get articles
      const articles = await ctx.db.query.knowledgeBase.findMany({
        where: and(...whereConditions),
        limit: input.limit,
        offset,
        orderBy: (knowledgeBase, { desc }) => [desc(knowledgeBase.updated_at)],
      });

      return {
        articles,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get published articles (public - for customer portal)
  getPublished: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // First find company by slug
      const company = await ctx.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.slug, input.companySlug),
      });

      if (!company) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Company not found",
        });
      }

      const offset = (input.page - 1) * input.limit;

      const whereConditions = [
        eq(knowledgeBase.company_id, company.id),
        eq(knowledgeBase.is_published, true),
        eq(knowledgeBase.is_public, true),
      ];

      if (input.search) {
        whereConditions.push(
          or(
            ilike(knowledgeBase.title, `%${input.search}%`),
            ilike(knowledgeBase.content, `%${input.search}%`),
          )!,
        );
      }

      const articles = await ctx.db.query.knowledgeBase.findMany({
        where: and(...whereConditions),
        columns: {
          id: true,
          title: true,
          slug: true,
          content: true,
          view_count: true,
          tags: true,
          created_at: true,
          updated_at: true,
        },
        limit: input.limit,
        offset,
        orderBy: (knowledgeBase, { desc }) => [desc(knowledgeBase.view_count)],
      });

      return articles;
    }),

  // Get single article by slug (internal)
  getBySlugInternal: companyProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.query.knowledgeBase.findFirst({
        where: (knowledgeBase, { and, eq }) =>
          and(
            eq(knowledgeBase.slug, input.slug),
            eq(knowledgeBase.company_id, ctx.company.id),
          ),
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Check if user can view this article
      if (
        !article.is_published &&
        article.author_membership_id !== ctx.membership.id &&
        !ctx.user.memberships.some((membership) => membership.role === "admin")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this article",
        });
      }

      return article;
    }),

  // Get single article by ID
  getById: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.query.knowledgeBase.findFirst({
        where: (knowledgeBase, { and, eq }) =>
          and(
            eq(knowledgeBase.id, input.id),
            eq(knowledgeBase.company_id, ctx.company.id),
          ),
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Check if user can view this article
      if (
        !article.is_published &&
        article.author_membership_id !== ctx.membership.id &&
        !ctx.user.memberships.some((membership) => membership.role === "admin")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this article",
        });
      }

      return article;
    }),

  // Get single article by slug (public)
  getBySlug: publicProcedure
    .input(
      z.object({
        companySlug: z.string(),
        articleSlug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Find company first
      const company = await ctx.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.slug, input.companySlug),
      });

      if (!company) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Company not found",
        });
      }

      const article = await ctx.db.query.knowledgeBase.findFirst({
        where: (knowledgeBase, { and, eq }) =>
          and(
            eq(knowledgeBase.company_id, company.id),
            eq(knowledgeBase.slug, input.articleSlug),
            eq(knowledgeBase.is_published, true),
            eq(knowledgeBase.is_public, true),
          ),
        columns: {
          id: true,
          title: true,
          slug: true,
          content: true,
          view_count: true,
          tags: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Increment view count
      await ctx.db
        .update(knowledgeBase)
        .set({
          view_count: article.view_count + 1,
          updated_at: new Date(),
        })
        .where(eq(knowledgeBase.id, article.id));

      return {
        ...article,
        view_count: article.view_count + 1,
      };
    }),

  // Create article
  create: companyProcedure
    .input(
      z.object({
        title: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/),
        content: z.string().min(1),
        isPublished: z.boolean().default(false),
        isPublic: z.boolean().default(true),
        tags: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is unique within company
      const existingArticle = await ctx.db.query.knowledgeBase.findFirst({
        where: (knowledgeBase, { and, eq }) =>
          and(
            eq(knowledgeBase.company_id, ctx.company.id),
            eq(knowledgeBase.slug, input.slug),
          ),
      });

      if (existingArticle) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Article with this slug already exists",
        });
      }

      const [article] = await ctx.db
        .insert(knowledgeBase)
        .values({
          company_id: ctx.company.id,
          title: input.title,
          slug: input.slug,
          content: input.content,
          author_membership_id: ctx.membership.id,
          is_published: input.isPublished,
          is_public: input.isPublic,
          tags: input.tags,
        })
        .returning();

      return article;
    }),

  // Update article
  update: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
        content: z.string().min(1).optional(),
        isPublished: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if article exists and user can edit it
      const existingArticle = await ctx.db.query.knowledgeBase.findFirst({
        where: (knowledgeBase, { and, eq }) =>
          and(
            eq(knowledgeBase.id, input.id),
            eq(knowledgeBase.company_id, ctx.company.id),
          ),
      });

      if (!existingArticle) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Check permissions - authors can edit their own articles, admins can edit all
      const canEdit =
        existingArticle.author_membership_id === ctx.membership.id ||
        ctx.user.memberships.some((membership) => membership.role === "admin");

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to edit this article",
        });
      }

      // Check slug uniqueness if changing
      if (input.slug && input.slug !== existingArticle.slug) {
        const slugExists = await ctx.db.query.knowledgeBase.findFirst({
          where: (knowledgeBase, { and, eq, ne }) =>
            and(
              eq(knowledgeBase.company_id, ctx.company.id),
              eq(knowledgeBase.slug, input.slug!),
              ne(knowledgeBase.id, input.id),
            ),
        });

        if (slugExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Article with this slug already exists",
          });
        }
      }

      const updateData: Record<string, any> = {};

      if (input.title) updateData.title = input.title;
      if (input.slug) updateData.slug = input.slug;
      if (input.content) updateData.content = input.content;
      if (typeof input.isPublished === "boolean") {
        updateData.is_published = input.isPublished;
      }
      if (typeof input.isPublic === "boolean") {
        updateData.is_public = input.isPublic;
      }
      if (input.tags) updateData.tags = input.tags;

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();

        const [updatedArticle] = await ctx.db
          .update(knowledgeBase)
          .set(updateData)
          .where(eq(knowledgeBase.id, input.id))
          .returning();

        return updatedArticle;
      }

      return existingArticle;
    }),

  // Delete article
  delete: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if article exists and user can delete it
      const article = await ctx.db.query.knowledgeBase.findFirst({
        where: (knowledgeBase, { and, eq }) =>
          and(
            eq(knowledgeBase.id, input.id),
            eq(knowledgeBase.company_id, ctx.company.id),
          ),
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Check permissions
      const canDelete =
        article.author_membership_id === ctx.membership.id ||
        ctx.user.memberships.some((membership) => membership.role === "admin");

      if (!canDelete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to delete this article",
        });
      }

      await ctx.db.delete(knowledgeBase).where(eq(knowledgeBase.id, input.id));

      return { success: true };
    }),
});
