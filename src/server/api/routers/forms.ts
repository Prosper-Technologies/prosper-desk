import { z } from "zod";
import {
  createTRPCRouter,
  companyProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  forms,
  formSubmissions,
  tickets,
  clients,
  customerPortalAccess,
  memberships,
} from "~/db/schema";
import { eq, desc, and, count, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Zod schemas for form field types
const fieldTypeSchema = z.enum([
  "text",
  "email",
  "number",
  "phone",
  "textarea",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "rating",
]);

const formFieldSchema = z.object({
  id: z.string().uuid(),
  type: fieldTypeSchema,
  label: z.string(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
  order: z.number(),
});

const formSettingsSchema = z.object({
  allow_multiple_submissions: z.boolean().default(true),
  require_authentication: z.boolean().default(false),
  collect_contact_info: z.boolean().default(true),
  confirmation_message: z.string().optional(),
  redirect_url: z.string().url().optional(),
  notify_on_submission: z.boolean().default(false),
  notification_emails: z.array(z.string().email()).optional(),
});

const ticketRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  field_id: z.string().uuid(),
  operator: z.enum(["eq", "neq", "lt", "lte", "gt", "gte", "contains"]),
  value: z.union([z.string(), z.number()]),
  create_ticket: z.boolean(),
  ticket_subject: z.string().optional(),
  ticket_priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assign_to_membership_id: z.string().uuid().optional(),
});

// Helper function to evaluate ticket rules
function evaluateRule(
  rule: z.infer<typeof ticketRuleSchema>,
  fieldValue: any,
): boolean {
  const { operator, value } = rule;

  switch (operator) {
    case "eq":
      return fieldValue == value;
    case "neq":
      return fieldValue != value;
    case "lt":
      return Number(fieldValue) < Number(value);
    case "lte":
      return Number(fieldValue) <= Number(value);
    case "gt":
      return Number(fieldValue) > Number(value);
    case "gte":
      return Number(fieldValue) >= Number(value);
    case "contains":
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    default:
      return false;
  }
}

// Helper function to create ticket from rule
async function createTicketFromRule(
  ctx: any,
  rule: z.infer<typeof ticketRuleSchema>,
  submission: {
    id: string;
    form_id: string;
    company_id: string;
    submitted_by_email: string;
    submitted_by_name: string;
    submitted_by_customer_portal_access_id?: string | null;
    data: Record<string, any>;
    description?: string | null;
  },
  form: { name: string; client_id: string | null },
) {
  if (!rule.create_ticket) return null;

  // Build ticket subject from template
  let subject = rule.ticket_subject || `Form submission: ${form.name}`;

  // Replace {{field_name}} placeholders in subject (including customer_name if it's a field)
  Object.entries(submission.data).forEach(([key, value]) => {
    subject = subject.replace(new RegExp(`{{${key}}}`, "g"), String(value));
  });

  // Replace {{customer_name}} placeholder if not already replaced by a field
  // This uses the contact info name as fallback
  if (subject.includes('{{customer_name}}')) {
    subject = subject.replace(/\{\{customer_name\}\}/g, submission.submitted_by_name);
  }

  // Use submission description as ticket description, or default message
  const ticketDescription = submission.description ||
    `Form submission from ${submission.submitted_by_name}. View the form submission details for more information.`;

  const [ticket] = await ctx.db
    .insert(tickets)
    .values({
      company_id: submission.company_id,
      client_id: form.client_id,
      subject,
      description: ticketDescription,
      priority: rule.ticket_priority || "medium",
      status: "open",
      customer_email: submission.submitted_by_email,
      customer_name: submission.submitted_by_name,
      assigned_to_membership_id: rule.assign_to_membership_id,
      assigned_to_customer_portal_access_id:
        submission.submitted_by_customer_portal_access_id,
      external_id: submission.id,
      external_type: "form_submission",
    })
    .returning();

  return ticket;
}

export const formsRouter = createTRPCRouter({
  // ========== AUTHENTICATED ENDPOINTS (Team Members) ==========

  // Get all forms for a company
  getAll: companyProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
        client_id: z.string().uuid().optional(),
        is_published: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const whereConditions = [eq(forms.company_id, ctx.company.id)];

      if (input.client_id) {
        whereConditions.push(eq(forms.client_id, input.client_id));
      }

      if (input.is_published !== undefined) {
        whereConditions.push(eq(forms.is_published, input.is_published));
      }

      // Get total count
      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(forms)
        .where(and(...whereConditions));

      // Get forms with relations
      const formsList = await ctx.db.query.forms.findMany({
        where: and(...whereConditions),
        with: {
          client: {
            columns: { id: true, name: true, slug: true },
          },
          createdByMembership: {
            with: {
              user: {
                columns: {
                  id: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
        limit: input.limit,
        offset,
        orderBy: (forms, { desc }) => [desc(forms.created_at)],
      });

      return {
        forms: formsList,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // Get a single form by ID
  getById: companyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.db.query.forms.findFirst({
        where: and(
          eq(forms.id, input.id),
          eq(forms.company_id, ctx.company.id),
        ),
        with: {
          client: {
            columns: { id: true, name: true, slug: true },
          },
          createdByMembership: {
            with: {
              user: {
                columns: {
                  id: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        });
      }

      return form;
    }),

  // Create a new form
  create: companyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100),
        description: z.string().optional(),
        client_id: z.string().uuid(),
        fields: z.array(formFieldSchema),
        settings: formSettingsSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug already exists for this client
      const existingForm = await ctx.db.query.forms.findFirst({
        where: and(
          eq(forms.slug, input.slug),
          eq(forms.company_id, ctx.company.id),
          eq(forms.client_id, input.client_id),
        ),
      });

      if (existingForm) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A form with this slug already exists for this client",
        });
      }

      const [form] = await ctx.db
        .insert(forms)
        .values({
          company_id: ctx.company.id,
          client_id: input.client_id,
          name: input.name,
          slug: input.slug,
          description: input.description,
          fields: input.fields,
          settings: input.settings || {},
          created_by_membership_id: ctx.membership.id,
        })
        .returning();

      return form;
    }),

  // Update a form
  update: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        slug: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        client_id: z.string().uuid().optional(),
        fields: z.array(formFieldSchema).optional(),
        settings: formSettingsSchema.optional(),
        ticket_rules: z.array(ticketRuleSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify form exists and belongs to company
      const existingForm = await ctx.db.query.forms.findFirst({
        where: and(eq(forms.id, input.id), eq(forms.company_id, ctx.company.id)),
      });

      if (!existingForm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        });
      }

      // Determine the client_id to use for uniqueness check
      const targetClientId = input.client_id || existingForm.client_id;

      // Check slug uniqueness if updating slug or client_id
      if (
        (input.slug && input.slug !== existingForm.slug) ||
        (input.client_id && input.client_id !== existingForm.client_id)
      ) {
        const checkSlug = input.slug || existingForm.slug;
        const slugExists = await ctx.db.query.forms.findFirst({
          where: and(
            eq(forms.slug, checkSlug),
            eq(forms.company_id, ctx.company.id),
            eq(forms.client_id, targetClientId),
          ),
        });

        if (slugExists && slugExists.id !== input.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A form with this slug already exists for this client",
          });
        }
      }

      const [updatedForm] = await ctx.db
        .update(forms)
        .set({
          name: input.name,
          slug: input.slug,
          description: input.description,
          client_id: input.client_id,
          fields: input.fields,
          settings: input.settings,
          ticket_rules: input.ticket_rules,
          updated_at: new Date(),
        })
        .where(eq(forms.id, input.id))
        .returning();

      return updatedForm;
    }),

  // Publish/unpublish a form
  publish: companyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        is_published: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [form] = await ctx.db
        .update(forms)
        .set({
          is_published: input.is_published,
          updated_at: new Date(),
        })
        .where(
          and(eq(forms.id, input.id), eq(forms.company_id, ctx.company.id)),
        )
        .returning();

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        });
      }

      return form;
    }),

  // Delete a form
  delete: companyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(forms)
        .where(
          and(eq(forms.id, input.id), eq(forms.company_id, ctx.company.id)),
        )
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        });
      }

      return { success: true };
    }),

  // Get submissions for a form
  getSubmissions: companyProcedure
    .input(
      z.object({
        form_id: z.string().uuid(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      // Verify form belongs to company
      const form = await ctx.db.query.forms.findFirst({
        where: and(
          eq(forms.id, input.form_id),
          eq(forms.company_id, ctx.company.id),
        ),
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        });
      }

      // Get total count
      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(formSubmissions)
        .where(eq(formSubmissions.form_id, input.form_id));

      // Get submissions with relations
      const submissions = await ctx.db.query.formSubmissions.findMany({
        where: eq(formSubmissions.form_id, input.form_id),
        with: {
          ticket: {
            columns: {
              id: true,
              subject: true,
              status: true,
              priority: true,
            },
          },
          submittedByCustomerPortalAccess: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          submittedByMembership: {
            with: {
              user: {
                columns: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                },
              },
            },
          },
        },
        limit: input.limit,
        offset,
        orderBy: (formSubmissions, { desc }) => [
          desc(formSubmissions.submitted_at),
        ],
      });

      return {
        submissions,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // Get a single submission by ID
  getSubmissionById: companyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.query.formSubmissions.findFirst({
        where: and(
          eq(formSubmissions.id, input.id),
          eq(formSubmissions.company_id, ctx.company.id),
        ),
        with: {
          form: {
            columns: {
              id: true,
              name: true,
              slug: true,
              fields: true,
            },
          },
          ticket: true,
          submittedByCustomerPortalAccess: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          submittedByMembership: {
            with: {
              user: {
                columns: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        });
      }

      return submission;
    }),

  // Create a ticket from a submission
  createTicketFromSubmission: companyProcedure
    .input(
      z.object({
        submission_id: z.string().uuid(),
        subject: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the submission
      const submission = await ctx.db.query.formSubmissions.findFirst({
        where: and(
          eq(formSubmissions.id, input.submission_id),
          eq(formSubmissions.company_id, ctx.company.id),
        ),
        with: {
          form: true,
        },
      });

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        });
      }

      if (submission.ticket_id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A ticket has already been created for this submission",
        });
      }

      // Use submission description as ticket description, or default message
      const ticketDescription = submission.description ||
        `Form submission from ${submission.submitted_by_name}. View the form submission details for more information.`;

      const [ticket] = await ctx.db
        .insert(tickets)
        .values({
          company_id: submission.company_id,
          client_id: submission.form.client_id,
          subject: input.subject || `Form submission: ${submission.form.name}`,
          description: ticketDescription,
          priority: input.priority || "medium",
          status: "open",
          customer_email: submission.submitted_by_email,
          customer_name: submission.submitted_by_name,
          assigned_to_customer_portal_access_id:
            submission.submitted_by_customer_portal_access_id,
          created_by_membership_id: ctx.membership.id,
          external_id: submission.id,
          external_type: "form_submission",
        })
        .returning();

      // Update submission with ticket reference
      await ctx.db
        .update(formSubmissions)
        .set({
          ticket_id: ticket.id,
          ticket_created: true,
          updated_at: new Date(),
        })
        .where(eq(formSubmissions.id, input.submission_id));

      return ticket;
    }),

  // Export submissions as CSV
  exportSubmissions: companyProcedure
    .input(z.object({ form_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify form belongs to company
      const form = await ctx.db.query.forms.findFirst({
        where: and(
          eq(forms.id, input.form_id),
          eq(forms.company_id, ctx.company.id),
        ),
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found",
        });
      }

      // Get all submissions
      const submissions = await ctx.db.query.formSubmissions.findMany({
        where: eq(formSubmissions.form_id, input.form_id),
        orderBy: (formSubmissions, { desc }) => [
          desc(formSubmissions.submitted_at),
        ],
      });

      // Extract field names from form definition
      const fields = form.fields as any[];
      const fieldNames = fields.map((f) => f.label);

      // Build CSV header
      const csvHeader = [
        "Submission ID",
        "Submitted By",
        "Email",
        "Submitted At",
        "Ticket Created",
        ...fieldNames,
      ].join(",");

      // Build CSV rows
      const csvRows = submissions.map((sub) => {
        const data = sub.data as Record<string, any>;
        const fieldValues = fields.map((f) => {
          const value = data[f.id] || "";
          // Escape commas and quotes in CSV
          return `"${String(value).replace(/"/g, '""')}"`;
        });

        return [
          sub.id,
          `"${sub.submitted_by_name}"`,
          `"${sub.submitted_by_email}"`,
          sub.submitted_at.toISOString(),
          sub.ticket_created ? "Yes" : "No",
          ...fieldValues,
        ].join(",");
      });

      const csv = [csvHeader, ...csvRows].join("\n");

      return { csv, filename: `${form.slug}-submissions-${Date.now()}.csv` };
    }),

  // ========== PUBLIC ENDPOINTS ==========

  // Get a published form by slug (public access)
  getPublicBySlug: publicProcedure
    .input(
      z.object({
        company_slug: z.string(),
        client_slug: z.string(),
        form_slug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Find company by slug
      const company = await ctx.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.slug, input.company_slug),
      });

      if (!company) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Company not found",
        });
      }

      // Find client by slug
      const client = await ctx.db.query.clients.findFirst({
        where: (clients, { eq, and }) =>
          and(
            eq(clients.slug, input.client_slug),
            eq(clients.company_id, company.id),
          ),
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      // Find form by slug
      const form = await ctx.db.query.forms.findFirst({
        where: and(
          eq(forms.slug, input.form_slug),
          eq(forms.company_id, company.id),
          eq(forms.client_id, client.id),
          eq(forms.is_published, true),
        ),
        with: {
          client: {
            columns: { id: true, name: true },
          },
        },
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found or not published",
        });
      }

      return {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        settings: form.settings,
        client: form.client,
        company_id: company.id,
        company_name: company.name,
      };
    }),

  // Submit a form (public access)
  submitPublic: publicProcedure
    .input(
      z.object({
        company_slug: z.string(),
        client_slug: z.string(),
        form_slug: z.string(),
        data: z.record(z.any()),
        contact: z
          .object({
            name: z.string().optional(),
            email: z.string().email().optional(),
          })
          .optional(),
        external_id: z.string().optional(),
        external_type: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find company and form
      const company = await ctx.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.slug, input.company_slug),
      });

      if (!company) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Company not found",
        });
      }

      // Find client by slug
      const client = await ctx.db.query.clients.findFirst({
        where: (clients, { eq, and }) =>
          and(
            eq(clients.slug, input.client_slug),
            eq(clients.company_id, company.id),
          ),
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      const form = await ctx.db.query.forms.findFirst({
        where: and(
          eq(forms.slug, input.form_slug),
          eq(forms.company_id, company.id),
          eq(forms.client_id, client.id),
          eq(forms.is_published, true),
        ),
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found or not published",
        });
      }

      const settings = form.settings as any;

      // Check if authenticated
      const {
        data: { user },
      } = await ctx.supabase.auth.getUser();

      let submitter_name = input.contact?.name || "Anonymous";
      let submitter_email = input.contact?.email || "anonymous@example.com";
      let portal_access_id: string | null = null;
      let membership_id: string | null = null;

      if (user) {
        // Check if user is a team member
        const teamMember = await ctx.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, user.email!),
        });

        if (teamMember) {
          const membership = await ctx.db.query.memberships.findFirst({
            where: (memberships, { and, eq }) =>
              and(
                eq(memberships.user_id, teamMember.id),
                eq(memberships.company_id, company.id),
                eq(memberships.is_active, true),
              ),
          });

          if (membership) {
            submitter_name = `${teamMember.first_name} ${teamMember.last_name}`;
            submitter_email = teamMember.email;
            membership_id = membership.id;
          }
        }

        // Check if user has customer portal access
        if (!membership_id && form.client_id) {
          const access = await ctx.db.query.customerPortalAccess.findFirst({
            where: (customerPortalAccess, { and, eq }) =>
              and(
                eq(customerPortalAccess.client_id, form.client_id!),
                eq(customerPortalAccess.email, user.email!),
                eq(customerPortalAccess.is_active, true),
              ),
          });

          if (access) {
            submitter_name = access.name;
            submitter_email = access.email;
            portal_access_id = access.id;
          }
        }
      } else if (settings.require_authentication) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This form requires authentication",
        });
      }

      // Validate required fields
      const fields = form.fields as any[];
      for (const field of fields) {
        if (field.required && !input.data[field.id]) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Field "${field.label}" is required`,
          });
        }
      }

      // Create submission
      const [submission] = await ctx.db
        .insert(formSubmissions)
        .values({
          form_id: form.id,
          company_id: company.id,
          submitted_by_email: submitter_email,
          submitted_by_name: submitter_name,
          submitted_by_customer_portal_access_id: portal_access_id,
          submitted_by_membership_id: membership_id,
          data: input.data,
          description: input.description,
          external_id: input.external_id,
          external_type: input.external_type,
        })
        .returning();

      // Evaluate ticket rules
      const rules = (form.ticket_rules as any[]) || [];
      let createdTicket = null;

      for (const rule of rules) {
        const fieldValue = input.data[rule.field_id];
        if (evaluateRule(rule, fieldValue)) {
          createdTicket = await createTicketFromRule(
            ctx,
            rule,
            {
              id: submission.id,
              form_id: form.id,
              company_id: company.id,
              submitted_by_email: submitter_email,
              submitted_by_name: submitter_name,
              submitted_by_customer_portal_access_id: portal_access_id,
              data: input.data,
              description: input.description,
            },
            { name: form.name, client_id: form.client_id },
          );

          if (createdTicket) {
            // Update submission with ticket reference
            await ctx.db
              .update(formSubmissions)
              .set({
                ticket_id: createdTicket.id,
                ticket_created: true,
                updated_at: new Date(),
              })
              .where(eq(formSubmissions.id, submission.id));

            break; // Only create one ticket per submission
          }
        }
      }

      return {
        success: true,
        submission_id: submission.id,
        ticket_created: !!createdTicket,
        ticket_id: createdTicket?.id,
        message:
          settings.confirmation_message ||
          "Thank you for your submission!",
      };
    }),
});
