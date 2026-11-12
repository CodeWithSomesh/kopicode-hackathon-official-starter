# KopiCode Starter

A working hackathon starter: **Next.js 16 · Tailwind v4 · TypeScript · Supabase · Vercel AI SDK**, deployed on Vercel. Auth, an app shell, an example full-stack feature and an AI chat are already wired, so the team starts from something usable.

It is deliberately generic. Problem-specific work starts at the event.

## What's in the box

| Route | What it shows |
|---|---|
| `/` | Landing page skeleton (problem → how it works → outcome) |
| `/login`, `/signup` | Supabase email + password auth |
| `/dashboard` | KPI cards, activity chart, recent list |
| `/dashboard/items` | Reference feature: Supabase table + RLS, search/filter in the URL, create/edit/delete with Server Actions, toasts, empty state |
| `/dashboard/assistant` | Streaming AI chat through the Vercel AI Gateway |
| `/dashboard/settings` | Profile form |

Also: dark mode, responsive sidebar, loading and error states, **demo mode** (runs on mock data with no Supabase vars, so a deploy always works), CI on every PR, Claude skills and shared team context.

## Get running (5 minutes)

```bash
git clone https://github.com/CodeWithSomesh/kopicode-starter.git
cd kopicode-starter
npm install
cp .env.example .env.local   # leave empty for demo mode
npm run dev                  # http://localhost:3000
```

### Turn on Supabase (one person, once)

1. Create a project at [supabase.com](https://supabase.com) (region: Singapore).
2. SQL Editor → paste `supabase/migrations/0001_init.sql` → Run.
3. Authentication → Sign In / Providers → Email: for the hackathon, turn **off** "Confirm email" so sign-up logs straight in.
4. Authentication → URL Configuration: Site URL = the Vercel URL; add `http://localhost:3000/**` and `https://*.vercel.app/**` to Redirect URLs.
5. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in everyone's `.env.local` and in Vercel → Project → Settings → Environment Variables. Redeploy.

### Turn on AI

On Vercel: Project → AI Gateway → enable (uses the project's own credentials, no key needed). Locally: set `AI_GATEWAY_API_KEY` in `.env.local` or run `npx vercel env pull`. Pick the model with `AI_MODEL`.

## Adding a feature

Copy `src/app/dashboard/items/` → `src/app/dashboard/<feature>/`, add a migration in `supabase/migrations/`, a data module in `src/lib/data/`, and one line in `src/components/app/nav.ts`. Full conventions in [`CLAUDE.md`](CLAUDE.md).

## Working with Claude

Everyone's Claude reads the same context from the repo:

- [`CLAUDE.md`](CLAUDE.md) — stack, conventions, rules, workflow
- [`docs/PLAN.md`](docs/PLAN.md) — problem, features, owners, shared contract, decision log
- [`PRODUCT.md`](PRODUCT.md) / [`DESIGN.md`](DESIGN.md) — who it's for and how it looks

Skills in `.claude/skills/`: `/grill-me` and `/grill-with-docs` (Matt Pocock) for planning, `/impeccable` for UI design and polish, `ui-ux-pro-max` and `design-taste-frontend` for better UI. MCP servers for Supabase and Vercel are in `.mcp.json`.

**Start of the event:** open Claude in this repo, run `/grill-me`, and point it at `docs/PLAN.md`. Commit the filled-in plan so everyone's Claude shares it.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run check` (all three, run before pushing to `main`)

## Credits

Skills vendored under their own licenses: [mattpocock/skills](https://github.com/mattpocock/skills), [pbakaus/impeccable](https://github.com/pbakaus/impeccable), [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill).
