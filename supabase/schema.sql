-- Saffari NeuroCare Supabase schema
-- Public-facing clients must NEVER receive the service_role key.
-- Data is only accessed by the neurocare-api Edge Function. RLS remains enabled
-- and direct privileges are denied to anon/authenticated roles.

create extension if not exists pgcrypto;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  mobile varchar(11) not null unique,
  national_id varchar(10) not null unique,
  password_hash text not null,
  password_changed_at timestamptz,
  disease_code varchar(30) not null default 'unassigned'
    check (disease_code in ('migraine','ms','epilepsy','parkinson','cognition','low_back_pain','stroke','other','unassigned')),
  status varchar(30) not null default 'pending_review'
    check (status in ('pending_review','active','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patients_created_at_idx on public.patients(created_at desc);

create table if not exists public.doctor_accounts (
  id uuid primary key default gen_random_uuid(),
  clinic_code varchar(40) not null unique,
  display_name varchar(120) not null default 'دکتر صفاری',
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Patient sessions reference patients. Doctor sessions live in a separate table.
create table if not exists public.sessions (
  token_hash text primary key,
  user_id uuid not null references public.patients(id) on delete cascade,
  role varchar(20) not null default 'patient' check (role = 'patient'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_expiry_idx on public.sessions(expires_at);
create index if not exists sessions_user_idx on public.sessions(user_id);

create table if not exists public.doctor_sessions (
  token_hash text primary key,
  user_id uuid not null,
  role varchar(20) not null default 'doctor' check (role = 'doctor'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists doctor_sessions_expiry_idx on public.doctor_sessions(expires_at);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  preferred_date date not null,
  preferred_time time not null,
  appointment_type varchar(20) not null default 'in_person'
    check (appointment_type in ('in_person','text')),
  reason text not null default '',
  status varchar(20) not null default 'requested'
    check (status in ('requested','confirmed','rejected','completed','cancelled')),
  doctor_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_patient_date_idx on public.appointments(patient_id, preferred_date desc);
create index if not exists appointments_status_date_idx on public.appointments(status, preferred_date);
create unique index if not exists appointments_active_slot_unique_idx
  on public.appointments (appointment_type, preferred_date, preferred_time)
  where status in ('requested','confirmed');

create table if not exists public.symptom_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  report_type varchar(20) not null check (report_type in ('symptom','pre_visit')),
  severity smallint check (severity between 1 and 10),
  symptoms jsonb not null default '[]'::jsonb,
  notes text not null default '',
  occurred_on date,
  submitted_at timestamptz not null default now()
);
create index if not exists symptom_reports_patient_time_idx on public.symptom_reports(patient_id, submitted_at desc);

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_label varchar(120) not null default 'پزشک معالج',
  note_text text not null,
  visible_to_patient boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists clinical_notes_patient_time_idx on public.clinical_notes(patient_id, created_at desc);

create table if not exists public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title varchar(200) not null,
  instructions text not null,
  follow_up_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists treatment_plans_patient_active_idx on public.treatment_plans(patient_id, active, created_at desc);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name varchar(200) not null,
  dose varchar(200) not null default '',
  instructions text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medications_patient_active_idx on public.medications(patient_id, active, created_at desc);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id text not null,
  actor_role varchar(20) not null,
  action varchar(100) not null,
  subject_type varchar(50) not null,
  subject_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_created_idx on public.audit_events(created_at desc);

create table if not exists public.auth_rate_limits (
  bucket_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Atomic per-IP/endpoint rate limiter. Service-role only.
create or replace function public.consume_neurocare_rate_limit(
  p_bucket_hash text,
  p_limit integer default 20,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
set search_path = ''
as $
declare
  current_attempts integer;
begin
  insert into public.auth_rate_limits(bucket_hash, window_started_at, attempts, updated_at)
  values (p_bucket_hash, now(), 1, now())
  on conflict (bucket_hash) do update
  set attempts = case
        when public.auth_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
        else public.auth_rate_limits.attempts + 1
      end,
      window_started_at = case
        when public.auth_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
        else public.auth_rate_limits.window_started_at
      end,
      updated_at = now()
  returning attempts into current_attempts;
  return current_attempts <= p_limit;
end;
$;

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  appointment_type varchar(20) not null check (appointment_type in ('in_person','text')),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null default 30 check (slot_minutes between 10 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);
create unique index if not exists doctor_availability_slot_unique
  on public.doctor_availability (appointment_type, day_of_week, start_time, end_time);
create index if not exists doctor_availability_active_idx
  on public.doctor_availability (appointment_type, day_of_week) where is_active = true;

create table if not exists public.captcha_challenges (
  id uuid primary key,
  answer_hash text not null,
  ip_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists captcha_challenges_expiry_idx on public.captcha_challenges (expires_at);

-- Run only from a server-side Edge Function using the service_role key.
alter table public.patients enable row level security;
alter table public.doctor_accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.doctor_sessions enable row level security;
alter table public.doctor_availability enable row level security;
alter table public.captcha_challenges enable row level security;
alter table public.appointments enable row level security;
alter table public.symptom_reports enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.medications enable row level security;
alter table public.audit_events enable row level security;
alter table public.auth_rate_limits enable row level security;

revoke all on table public.patients, public.doctor_accounts, public.sessions,
  public.appointments, public.symptom_reports, public.clinical_notes,
  public.treatment_plans, public.medications, public.audit_events, public.auth_rate_limits,
  public.doctor_sessions, public.doctor_availability, public.captcha_challenges
  from public, anon, authenticated;

grant all on table public.patients, public.doctor_accounts, public.sessions,
  public.appointments, public.symptom_reports, public.clinical_notes,
  public.treatment_plans, public.medications, public.audit_events, public.auth_rate_limits,
  public.doctor_sessions, public.doctor_availability, public.captcha_challenges
  to service_role;

revoke all on function public.consume_neurocare_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_neurocare_rate_limit(text, integer, integer) to service_role;
