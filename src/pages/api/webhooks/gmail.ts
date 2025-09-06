import { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { db } from "~/db";
import {
  gmailIntegration,
  tickets,
  ticketComments,
  emailThreads,
  clients,
  memberships,
} from "~/db/schema";
import { eq, and } from "drizzle-orm";

// Helper function to create OAuth client with token refresh handling
const createOAuthClientWithRefresh = () => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  // Enable automatic token refresh
  client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      console.log('New refresh token received in webhook');
    }
  });

  return client;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse the Pub/Sub message
    const message = req.body;
    console.log("Gmail webhook received:", JSON.stringify(message, null, 2));

    // Check if it's a Pub/Sub message format
    if (!message.message) {
      return res.status(400).json({ error: "Invalid Pub/Sub message format" });
    }

    let data: any = {};
    try {
      if (message.message.data) {
        const decodedData = Buffer.from(message.message.data, "base64").toString();
        data = JSON.parse(decodedData);
      }
    } catch (parseError) {
      console.error("Error parsing Pub/Sub message data:", parseError);
      // Continue with empty data object for now
    }

    const emailAddress = data.emailAddress;
    const historyId = data.historyId;

    console.log("Gmail webhook parsed - email:", emailAddress, "historyId:", historyId);

    if (!emailAddress) {
      console.log("No email address found, checking all active integrations");
      // If no specific email, process all active integrations
      const integrations = await db.query.gmailIntegration.findMany({
        where: and(
          eq(gmailIntegration.is_active, true),
          eq(gmailIntegration.auto_sync_enabled, true),
          eq(gmailIntegration.auto_create_tickets, true),
        ),
        with: {
          company: true,
        },
      });

      let totalResults = { messagesProcessed: 0, ticketsCreated: 0 };
      for (const integration of integrations) {
        try {
          const result = await processGmailIntegration(integration);
          totalResults.messagesProcessed += result.messagesProcessed;
          totalResults.ticketsCreated += result.ticketsCreated;
        } catch (error) {
          console.error(`Error processing integration ${integration.id}:`, error);
        }
      }

      return res.status(200).json({
        success: true,
        integrationsProcessed: integrations.length,
        ...totalResults,
      });
    }

    // Find the Gmail integration for this email
    const integration = await db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.email, emailAddress),
        eq(gmailIntegration.is_active, true),
        eq(gmailIntegration.auto_sync_enabled, true),
        eq(gmailIntegration.auto_create_tickets, true),
      ),
      with: {
        company: true,
      },
    });

    if (!integration) {
      console.log("No active integration found for email:", emailAddress);
      return res
        .status(200)
        .json({ success: true, message: "No active integration" });
    }

    // Process new emails for this integration
    const result = await processGmailIntegration(integration);

    return res.status(200).json({
      companyId: integration.company_id,
      ...result,
      success: true,
    });
  } catch (error) {
    console.error("Gmail webhook error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function processGmailIntegration(integration: any) {
  const oauth2ClientInstance = createOAuthClientWithRefresh();
  oauth2ClientInstance.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2ClientInstance });

  // Get messages since last sync (or last hour)
  const lastSyncDate =
    integration.last_sync_at || new Date(Date.now() - 60 * 60 * 1000);

  console.log("Using regular message query");
  const query = `is:unread after:${Math.floor(lastSyncDate.getTime() / 1000)}`;
  const messages = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  // Get company clients for domain filtering
  const companyClients = await db.query.clients.findMany({
    where: and(
      eq(clients.company_id, integration.company_id),
      eq(clients.is_active, true),
    ),
  });

  const domainToClient = new Map<string, (typeof companyClients)[0]>();
  companyClients.forEach((client: any) => {
    const domains = Array.isArray(client.email_domains)
      ? client.email_domains
      : [];
    domains.forEach((domain: string) => {
      if (domain && typeof domain === "string") {
        domainToClient.set(domain.toLowerCase(), client);
      }
    });
  });

  let ticketsCreated = 0;
  let messagesProcessed = 0;

  if (messages.data.messages) {
    for (const message of messages.data.messages) {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "full",
        });

        messagesProcessed++;

        const headers = fullMessage.data.payload?.headers || [];
        const subject =
          headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const from = headers.find((h) => h.name === "From")?.value || "";
        const threadId = fullMessage.data.threadId;

        // Extract sender domain
        const emailMatch =
          from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
        const senderEmail = emailMatch ? emailMatch[1] || emailMatch[0] : from;
        const senderDomain = senderEmail.includes("@")
          ? senderEmail.split("@")[1]?.toLowerCase()
          : "";

        const matchedClient = senderDomain
          ? domainToClient.get(senderDomain)
          : null;

        if (!matchedClient) {
          continue;
        }

        // Check if this thread already exists
        const existingThread = await db.query.emailThreads.findFirst({
          where: eq(emailThreads.gmail_thread_id, threadId!),
          with: {
            ticket: true,
          },
        });

        if (existingThread) {
          // This is a reply to an existing thread - add as comment
          console.log(`📧 Found reply to existing ticket ${existingThread.ticket_id}`);
          
          // Extract email body
          let emailBody = "";
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

          if (fullMessage.data.payload?.parts) {
            emailBody = extractTextFromParts(fullMessage.data.payload.parts);
          } else if (fullMessage.data.payload?.body?.data) {
            emailBody = Buffer.from(fullMessage.data.payload.body.data, "base64").toString("utf-8");
          }

          if (emailBody.trim()) {
            const date = headers.find((h) => h.name === "Date")?.value || "";
            
            // Create ticket comment for this reply
            await db.insert(ticketComments).values({
              company_id: integration.company_id,
              ticket_id: existingThread.ticket_id!,
              membership_id: undefined,
              customer_portal_access_id: undefined,
              content: `Reply from: ${from}\nDate: ${date}\n\n${emailBody.trim()}`,
              is_internal: false,
              is_system: true,
            });

            // Update thread's last message ID
            await db.update(emailThreads)
              .set({ 
                last_message_id: message.id!,
                updated_at: new Date(),
              })
              .where(eq(emailThreads.id, existingThread.id));

            console.log(`✅ Added reply as comment to ticket ${existingThread.ticket_id}`);
          }
          
          continue; // Skip creating a new ticket
        }

        // This is a new thread - create a new ticket
        console.log(`🆕 Creating new ticket for thread ${threadId}`);
        
        if (true) { // Changed condition to always enter this block for new threads
          // Extract email body
          let emailBody = "";
          const extractTextFromParts = (parts: any[]): string => {
            let text = "";
            for (const part of parts) {
              if (part.mimeType === "text/plain" && part.body?.data) {
                text +=
                  Buffer.from(part.body.data, "base64").toString("utf-8") +
                  "\n";
              } else if (
                part.mimeType === "text/html" &&
                part.body?.data &&
                !text
              ) {
                text +=
                  Buffer.from(part.body.data, "base64")
                    .toString("utf-8")
                    .replace(/<[^>]*>/g, "") + "\n";
              } else if (part.parts) {
                text += extractTextFromParts(part.parts);
              }
            }
            return text;
          };

          if (fullMessage.data.payload?.parts) {
            emailBody = extractTextFromParts(fullMessage.data.payload.parts);
          } else if (fullMessage.data.payload?.body?.data) {
            emailBody = Buffer.from(
              fullMessage.data.payload.body.data,
              "base64",
            ).toString("utf-8");
          }

          // Get admin membership
          const adminMembership = await db.query.memberships.findFirst({
            where: and(
              eq(memberships.company_id, integration.company_id),
              eq(memberships.role, "admin"),
              eq(memberships.is_active, true),
            ),
          });

          const [newTicket] = await db
            .insert(tickets)
            .values({
              company_id: integration.company_id,
              client_id: matchedClient.id,
              subject,
              description: `Email from: ${from}\n\nSubject: ${subject}\n\n${emailBody.trim()}`,
              status: "open",
              priority: integration.default_ticket_priority || "medium",
              customer_email: senderEmail,
              customer_name: from.split("<")[0]?.trim() || senderEmail,
              created_by_membership_id: adminMembership?.id,
            })
            .returning();

          await db.insert(emailThreads).values({
            company_id: integration.company_id,
            ticket_id: newTicket.id,
            gmail_thread_id: threadId!,
            subject,
            participants: [from],
            last_message_id: message.id!,
          });

          ticketsCreated++;
        }
      } catch (messageError) {
        console.error("Error processing message:", messageError);
        continue;
      }
    }
  }

  // Update last sync time
  await db
    .update(gmailIntegration)
    .set({
      last_sync_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(gmailIntegration.id, integration.id));

  return {
    success: true,
    messagesProcessed,
    ticketsCreated,
  };
}
