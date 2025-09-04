import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "customer"]);
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

// Users table (separate from auth for flexibility)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  auth_user_id: uuid("auth_user_id"), // nullable - links to Supabase Auth
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("agent"),
  avatar_url: text("avatar_url"),
  is_active: boolean("is_active").default(true).notNull(),
  last_seen_at: timestamp("last_seen_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

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

// Tickets table (core entity)
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),

  // User relationships
  created_by: uuid("created_by").references(() => users.id),
  assigned_to: uuid("assigned_to").references(() => users.id),

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

// Ticket Comments
export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  ticket_id: uuid("ticket_id")
    .references(() => tickets.id, { onDelete: "cascade" })
    .notNull(),
  user_id: uuid("user_id").references(() => users.id),
  content: text("content").notNull(),
  is_internal: boolean("is_internal").default(false).notNull(), // Internal notes vs customer-visible
  is_system: boolean("is_system").default(false).notNull(), // System-generated comments
  attachments: jsonb("attachments").default("[]"), // Array of file URLs
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Knowledge Base Articles
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
  author_id: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  view_count: integer("view_count").default(0).notNull(),
  tags: jsonb("tags").default("[]"),
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
  slug: varchar("slug", { length: 100 }).notNull(), // unique per company for portal URLs
  email_domain: varchar("email_domain", { length: 255 }), // optional: restrict by email domain
  logo_url: text("logo_url"),
  description: text("description"),
  is_active: boolean("is_active").default(true).notNull(),
  portal_enabled: boolean("portal_enabled").default(true).notNull(),
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
  // Simplified token-based authentication
  access_token: varchar("access_token", { length: 255 }).notNull().unique(),
  expires_at: timestamp("expires_at"), // null = never expires
  last_login_at: timestamp("last_login_at"),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  tickets: many(tickets),
  slaPolicies: many(slaPolicies),
  escalationPolicies: many(escalationPolicies),
  ticketComments: many(ticketComments),
  knowledgeBase: many(knowledgeBase),
  clients: many(clients),
  customerPortalAccess: many(customerPortalAccess),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.company_id],
    references: [companies.id],
  }),
  createdTickets: many(tickets, { relationName: "createdBy" }),
  assignedTickets: many(tickets, { relationName: "assignedTo" }),
  ticketComments: many(ticketComments),
  knowledgeBaseArticles: many(knowledgeBase),
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
  createdBy: one(users, {
    fields: [tickets.created_by],
    references: [users.id],
    relationName: "createdBy",
  }),
  assignedTo: one(users, {
    fields: [tickets.assigned_to],
    references: [users.id],
    relationName: "assignedTo",
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

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  company: one(companies, {
    fields: [ticketComments.company_id],
    references: [companies.id],
  }),
  ticket: one(tickets, {
    fields: [ticketComments.ticket_id],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketComments.user_id],
    references: [users.id],
  }),
}));

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  company: one(companies, {
    fields: [knowledgeBase.company_id],
    references: [companies.id],
  }),
  author: one(users, {
    fields: [knowledgeBase.author_id],
    references: [users.id],
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
  ({ one }) => ({
    company: one(companies, {
      fields: [customerPortalAccess.company_id],
      references: [companies.id],
    }),
    client: one(clients, {
      fields: [customerPortalAccess.client_id],
      references: [clients.id],
    }),
  }),
);
