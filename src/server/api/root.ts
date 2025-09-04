import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { authRouter } from "./routers/auth";
import { companyRouter } from "./routers/company";
import { userRouter } from "./routers/user";
import { ticketRouter } from "./routers/ticket";
import { knowledgeBaseRouter } from "./routers/knowledgeBase";
import { dashboardRouter } from "./routers/dashboard";
import { customerPortalRouter } from "./routers/customerPortal";
import { clientRouter } from "./routers/client";
import { slaRouter } from "./routers/sla";
import { gmailRouter } from "./routers/gmail";
import { apiKeysRouter } from "./routers/apiKeys";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  company: companyRouter,
  user: userRouter,
  ticket: ticketRouter,
  knowledgeBase: knowledgeBaseRouter,
  dashboard: dashboardRouter,
  customerPortal: customerPortalRouter,
  clients: clientRouter,
  sla: slaRouter,
  gmail: gmailRouter,
  apiKeys: apiKeysRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
