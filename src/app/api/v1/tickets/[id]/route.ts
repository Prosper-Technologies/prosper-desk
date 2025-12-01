import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/db";
import { tickets } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { validateApiKey, hasPermission } from "~/lib/auth-api";

const updateTicketSchema = z.object({
  subject: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  tags: z.array(z.string()).optional(),
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

// GET /api/v1/tickets/[id] - Get single ticket
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authContext = await handleAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  if (!hasPermission(authContext, "tickets:read")) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  try {
    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.id, params.id),
        eq(tickets.company_id, authContext.company.id),
      ),
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
        slaPolicy: true,
        comments: {
          where: (ticketComments, { eq }) =>
            eq(ticketComments.is_internal, false), // Only public comments via API
          with: {
            membership: {
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
            customerPortalAccess: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: (ticketComments, { asc }) => [
            asc(ticketComments.created_at),
          ],
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ data: ticket });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT /api/v1/tickets/[id] - Update ticket
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authContext = await handleAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  if (!hasPermission(authContext, "tickets:update")) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const data = updateTicketSchema.parse(body);

    // Verify ticket exists and belongs to company
    const existingTicket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.id, params.id),
        eq(tickets.company_id, authContext.company.id),
      ),
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (data.subject) updateData.subject = data.subject;
    if (data.description) updateData.description = data.description;
    if (data.status) {
      updateData.status = data.status;

      // Mark resolved timestamp
      if (data.status === "resolved" && existingTicket.status !== "resolved") {
        updateData.resolved_at = new Date();
      }
    }
    if (data.priority) updateData.priority = data.priority;
    if (data.tags) updateData.tags = data.tags;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date();

      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, params.id))
        .returning();

      // Fetch updated ticket with relations
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, params.id),
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

      return NextResponse.json({ data: ticket });
    }

    return NextResponse.json({ data: existingTicket });
  } catch (error) {
    console.error("Error updating ticket:", error);
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
