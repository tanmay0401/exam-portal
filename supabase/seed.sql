-- Seed script for ExamPortal: Create Default Admin and Candidate Accounts
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query)

-- 1. Create Default Admin Account
-- Email: admin@examportal.com
-- Password: AdminPassword@123
DO $$
DECLARE
  admin_uid uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@examportal.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      'admin@examportal.com',
      crypt('AdminPassword@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Exam Administrator","role":"admin"}',
      now(),
      now(),
      ''
    );

    -- Ensure profile exists with role 'admin'
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (admin_uid, 'admin@examportal.com', 'Exam Administrator', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  ELSE
    -- If already exists, ensure role is admin
    UPDATE public.profiles
    SET role = 'admin'
    WHERE email = 'admin@examportal.com';
  END IF;
END $$;

-- 2. Create Default Student Account
-- Email: student@examportal.com
-- Password: StudentPassword@123
DO $$
DECLARE
  student_uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'student@examportal.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      student_uid,
      'authenticated',
      'authenticated',
      'student@examportal.com',
      crypt('StudentPassword@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Candidate Sample","role":"student"}',
      now(),
      now(),
      ''
    );

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (student_uid, 'student@examportal.com', 'Candidate Sample', 'student')
    ON CONFLICT (id) DO UPDATE SET role = 'student';
  END IF;
END $$;
