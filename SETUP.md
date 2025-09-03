# BlueDesk Setup Guide

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
```

Fill in your environment variables:
- `DATABASE_URL`: Your PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon public key
- `NEXT_PUBLIC_APP_URL`: Your app URL (http://localhost:3000 for dev)

### 3. Database Setup

```bash
# Generate migrations from schema
pnpm db:generate

# Run migrations
pnpm db:migrate
```

**Important**: Apply RLS policies in Supabase SQL Editor:
1. Go to your Supabase dashboard → SQL Editor
2. Copy and paste the contents of `supabase/rls-policies.sql`
3. Run the SQL

### 4. Start Development
```bash
pnpm dev
```

## 🔧 Troubleshooting

### Missing Radix UI Components
If you get errors about missing Radix UI components, the project uses shadcn/ui. All necessary components are already included in the codebase in `src/components/ui/`.

### Supabase Auth Issues
- Make sure RLS policies are applied
- Verify your Supabase project settings allow the redirect URLs
- Check that your environment variables are correctly set

### Database Connection Issues
- Ensure your PostgreSQL database is running
- Verify the `DATABASE_URL` format: `postgresql://username:password@localhost:5432/database_name`
- Make sure the database exists

## 📋 Next Steps

1. **Configure Supabase**:
   - Set up your Supabase project
   - Configure authentication providers (Google OAuth, etc.)
   - Apply RLS policies from `supabase/rls-policies.sql`

2. **Customize Branding**:
   - Update app name in `src/app/layout.tsx`
   - Modify colors in `src/styles/globals.css`
   - Update company references throughout the codebase

3. **Deploy**:
   - Set up environment variables in your deployment platform
   - Run database migrations in production
   - Configure your domain and auth redirects

## 🛠️ Development Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production  
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript checks
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio