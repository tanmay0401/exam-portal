-- Online Examination Portal Database Schema Migration
-- PostgreSQL / Supabase Migration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 2. SUBJECTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. QUESTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. EXAMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  total_questions int NOT NULL,
  marks_per_question numeric NOT NULL DEFAULT 4,
  negative_marks numeric NOT NULL DEFAULT 1,
  max_marks numeric GENERATED ALWAYS AS (total_questions * marks_per_question) STORED,
  duration_minutes int NOT NULL,
  batch_count int NOT NULL DEFAULT 3,
  allow_question_reuse boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  is_dry_run boolean NOT NULL DEFAULT false,
  selected_batch_id uuid,
  published_at timestamptz,
  exam_link_token text UNIQUE,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. EXAM BATCHES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  batch_number int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_exam_batch UNIQUE (exam_id, batch_number)
);

-- Add foreign key constraint for selected_batch_id on exams now that exam_batches exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exams_selected_batch_id_fkey'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_selected_batch_id_fkey
      FOREIGN KEY (selected_batch_id) REFERENCES public.exam_batches(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ==============================================================================
-- 6. EXAM BATCH QUESTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_batch_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.exam_batches(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_order int NOT NULL,
  CONSTRAINT unique_batch_question UNIQUE (batch_id, question_id),
  CONSTRAINT unique_batch_question_order UNIQUE (batch_id, question_order)
);

-- ==============================================================================
-- 7. EXAM ATTEMPTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.exam_batches(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  is_auto_submitted boolean NOT NULL DEFAULT false,
  is_dry_run boolean NOT NULL DEFAULT false,
  score numeric,
  total_correct int NOT NULL DEFAULT 0,
  total_incorrect int NOT NULL DEFAULT 0,
  total_unanswered int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  proctor_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT unique_exam_student_attempt UNIQUE (exam_id, student_id)
);

-- ==============================================================================
-- 8. EXAM RESPONSES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_order int NOT NULL,
  selected_option text CHECK (selected_option IN ('A', 'B', 'C', 'D') OR selected_option IS NULL),
  is_marked_for_review boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_subjects_created_by ON public.subjects(created_by);

CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_created_by ON public.questions(created_by);

CREATE INDEX IF NOT EXISTS idx_exams_subject_id ON public.exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_link_token ON public.exams(exam_link_token);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON public.exams(created_by);

CREATE INDEX IF NOT EXISTS idx_exam_batches_exam_id ON public.exam_batches(exam_id);

CREATE INDEX IF NOT EXISTS idx_batch_questions_batch_id ON public.exam_batch_questions(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_questions_question_id ON public.exam_batch_questions(question_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON public.exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_batch_id ON public.exam_attempts(batch_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);

CREATE INDEX IF NOT EXISTS idx_exam_responses_attempt_id ON public.exam_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_responses_question_id ON public.exam_responses(question_id);

-- ==============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger function to automatically create a profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function to update response updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_exam_response_updated ON public.exam_responses;
CREATE TRIGGER on_exam_response_updated
  BEFORE UPDATE ON public.exam_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_batch_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_responses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- SUBJECTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to subjects"
  ON public.subjects FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can read subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------------------------
-- QUESTIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to questions"
  ON public.questions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view questions for their assigned batch attempt"
  ON public.questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      JOIN public.exam_batch_questions ebq ON ea.batch_id = ebq.batch_id
      WHERE ea.student_id = auth.uid()
        AND ebq.question_id = public.questions.id
    )
  );

-- ------------------------------------------------------------------------------
-- EXAMS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to exams"
  ON public.exams FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view published exams"
  ON public.exams FOR SELECT
  TO authenticated
  USING (status = 'published');

-- ------------------------------------------------------------------------------
-- EXAM BATCHES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to exam batches"
  ON public.exam_batches FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view their assigned batch"
  ON public.exam_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.student_id = auth.uid()
        AND ea.batch_id = public.exam_batches.id
    )
  );

-- ------------------------------------------------------------------------------
-- EXAM BATCH QUESTIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to batch questions"
  ON public.exam_batch_questions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view batch questions for their assigned batch"
  ON public.exam_batch_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.student_id = auth.uid()
        AND ea.batch_id = public.exam_batch_questions.batch_id
    )
  );

-- ------------------------------------------------------------------------------
-- EXAM ATTEMPTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to attempts"
  ON public.exam_attempts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view own attempts"
  ON public.exam_attempts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own attempts"
  ON public.exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own attempts"
  ON public.exam_attempts FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ------------------------------------------------------------------------------
-- EXAM RESPONSES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins have full access to responses"
  ON public.exam_responses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view own responses"
  ON public.exam_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = public.exam_responses.attempt_id
        AND ea.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert own responses"
  ON public.exam_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = public.exam_responses.attempt_id
        AND ea.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can update own responses"
  ON public.exam_responses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = public.exam_responses.attempt_id
        AND ea.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = public.exam_responses.attempt_id
        AND ea.student_id = auth.uid()
    )
  );
