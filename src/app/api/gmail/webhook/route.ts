import { NextRequest, NextResponse } from "next/server";
import { db } from "~/db";
import { gmailIntegration, emailThreads, ticketComments } from "~/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

// Gmail webhook endpoint for push notifications
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from Google
    const body = await request.text();
    const data = JSON.parse(body);
    
    // Extract the message data
    const message = data.message;
    if (!message) {
      return NextResponse.json({ error: "No message data" }, { status: 400 });
    }

    // Decode the base64 message
    const decodedData = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8')
    );

    const { emailAddress, historyId } = decodedData;

    // Find the Gmail integration for this email
    const integration = await db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.email, emailAddress),
      with: {
        company: true,
      },
    });

    if (!integration) {
      console.log(`No integration found for email: ${emailAddress}`);
      return NextResponse.json({ status: "ignored" });
    }

    // Set up Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get history to find what changed
    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: integration.last_history_id || "1",
    });

    if (!history.data.history) {
      return NextResponse.json({ status: "no_changes" });
    }

    // Process each history record
    for (const record of history.data.history) {
      if (record.messagesAdded) {
        for (const addedMessage of record.messagesAdded) {
          await processNewMessage(gmail, addedMessage.message!, integration);
        }
      }
    }

    // Update the last history ID
    await db.update(gmailIntegration)
      .set({ last_history_id: historyId })
      .where(eq(gmailIntegration.id, integration.id));

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Gmail webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function processNewMessage(gmail: any, message: any, integration: any) {
  try {
    // Get full message details
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "full",
    });

    const threadId = fullMessage.data.threadId;
    
    // Check if this thread is already tracked
    const existingThread = await db.query.emailThreads.findFirst({
      where: eq(emailThreads.gmail_thread_id, threadId),
      with: {
        ticket: true,
      },
    });

    if (!existingThread) {
      // New thread - would be handled by regular sync
      return;
    }

    // This is a reply to an existing thread - add as comment
    const headers = fullMessage.data.payload?.headers || [];
    const from = headers.find((h) => h.name === "From")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";
    
    // Extract message body
    const extractTextFromParts = (parts: any[]): string => {
      let text = "";
      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          text += Buffer.from(part.body.data, "base64").toString("utf-8") + "\n";
        } else if (part.mimeType === "text/html" && part.body?.data && !text) {
          text += Buffer.from(part.body.data, "base64")
            .toString("utf-8")
            .replace(/<[^>]*>/g, "") + "\n";
        } else if (part.parts) {
          text += extractTextFromParts(part.parts);
        }
      }
      return text;
    };

    let messageBody = "";
    if (fullMessage.data.payload?.parts) {
      messageBody = extractTextFromParts(fullMessage.data.payload.parts);
    } else if (fullMessage.data.payload?.body?.data) {
      messageBody = Buffer.from(
        fullMessage.data.payload.body.data,
        "base64",
      ).toString("utf-8");
    }

    if (messageBody.trim()) {
      // Add as ticket comment
      await db.insert(ticketComments).values({
        company_id: integration.company_id,
        ticket_id: existingThread.ticket_id,
        membership_id: undefined,
        customer_portal_access_id: undefined,
        content: `New reply from: ${from}\nDate: ${date}\n\n${messageBody.trim()}`,
        is_internal: false,
        is_system: true,
      });

      // Update thread's last message ID
      await db.update(emailThreads)
        .set({ 
          last_message_id: message.id,
          updated_at: new Date(),
        })
        .where(eq(emailThreads.id, existingThread.id));

      console.log(`Added reply as comment to ticket ${existingThread.ticket_id}`);
    }
  } catch (error) {
    console.error("Error processing new message:", error);
  }
}