create table if not exists public.clinical_scores (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  score_type text not null default 'edss' check (score_type = 'edss'),
  score_value numeric(3,1) not null,
  assessed_on date not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint clinical_scores_edss_range check (
    score_value >= 0
    and score_value <= 10
    and score_value * 2 = trunc(score_value * 2)
  ),
  constraint clinical_scores_notes_length check (
    notes is null or char_length(notes) <= 500
  )
);

create index if not exists clinical_scores_patient_assessed_idx
  on public.clinical_scores (patient_id, assessed_on desc, created_at desc);

alter table public.clinical_scores enable row level security;
revoke all on table public.clinical_scores from public, anon, authenticated;
grant select, insert, update, delete on table public.clinical_scores to service_role;

create or replace function public.purge_patient_data(p_patient_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from public.patients where id = p_patient_id
  ) into v_exists;

  if not v_exists then
    return false;
  end if;

  delete from public.audit_events
  where actor_id = p_patient_id::text
     or subject_id = p_patient_id::text
     or subject_id in (
       select id::text from public.appointments where patient_id = p_patient_id
       union all
       select id::text from public.symptom_reports where patient_id = p_patient_id
       union all
       select id::text from public.clinical_notes where patient_id = p_patient_id
       union all
       select id::text from public.treatment_plans where patient_id = p_patient_id
       union all
       select id::text from public.medications where patient_id = p_patient_id
       union all
       select id::text from public.clinical_scores where patient_id = p_patient_id
     );

  delete from public.sessions where user_id = p_patient_id;
  delete from public.appointments where patient_id = p_patient_id;
  delete from public.symptom_reports where patient_id = p_patient_id;
  delete from public.clinical_notes where patient_id = p_patient_id;
  delete from public.treatment_plans where patient_id = p_patient_id;
  delete from public.medications where patient_id = p_patient_id;
  delete from public.clinical_scores where patient_id = p_patient_id;
  delete from public.patients where id = p_patient_id;

  return true;
end;
$function$;

revoke all on function public.purge_patient_data(uuid) from public;
revoke all on function public.purge_patient_data(uuid) from anon, authenticated;
grant execute on function public.purge_patient_data(uuid) to service_role;
