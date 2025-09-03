import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/db";
import { tickets, ticketComments, customerPortalAccess } from "~/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { validateApiKey, hasPermission } from "~/lib/auth-api";

const createCommentSchema = z.object({
  content: z.string().min(1, "Content is required"),
  customer_email: z.string().email("Invalid email").optional(),
  customer_name: z.string().optional(),
});

async function handleAuth(request: NextRequest) {
  const authContext = await validateApiKey(request);
  if (!authContext) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }
  return authContext;
}

// GET /api/v1/tickets/[id]/comments - Get ticket comments
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authContext = await handleAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  if (!hasPermission(authContext, "comments:read")) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    // Verify ticket exists and belongs to company
    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.id, params.id),
        eq(tickets.company_id, authContext.company.id)
      ),
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Get comments (only non-internal comments for API)
    const comments = await db.query.ticketComments.findMany({
      where: and(
        eq(ticketComments.ticket_id, params.id),
        eq(ticketComments.company_id, authContext.company.id),
        eq(ticketComments.is_internal, false)
      ),
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
      orderBy: [desc(ticketComments.created_at)],
    });

    return NextResponse.json({ data: comments });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/v1/tickets/[id]/comments - Add comment to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authContext = await handleAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  if (!hasPermission(authContext, "comments:create")) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const data = createCommentSchema.parse(body);

    // Verify ticket exists and belongs to company
    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.id, params.id),
        eq(tickets.company_id, authContext.company.id)
      ),
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Create customer portal access if customer info provided and doesn't exist
    let customerPortalAccessId = null;
    if (data.customer_email && data.customer_name) {
      // For API-created comments, we'll create a simplified customer portal access
      // or find existing one by email for this company
      let customerPortalAccessRecord = await db.query.customerPortalAccess.findFirst({
        where: and(
          eq(customerPortalAccess.email, data.customer_email),
          eq(customerPortalAccess.company_id, authContext.company.id)
        ),
      });

      if (!customerPortalAccessRecord) {
        // We need a client_id, so if ticket doesn't have one, we'll create a default or skip customer portal creation
        if (ticket.client_id) {
          // Generate access token for this customer
          const accessToken = `api_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
          
          const [newAccess] = await db
            .insert(customerPortalAccess)
            .values({
              company_id: authContext.company.id,
              client_id: ticket.client_id,
              email: data.customer_email,
              name: data.customer_name,
              access_token: accessToken,
            })
            .returning();

          customerPortalAccessId = newAccess!.id;
        }
        // If no client_id, we'll create the comment without customer portal access
      } else {
        customerPortalAccessId = customerPortalAccessRecord.id;
      }
    }

    // Create the comment
    const [comment] = await db
      .insert(ticketComments)
      .values({
        company_id: authContext.company.id,
        ticket_id: params.id,
        customer_portal_access_id: customerPortalAccessId,
        content: data.content,
        is_internal: false, // API comments are always public
      })
      .returning();

    // Mark first response time if this is the first comment
    if (!ticket.first_response_at) {
      await db
        .update(tickets)
        .set({
          first_response_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(tickets.id, params.id));
    }

    // Fetch the created comment with relations
    const createdComment = await db.query.ticketComments.findFirst({
      where: eq(ticketComments.id, comment!.id),
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
    });

    return NextResponse.json(
      { data: createdComment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating comment:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}