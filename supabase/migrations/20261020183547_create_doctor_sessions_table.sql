-- Separate doctor sessions from patient sessions to avoid invalid patient foreign-key references.
create table if not exists public.doctor_sessions (
  token_hash text primary key,
  user_id uuid not null,
  role varchar(20) not null default 'doctor' check (role = 'doctor'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists doctor_sessions_expiry_idx on public.doctor_sessions(expires_at);
alter table public.doctor_sessions enable row level security;
revoke all on table public.doctor_sessions from public, anon, authenticated;
grant all on table public.doctor_sessions to service_role;
