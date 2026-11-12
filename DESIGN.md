# Design system

> Current visual system of the starter. Update it when the product identity changes (run `/impeccable document` to regenerate from code). Tokens live in `src/app/globals.css`.

## Direction

Warm, quiet, trustworthy. Warm-neutral surfaces with a single kopi (coffee-brown) accent. Generous whitespace, thin borders, almost no shadows. The data is the hero; chrome stays out of the way.

## Colour

- Defined as OKLCH CSS variables on `:root` and `.dark` (shadcn/ui v4 names): `background`, `foreground`, `card`, `muted`, `accent`, `primary`, `destructive`, `border`, `ring`, `chart-1…5`, `sidebar-*`.
- **One accent:** `primary` (light `oklch(0.47 0.085 55)`, dark `oklch(0.74 0.1 65)`). Use it for the main action on a screen and for key data marks. Never two primary buttons side by side.
- Status colours: success = emerald, warning = amber, danger = `destructive`. Use the `Badge` variants, not raw colours.
- Always use tokens in classes (`bg-primary`, `text-muted-foreground`), never hex values. Every screen must work in light and dark.

## Type

- Geist Sans for UI, Geist Mono for code, IDs and step numbers.
- Page title `text-2xl font-semibold tracking-tight`; section/card title `font-semibold`; body `text-sm`; secondary `text-muted-foreground`.
- Numbers in tables and KPIs: `tabular-nums`.

## Layout

- App shell: fixed 240px sidebar (sheet on mobile), sticky 56px top bar, content `max-w-6xl` with `px-4 md:px-6`.
- Grid gaps: `gap-4` between cards, `gap-6` between page sections.
- Radius: `--radius` 10px; cards `rounded-xl`, inputs/buttons `rounded-md`.

## Components (`src/components/ui`)

Button, Card, Input, Textarea, Label, NativeSelect, Badge, Table, Dialog, Sheet, DropdownMenu, Avatar, Separator, Skeleton, Toaster (sonner).
App-level: PageHeader, EmptyState, Sidebar, UserMenu, ThemeToggle, DemoBanner, Logo.

More components: `npx shadcn@latest add <name>` (stock shadcn) or `npx shadcn@latest add @reui/<name>` (ReUI, registry already configured in `components.json`). Restyle anything added to match these tokens.

## States every screen needs

Loading (skeleton), empty (EmptyState with a next action), error (inline message or `error.tsx`), success (toast). Disabled and pending buttons show a spinner.

## Motion

Subtle and fast: 150–200 ms transitions on colour/opacity; dialog/sheet enter animations from `tw-animate-css`. No decorative motion on Operate screens.
