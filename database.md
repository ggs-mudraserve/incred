-- ========== ENUMS ==========
create type if not exists final_status_enum as enum ('open','close');
create type if not exists application_stage as enum ('UnderReview','Approved','Reject','Disbursed');
create type if not exists status_enum as enum (
  'cash salary',
  'self employed',
  'NI',
  'ring more than 3 days',
  'salary low',
  'cibil issue',
  'banking received',
  'language_issue',
  'ringing'
);

create type if not exists user_role as enum ('admin','agent');

-- ========== PROFILES ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role user_role not null default 'agent',
  created_at timestamptz not null default now()
);

-- ========== LEADS ==========
create table if not exists public.leads (
  id bigserial primary key,
  app_no text unique not null,
  mobile_no text not null check (char_length(mobile_no) = 10),
  name text,
  amount numeric check (amount >= 40000 and amount <= 1500000),
  status status_enum,
  final_status final_status_enum not null default 'open',
  agent_id uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_uploaded_at on public.leads(uploaded_at);
create index if not exists idx_leads_agent_uploaded on public.leads(agent_id, uploaded_at);
create index if not exists idx_leads_final_status on public.leads(final_status);

-- Auto-update updated_at
create or replace function public.touch_updated_at_leads()
returns trigger as $$
begin new.updated_at := now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_leads_touch on public.leads;
create trigger trg_leads_touch before update on public.leads
for each row execute function public.touch_updated_at_leads();

-- ========== STATUS_OPTIONS ==========
create table if not exists public.status_options (
  status status_enum primary key,
  final_status_default final_status_enum not null default 'open',
  progresses_to_stage application_stage null
);

insert into public.status_options(status, final_status_default, progresses_to_stage) values
  ('cash salary','close',null),
  ('self employed','close',null),
  ('NI','close',null),
  ('ring more than 3 days','close',null),
  ('salary low','close',null),
  ('cibil issue','close',null),
  ('banking received','open','UnderReview'),
  ('language_issue','close',null),
  ('ringing','open',null)
on conflict (status) do update
set final_status_default = excluded.final_status_default,
    progresses_to_stage   = excluded.progresses_to_stage;

-- ========== NOTES ==========
create table if not exists public.lead_notes (
  id bigserial primary key,
  lead_id bigint not null references public.leads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  note text not null check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_notes_lead_id on public.lead_notes(lead_id);

-- ========== APPLICATIONS ==========
create table if not exists public.applications (
  id bigserial primary key,
  lead_id bigint not null unique references public.leads(id) on delete cascade,
  stage application_stage not null default 'UnderReview',
  disbursed_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applications_stage on public.applications(stage);

-- Auto-update updated_at
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_app_touch on public.applications;
create trigger trg_app_touch before update on public.applications
for each row execute function public.touch_updated_at();

-- Disbursed must have amount
create or replace function public.applications_enforce_disbursed_amount()
returns trigger as $$
begin
  if new.stage = 'Disbursed' and (new.disbursed_amount is null or new.disbursed_amount <= 0) then
    raise exception 'disbursed_amount is required to move to Disbursed';
  end if;
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_app_stage_check on public.applications;
create trigger trg_app_stage_check
before insert or update of stage on public.applications
for each row execute function public.applications_enforce_disbursed_amount();

-- Sync lead.final_status when application closes
create or replace function public.applications_sync_lead_final_status()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.stage is distinct from old.stage) then
    if new.stage in ('Reject','Disbursed') then
      update public.leads set final_status = 'close'
      where id = new.lead_id and final_status <> 'close';
    end if;
  end if;
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_app_sync_lead_final on public.applications;
create trigger trg_app_sync_lead_final
after insert or update of stage on public.applications
for each row execute function public.applications_sync_lead_final_status();

-- ========== RLS POLICIES ==========
-- Enable RLS
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.applications enable row level security;

-- Profiles: only admins manage
create policy "admin manage profiles"
on public.profiles for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'));

-- Leads
create policy "admin full access leads"
on public.leads for all
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create policy "agent access own leads"
on public.leads for all
using (agent_id = auth.uid());

-- Notes
create policy "admin full access notes"
on public.lead_notes for all
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create policy "agent manage own notes"
on public.lead_notes for all
using (exists (select 1 from public.leads l where l.id=lead_notes.lead_id and l.agent_id=auth.uid()));

-- Applications
create policy "admin full access applications"
on public.applications for all
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create policy "agent access own applications"
on public.applications for all
using (exists (select 1 from public.leads l where l.id=applications.lead_id and l.agent_id=auth.uid()));