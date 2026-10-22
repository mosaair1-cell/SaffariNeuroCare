-- Add the requested neuromuscular follow-up categories and physician-defined labels for "other".
alter table public.patients
  add column if not exists custom_disease_label text;

alter table public.patients
  drop constraint if exists patients_disease_code_check;

alter table public.patients
  add constraint patients_disease_code_check
  check (disease_code in (
    'migraine','ms','epilepsy','parkinson','cognition',
    'low_back_pain','stroke','vertigo','myasthenia_gravis',
    'neuropathy','als','myopathy','other','unassigned'
  ));

alter table public.patients
  drop constraint if exists patients_custom_disease_label_check;

alter table public.patients
  add constraint patients_custom_disease_label_check
  check (
    custom_disease_label is null
    or (disease_code = 'other' and length(btrim(custom_disease_label)) between 1 and 80)
  );

create or replace function public.change_patient_disease(
  p_patient_id uuid,
  p_new_disease_code text,
  p_new_custom_disease_label text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_old_disease text;
  v_old_custom_label text;
  v_new_custom_label text;
begin
  if p_new_disease_code not in (
    'migraine','ms','epilepsy','parkinson','cognition',
    'low_back_pain','stroke','vertigo','myasthenia_gravis',
    'neuropathy','als','myopathy','other','unassigned'
  ) then
    raise exception 'invalid_disease_code';
  end if;

  v_new_custom_label := case
    when p_new_disease_code = 'other' then nullif(btrim(coalesce(p_new_custom_disease_label, '')), '')
    else null
  end;

  if v_new_custom_label is not null and length(v_new_custom_label) > 80 then
    raise exception 'invalid_custom_disease_label';
  end if;

  select disease_code, custom_disease_label
    into v_old_disease, v_old_custom_label
    from public.patients
   where id = p_patient_id
   for update;

  if not found then
    return null;
  end if;

  if v_old_disease = p_new_disease_code
     and coalesce(v_old_custom_label, '') = coalesce(v_new_custom_label, '') then
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
         custom_disease_label = v_new_custom_label,
         updated_at = now()
   where id = p_patient_id;

  return v_old_disease;
end;
$function$;

create or replace function public.change_patient_disease(
  p_patient_id uuid,
  p_new_disease_code text
)
returns text
language sql
security invoker
set search_path = ''
as $function$
  select public.change_patient_disease(p_patient_id, p_new_disease_code, null::text);
$function$;

revoke all on function public.change_patient_disease(uuid,text) from public;
revoke all on function public.change_patient_disease(uuid,text) from anon, authenticated;
grant execute on function public.change_patient_disease(uuid,text) to service_role;

revoke all on function public.change_patient_disease(uuid,text,text) from public;
revoke all on function public.change_patient_disease(uuid,text,text) from anon, authenticated;
grant execute on function public.change_patient_disease(uuid,text,text) to service_role;
