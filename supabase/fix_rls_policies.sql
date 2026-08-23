-- ============================================================
-- Bunk Line: RLS Policy Fix Migration
-- Run this in your Supabase SQL Editor (Project: Bunk Line)
-- ============================================================
-- This migration DOES NOT drop or recreate tables.
-- It drops old incomplete policies and replaces them with
-- correct policies that use both USING and WITH CHECK clauses.
-- It also grants the necessary table-level privileges to the
-- 'authenticated' role, which RLS alone cannot provide.
-- ============================================================

-- ============================================================
-- STEP 1: Grant table-level privileges to authenticated role
-- (RLS alone is NOT enough — the role needs SELECT/INSERT/etc.)
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.terms to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.schedule_slots to authenticated;
grant select, insert, update, delete on public.schedule_overrides to authenticated;
grant select, insert, update, delete on public.day_overrides to authenticated;
grant select, insert, update, delete on public.attendance_records to authenticated;
grant select, insert, update, delete on public.alerts_seen to authenticated;

-- Also grant to anon for safety (Supabase requires this for the client SDK even with auth)
grant usage on schema public to anon;

-- ============================================================
-- STEP 2: Drop all existing broken/incomplete RLS policies
-- ============================================================

drop policy if exists "Users can manage their own profile" on public.profiles;
drop policy if exists "Users can manage their own settings" on public.settings;
drop policy if exists "Users can manage their own terms" on public.terms;
drop policy if exists "Users can manage their own subjects" on public.subjects;
drop policy if exists "Users can manage their own schedule slots" on public.schedule_slots;
drop policy if exists "Users can manage their own schedule overrides" on public.schedule_overrides;
drop policy if exists "Users can manage their own day overrides" on public.day_overrides;
drop policy if exists "Users can manage their own attendance records" on public.attendance_records;
drop policy if exists "Users can manage their own alerts seen" on public.alerts_seen;

-- ============================================================
-- STEP 3: Re-create correct RLS policies with proper
--         USING (filter existing rows) + WITH CHECK (validate inserts/updates)
-- ============================================================

-- profiles: primary key IS the user's auth.uid()
create policy "profiles: owner full access"
  on public.profiles
  as permissive
  for all
  to authenticated
  using       (auth.uid() = id)
  with check  (auth.uid() = id);

-- settings: user_id must match auth.uid()
create policy "settings: owner full access"
  on public.settings
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- terms: user_id must match auth.uid()
create policy "terms: owner full access"
  on public.terms
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- subjects: user_id must match auth.uid()
create policy "subjects: owner full access"
  on public.subjects
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- schedule_slots: user_id must match auth.uid()
create policy "schedule_slots: owner full access"
  on public.schedule_slots
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- schedule_overrides: user_id must match auth.uid()
create policy "schedule_overrides: owner full access"
  on public.schedule_overrides
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- day_overrides: user_id must match auth.uid()
create policy "day_overrides: owner full access"
  on public.day_overrides
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- attendance_records: user_id must match auth.uid()
create policy "attendance_records: owner full access"
  on public.attendance_records
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- alerts_seen: user_id must match auth.uid()
create policy "alerts_seen: owner full access"
  on public.alerts_seen
  as permissive
  for all
  to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- ============================================================
-- STEP 4: Ensure triggers work correctly
-- The handle_new_user and handle_new_profile functions use
-- SECURITY DEFINER which means they run as the table owner (postgres),
-- bypassing RLS. This is correct and must stay as-is.
-- Re-create them to make sure they are up to date.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, created_at)
  values (new.id, now())
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Recreate trigger (drop first to avoid duplicate)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id, min_attendance_pct, theme, current_term_id, created_at)
  values (new.id, 60, 'dark', null, now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Recreate trigger (drop first to avoid duplicate)
drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- ============================================================
-- STEP 5: Fix updated_at trigger (security hardening)
-- ============================================================

create or replace function public.handle_update_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_attendance_records_update on public.attendance_records;
create trigger on_attendance_records_update
  before update on public.attendance_records
  for each row execute procedure public.handle_update_timestamp();

-- ============================================================
-- STEP 6: Verify RLS is still enabled on all tables
-- (safe to run even if already enabled)
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.settings          enable row level security;
alter table public.terms             enable row level security;
alter table public.subjects          enable row level security;
alter table public.schedule_slots    enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.day_overrides     enable row level security;
alter table public.attendance_records enable row level security;
alter table public.alerts_seen       enable row level security;

-- ============================================================
-- Done. Policies are now correct for all 9 tables.
-- Each authenticated user can only access rows where
-- user_id = auth.uid() (or id = auth.uid() for profiles).
-- ============================================================
