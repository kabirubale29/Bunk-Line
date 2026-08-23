-- Supabase Database Schema for Bunk Line: Attendance Tracker App

-- Enable UUID extension (should be enabled by default in Supabase)
create extension if not exists "uuid-ossp";

-- 1. Profiles (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Terms (semesters)
create table public.terms (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  label text not null,
  start_date date not null,
  archived_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Settings (linked to profiles)
create table public.settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  min_attendance_pct integer default 60 not null,
  theme text default 'dark' not null,
  current_term_id uuid references public.terms(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Subjects
create table public.subjects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  term_id uuid references public.terms(id) on delete cascade not null,
  name text not null,
  color text not null,
  baseline_total_held integer default 0 not null,
  baseline_total_attended integer default 0 not null,
  archived boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Schedule Slots (weekly schedule)
create table public.schedule_slots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  term_id uuid references public.terms(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  weekday text not null check (weekday in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  period integer not null,
  start_time text not null, -- format "HH:MM"
  end_time text not null, -- format "HH:MM"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Schedule Overrides (one-off class updates for specific date)
create table public.schedule_overrides (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  term_id uuid references public.terms(id) on delete cascade not null,
  date date not null,
  original_slot_id uuid references public.schedule_slots(id) on delete cascade, -- null if extra class added
  subject_id uuid references public.subjects(id) on delete cascade, -- null if deleted/cancelled slot
  period integer,
  start_time text, -- format "HH:MM"
  end_time text, -- format "HH:MM"
  override_type text not null check (override_type in ('modify', 'delete', 'add')),
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Day Overrides (holiday declarations)
create table public.day_overrides (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  term_id uuid references public.terms(id) on delete cascade not null,
  date date not null,
  type text default 'holiday' not null check (type = 'holiday'),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, term_id, date)
);

-- 8. Attendance Records
create table public.attendance_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  term_id uuid references public.terms(id) on delete cascade not null,
  date date not null,
  slot_id uuid references public.schedule_slots(id) on delete set null,
  override_id uuid references public.schedule_overrides(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  status text not null check (status in ('present', 'absent', 'cancelled')),
  note text,
  marked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  edited boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Alerts Seen
create table public.alerts_seen (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  alert_type text not null, -- e.g. 'low_attendance'
  event_key text not null,  -- e.g. 'physics-2026-08-22' to prevent duplicate alerts for the same event
  seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, subject_id, event_key)
);

-- Unique index constraints to prevent duplicate attendance markings per day per class
create unique index idx_attendance_records_slot_date 
on public.attendance_records (user_id, date, slot_id) 
where slot_id is not null;

create unique index idx_attendance_records_override_date 
on public.attendance_records (user_id, date, override_id) 
where override_id is not null;

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.terms enable row level security;
alter table public.subjects enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.day_overrides enable row level security;
alter table public.attendance_records enable row level security;
alter table public.alerts_seen enable row level security;

-- RLS Policies
create policy "Users can manage their own profile"
  on public.profiles for all using (auth.uid() = id);

create policy "Users can manage their own settings"
  on public.settings for all using (auth.uid() = user_id);

create policy "Users can manage their own terms"
  on public.terms for all using (auth.uid() = user_id);

create policy "Users can manage their own subjects"
  on public.subjects for all using (auth.uid() = user_id);

create policy "Users can manage their own schedule slots"
  on public.schedule_slots for all using (auth.uid() = user_id);

create policy "Users can manage their own schedule overrides"
  on public.schedule_overrides for all using (auth.uid() = user_id);

create policy "Users can manage their own day overrides"
  on public.day_overrides for all using (auth.uid() = user_id);

create policy "Users can manage their own attendance records"
  on public.attendance_records for all using (auth.uid() = user_id);

create policy "Users can manage their own alerts seen"
  on public.alerts_seen for all using (auth.uid() = user_id);

-- Triggers for automatic profiles & settings creation on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_new_profile()
returns trigger as $$
begin
  insert into public.settings (user_id, min_attendance_pct, theme, current_term_id)
  values (new.id, 60, 'dark', null);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- Trigger for updating the updated_at timestamp on attendance records
create or replace function public.handle_update_timestamp()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger on_attendance_records_update
  before update on public.attendance_records
  for each row execute procedure public.handle_update_timestamp();
