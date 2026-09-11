/*
# Tuition Platform — Create Tables

Creates all tables for the tuition class video streaming platform.
Policies and triggers are added in a follow-up migration.

## Tables
- grades: Grade 9, 10, 11 with display ordering
- months: Per-grade monthly containers (year + month_name), can be locked
- profiles: User info (name, phone, role, active_grade_id)
- videos: Lesson videos with title, description, URL, multi-quality URLs, thumbnail
- student_access: Per-student per-month access grants
*/

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_name text UNIQUE NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  month_name text NOT NULL,
  year int NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (grade_id, month_name, year)
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  active_grade_id uuid REFERENCES grades(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  video_url text NOT NULL,
  quality_urls jsonb DEFAULT '[]'::jsonb,
  duration text DEFAULT '',
  thumbnail_url text DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_id uuid NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  has_access boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, month_id)
);
