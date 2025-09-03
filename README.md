# BlueDesk - Multi-Tenant Helpdesk SaaS

A modern, multi-tenant helpdesk SaaS built for AI startups using Next.js, tRPC, Drizzle ORM, and Supabase.

## 🚀 Features

### ✅ **Core Architecture**
- **Multi-tenancy**: Complete isolation with Row Level Security (RLS)
- **Type Safety**: End-to-end type safety with tRPC and TypeScript
- **Modern Stack**: Next.js App Router, Drizzle ORM, Supabase
- **DDD Structure**: Domain-driven design for scalability

### ✅ **Authentication & Onboarding**
- Supabase Auth with email/password and Google OAuth
- 3-step onboarding flow (Profile → Company → Complete)
- Flexible user system separate from auth (can switch providers)

### ✅ **Dashboard & Analytics**
- Real-time metrics and SLA tracking
- Agent workload distribution
- Priority and status analytics
- Recent tickets overview

### ✅ **Ticket Management**
- Full CRUD operations with comments
- Advanced filtering and search
- Ticket assignment and priority management
- SLA policy enforcement
- Internal vs customer-visible comments

### ✅ **User Management**
- Multi-role system (Admin, Agent, Customer)
- Company-based user isolation
- User invitation system

### 🔧 **Ready for Extension**
- Customer portal endpoints
- Knowledge base system
- Escalation policies
- Settings management

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: tRPC, Drizzle ORM
- **Database**: PostgreSQL with Supabase
- **Auth**: Supabase Auth
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: TanStack Query (React Query)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <your-repo>
   cd bluedesk
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Fill in your environment variables
   ```

3. **Database Setup**
   ```bash
   # Generate migrations (Supabase-compatible with timestamps)
   ./scripts/generate-migration.sh your_migration_name
   # OR: npm run db:generate:supabase
   
   # Run migrations locally (when database is available)
   npm run db:migrate
   
   # For Supabase: Apply migrations via Dashboard SQL Editor
   # See MIGRATION_GUIDE.md for detailed instructions
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API routes
├── components/            
│   ├── layout/            # Layout components
│   ├── tickets/           # Ticket-specific components
│   └── ui/                # shadcn/ui components
├── db/                    # Database schema and config
├── lib/                   # Utilities
├── server/api/            # tRPC routers
└── trpc/                  # tRPC client setup
```

## 🗄 Database Schema

### Core Entities
- **Companies**: Root tenant entity
- **Users**: Linked to companies with roles
- **Tickets**: Support tickets with SLA tracking
- **Ticket Comments**: Thread-based conversations
- **SLA Policies**: Response/resolution time targets
- **Knowledge Base**: Help articles per company
- **Customer Portal Access**: External customer access

### Security
- Complete Row Level Security (RLS) implementation
- Company-based data isolation
- Role-based access control

## 🔐 Multi-Tenancy

The application implements **row-level multi-tenancy**:

1. Every table has `company_id` for tenant isolation
2. RLS policies enforce data access boundaries
3. Users can only access their company's data
4. Automatic tenant context in all queries

## 🎨 UI Components

Built with **shadcn/ui** components:
- Consistent design system
- Dark mode support
- Accessible by default
- Customizable with CSS variables

## 🚀 Deployment

### Environment Variables
Set up these environment variables in your deployment:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Database Migration
Run migrations in production:
```bash
npm run db:migrate
```

### Build
```bash
npm run build
npm start
```

## 🛣 Roadmap

### Immediate Extensions
- [ ] Settings pages (company branding, SLA policies)
- [ ] Customer portal (external ticket submission)
- [ ] Knowledge base management
- [ ] Email notifications
- [ ] File attachments

### Advanced Features
- [ ] Webhook integrations
- [ ] Advanced reporting
- [ ] API rate limiting
- [ ] Multi-language support
- [ ] White-label customization

## 🤝 Contributing

This is a boilerplate project designed to be customized for your specific needs. Key areas for extension:

1. **Business Logic**: Extend tRPC routers in `src/server/api/routers/`
2. **UI Components**: Add components following the existing patterns
3. **Database**: Modify schema in `src/db/schema.ts`
4. **Auth**: Extend authentication in the auth router

## 📄 License

MIT License - see LICENSE file for details.

---

**Built for AI startups who need a solid foundation for customer support** 🚀