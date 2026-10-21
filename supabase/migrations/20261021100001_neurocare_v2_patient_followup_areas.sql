-- Extend patient follow-up options without modifying existing patient rows.
alter table public.patients drop constraint if exists patients_disease_code_check;
alter table public.patients add constraint patients_disease_code_check
  check (disease_code in ('migraine','ms','epilepsy','parkinson','cognition','low_back_pain','stroke','other','unassigned'));
