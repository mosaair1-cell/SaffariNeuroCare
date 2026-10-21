-- Doctor-managed date-range leave blocks for new appointment slots.
create table if not exists public.doctor_leave_ranges (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  appointment_type varchar(20) null
    check (appointment_type is null or appointment_type in ('in_person','text')),
  reason varchar(300) not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);
create index if not exists doctor_leave_ranges_dates_idx
  on public.doctor_leave_ranges (start_date, end_date)
  where is_active = true;
create index if not exists doctor_leave_ranges_type_idx
  on public.doctor_leave_ranges (appointment_type, start_date, end_date)
  where is_active = true;
alter table public.doctor_leave_ranges enable row level security;
revoke all on table public.doctor_leave_ranges from public, anon, authenticated;
grant all on table public.doctor_leave_ranges to service_role;
