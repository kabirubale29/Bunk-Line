-- ============================================================
-- MIGRATION: Supabase-Based Admin Managed Allowed Users Table
-- ============================================================

-- 1. Create allowed_users table
create table if not exists public.allowed_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  role text default 'user' not null check (role in ('admin', 'user')),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Seed existing allowed emails
insert into public.allowed_users (email, role, note)
values 
  ('ubalekabir29@gmail.com', 'admin', 'Primary Admin Account'),
  ('kabirubale0358@gmail.com', 'user', 'Attendance Account'),
  ('nehasangewar14@gmail.com', 'user', 'Whitelisted User')
on conflict (email) 
do update set role = excluded.role, note = excluded.note;

-- 3. Enable Row Level Security (RLS)
alter table public.allowed_users enable row level security;

-- 4. SECURITY DEFINER RPC: Check if an email is allowed to register/login
create or replace function public.is_email_allowed(check_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if check_email is null or check_email = '' then
    return false;
  end if;
  return exists (
    select 1 from public.allowed_users 
    where lower(email) = lower(trim(check_email))
  );
end;
$$;

-- 5. SECURITY DEFINER RPC: Check if current authenticated user is an Admin
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 
    from auth.users au
    join public.allowed_users au_list on lower(trim(au.email)) = lower(trim(au_list.email))
    where au.id = auth.uid() and au_list.role = 'admin'
  );
end;
$$;

-- 6. SECURITY DEFINER RPC: Get current user's role
create or replace function public.get_my_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  user_role text;
begin
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    return 'none';
  end if;
  select role into user_role from public.allowed_users where lower(trim(email)) = lower(trim(user_email));
  return coalesce(user_role, 'none');
end;
$$;

-- 7. RLS Policies for allowed_users table:
drop policy if exists "allowed_users: admin full control" on public.allowed_users;
drop policy if exists "allowed_users: admin select" on public.allowed_users;
drop policy if exists "allowed_users: admin insert" on public.allowed_users;
drop policy if exists "allowed_users: admin update" on public.allowed_users;
drop policy if exists "allowed_users: admin delete" on public.allowed_users;

-- Admin users have full SELECT, INSERT, UPDATE, DELETE permissions
create policy "allowed_users: admin select"
  on public.allowed_users
  for select
  to authenticated
  using (public.is_admin());

create policy "allowed_users: admin insert"
  on public.allowed_users
  for insert
  to authenticated
  with check (public.is_admin());

create policy "allowed_users: admin update"
  on public.allowed_users
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "allowed_users: admin delete"
  on public.allowed_users
  for delete
  to authenticated
  using (public.is_admin());

-- Grant execution to authenticated & anon roles
grant execute on function public.is_email_allowed(text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_my_role() to authenticated;
