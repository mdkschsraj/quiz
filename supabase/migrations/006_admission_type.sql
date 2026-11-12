-- Admission type chosen on the registration form. Run after 005.
alter table students add column if not exists admission_type text
  check (admission_type in ('medical','nursing','a_unit','other_unit'));

-- Make Supabase's API notice the new column straight away.
notify pgrst, 'reload schema';
