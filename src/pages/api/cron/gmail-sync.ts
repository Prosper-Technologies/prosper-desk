import { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import {
  gmailIntegration,
  tickets,
  emailThreads,
  clients,
  memberships,
} from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "~/db";

// Gmail OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret for security
  const cronSecret = req.headers.authorization?.replace("Bearer ", "");
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get all active Gmail integrations that have auto sync enabled
    const activeIntegrations = await db.query.gmailIntegration.findMany({
      where: and(
        eq(gmailIntegration.is_active, true),
        eq(gmailIntegration.auto_sync_enabled, true),
        eq(gmailIntegration.auto_create_tickets, true),
      ),
      with: {
        company: true,
      },
    });

    const results = [];

    for (const integration of activeIntegrations) {
      try {
        const result = await processGmailIntegration(integration);
        results.push({
          companyId: integration.company_id,
          companyName: integration.company.name,
          ...result,
        });
      } catch (error) {
        console.error(
          `Error processing Gmail integration for company ${integration.company_id}:`,
          error,
        );
        results.push({
          companyId: integration.company_id,
          companyName: integration.company?.name || "Unknown",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return res.status(200).json({
      success: true,
      processedIntegrations: results.length,
      results,
    });
  } catch (error) {
    console.error("Gmail cron sync error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function processGmailIntegration(integration: any) {
  // Set up OAuth client
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Get recent messages since last sync (or last 1 hour if no last sync)
  const lastSyncDate =
    integration.last_sync_at || new Date(Date.now() - 60 * 60 * 1000);
  const query = `is:unread after:${Math.floor(lastSyncDate.getTime() / 1000)}`;

  const messages = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });

  // Get company clients with email domains for filtering
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

        // Extract email details
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

        // Check if we've already processed this thread
        const existingThread = await db.query.emailThreads.findFirst({
          where: eq(emailThreads.gmail_thread_id, threadId!),
        });

        if (!existingThread) {
          // Extract email body content
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

          // Get the first admin membership for creating tickets
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
        console.error("Error processing message in cron sync:", messageError);
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
    lastSyncAt: new Date().toISOString(),
  };
}
