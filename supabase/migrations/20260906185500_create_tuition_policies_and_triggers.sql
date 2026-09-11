/*
# Tuition Platform — Functions, Triggers & RLS Policies

Adds the is_admin() helper, auto-profile trigger, role-protection trigger,
enables RLS on all tables, and creates ownership/admin-scoped policies.

## Security
- is_admin() SECURITY DEFINER function checks profiles.role = 'admin'
- RLS on all tables; grades/months/videos readable by all authenticated, writable by admin only
- profiles: users read/update own, admins read all; role is immutable via trigger
- student_access: students read own, admins have full CRUD
- Auto-profile creation via trigger on auth.users insert
*/

-- ============================================================
-- is_admin() helper function
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  );
$$;

-- ============================================================
-- Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Prevent role changes on profiles
-- ============================================================
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.role := OLD.role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_profile_update ON profiles;
CREATE TRIGGER before_profile_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- ============================================================
-- RLS: grades
-- ============================================================
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_grades_authenticated" ON grades;
CREATE POLICY "select_grades_authenticated"
ON grades FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_grades_admin" ON grades;
CREATE POLICY "insert_grades_admin"
ON grades FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_grades_admin" ON grades;
CREATE POLICY "update_grades_admin"
ON grades FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_grades_admin" ON grades;
CREATE POLICY "delete_grades_admin"
ON grades FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- RLS: months
-- ============================================================
ALTER TABLE months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_months_authenticated" ON months;
CREATE POLICY "select_months_authenticated"
ON months FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_months_admin" ON months;
CREATE POLICY "insert_months_admin"
ON months FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_months_admin" ON months;
CREATE POLICY "update_months_admin"
ON months FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_months_admin" ON months;
CREATE POLICY "delete_months_admin"
ON months FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- RLS: profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
ON profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS: videos
-- ============================================================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_videos_authenticated" ON videos;
CREATE POLICY "select_videos_authenticated"
ON videos FOR SELECT TO authenticated
USING (is_published = true OR is_admin());

DROP POLICY IF EXISTS "insert_videos_admin" ON videos;
CREATE POLICY "insert_videos_admin"
ON videos FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_videos_admin" ON videos;
CREATE POLICY "update_videos_admin"
ON videos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_videos_admin" ON videos;
CREATE POLICY "delete_videos_admin"
ON videos FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- RLS: student_access
-- ============================================================
ALTER TABLE student_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_access_or_admin" ON student_access;
CREATE POLICY "select_own_access_or_admin"
ON student_access FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "insert_access_admin" ON student_access;
CREATE POLICY "insert_access_admin"
ON student_access FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_access_admin" ON student_access;
CREATE POLICY "update_access_admin"
ON student_access FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_access_admin" ON student_access;
CREATE POLICY "delete_access_admin"
ON student_access FOR DELETE TO authenticated USING (is_admin());
