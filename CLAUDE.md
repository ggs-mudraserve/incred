# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is "Incred Followup" - a Supabase-backed loan lead management application built with Next.js 15, TypeScript, and Tailwind CSS. The project has two main parts:

- **Root level**: Basic npm package with MCP server configuration
- **`app/` directory**: Main Next.js application

### MCP Servers Available
- **supabase**: Direct Supabase database operations and management
- **context7**: Up-to-date library documentation and code examples
- **serena**: AI-powered development assistance and code analysis

## Development Commands

All development work should be done in the `app/` directory:

```bash
cd app
npm run dev        # Start development server (http://localhost:3000)
npm run build      # Build for production  
npm run start      # Start production server
npm run lint       # Run ESLint with next/core-web-vitals and next/typescript configs
```

**Important**: Always run `npm run lint` after making changes to ensure code quality and TypeScript compliance.

## Architecture Overview

### Frontend Stack
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** + **shadcn/ui** components for UI
- **Framer Motion** for animations
- **React 19** with modern patterns

### Backend & Database
- **Supabase** for authentication, database, and real-time features
- **PostgreSQL** with Row Level Security (RLS) policies
- Database schema defined in `database.md`

### Key Application Features
- **Role-based access**: Admin and Agent roles with different permissions
- **Lead Management**: CSV upload, assignment, status tracking, notes
- **Application Pipeline**: Kanban-style workflow (UnderReview → Approved → Reject/Disbursed)
- **Dashboard**: Admin analytics tables (no charts, tables only)

### Project Structure
```
app/src/
├── app/                 # Next.js App Router pages
│   ├── admin/          # Admin-only pages (users, leads, upload, dashboard, applications)
│   ├── agent/          # Agent-only pages (dashboard, applications)
│   ├── login/          # Authentication
│   └── setup/          # Initial setup
├── components/
│   ├── ui/             # shadcn/ui components
│   └── RoleGuard.tsx   # Role-based access control
├── contexts/
│   └── AuthContext.tsx # Supabase auth state management
├── lib/
│   ├── supabase.ts     # Supabase client and type exports
│   └── utils.ts        # Utility functions
└── types/
    └── database.ts     # Generated Supabase database types
```

### Authentication & Authorization
- Uses Supabase Auth with email/password
- No public signup - only admins can create users
- Role-based routing with `RoleGuard` component
- Profile data stored in `profiles` table with role enum (admin/agent)

### Data Flow
- **Leads**: Upload via CSV → assign to agents → status updates → notes tracking
- **Applications**: Created when lead status = "banking received" → move through Kanban stages
- **RLS Policies**: Agents see only their data, admins see all data

### Key Dependencies
- `@supabase/supabase-js` - Database client and type exports
- `@supabase/ssr` - Server-side rendering support
- `@supabase/auth-ui-react` - Pre-built auth components
- `@tanstack/react-table` - Data tables for leads/applications management
- `@dnd-kit/*` - Drag and drop for Kanban boards
- `@radix-ui/*` - Headless UI primitives (dialogs, dropdowns, etc.)
- `lucide-react` - Icon library
- `sonner` - Toast notifications
- `next-themes` - Theme management
- `class-variance-authority` & `clsx` - Conditional styling utilities

### Environment Variables
Required in `app/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database & Type System
- Database schema defined in `database.md` with full PostgreSQL setup
- Generated TypeScript types in `app/src/types/database.ts`
- Supabase client and helper types exported from `app/src/lib/supabase.ts`
- Extended types with relations (e.g., `LeadWithProfile`, `ApplicationWithLead`)

### Business Logic Notes
- Mobile numbers must be 10-digit Indian format
- Amount range: ₹40,000 - ₹15,00,000
- Status changes auto-update `final_status` (open/close)
- Only "banking received" status progresses to applications
- Disbursed applications require `disbursed_amount > 0`
- All timestamps use Asia/Kolkata timezone
- Database triggers handle automatic final_status sync and updated_at fields

### Development Workflow
- Database changes: Update `database.md` → regenerate types → update components
- New features: Follow existing patterns in similar components/pages
- Role-based features: Use `RoleGuard` component for access control
- State management: Use React Context (AuthContext) + Supabase real-time