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
     );

  delete from public.sessions where user_id = p_patient_id;
  delete from public.appointments where patient_id = p_patient_id;
  delete from public.symptom_reports where patient_id = p_patient_id;
  delete from public.clinical_notes where patient_id = p_patient_id;
  delete from public.treatment_plans where patient_id = p_patient_id;
  delete from public.medications where patient_id = p_patient_id;
  delete from public.patients where id = p_patient_id;

  return true;
end;
$function$;

revoke all on function public.purge_patient_data(uuid) from public;
revoke all on function public.purge_patient_data(uuid) from anon, authenticated;
grant execute on function public.purge_patient_data(uuid) to service_role;
