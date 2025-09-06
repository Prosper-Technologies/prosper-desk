import { NextRequest, NextResponse } from "next/server";
import { db } from "~/db";
import { gmailIntegration, emailThreads, ticketComments } from "~/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

// Test endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "Gmail webhook endpoint is active",
    timestamp: new Date().toISOString()
  });
}

// Gmail webhook endpoint for push notifications
export async function POST(request: NextRequest) {
  console.log("🔔 Gmail webhook received");
  
  try {
    // Verify the request is from Google
    const body = await request.text();
    console.log("📨 Webhook body:", body);
    
    const data = JSON.parse(body);
    console.log("📊 Parsed data:", data);
    
    // Extract the message data
    const message = data.message;
    if (!message) {
      console.log("❌ No message data in webhook");
      return NextResponse.json({ error: "No message data" }, { status: 400 });
    }

    // Decode the base64 message
    const decodedData = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8')
    );
    console.log("🔓 Decoded webhook data:", decodedData);

    const { emailAddress, historyId } = decodedData;

    // Find the Gmail integration for this email
    const integration = await db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.email, emailAddress),
      with: {
        company: true,
      },
    });

    if (!integration) {
      console.log(`❌ No integration found for email: ${emailAddress}`);
      return NextResponse.json({ status: "ignored" });
    }

    console.log(`✅ Found integration for ${emailAddress} (company: ${integration.company.name})`);

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
    console.log(`📚 Getting history from ${integration.last_history_id || "1"} to ${historyId}`);
    
    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: integration.last_history_id || "1",
    });

    console.log(`📊 History response:`, JSON.stringify(history.data, null, 2));

    if (!history.data.history) {
      console.log("❌ No history data found");
      return NextResponse.json({ status: "no_changes" });
    }

    console.log(`📝 Processing ${history.data.history.length} history records`);

    // Process each history record
    for (const record of history.data.history) {
      console.log(`🔍 History record:`, record);
      
      if (record.messagesAdded) {
        console.log(`➕ Found ${record.messagesAdded.length} new messages`);
        for (const addedMessage of record.messagesAdded) {
          console.log(`📧 Processing added message:`, addedMessage);
          await processNewMessage(gmail, addedMessage.message!, integration);
        }
      } else {
        console.log(`ℹ️ No messagesAdded in this history record`);
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
    console.log(`🔍 Processing message ${message.id}`);
    
    // Get full message details
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "full",
    });

    const threadId = fullMessage.data.threadId;
    console.log(`🧵 Thread ID: ${threadId}`);
    
    // Check if this thread is already tracked
    const existingThread = await db.query.emailThreads.findFirst({
      where: eq(emailThreads.gmail_thread_id, threadId),
      with: {
        ticket: true,
      },
    });

    if (!existingThread) {
      console.log(`❌ Thread ${threadId} not found in database - skipping`);
      // New thread - would be handled by regular sync
      return;
    }

    console.log(`✅ Found existing thread for ticket ${existingThread.ticket_id}`);

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