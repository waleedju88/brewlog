-- ============================================
-- BrewLog v2 – Schema Migration
-- Run this in: Supabase → SQL Editor → New query
-- ============================================

-- 1. Drop old table (skip if you never ran the old schema)
drop table if exists coffee_logs;

-- 2. New per-cup log table
create table if not exists cup_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  logged_at  timestamptz not null default now(),
  note       text default null
);

-- Index for fast per-user queries
create index if not exists cup_logs_user_time on cup_logs(user_id, logged_at desc);

-- 3. Row Level Security
alter table cup_logs enable row level security;

create policy "Own cup logs only" on cup_logs
  for all using (auth.uid() = user_id);

-- 4. Profiles table (keep as-is, stores daily_limit)
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  daily_limit integer default null,
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

create policy "Own profile only" on profiles
  for all using (auth.uid() = id);

-- 5. Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
