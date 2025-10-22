import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "agent",
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const companySizeEnum = pgEnum("company_size", [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  size: companySizeEnum("size").notNull(),
  logo_url: text("logo_url"),
  primary_color: varchar("primary_color", { length: 7 }).default("#3b82f6"), // hex color
  settings: jsonb("settings").default("{}"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Users table - now global, not tied to a specific company
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  auth_user_id: uuid("auth_user_id").unique(), // links to Supabase Auth
  email: varchar("email", { length: 255 }).notNull().unique(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  avatar_url: text("avatar_url"),
  is_active: boolean("is_active").default(true).notNull(),
  last_seen_at: timestamp("last_seen_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Memberships - junction table between users and companies with roles
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    company_id: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    role: membershipRoleEnum("role").notNull().default("agent"),
    is_active: boolean("is_active").default(true).notNull(),
    joined_at: timestamp("joined_at").defaultNow().notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: one membership per user per company
    userCompanyUnique: unique().on(table.user_id, table.company_id),
  }),
).enableRLS();

// SLA Policies per client (client_id can be null for company defaults)
export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  client_id: uuid("client_id").references(() => clients.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  priority: ticketPriorityEnum("priority").notNull(),
  response_time_minutes: integer("response_time_minutes").notNull(), // SLA response time
  resolution_time_minutes: integer("resolution_time_minutes").notNull(), // SLA resolution time
  is_default: boolean("is_default").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Escalation Policies
export const escalationPolicies = pgTable("escalation_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  escalation_rules: jsonb("escalation_rules").notNull(), // Array of escalation steps
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Clients (customer organizations that submit tickets)
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(), // unique per comspany for portal URLs
  email_domains: text("email_domains")
    .array()
    .default(sql`array[]::text[]`)
    .notNull(),
  logo_url: text("logo_url"),
  description: text("description"),
  is_active: boolean("is_active").default(true).notNull(),
  portal_enabled: boolean("portal_enabled").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Tickets table (core entity) - now references membership instead of user directly
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  external_id: varchar("external_id", { length: 255 }).unique(), // External system identifier
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),

  // User relationships - now through memberships
  created_by_membership_id: uuid("created_by_membership_id").references(
    () => memberships.id,
  ),
  assigned_to_membership_id: uuid("assigned_to_membership_id").references(
    () => memberships.id,
  ),

  // SLA tracking
  sla_policy_id: uuid("sla_policy_id").references(() => slaPolicies.id),
  first_response_at: timestamp("first_response_at"),
  resolved_at: timestamp("resolved_at"),
  sla_response_breach: boolean("sla_response_breach").default(false),
  sla_resolution_breach: boolean("sla_resolution_breach").default(false),

  // Escalation
  escalation_policy_id: uuid("escalation_policy_id").references(
    () => escalationPolicies.id,
  ),
  escalation_level: integer("escalation_level").default(0),

  // Customer info (for portal tickets)
  client_id: uuid("client_id").references(() => clients.id),
  customer_email: varchar("customer_email", { length: 255 }),
  customer_name: varchar("customer_name", { length: 255 }),

  // Metadata
  tags: jsonb("tags").default("[]"), // Array of strings
  custom_fields: jsonb("custom_fields").default("{}"),

  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  ticket_id: uuid("ticket_id")
    .references(() => tickets.id, { onDelete: "cascade" })
    .notNull(),
  parent_comment_id: uuid("parent_comment_id").references(
    (): any => ticketComments.id,
    { onDelete: "cascade" },
  ), // For nested replies (one level only)
  // Polymorphic ownership: exactly one of these should be set
  membership_id: uuid("membership_id").references(() => memberships.id), // For staff comments
  customer_portal_access_id: uuid("customer_portal_access_id").references(
    () => customerPortalAccess.id,
  ), // For customer comments
  content: text("content").notNull(),
  is_internal: boolean("is_internal").default(false).notNull(), // Internal notes vs customer-visible
  is_system: boolean("is_system").default(false).notNull(), // System-generated comments
  attachments: jsonb("attachments").default("[]"), // Array of file URLs
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export const knowledgeBase = pgTable("knowledge_base", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  content: text("content").notNull(),
  is_published: boolean("is_published").default(false).notNull(),
  is_public: boolean("is_public").default(true).notNull(), // Visible to customers
  author_membership_id: uuid("author_membership_id")
    .references(() => memberships.id)
    .notNull(),
  view_count: integer("view_count").default(0).notNull(),
  tags: jsonb("tags").default("[]"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Customer Portal Access (for external customers)
export const customerPortalAccess = pgTable("customer_portal_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  client_id: uuid("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // Magic link authentication - no token storage needed, Supabase handles it
  last_login_at: timestamp("last_login_at"),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Gmail integration settings
export const gmailIntegration = pgTable("gmail_integration", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  refresh_token: text("refresh_token").notNull(),
  access_token: text("access_token"),
  token_expires_at: timestamp("token_expires_at"),
  last_sync_at: timestamp("last_sync_at"),
  last_history_id: varchar("last_history_id", { length: 255 }),
  is_active: boolean("is_active").default(true).notNull(),
  // Auto processing configuration
  auto_sync_enabled: boolean("auto_sync_enabled").default(true).notNull(),
  sync_frequency_minutes: integer("sync_frequency_minutes")
    .default(15)
    .notNull(), // How often to check for new emails
  auto_create_tickets: boolean("auto_create_tickets").default(true).notNull(),
  default_ticket_priority: ticketPriorityEnum(
    "default_ticket_priority",
  ).default("medium"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Email threads to track conversations
export const emailThreads = pgTable("email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  ticket_id: uuid("ticket_id").references(() => tickets.id, {
    onDelete: "cascade",
  }),
  gmail_thread_id: varchar("gmail_thread_id", { length: 255 }).notNull(),
  subject: text("subject").notNull(),
  participants: jsonb("participants").default("[]").notNull(), // Array of email addresses
  last_message_id: varchar("last_message_id", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// API Keys for external API access
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  key_hash: varchar("key_hash", { length: 255 }).notNull().unique(), // bcrypt hash of the key
  prefix: varchar("prefix", { length: 20 }).notNull(), // first few chars for identification
  permissions: jsonb("permissions").default("[]").notNull(), // Array of allowed operations
  last_used_at: timestamp("last_used_at"),
  expires_at: timestamp("expires_at"), // null = never expires
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Invitation codes for user invitations
export const invitationCodes = pgTable("invitation_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 6 }).notNull().unique(), // 6-digit numeric code
  role: membershipRoleEnum("role").notNull(),
  invited_by_membership_id: uuid("invited_by_membership_id")
    .references(() => memberships.id, { onDelete: "cascade" })
    .notNull(),
  is_used: boolean("is_used").default(false).notNull(),
  used_at: timestamp("used_at"),
  expires_at: timestamp("expires_at").notNull(), // 7 days from creation
  created_at: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  memberships: many(memberships),
  tickets: many(tickets),
  slaPolicies: many(slaPolicies),
  escalationPolicies: many(escalationPolicies),
  ticketComments: many(ticketComments),
  knowledgeBase: many(knowledgeBase),
  clients: many(clients),
  customerPortalAccess: many(customerPortalAccess),
  apiKeys: many(apiKeys),
  invitationCodes: many(invitationCodes),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  invitationCodes: many(invitationCodes),
}));

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  user: one(users, {
    fields: [memberships.user_id],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [memberships.company_id],
    references: [companies.id],
  }),
  createdTickets: many(tickets, { relationName: "createdByMembership" }),
  assignedTickets: many(tickets, { relationName: "assignedToMembership" }),
  ticketComments: many(ticketComments),
  knowledgeBaseArticles: many(knowledgeBase),
  sentInvitations: many(invitationCodes),
}));

export const slaPoliciesRelations = relations(slaPolicies, ({ one, many }) => ({
  company: one(companies, {
    fields: [slaPolicies.company_id],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [slaPolicies.client_id],
    references: [clients.id],
  }),
  tickets: many(tickets),
}));

export const escalationPoliciesRelations = relations(
  escalationPolicies,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [escalationPolicies.company_id],
      references: [companies.id],
    }),
    tickets: many(tickets),
  }),
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  company: one(companies, {
    fields: [tickets.company_id],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [tickets.client_id],
    references: [clients.id],
  }),
  createdByMembership: one(memberships, {
    fields: [tickets.created_by_membership_id],
    references: [memberships.id],
    relationName: "createdByMembership",
  }),
  assignedToMembership: one(memberships, {
    fields: [tickets.assigned_to_membership_id],
    references: [memberships.id],
    relationName: "assignedToMembership",
  }),
  slaPolicy: one(slaPolicies, {
    fields: [tickets.sla_policy_id],
    references: [slaPolicies.id],
  }),
  escalationPolicy: one(escalationPolicies, {
    fields: [tickets.escalation_policy_id],
    references: [escalationPolicies.id],
  }),
  comments: many(ticketComments),
}));

export const ticketCommentsRelations = relations(
  ticketComments,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [ticketComments.company_id],
      references: [companies.id],
    }),
    ticket: one(tickets, {
      fields: [ticketComments.ticket_id],
      references: [tickets.id],
    }),
    membership: one(memberships, {
      fields: [ticketComments.membership_id],
      references: [memberships.id],
    }),
    customerPortalAccess: one(customerPortalAccess, {
      fields: [ticketComments.customer_portal_access_id],
      references: [customerPortalAccess.id],
    }),
    parentComment: one(ticketComments, {
      fields: [ticketComments.parent_comment_id],
      references: [ticketComments.id],
      relationName: "commentReplies",
    }),
    replies: many(ticketComments, {
      relationName: "commentReplies",
    }),
  }),
);

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  company: one(companies, {
    fields: [knowledgeBase.company_id],
    references: [companies.id],
  }),
  authorMembership: one(memberships, {
    fields: [knowledgeBase.author_membership_id],
    references: [memberships.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  company: one(companies, {
    fields: [clients.company_id],
    references: [companies.id],
  }),
  tickets: many(tickets),
  portalAccess: many(customerPortalAccess),
  slaPolicies: many(slaPolicies),
}));

export const customerPortalAccessRelations = relations(
  customerPortalAccess,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [customerPortalAccess.company_id],
      references: [companies.id],
    }),
    client: one(clients, {
      fields: [customerPortalAccess.client_id],
      references: [clients.id],
    }),
    ticketComments: many(ticketComments),
  }),
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  company: one(companies, {
    fields: [apiKeys.company_id],
    references: [companies.id],
  }),
}));

export const gmailIntegrationRelations = relations(
  gmailIntegration,
  ({ one }) => ({
    company: one(companies, {
      fields: [gmailIntegration.company_id],
      references: [companies.id],
    }),
  }),
);

export const emailThreadsRelations = relations(emailThreads, ({ one }) => ({
  company: one(companies, {
    fields: [emailThreads.company_id],
    references: [companies.id],
  }),
  ticket: one(tickets, {
    fields: [emailThreads.ticket_id],
    references: [tickets.id],
  }),
}));

export const invitationCodesRelations = relations(
  invitationCodes,
  ({ one }) => ({
    company: one(companies, {
      fields: [invitationCodes.company_id],
      references: [companies.id],
    }),
    user: one(users, {
      fields: [invitationCodes.user_id],
      references: [users.id],
    }),
    invitedByMembership: one(memberships, {
      fields: [invitationCodes.invited_by_membership_id],
      references: [memberships.id],
    }),
  }),
);
