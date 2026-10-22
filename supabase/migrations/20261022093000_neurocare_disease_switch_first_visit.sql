-- Support a structured first-visit intake report.
alter table public.symptom_reports
  drop constraint if exists symptom_reports_report_type_check;
alter table public.symptom_reports
  add constraint symptom_reports_report_type_check
  check (report_type in ('symptom','pre_visit','initial_visit'));

-- Atomically switch a patient's follow-up area and clear the previous clinical file.
-- The patient account, credentials, approval status, and current session are retained.
create or replace function public.change_patient_disease(
  p_patient_id uuid,
  p_new_disease_code text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_old_disease text;
begin
  if p_new_disease_code not in (
    'migraine','ms','epilepsy','parkinson','cognition',
    'low_back_pain','stroke','vertigo','other','unassigned'
  ) then
    raise exception 'invalid_disease_code';
  end if;

  select disease_code
    into v_old_disease
    from public.patients
   where id = p_patient_id
   for update;

  if not found then
    return null;
  end if;

  if v_old_disease = p_new_disease_code then
    return v_old_disease;
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

  delete from public.appointments where patient_id = p_patient_id;
  delete from public.symptom_reports where patient_id = p_patient_id;
  delete from public.clinical_notes where patient_id = p_patient_id;
  delete from public.treatment_plans where patient_id = p_patient_id;
  delete from public.medications where patient_id = p_patient_id;
  delete from public.clinical_scores where patient_id = p_patient_id;

  update public.patients
     set disease_code = p_new_disease_code,
         updated_at = now()
   where id = p_patient_id;

  return v_old_disease;
end;
$function$;

revoke all on function public.change_patient_disease(uuid,text) from public;
revoke all on function public.change_patient_disease(uuid,text) from anon, authenticated;
grant execute on function public.change_patient_disease(uuid,text) to service_role;
