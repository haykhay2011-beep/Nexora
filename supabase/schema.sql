-- Personal AI OS - core schema
-- Run this against your Supabase project (SQL editor or `supabase db push`).

create extension if not exists pgcrypto;

-- Stores OAuth tokens / credentials for third-party integrations, keyed by
-- (user_id, provider). Access is server-side only via the service role key;
-- RLS below also lets an authenticated user read/manage their own rows directly
-- from the client if ever needed (e.g. to show connection status).
create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'yahoo', 'plaid')),
  access_token text,
  refresh_token text,
  scope text,
  expiry_date bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_integrations_user_id_idx on public.user_integrations (user_id);

alter table public.user_integrations enable row level security;

drop policy if exists "Users can view own integrations" on public.user_integrations;
create policy "Users can view own integrations"
  on public.user_integrations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own integrations" on public.user_integrations;
create policy "Users can insert own integrations"
  on public.user_integrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own integrations" on public.user_integrations;
create policy "Users can update own integrations"
  on public.user_integrations for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own integrations" on public.user_integrations;
create policy "Users can delete own integrations"
  on public.user_integrations for delete
  using (auth.uid() = user_id);

-- Keeps updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_integrations_updated_at on public.user_integrations;
create trigger set_user_integrations_updated_at
  before update on public.user_integrations
  for each row execute procedure public.set_updated_at();

-- Optional: persisted chat history so conversations survive app restarts.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_id_created_at_idx
  on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Users can view own messages" on public.chat_messages;
create policy "Users can view own messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.chat_messages;
create policy "Users can insert own messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Reminders Jarvis tracks on the user's behalf and proactively surfaces
-- once due (e.g. "remind me to call mom tomorrow").
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  due_at timestamptz not null,
  completed boolean not null default false,
  surfaced boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_id_due_at_idx on public.reminders (user_id, due_at);

alter table public.reminders enable row level security;

drop policy if exists "Users can view own reminders" on public.reminders;
create policy "Users can view own reminders"
  on public.reminders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reminders" on public.reminders;
create policy "Users can insert own reminders"
  on public.reminders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reminders" on public.reminders;
create policy "Users can update own reminders"
  on public.reminders for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own reminders" on public.reminders;
create policy "Users can delete own reminders"
  on public.reminders for delete
  using (auth.uid() = user_id);
