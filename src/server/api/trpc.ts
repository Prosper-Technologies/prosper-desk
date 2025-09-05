import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { createServerClient } from "@supabase/ssr";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "~/db";
import { env } from "~/env";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;

  // Create a cookie store that works with the request/response
  const cookieStore = {
    get(name: string) {
      // Try Next.js RequestCookies object first (newer API routes)
      if (req.cookies && typeof (req.cookies as any).get === "function") {
        const cookie = (req.cookies as any).get(name);
        return cookie?.value;
      }

      // Fallback to standard req.cookies object (older API routes)
      if (req.cookies && typeof req.cookies === "object" && req.cookies[name]) {
        return req.cookies[name];
      }

      // Final fallback to parsing cookie header manually
      const cookie = req.headers.cookie;
      if (!cookie) return undefined;

      const match = cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
      return match ? decodeURIComponent(match[2]) : undefined;
    },
    set(name: string, value: string, options: any = {}) {
      if (!res) return;

      let cookieString = `${name}=${encodeURIComponent(value)}; Path=/`;

      if (options.maxAge) {
        cookieString += `; Max-Age=${options.maxAge}`;
      }
      if (options.httpOnly) {
        cookieString += `; HttpOnly`;
      }
      if (options.secure) {
        cookieString += `; Secure`;
      }
      if (options.sameSite) {
        cookieString += `; SameSite=${options.sameSite}`;
      }

      // Get existing Set-Cookie headers
      const existingCookies = res.getHeader("Set-Cookie");
      const cookieArray = Array.isArray(existingCookies)
        ? existingCookies
        : existingCookies
        ? [existingCookies as string]
        : [];

      res.setHeader("Set-Cookie", [...cookieArray, cookieString]);
    },
    remove(name: string, options: any = {}) {
      if (!res) return;

      let cookieString =
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

      if (options.httpOnly) {
        cookieString += `; HttpOnly`;
      }
      if (options.secure) {
        cookieString += `; Secure`;
      }
      if (options.sameSite) {
        cookieString += `; SameSite=${options.sameSite}`;
      }

      // Get existing Set-Cookie headers
      const existingCookies = res.getHeader("Set-Cookie");
      const cookieArray = Array.isArray(existingCookies)
        ? existingCookies
        : existingCookies
        ? [existingCookies as string]
        : [];

      res.setHeader("Set-Cookie", [...cookieArray, cookieString]);
    },
  };

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: cookieStore,
    },
  );

  const supabaseAdmin = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: cookieStore,
    },
  );

  // Get session from Supabase
  let session = null;
  try {
    const {
      data: { session: authSession },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      console.error("❌ Session error:", error);
    } else {
      console.log(
        "✅ Session retrieved:",
        authSession ? "USER FOUND" : "NO USER",
      );
      session = authSession;
    }
  } catch (error) {
    console.error("❌ Session catch error:", error);
  }

  return {
    db,
    session,
    supabase,
    supabaseAdmin,
    req,
    res,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError
          ? error.cause.flatten()
          : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Admin procedure
 *
 * Only allows admin users to access the procedure.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Get user and their memberships from database to check role
  const user = await ctx.db.query.users.findFirst({
    where: (users, { eq }) => eq(users.auth_user_id, ctx.session.user.id),
    with: {
      memberships: {
        where: (memberships, { and, eq, or }) =>
          and(
            eq(memberships.is_active, true),
            or(eq(memberships.role, "admin"), eq(memberships.role, "owner")),
          ),
        with: {
          company: true,
        },
      },
    },
  });

  if (!user || !user.memberships.length) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

/**
 * Company context procedure
 *
 * Ensures the user belongs to a company and adds company context.
 * Uses X-Company-Id header to determine which company to operate on.
 */
export const companyProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.auth_user_id, ctx.session.user.id),
      with: {
        memberships: {
          where: (memberships, { eq }) => eq(memberships.is_active, true),
          with: {
            company: true,
          },
        },
      },
    });

    if (!user?.memberships?.length) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User not associated with any company",
      });
    }

    // Check for company selection via header
    const companyId = ctx.req?.headers?.["x-company-id"] as string;
    let membership = user.memberships[0]; // Default to first membership

    if (companyId) {
      // Find the specific membership for the requested company
      const requestedMembership = user.memberships.find(
        (m) => m.company.id === companyId,
      );

      if (requestedMembership) {
        membership = requestedMembership;
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User not authorized for this company",
        });
      }
    }

    return next({
      ctx: {
        ...ctx,
        user,
        membership,
        company: membership.company,
      },
    });
  },
);

/**
 * Admin company context procedure
 *
 * Combines admin role checking with company context.
 * Only allows admin or owner roles to proceed.
 */
export const adminCompanyProcedure = companyProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.membership.role !== "admin" && ctx.membership.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    return next({
      ctx,
    });
  },
);
