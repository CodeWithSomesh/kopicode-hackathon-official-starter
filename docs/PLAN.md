# Team plan

> Shared source of truth. Fill this in during the 9–11 AM planning session (run `/grill-me` with it open), commit it, and everyone's Claude reads it from then on.

## Problem statement (by 11 AM)

- **User:** _one specific person, never "everyone"_ —
- **Problem, in one sentence:** —
- **Evidence it matters (size, frequency, cost):** —
- **What exists today and why it falls short:** —
- **Our one unique selling point:** —

## The demo story (5 minutes)

1. Open with a question the room relates to:
2. The user's moment of pain:
3. Our app solving it, one journey start to finish:
4. Before and after, with numbers:

## Features

**Rule:** the 3 must-haves are the core flow end to end: the user puts something in → the app does the smart part → the user gets something useful out. At most 2 nice-to-haves. Everything else goes to the parking lot and into the pitch as "next steps".

| # | Feature | Must / nice | Owner | Route | Status |
|---|---|---|---|---|---|
| 1 |  | Must |  | `/dashboard/…` | not started |
| 2 |  | Must |  | `/dashboard/…` | not started |
| 3 |  | Must |  | `/dashboard/…` | not started |
| 4 |  | Nice |  |  |  |
| 5 |  | Nice |  |  |  |

**Parking lot:**
-

## Roles

| Member | Big feature | Extra duty |
|---|---|---|
|  | Feature 1 | Merge captain: reviews merges, keeps `main` deployable, submits the form |
|  | Feature 2 | Takes the 5 PM challenge if it lands near this feature |
|  | Feature 3 | Tester: runs the live URL as a new user after each merge, guards the feature list |

## Shared contract (agree at 10:15 AM, before splitting)

Agree these so three full-stack features don't clash at merge time.

**Tables** (one migration each, `supabase/migrations/000N_<name>.sql`):

```
table_name (column type, …)  — owner:
```

**Shared types** (`src/lib/supabase/database.types.ts`):

```ts
```

**Server actions / API routes** (name → input → output):

```
```

**Shared UI** (who builds which reusable component):

-

## Timeline

| Time | What |
|---|---|
| Thu 9:00–11:00 AM | Plan: problem, 3–5 features, one per member, shared contract |
| 11:00 AM–12:00 PM | Start building from this starter |
| 12:00–1:00 PM | Lunch |
| 1:00–7:00 PM | Build. **Merge and deploy at 4 PM.** Challenge drops at 5 PM |
| 7:00–8:00 PM | Dinner |
| 8:00 PM–12:00 AM | Finish features, add the challenge, polish. **Freeze at 12 AM** |
| 12:00–1:30 AM | Test the live app together |
| Fri 1:30–6:30 AM | Demo video, slides, rehearse |
| 6:30–8:30 AM | Final check on the live URL. **Submit by 8:30 AM** |
| 8:30–9:00 AM | Hands off. Code freeze at 9 AM |

## Decision log

Newest first. One line each: date/time — decision — why.

-
