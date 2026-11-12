-- KopiCode starter schema. Generic on purpose: rename/extend `items` once the
-- problem statement is set. Run in Supabase: SQL Editor -> paste -> Run,
-- or `npx supabase db push` with the Supabase CLI linked to your project.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select using (auth.uid() = id);
create policy "Profiles are updatable by their owner"
  on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- items: the example resource. Copy this pattern for each feature's table.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.item_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status public.item_status not null default 'todo',
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_id_created_at_idx
  on public.items (user_id, created_at desc);

alter table public.items enable row level security;

create policy "Users read their own items"
  on public.items for select using (auth.uid() = user_id);
create policy "Users insert their own items"
  on public.items for insert with check (auth.uid() = user_id);
create policy "Users update their own items"
  on public.items for update using (auth.uid() = user_id);
create policy "Users delete their own items"
  on public.items for delete using (auth.uid() = user_id);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute procedure public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();
