# Repository Guidelines

This project powers the Incred agent workspace using a Next.js 15 application in `app/`. Follow the practices below to keep changes predictable and easy to review.

## Project Structure & Module Organization
- `app/src/app/` hosts App Router routes (e.g., `admin`, `agent`, `login`, `setup`) and global layout assets.
- `app/src/components/` contains shared UI (Radix-based primitives in `ui/` plus guards and providers).
- `app/src/lib/` centralizes Supabase client setup (`supabase.ts`) and utility helpers; shared database typings live in `app/src/types/`.
- Supabase project settings live under `supabase/`; keep local environment variables in `app/.env.local` and never commit secrets.

## Build, Test, and Development Commands
- `cd app && npm install` installs workspace dependencies (lockfile is npm-based).
- `cd app && npm run dev` starts the Next dev server on port 3000.
- `cd app && npm run build` produces an optimized production bundle; run before shipping backend config changes.
- `cd app && npm run start` serves the built app; use this for production-like smoke checks.
- `cd app && npm run lint` runs ESLint with the repo config to catch style and typing drift.

## Coding Style & Naming Conventions
- TypeScript is required; prefer explicit types for Supabase responses and React props.
- Two-space indentation, single quotes in application code, and Tailwind utility classes for styling are the prevailing patterns.
- Route folders follow Next.js naming, shared React components use PascalCase filenames, and hooks/utilities are camelCase.
- Use the `@/` path alias for cross-module imports and keep feature logic colocated with its route or context provider.

## Testing Guidelines
- No automated test runner is wired yet; validate critical flows manually and document scenarios in PRs.
- When adding tests, align on React Testing Library + Vitest and place specs beside the component (`ComponentName.test.tsx`).
- Aim for meaningful coverage on Supabase data flows (auth guards, lead/application mutations) before merging major features.

## Commit & Pull Request Guidelines
- Follow the existing terse, imperative commit style (`add filter for final status`, `create lead button`).
- Bundle logically-related changes per commit; avoid mixing schema updates with UI tweaks.
- PRs must include: purpose summary, linked issue or ticket, screenshots/GIFs for UI changes, and callouts for required env/config updates.
- Verify `npm run lint` and a production build prior to requesting review; note any skipped steps explicitly.
