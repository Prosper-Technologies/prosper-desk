import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/db";
import { tickets } from "~/db/schema";
import { eq, desc, and, or, ilike, count } from "drizzle-orm";
import { validateApiKey, hasPermission } from "~/lib/auth-api";

// Validation schemas
const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(1, "Description is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  customer_email: z.string().email("Invalid email").optional(),
  customer_name: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  search: z.string().optional(),
});

async function handleAuth(request: NextRequest) {
  const authContext = await validateApiKey(request);
  if (!authContext) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 },
    );
  }
  return authContext;
}

// GET /api/v1/tickets - List tickets
export async function GET(request: NextRequest) {
  const authContext = await handleAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  if (!hasPermission(authContext, "tickets:read")) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status"),
      priority: searchParams.get("priority"),
      search: searchParams.get("search"),
    });

    const offset = (query.page - 1) * query.limit;

    // Build where conditions
    const whereConditions = [eq(tickets.company_id, authContext.company.id)];

    if (query.status) {
      whereConditions.push(eq(tickets.status, query.status));
    }

    if (query.priority) {
      whereConditions.push(eq(tickets.priority, query.priority));
    }

    if (query.search) {
      whereConditions.push(
        or(
          ilike(tickets.subject, `%${query.search}%`),
          ilike(tickets.description, `%${query.search}%`),
        )!,
      );
    }

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(tickets)
      .where(and(...whereConditions));

    // Get tickets
    const ticketList = await db.query.tickets.findMany({
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
        client: {
          columns: { id: true, name: true, slug: true },
        },
      },
      limit: query.limit,
      offset,
      orderBy: [desc(tickets.created_at)],
    });

    return NextResponse.json({
      data: ticketList,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/v1/tickets - Create ticket
export async function POST(request: NextRequest) {
  const authContext = await handleAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  if (!hasPermission(authContext, "tickets:create")) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const data = createTicketSchema.parse(body);

    // Get default SLA policy
    const defaultSLA = await db.query.slaPolicies.findFirst({
      where: (slaPolicies, { and, eq }) =>
        and(
          eq(slaPolicies.company_id, authContext.company.id),
          eq(slaPolicies.is_default, true),
        ),
    });

    // Create ticket without assigned membership (external API created)
    const [ticket] = await db
      .insert(tickets)
      .values({
        company_id: authContext.company.id,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        sla_policy_id: defaultSLA?.id,
        tags: data.tags,
      })
      .returning();

    // Fetch the created ticket with relations
    const createdTicket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticket!.id),
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
        client: {
          columns: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json({ data: createdTicket }, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
