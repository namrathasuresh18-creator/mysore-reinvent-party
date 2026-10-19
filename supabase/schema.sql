-- Run this whole file once in Supabase: SQL Editor > New query > Run.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_settings (
  id int primary key default 1 check (id = 1),     -- single row
  applications_open boolean not null default true,
  whatsapp_group_url text
);
insert into public.event_settings (id) values (1) on conflict do nothing;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  builder_id text not null,
  college text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

create table if not exists public.application_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null,
  review_note text,
  decided_at timestamptz not null default now()
);

-- Helpers -------------------------------------------------------------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

create or replace function public.applications_open() returns boolean
language sql stable security definer set search_path = public as $$
  select applications_open from public.event_settings where id = 1;
$$;

-- WhatsApp link is returned ONLY to the user whose application is accepted.
create or replace function public.get_whatsapp_link() returns text
language sql stable security definer set search_path = public as $$
  select s.whatsapp_group_url
  from public.event_settings s
  where exists (select 1 from public.applications a where a.user_id = auth.uid() and a.status = 'accepted');
$$;

create or replace function public.review_application(app_id uuid, new_status text, note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'not allowed'; end if;
  if new_status not in ('accepted','rejected','pending') then raise exception 'bad status'; end if;
  update public.applications set status = new_status, reviewed_by = auth.uid(), reviewed_at = now() where id = app_id;
  insert into public.application_decisions (application_id, reviewer_id, decision, review_note)
  values (app_id, auth.uid(), new_status, note);
end $$;

-- Row level security ----------------------------------------------------
alter table public.user_roles enable row level security;
alter table public.event_settings enable row level security;
alter table public.applications enable row level security;
alter table public.application_decisions enable row level security;

-- applicants: read their own row, insert their own row as pending only. No updates.
create policy "own application read" on public.applications for select using (user_id = auth.uid());
create policy "staff read all" on public.applications for select using (public.is_staff());
create policy "own application insert" on public.applications for insert
  with check (user_id = auth.uid() and status = 'pending' and public.applications_open());

create policy "staff read decisions" on public.application_decisions for select using (public.is_staff());
create policy "own role read" on public.user_roles for select using (user_id = auth.uid());
-- event_settings has no policies: clients can't read the WhatsApp link directly (only via get_whatsapp_link()).
-- Staff edit settings in the Supabase dashboard (Table Editor).

grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.applications_open() to authenticated, anon;
grant execute on function public.get_whatsapp_link() to authenticated;
grant execute on function public.review_application(uuid, text, text) to authenticated;
