# Claude Instructions for BlueDesk Project

This document provides project-specific instructions for Claude to ensure consistent development practices across the BlueDesk application.

## Project Overview

BlueDesk is a Next.js application built with:

- **Framework**: Next.js 14 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase
- **UI**: Tailwind CSS + shadcn/ui + Radix UI components
- **State Management**: tRPC + React Query
- **Styling**: Tailwind CSS with custom design system
- **Package Manager**: pnpm
- **Rich Text**: TipTap editor

## Development Commands

When working on this project, use these specific commands:

### Database & Services

```bash
# Start all development services
pnpm run dev:services

# Stop all services
pnpm run stop:services

# Database operations
pnpm run db:generate    # Generate Drizzle migrations
pnpm run db:push        # Push schema changes
pnpm run db:migrate     # Run migrations
pnpm run db:studio      # Open Drizzle Studio
```

### Development

```bash
pnpm dev                # Start development server
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run ESLint
pnpm type-check         # Run TypeScript type checking
```

## Code Quality Standards

### Linting & Type Checking

- **Always run** `pnpm lint` and `pnpm type-check` after making code changes
- ESLint and TypeScript errors are ignored during builds (see next.config.js) but should be fixed during development
- Follow the existing ESLint configuration in `eslint.config.mjs`

### Code Style

- Use TypeScript for all new files
- Follow the existing code conventions (analyze existing files first)
- Use the `~/*` path alias for imports from the `src/` directory
- Prefer existing utility functions and components over creating new ones

## Project Structure

```
src/
├── app/                # Next.js App Router pages
├── components/         # Reusable UI components
├── contexts/          # React contexts
├── db/                # Database schema and utilities
├── lib/               # Utility functions and configurations
├── server/            # Server-side code and API routes
├── trpc/              # tRPC setup and routers
└── utils/             # General utilities
```

## Database & Backend

### Database Schema

- Located in `src/db/schema.ts`
- Use Drizzle ORM for all database operations
- Migrations are stored in `supabase/migrations/`
- Configuration in `drizzle.config.ts`

### API Architecture

- Use tRPC for type-safe API routes
- Server procedures in `src/server/`
- Client setup in `src/trpc/`

## UI Guidelines

### Components

- Use shadcn/ui components as the base layer
- Extend with custom components in `src/components/`
- Follow the existing component patterns and structure
- Use Radix UI primitives for complex interactions

### Styling

- Use Tailwind CSS for all styling
- Custom colors and theme defined in `tailwind.config.ts`
- Dark mode support via `next-themes`
- Use CSS custom properties for theming

### Fonts

- Geist Sans and Geist Mono are configured
- Fonts are loaded via the theme configuration

## Environment Setup

### Required Environment Variables

Reference `.env.example` for all required variables:

- Database connection (`DATABASE_URL`)
- Supabase configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- App URL (`NEXT_PUBLIC_APP_URL`)

### Development Environment

- Use `.env.local` for local development
- Production environment uses `.env.production`

## Important Notes

### Build Configuration

- TypeScript errors and ESLint errors are ignored during builds
- This is intentional for rapid prototyping but code should still follow standards
- Experimental typed routes are enabled

### Package Management

- **Always use pnpm** (not npm or yarn)
- Dependencies are managed in `package.json`
- Lock file is `pnpm-lock.yaml`

### Git Workflow

- Follow conventional commit messages
- Ensure code is properly formatted before committing
- Run type checks and linting before pushing

## Development Workflow

1. **Before making changes**: Understand existing patterns by reading similar files
2. **During development**: Use type-safe APIs and follow TypeScript best practices
3. **Before committing**: Run `pnpm lint` and `pnpm type-check`
4. **Testing**: Test functionality manually in development environment

## Additional Documentation

- `README.md` - Project setup instructions
- `SETUP.md` - Development environment setup
- `SUPABASE_SETUP.md` - Supabase configuration
- `GMAIL_SETUP.md` - Gmail integration setup

## File Path References

When referencing code locations, always use the format `file_path:line_number` for easy navigation.

Example: `src/app/page.tsx:25` for line 25 in the main page component.
