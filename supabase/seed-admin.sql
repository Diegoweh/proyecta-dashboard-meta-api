-- Script to create first admin user
-- Replace 'admin@example.com' with your actual admin email

-- First, the user must sign up through the app or Supabase auth
-- Then run this to promote them to admin:

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
WHERE email = 'admin@example.com';

-- To verify:
SELECT email, raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'admin@example.com';

-- To demote back to viewer:
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"role": "VIEWER"}'::jsonb
-- WHERE email = 'admin@example.com';
