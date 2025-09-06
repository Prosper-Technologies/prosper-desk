import { NextResponse } from "next/server";
import { db } from "~/db";
import { ticketComments, emailThreads } from "~/db/schema";
import { eq } from "drizzle-orm";

// Test endpoint to manually create a comment for an existing thread
export async function POST() {
  try {
    // Find the most recent email thread
    const thread = await db.query.emailThreads.findFirst({
      orderBy: (threads, { desc }) => [desc(threads.created_at)],
      with: {
        ticket: true,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "No email threads found" }, { status: 404 });
    }

    // Create a test comment
    const [comment] = await db.insert(ticketComments).values({
      company_id: thread.company_id,
      ticket_id: thread.ticket_id!,
      membership_id: undefined,
      customer_portal_access_id: undefined,
      content: `TEST: This is a test comment created via webhook test at ${new Date().toISOString()}`,
      is_internal: false,
      is_system: true,
    }).returning();

    return NextResponse.json({
      success: true,
      thread_id: thread.id,
      ticket_id: thread.ticket_id,
      comment_id: comment.id,
      message: "Test comment created successfully"
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    return NextResponse.json({ 
      error: "Failed to create test comment",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}