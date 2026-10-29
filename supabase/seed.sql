-- Sample data for local testing. Replace with real centers and questions.

insert into centers (name, slug) values
  ('Sample Coaching Center A', 'center-a'),
  ('Sample Coaching Center B', 'center-b');

insert into campaign_weeks (label, starts_at, ends_at, quiz_duration_seconds, questions_per_quiz)
values ('Week 1', now() - interval '1 day', now() + interval '6 days', 300, 5);

insert into questions (text, options, correct_index) values
  ('Which organ pumps blood around the body?', '["Liver","Heart","Kidney","Lung"]', 1),
  ('What is the chemical symbol for water?', '["CO2","O2","H2O","NaCl"]', 2),
  ('Which vitamin is produced when skin is exposed to sunlight?', '["Vitamin A","Vitamin C","Vitamin D","Vitamin K"]', 2),
  ('How many bones are in the typical adult human body?', '["186","206","226","256"]', 1),
  ('Which part of the eye controls how much light enters?', '["Cornea","Retina","Iris","Lens"]', 2),
  ('What is the capital of Bangladesh?', '["Chattogram","Dhaka","Sylhet","Khulna"]', 1),
  ('Which blood cells carry oxygen?', '["White cells","Platelets","Red cells","Plasma"]', 2);
