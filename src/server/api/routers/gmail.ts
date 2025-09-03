import { z } from "zod";
import { google } from 'googleapis';
import {
  createTRPCRouter,
  companyProcedure,
  adminCompanyProcedure,
} from "~/server/api/trpc";
import { gmailIntegration, tickets, emailThreads } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Gmail OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const gmailRouter = createTRPCRouter({
  // Get Gmail integration status
  getIntegration: companyProcedure.query(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.company_id, ctx.company.id),
    });

    return integration;
  }),

  // Get OAuth URL for Gmail setup
  getAuthUrl: adminCompanyProcedure.query(() => {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });

    return { authUrl };
  }),

  // Setup Gmail integration with OAuth code
  setupIntegration: adminCompanyProcedure
    .input(z.object({
      code: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Exchange code for tokens
        const { tokens } = await new Promise((resolve, reject) => {
          oauth2Client.getAccessToken(input.code, (err, tokens) => {
            if (err) reject(err);
            else resolve({ tokens });
          });
        }) as { tokens: any };
        
        if (!tokens.access_token || !tokens.refresh_token) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to get access tokens from Google",
          });
        }

        // Set credentials to get user info
        oauth2Client.setCredentials(tokens);
        
        // Get user email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        
        if (!userInfo.data.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to get user email from Google",
          });
        }

        // Save or update integration
        const existingIntegration = await ctx.db.query.gmailIntegration.findFirst({
          where: eq(gmailIntegration.company_id, ctx.company.id),
        });

        if (existingIntegration) {
          // Update existing
          const [updatedIntegration] = await ctx.db
            .update(gmailIntegration)
            .set({
              email: userInfo.data.email,
              refresh_token: tokens.refresh_token,
              access_token: tokens.access_token,
              token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
              is_active: true,
              updated_at: new Date(),
            })
            .where(eq(gmailIntegration.id, existingIntegration.id))
            .returning();

          return updatedIntegration;
        } else {
          // Create new
          const [newIntegration] = await ctx.db
            .insert(gmailIntegration)
            .values({
              company_id: ctx.company.id,
              email: userInfo.data.email,
              refresh_token: tokens.refresh_token,
              access_token: tokens.access_token,
              token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
              is_active: true,
            })
            .returning();

          return newIntegration;
        }
      } catch (error) {
        console.error('Gmail setup error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to setup Gmail integration",
        });
      }
    }),

  // Disable Gmail integration
  disableIntegration: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: eq(gmailIntegration.company_id, ctx.company.id),
    });

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Gmail integration found",
      });
    }

    await ctx.db
      .update(gmailIntegration)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(gmailIntegration.id, integration.id));

    return { success: true };
  }),

  // Test Gmail connection
  testConnection: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    });

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active Gmail integration found",
      });
    }

    try {
      // Set up OAuth client with stored tokens
      oauth2Client.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      });

      // Test by getting user profile
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      // Update last sync time
      await ctx.db
        .update(gmailIntegration)
        .set({
          last_sync_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(gmailIntegration.id, integration.id));

      return {
        success: true,
        email: integration.email,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal,
      };
    } catch (error) {
      console.error('Gmail connection test failed:', error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Gmail connection test failed",
      });
    }
  }),

  // Sync emails and create tickets
  syncEmails: adminCompanyProcedure.mutation(async ({ ctx }) => {
    const integration = await ctx.db.query.gmailIntegration.findFirst({
      where: and(
        eq(gmailIntegration.company_id, ctx.company.id),
        eq(gmailIntegration.is_active, true)
      ),
    });

    if (!integration) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active Gmail integration found",
      });
    }

    try {
      // Set up OAuth client
      oauth2Client.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get recent messages (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const query = `is:unread after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;
      
      const messages = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10,
      });

      let ticketsCreated = 0;

      if (messages.data.messages) {
        for (const message of messages.data.messages) {
          try {
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'full',
            });

            // Extract email details
            const headers = fullMessage.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const threadId = fullMessage.data.threadId;

            // Check if we've already processed this thread
            const existingThread = await ctx.db.query.emailThreads.findFirst({
              where: eq(emailThreads.gmail_thread_id, threadId!),
            });

            if (!existingThread) {
              // Create new ticket for this email thread
              const [newTicket] = await ctx.db
                .insert(tickets)
                .values({
                  company_id: ctx.company.id,
                  subject,
                  description: `Email from: ${from}\n\nSubject: ${subject}`,
                  status: 'open',
                  priority: 'medium',
                  created_by_membership_id: ctx.membership.id,
                })
                .returning();

              // Create email thread record
              await ctx.db
                .insert(emailThreads)
                .values({
                  company_id: ctx.company.id,
                  ticket_id: newTicket.id,
                  gmail_thread_id: threadId!,
                  subject,
                  participants: [from],
                  last_message_id: message.id!,
                });

              ticketsCreated++;
            }
          } catch (messageError) {
            console.error('Error processing message:', messageError);
            continue;
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
        .where(eq(gmailIntegration.id, integration.id));

      return {
        success: true,
        messagesProcessed: messages.data.messages?.length || 0,
        ticketsCreated,
      };
    } catch (error) {
      console.error('Gmail sync error:', error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to sync Gmail emails",
      });
    }
  }),
});