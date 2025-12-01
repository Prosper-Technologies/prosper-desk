import { z } from "zod"
import { google } from "googleapis"
import {
  createTRPCRouter,
  companyProcedure,
  adminCompanyProcedure,
} from "~/server/api/trpc"
import {
  gmailIntegration,
  tickets,
  ticketComments,
  emailThreads,
  clients,
  memberships,
} from "~/db/schema"
import { eq, and } from "drizzle-orm"
import { TRPCError } from "@trpc/server"

// Gmail OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

// Helper function to create OAuth client with token refresh handling
const createOAuthClientWithRefresh = () => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  // Enable automatic token refresh
  client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      // Refresh token received - you might want to store this in the database
      console.log("New refresh token received")
    }
  })

  return client
}

export const gmailRouter = createTRPCRouter({
  // Get Gmail integration status
  getIntegration: companyProcedure.query(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.company_id, ctx.company.id),
    })

    return integration
  }),

  // Get OAuth URL for Gmail setup
  getAuthUrl: adminCompanyProcedure.query(() => {
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ]

    // Generate a random state parameter for CSRF protection
    const state = Math.random().toString(36).substring(2, 15)

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state,
    })

    return { authUrl, state }
  }),

  // Setup Gmail integration with OAuth code
  setupIntegration: adminCompanyProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create a new OAuth2 client instance for this request
        // to avoid state conflicts between concurrent requests
        const oauth2ClientInstance = createOAuthClientWithRefresh()

        // Exchange code for tokens
        const { tokens } = await oauth2ClientInstance.getToken(input.code)

        if (!tokens.access_token || !tokens.refresh_token) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to get access tokens from Google",
          })
        }

        // Set credentials to get user info
        oauth2ClientInstance.setCredentials(tokens)

        // Get user email
        const oauth2 = google.oauth2({
          version: "v2",
          auth: oauth2ClientInstance,
        })
        const userInfo = await oauth2.userinfo.get()

        if (!userInfo.data.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to get user email from Google",
          })
        }

        // Save or update integration
        const existingIntegration =
          await ctx.db.query.gmailIntegration.findFirst({
            where: eq(gmailIntegration.company_id, ctx.company.id),
          })

        if (existingIntegration) {
          // Update existing
          const [updatedIntegration] = await ctx.db
            .update(gmailIntegration)
            .set({
              email: userInfo.data.email,
              refresh_token: tokens.refresh_token,
              access_token: tokens.access_token,
              token_expires_at: tokens.expiry_date
                ? new Date(tokens.expiry_date)
                : null,
              is_active: true,
              updated_at: new Date(),
            })
            .where(eq(gmailIntegration.id, existingIntegration.id))
            .returning()

          return updatedIntegration
        } else {
          // Create new
          const [newIntegration] = await ctx.db
            .insert(gmailIntegration)
            .values({
              company_id: ctx.company.id,
              email: userInfo.data.email,
              refresh_token: tokens.refresh_token,
              access_token: tokens.access_token,
              token_expires_at: tokens.expiry_date
                ? new Date(tokens.expiry_date)
                : null,
              is_active: true,
            })
            .returning()

          return newIntegration
        }
      } catch (error) {
        console.error("Gmail setup error:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to setup Gmail integration",
        })
      }
    }),

  // Disable Gmail integration
  disableIntegration: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.company_id, ctx.company.id),
    })

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Gmail integration found",
      })
    }

    await ctx.db
      .update(gmailIntegration)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(gmailIntegration.id, integration.id))

    return { success: true }
  }),

  // Test Gmail connection
  testConnection: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    })

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active Gmail integration found",
      })
    }

    try {
      // Set up OAuth client with stored tokens
      const oauth2ClientInstance = createOAuthClientWithRefresh()
      oauth2ClientInstance.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      })

      // Test by getting user profile
      const gmail = google.gmail({ version: "v1", auth: oauth2ClientInstance })
      const profile = await gmail.users.getProfile({ userId: "me" })

      // Update last sync time
      await ctx.db
        .update(gmailIntegration)
        .set({
          last_sync_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id))

      return {
        success: true,
        email: integration.email,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal,
      }
    } catch (error) {
      console.error("Gmail connection test failed:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Gmail connection test failed",
      })
    }
  }),

  // Setup Gmail push notifications
  setupPushNotifications: companyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.company_id, ctx.company.id),
    })

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Gmail integration not found",
      })
    }

    const oauth2Client = createOAuthClientWithRefresh()
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    try {
      // Set up push notifications
      const watchResponse = await gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName: process.env.GOOGLE_PUBSUB_TOPIC!,
          labelIds: ["INBOX"],
          labelFilterBehavior: "include",
        },
      })

      // Update integration with history ID
      await ctx.db
        .update(gmailIntegration)
        .set({
          last_history_id: watchResponse.data.historyId,
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id))

      return {
        success: true,
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration,
      }
    } catch (error) {
      console.error("Failed to setup push notifications:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to setup push notifications",
      })
    }
  }),

  // Sync emails and create tickets
  syncEmails: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    })

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active Gmail integration found",
      })
    }

    try {
      // Set up OAuth client
      const oauth2ClientInstance = createOAuthClientWithRefresh()
      oauth2ClientInstance.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      })

      const gmail = google.gmail({ version: "v1", auth: oauth2ClientInstance })

      // Get recent messages (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const query = `is:unread after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`

      const messages = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 10,
      })

      // Get company clients with email domains for filtering
      const companyClients = await ctx.db.query.clients.findMany({
        where: and(
          eq(clients.company_id, ctx.company.id),
          eq(clients.is_active, true)
        ),
      })

      // Create a map of email domains to clients
      const domainToClient = new Map<string, (typeof companyClients)[0]>()
      companyClients.forEach((client) => {
        const domains = Array.isArray(client.email_domains)
          ? client.email_domains
          : []
        domains.forEach((domain: string) => {
          if (domain && typeof domain === "string") {
            domainToClient.set(domain.toLowerCase(), client)
          }
        })
      })

      let ticketsCreated = 0

      // Process unique threads instead of individual messages
      const processedThreads = new Set<string>()

      if (messages.data.messages) {
        for (const message of messages.data.messages) {
          try {
            const fullMessage = await gmail.users.messages.get({
              userId: "me",
              id: message.id!,
              format: "full",
            })

            const threadId = fullMessage.data.threadId

            // Skip if we've already processed this thread
            if (processedThreads.has(threadId!)) {
              continue
            }
            processedThreads.add(threadId!)

            // Get the full Gmail thread with all messages
            const fullThread = await gmail.users.threads.get({
              userId: "me",
              id: threadId!,
              format: "full",
            })

            if (
              !fullThread.data.messages ||
              fullThread.data.messages.length === 0
            ) {
              continue
            }

            // Get the first message (original email) details
            const firstMessage = fullThread.data.messages[0]
            const headers = firstMessage.payload?.headers || []
            const subject =
              headers.find((h) => h.name === "Subject")?.value || "No Subject"
            const from = headers.find((h) => h.name === "From")?.value || ""

            // Extract sender domain
            const emailMatch =
              from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/)
            const senderEmail = emailMatch
              ? emailMatch[1] || emailMatch[0]
              : from
            const senderDomain = senderEmail.includes("@")
              ? senderEmail.split("@")[1]?.toLowerCase()
              : ""

            // Check if sender domain matches any client domain
            const matchedClient = senderDomain
              ? domainToClient.get(senderDomain)
              : null

            // Only process emails from configured client domains
            if (!matchedClient) {
              console.log(
                `Skipping email from ${senderEmail} - domain ${senderDomain} not configured for any client`
              )
              continue
            }

            // Check if we've already processed this thread
            const existingThread = await ctx.db.query.emailThreads.findFirst({
              where: eq(emailThreads.gmail_thread_id, threadId!),
            })

            if (!existingThread) {
              // Helper function to extract email body content
              const extractTextFromParts = (parts: any[]): string => {
                let text = ""
                for (const part of parts) {
                  if (part.mimeType === "text/plain" && part.body?.data) {
                    text +=
                      Buffer.from(part.body.data, "base64").toString("utf-8") +
                      "\n"
                  } else if (
                    part.mimeType === "text/html" &&
                    part.body?.data &&
                    !text
                  ) {
                    // Fallback to HTML if no plain text
                    text +=
                      Buffer.from(part.body.data, "base64")
                        .toString("utf-8")
                        .replace(/<[^>]*>/g, "") + "\n"
                  } else if (part.parts) {
                    text += extractTextFromParts(part.parts)
                  }
                }
                return text
              }

              const extractEmailBody = (message: any): string => {
                let emailBody = ""
                if (message.payload?.parts) {
                  emailBody = extractTextFromParts(message.payload.parts)
                } else if (message.payload?.body?.data) {
                  emailBody = Buffer.from(
                    message.payload.body.data,
                    "base64"
                  ).toString("utf-8")
                }
                return emailBody.trim()
              }

              // Get the first message body for the ticket description
              const firstMessageBody = extractEmailBody(firstMessage)

              // Create new ticket for this email thread
              const [newTicket] = await ctx.db
                .insert(tickets)
                .values({
                  company_id: ctx.company.id,
                  client_id: matchedClient.id,
                  subject,
                  description: `Email from: ${from}\n\nSubject: ${subject}\n\n${firstMessageBody}`,
                  status: "open",
                  priority: "medium",
                  customer_email: senderEmail,
                  customer_name: from.split("<")[0]?.trim() || senderEmail,
                  created_by_membership_id: ctx.membership.id,
                })
                .returning()

              // Process remaining messages in the thread as comments
              for (let i = 1; i < fullThread.data.messages.length; i++) {
                const threadMessage = fullThread.data.messages[i]
                const messageHeaders = threadMessage.payload?.headers || []
                const messageFrom =
                  messageHeaders.find((h) => h.name === "From")?.value || ""
                const messageDate =
                  messageHeaders.find((h) => h.name === "Date")?.value || ""
                const messageBody = extractEmailBody(threadMessage)

                if (messageBody) {
                  // Create ticket comment for this reply
                  await ctx.db.insert(ticketComments).values({
                    company_id: ctx.company.id,
                    ticket_id: newTicket.id,
                    membership_id: null, // External email, not from a team member
                    customer_portal_access_id: null,
                    content: `Reply from: ${messageFrom}\nDate: ${messageDate}\n\n${messageBody}`,
                    is_internal: false, // Customer-visible
                    is_system: true, // System-generated from email
                  })

                  console.log(
                    `Added email reply as comment to ticket ${newTicket.id}`
                  )
                }
              }

              // Get all participants in the thread
              const participants = fullThread.data.messages
                .map((msg) => {
                  const headers = msg.payload?.headers || []
                  return headers.find((h) => h.name === "From")?.value || ""
                })
                .filter(Boolean)
              const uniqueParticipants = Array.from(new Set(participants))

              // Create email thread record
              await ctx.db.insert(emailThreads).values({
                company_id: ctx.company.id,
                ticket_id: newTicket.id,
                gmail_thread_id: threadId!,
                subject,
                participants: uniqueParticipants,
                last_message_id:
                  fullThread.data.messages[fullThread.data.messages.length - 1]
                    .id!,
              })

              ticketsCreated++
              console.log(
                `Created ticket ${newTicket.id} with ${fullThread.data.messages.length - 1} replies for thread from ${senderEmail} (client: ${matchedClient.name})`
              )
            }
          } catch (messageError) {
            console.error("Error processing message:", messageError)
            continue
          }
        }
      }

      // Update last sync time
      await ctx.db
        .update(gmailIntegration)
        .set({
          last_sync_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id))

      return {
        success: true,
        messagesProcessed: messages.data.messages?.length || 0,
        ticketsCreated,
      }
    } catch (error) {
      console.error("Gmail sync error:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to sync Gmail emails",
      })
    }
  }),

  // Auto sync emails (can be called by cron job or webhook)
  autoSyncEmails: companyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    })

    if (!integration) {
      return { success: false, message: "No active Gmail integration found" }
    }

    try {
      // Set up OAuth client
      const oauth2ClientInstance = createOAuthClientWithRefresh()
      oauth2ClientInstance.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      })

      const gmail = google.gmail({ version: "v1", auth: oauth2ClientInstance })

      // Get recent messages since last sync (or last 1 hour if no last sync)
      const lastSyncDate =
        integration.last_sync_at || new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      const query = `is:unread after:${Math.floor(lastSyncDate.getTime() / 1000)}`

      const messages = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 50, // Process more messages for auto sync
      })

      // Get company clients with email domains for filtering
      const companyClients = await ctx.db.query.clients.findMany({
        where: and(
          eq(clients.company_id, ctx.company.id),
          eq(clients.is_active, true)
        ),
      })

      const domainToClient = new Map<string, (typeof companyClients)[0]>()
      companyClients.forEach((client) => {
        const domains = Array.isArray(client.email_domains)
          ? client.email_domains
          : []
        domains.forEach((domain: string) => {
          if (domain && typeof domain === "string") {
            domainToClient.set(domain.toLowerCase(), client)
          }
        })
      })

      let ticketsCreated = 0
      let messagesProcessed = 0

      if (messages.data.messages) {
        for (const message of messages.data.messages) {
          try {
            const fullMessage = await gmail.users.messages.get({
              userId: "me",
              id: message.id!,
              format: "full",
            })

            messagesProcessed++

            // Extract email details
            const headers = fullMessage.data.payload?.headers || []
            const subject =
              headers.find((h) => h.name === "Subject")?.value || "No Subject"
            const from = headers.find((h) => h.name === "From")?.value || ""
            const threadId = fullMessage.data.threadId

            // Extract sender domain
            const emailMatch =
              from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/)
            const senderEmail = emailMatch
              ? emailMatch[1] || emailMatch[0]
              : from
            const senderDomain = senderEmail.includes("@")
              ? senderEmail.split("@")[1]?.toLowerCase()
              : ""

            const matchedClient = senderDomain
              ? domainToClient.get(senderDomain)
              : null

            if (!matchedClient) {
              continue
            }

            // Check if we've already processed this thread
            const existingThread = await ctx.db.query.emailThreads.findFirst({
              where: eq(emailThreads.gmail_thread_id, threadId!),
            })

            if (!existingThread) {
              // Extract email body content
              let emailBody = ""
              const extractTextFromParts = (parts: any[]): string => {
                let text = ""
                for (const part of parts) {
                  if (part.mimeType === "text/plain" && part.body?.data) {
                    text +=
                      Buffer.from(part.body.data, "base64").toString("utf-8") +
                      "\n"
                  } else if (
                    part.mimeType === "text/html" &&
                    part.body?.data &&
                    !text
                  ) {
                    text +=
                      Buffer.from(part.body.data, "base64")
                        .toString("utf-8")
                        .replace(/<[^>]*>/g, "") + "\n"
                  } else if (part.parts) {
                    text += extractTextFromParts(part.parts)
                  }
                }
                return text
              }

              if (fullMessage.data.payload?.parts) {
                emailBody = extractTextFromParts(fullMessage.data.payload.parts)
              } else if (fullMessage.data.payload?.body?.data) {
                emailBody = Buffer.from(
                  fullMessage.data.payload.body.data,
                  "base64"
                ).toString("utf-8")
              }

              // Get the admin membership for creating tickets
              const adminMembership = await ctx.db.query.memberships.findFirst({
                where: and(
                  eq(memberships.company_id, ctx.company.id),
                  eq(memberships.role, "admin"),
                  eq(memberships.is_active, true)
                ),
              })

              const [newTicket] = await ctx.db
                .insert(tickets)
                .values({
                  company_id: ctx.company.id,
                  client_id: matchedClient.id,
                  subject,
                  description: `Email from: ${from}\n\nSubject: ${subject}\n\n${emailBody.trim()}`,
                  status: "open",
                  priority: "medium",
                  customer_email: senderEmail,
                  customer_name: from.split("<")[0]?.trim() || senderEmail,
                  created_by_membership_id: adminMembership?.id,
                })
                .returning()

              await ctx.db.insert(emailThreads).values({
                company_id: ctx.company.id,
                ticket_id: newTicket.id,
                gmail_thread_id: threadId!,
                subject,
                participants: [from],
                last_message_id: message.id!,
              })

              ticketsCreated++
            }
          } catch (messageError) {
            console.error(
              "Error processing message in auto sync:",
              messageError
            )
            continue
          }
        }
      }

      // Update last sync time
      await ctx.db
        .update(gmailIntegration)
        .set({
          last_sync_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id))

      return {
        success: true,
        messagesProcessed,
        ticketsCreated,
        lastSyncAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Gmail auto sync error:", error)
      return {
        success: false,
        message: "Auto sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }),

  // Update Gmail integration configuration
  updateConfiguration: adminCompanyProcedure
    .input(
      z.object({
        auto_sync_enabled: z.boolean().optional(),
        sync_frequency_minutes: z.number().min(5).max(1440).optional(), // Between 5 minutes and 24 hours
        auto_create_tickets: z.boolean().optional(),
        default_ticket_priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.db.query.gmailIntegration.findFirst({
        where: eq(gmailIntegration.company_id, ctx.company.id),
      })

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Gmail integration found",
        })
      }

      const [updatedIntegration] = await ctx.db
        .update(gmailIntegration)
        .set({
          ...input,
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id))
        .returning()

      return updatedIntegration
    }),

  // Get Gmail integration configuration
  getConfiguration: companyProcedure.query(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.company_id, ctx.company.id),
    })

    if (!integration) {
      return null
    }

    return {
      auto_sync_enabled: integration.auto_sync_enabled,
      sync_frequency_minutes: integration.sync_frequency_minutes,
      auto_create_tickets: integration.auto_create_tickets,
      default_ticket_priority: integration.default_ticket_priority,
      last_sync_at: integration.last_sync_at,
      is_active: integration.is_active,
    }
  }),

  // Subscribe to Gmail push notifications
  subscribeToWebhook: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    })

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active Gmail integration found",
      })
    }

    try {
      const oauth2ClientInstance = createOAuthClientWithRefresh()
      oauth2ClientInstance.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      })

      const gmail = google.gmail({ version: "v1", auth: oauth2ClientInstance })

      // Subscribe to push notifications
      const result = await gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName: process.env.GOOGLE_PUBSUB_TOPIC, // e.g., "projects/your-project/topics/gmail-notifications"
          labelIds: ["INBOX"],
          labelFilterAction: "include",
        },
      })

      console.log("Gmail webhook subscription result:", result.data)

      // Update integration with webhook info
      await ctx.db
        .update(gmailIntegration)
        .set({
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id))

      return {
        success: true,
        historyId: result.data.historyId,
        expiration: result.data.expiration,
      }
    } catch (error) {
      console.error("Gmail webhook subscription failed:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to subscribe to Gmail webhook",
      })
    }
  }),

  // Unsubscribe from Gmail push notifications
  unsubscribeFromWebhook: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    })

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active Gmail integration found",
      })
    }

    try {
      const oauth2ClientInstance = createOAuthClientWithRefresh()
      oauth2ClientInstance.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      })

      const gmail = google.gmail({ version: "v1", auth: oauth2ClientInstance })

      // Stop push notifications
      await gmail.users.stop({
        userId: "me",
      })

      return { success: true }
    } catch (error) {
      console.error("Gmail webhook unsubscribe failed:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to unsubscribe from Gmail webhook",
      })
    }
  }),
})
