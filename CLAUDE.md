@AGENTS.md

# KopiCode — shared context for every teammate's Claude

This file is loaded by Claude Code for **everyone** who works in this repo. It is the team's shared memory. Keep it short and true. When a decision is made, write it down here or in `docs/PLAN.md` and commit it, so every teammate's Claude picks it up on the next `git pull`.

## Read these first, in this order

1. `docs/PLAN.md` — problem statement, the 3 must-have features, who owns what, the shared data contract, the timeline and the decision log. **Source of truth for scope.**
2. `PRODUCT.md` — who the user is and what the product is for (used by the impeccable design skill).
3. `DESIGN.md` — visual system: tokens, type, components. Follow it; don't invent a second style.
4. `GLOSSARY.md` (created during planning) — the domain words we agreed on. Use them in code, UI and pitch.

## Hackathon rules that bind the code

- **Feature freeze 12:00 AM Fri. Submit by 8:30 AM. No commits or deploys after 9:00 AM** — that disqualifies us.
- Nothing in this starter is tied to a problem. Problem-specific work starts at the event.
- `main` must always deploy. Every push to `main` goes live on Vercel.
- Prefer working, demoable and simple over clever. If something fights you for 30 min, simplify.
- Judges only see the demo. Every feature must be visible in the 5-minute demo path.

## Stack

- Next.js 16 (App Router, Turbopack, `src/`), React 19, TypeScript strict.
- Tailwind CSS v4 + shadcn/ui-style components in `src/components/ui` (hand-owned, edit freely). Icons: `lucide-react`. Charts: `recharts`. Toasts: `sonner`.
- Supabase (Postgres + Auth) via `@supabase/ssr`. Schema in `supabase/migrations/`.
- AI: Vercel AI SDK (`ai`, `@ai-sdk/react`) through the Vercel AI Gateway. Model set by `AI_MODEL`.
- Deploy: Vercel (GitHub integration, auto-deploy on push to `main`, previews on PRs).

### Next.js 16 notes (differs from older training data)

- `middleware.ts` is now **`src/proxy.ts`** (export `proxy`).
- `params` / `searchParams` / `cookies()` / `headers()` are async: `await` them. Use the generated `PageProps<"/route">` and `LayoutProps<"/route">` types.
- `cacheComponents` is **off** in `next.config.ts` on purpose. Pages that read the session are dynamic automatically. Do not add `"use cache"` unless you turn it on deliberately.
- Before using an unfamiliar Next API, read `node_modules/next/dist/docs/`.

## Where things go (copy the Items feature)

```
src/app/dashboard/<feature>/page.tsx      Server Component: loads data, renders UI
src/app/dashboard/<feature>/actions.ts    "use server" mutations (validate with zod, re-check user)
src/app/dashboard/<feature>/*.tsx          Client pieces ("use client") only where interactive
src/lib/data/<feature>.ts                 Data access (server-only). Always calls getCurrentUser() first
supabase/migrations/000N_<feature>.sql    Table + RLS policies (owner = auth.uid())
src/lib/supabase/database.types.ts        Add the table's types (or regenerate)
src/components/app/nav.ts                 One line to add the page to the sidebar
```

`src/app/dashboard/items/` is the reference implementation: list, URL-driven search/filter, create/edit dialog, delete, empty state, toasts, demo-mode fallback. Copy it, rename, adapt.

## Conventions

- Server Components by default. `"use client"` only for state, effects, event handlers.
- Mutations: Server Actions + `useActionState`. Validate with `zod`. Return `{ ok, message }`; show with `toast`.
- Every data function and Server Action calls `getCurrentUser()` (from `src/lib/auth.ts`) before touching data. RLS is the second line of defence, not the only one.
- Never expose the Supabase service-role key to the browser. Only `NEXT_PUBLIC_*` vars reach the client.
- Demo mode: with no Supabase env vars the app runs on mock data (`src/lib/data/mock.ts`) and skips auth. Keep new features working in demo mode when it's cheap; it is our safety net if the database misbehaves during judging.
- Styling: use the tokens (`bg-primary`, `text-muted-foreground`, `border`…), never raw hex. One accent colour. Respect dark mode.
- Accessibility basics: labels on inputs, `aria-label` on icon buttons, visible focus.
- File names kebab-case; components PascalCase; one component per file unless tiny.
- Run `npm run check` (lint + typecheck + build) before pushing to `main`.

## Git workflow (3 people, one repo)

- Branch per feature: `feat/<name>`. Small commits. Pull `main` often.
- Open a PR to `main`; the merge captain merges. Vercel posts a preview URL on each PR — test there.
- Shared files (`nav.ts`, `database.types.ts`, `globals.css`, `CLAUDE.md`, `docs/PLAN.md`) change in small, separate commits to avoid conflicts.
- New migration = new numbered file. Never edit a migration someone else already ran.

## Skills in this repo (`.claude/skills/`)

| Skill | Use it for | How |
|---|---|---|
| `grill-me` | Stress-test the problem statement and plan at 9 AM until nothing is unclear | `/grill-me` |
| `grill-with-docs` | Same interview, and also writes `GLOSSARY.md` and ADRs as decisions land | `/grill-with-docs` |
| `domain-modeling` | Keep terminology consistent; record decisions | auto |
| `impeccable` | Design, critique, audit and polish UI (`/impeccable polish`, `/impeccable audit`, `/impeccable critique`) | `/impeccable …` |
| `ui-ux-pro-max` | UI/UX reference: palettes, font pairings, chart choice, UX guidelines for dashboards | auto / ask |
| `design-taste-frontend` | Anti-generic art direction for the **public landing page** and pitch-facing pages | ask for it by name |

Don't stack every design skill on one task: pick one. `impeccable` for app screens, `design-taste-frontend` for the landing page.

## MCP servers (`.mcp.json`)

Supabase and Vercel MCP servers are declared for the team. Each person signs in with their own account the first time Claude uses them. With Supabase MCP connected, ask Claude to apply migrations, inspect tables and generate types directly.
