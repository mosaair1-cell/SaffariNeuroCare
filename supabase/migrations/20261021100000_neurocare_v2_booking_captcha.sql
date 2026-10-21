-- Saffari NeuroCare v2 booking, CAPTCHA and anti-abuse support.
-- Safe to re-run against the current production schema.
alter table public.appointments
  add column if not exists appointment_type varchar(20) not null default 'in_person';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_appointment_type_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_appointment_type_check
      check (appointment_type in ('in_person','text'));
  end if;
end $$;

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

alter table public.auth_rate_limits add column if not exists bucket_hash text;
create unique index if not exists auth_rate_limits_bucket_hash_unique on public.auth_rate_limits (bucket_hash);

create or replace function public.consume_neurocare_rate_limit(
  p_bucket_hash text,
  p_limit integer default 20,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
set search_path = ''
as $$
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
$$;

create unique index if not exists appointments_active_slot_unique_idx
  on public.appointments (appointment_type, preferred_date, preferred_time)
  where status in ('requested','confirmed');

alter table public.doctor_availability enable row level security;
alter table public.captcha_challenges enable row level security;
revoke all on table public.doctor_availability, public.captcha_challenges from public, anon, authenticated;
grant all on table public.doctor_availability, public.captcha_challenges to service_role;
revoke all on function public.consume_neurocare_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_neurocare_rate_limit(text, integer, integer) to service_role;
