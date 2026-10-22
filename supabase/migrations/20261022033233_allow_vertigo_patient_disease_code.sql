-- Include vertigo in allowed patient follow-up areas.
-- Without this value the frontend and API accepted it, but the patients table
-- CHECK constraint rejected the update and returned a server error.
alter table public.patients
  drop constraint if exists patients_disease_code_check;

alter table public.patients
  add constraint patients_disease_code_check
  check (disease_code in (
    'migraine','ms','epilepsy','parkinson','cognition',
    'low_back_pain','stroke','vertigo','other','unassigned'
  ));
