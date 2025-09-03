# 🚀 Supabase Local Development Setup

Your Supabase local development environment is now configured and running!

## 📋 **What's Been Set Up**

### ✅ **Local Supabase Stack**
- **PostgreSQL Database**: Running on `localhost:54322`
- **API Gateway**: Running on `http://127.0.0.1:54321`
- **Auth Service**: User authentication and management
- **Storage**: File upload and management
- **Realtime**: WebSocket connections for live updates
- **Email Testing**: Inbucket for testing emails

### ✅ **Database Schema Applied**
- Multi-tenant schema with RLS policies
- Complete helpdesk data model (companies, users, tickets, etc.)
- Sample seed data for testing
- Automatic triggers for updated_at timestamps

### ✅ **Environment Configuration**
- Local environment variables configured in `.env.local`
- Drizzle ORM connected to local database
- tRPC configured for local Supabase

## 🔗 **Local Development URLs**

| Service | URL | Purpose |
|---------|-----|---------|
| **API** | http://127.0.0.1:54321 | Main API endpoint |
| **Database** | postgresql://postgres:postgres@127.0.0.1:54322/postgres | Direct DB access |
| **Email Testing** | http://127.0.0.1:54324 | View sent emails |
| **Next.js App** | http://localhost:3000 | Your application |

## 🎯 **Getting Started**

### 1. **Start Your Next.js App**
```bash
pnpm dev
```

### 2. **Test Authentication**
- Visit http://localhost:3000
- Try signing up with: `admin@demo-ai-startup.com`
- This will link to the pre-seeded demo admin user

### 3. **Access Sample Data**
The database includes:
- **Demo Company**: "Demo AI Startup" 
- **Sample Users**: Admin and Agent users
- **Sample Tickets**: Various ticket examples with comments
- **Knowledge Base**: Sample help articles
- **SLA Policies**: Default response time policies

## 🛠️ **Development Commands**

```bash
# Supabase Commands
supabase status          # Check running services
supabase stop           # Stop all services
supabase start          # Start all services
supabase db reset       # Reset database with fresh migrations

# Database Commands
pnpm db:generate        # Generate new migrations from schema changes
pnpm db:push            # Push schema changes without migrations

# Application Commands
pnpm dev               # Start Next.js development server
pnpm build             # Build for production
pnpm lint              # Run ESLint
```

## 🔑 **Authentication Keys**

Your local development keys (safe to commit):

```bash
# Anonymous Key (public)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Service Role Key (admin access)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## 🧪 **Testing the Setup**

### 1. **Database Connection Test**
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 2. **API Test**
```bash
curl http://127.0.0.1:54321/rest/v1/companies \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### 3. **Email Testing**
- Visit http://127.0.0.1:54324 
- Sign up through your app
- Check the inbox for confirmation emails

## 🔄 **Schema Changes Workflow**

When you modify the database schema:

1. **Update the schema** in `src/db/schema.ts`
2. **Generate migration**: `pnpm db:generate`
3. **Apply migration**: `supabase db reset` (for local)
4. **Update types**: Restart your dev server

## 🚀 **Production Deployment**

When you're ready to deploy:

1. **Create Supabase project** at https://supabase.com
2. **Update environment variables** with production URLs
3. **Run migrations** in production
4. **Configure OAuth providers** in Supabase dashboard

## 💡 **Tips & Tricks**

- **Email Testing**: All emails are caught by Inbucket - no real emails sent
- **Data Persistence**: Local data persists between restarts
- **Reset Database**: Use `supabase db reset` to start fresh
- **Multiple Projects**: Use different project IDs to run multiple local instances

## 🛠️ **Troubleshooting**

### Port Already in Use
```bash
supabase stop --project-id <other-project>
supabase start
```

### Docker Issues
```bash
docker system prune
supabase start
```

### Database Connection Issues
- Check that Docker is running
- Verify ports 54321, 54322, 54323, 54324 are free
- Try `supabase stop` then `supabase start`

---

Your local Supabase development environment is ready! 🎉