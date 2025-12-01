# BlueDesk - Multi-Tenant Helpdesk SaaS

A modern, multi-tenant helpdesk SaaS built with Next.js, tRPC, Drizzle ORM, and Supabase.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: tRPC, Drizzle ORM
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Environment

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```bash
# Supabase (get from https://supabase.com/dashboard/project/_/settings/api)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Database (get from Supabase Database Settings)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# App
NEXT_PUBLIC_APP_URL="http://localhost:4000"
```

### 3. Setup Local Supabase

```bash
# Start Supabase locally
supabase start

# Apply existing migrations
supabase db push --local
```

### 4. Start Development

```bash
pnpm dev
```

Visit http://localhost:4000

## Development Workflow

### Making Database Changes

1. **Update Schema** - Edit `src/db/schema.ts`
2. **Generate Migration** - Run `pnpm db:generate`
3. **Apply Locally** - Run `supabase migration up --local` or `supabase db reset`
4. **Test Changes** - Verify in your local app
5. **Push to Production** - When ready: `supabase db push`

### Common Commands

```bash
# Development
pnpm dev                      # Start Next.js dev server
pnpm build                    # Build for production
pnpm lint                     # Run ESLint
pnpm type-check              # Run TypeScript checks

# Database
pnpm db:generate             # Generate Drizzle migrations from schema
pnpm db:studio               # Open Drizzle Studio

# Supabase
supabase start               # Start local Supabase
supabase stop                # Stop local Supabase
supabase status              # Check status
supabase db reset            # Reset local DB with migrations
supabase db push             # Push migrations to production
supabase db push --local     # Push migrations to local
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
├── db/              # Database schema (Drizzle)
├── server/          # tRPC routers & server code
└── trpc/            # tRPC client setup

supabase/
└── migrations/      # SQL migrations
```

## Features

- Multi-tenant with Row Level Security (RLS)
- Ticket management with SLA tracking
- User roles (Owner, Admin, Agent)
- Knowledge base
- Gmail integration
- Customer portal access
- Real-time dashboard analytics

## Local Development URLs

- **App**: http://localhost:4000
- **Supabase Studio**: http://127.0.0.1:55323
- **Supabase API**: http://127.0.0.1:55321
- **Drizzle Studio**: `pnpm db:studio`

## Deployment

1. Create a Supabase project at https://supabase.com
2. Update `.env.production` with production credentials
3. Push migrations: `supabase db push`
4. Deploy to Vercel/Railway/your platform
5. Set environment variables in deployment platform

---

Built with ❤️ for AI startups
