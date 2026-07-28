-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','staff');
CREATE TYPE public.gender_type AS ENUM ('male','female','other');
CREATE TYPE public.student_status AS ENUM ('active','inactive','transferred');
CREATE TYPE public.attendance_status AS ENUM ('present','absent');

-- ============ SHARED TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- new users -> profile + default role (first user becomes admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  SELECT count(*) INTO existing FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing = 0 THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  school_name TEXT NOT NULL DEFAULT 'Government High School',
  academic_year TEXT NOT NULL DEFAULT '2025-2026',
  logo_url TEXT,
  rice_per_student_g NUMERIC(10,2) NOT NULL DEFAULT 100,
  dal_per_student_g NUMERIC(10,2) NOT NULL DEFAULT 20,
  veg_per_student_g NUMERIC(10,2) NOT NULL DEFAULT 50,
  budget_per_student NUMERIC(10,2) NOT NULL DEFAULT 6.75,
  masala_per_student NUMERIC(10,2) NOT NULL DEFAULT 1.20,
  fuel_per_student NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write" ON public.settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "settings_update" ON public.settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.settings (id) VALUES (true);

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no TEXT NOT NULL UNIQUE,
  roll_no TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  father_name TEXT,
  mother_name TEXT,
  gender public.gender_type NOT NULL DEFAULT 'male',
  dob DATE,
  class_name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'A',
  mobile TEXT,
  address TEXT,
  status public.student_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_class ON public.students (class_name, section);
CREATE INDEX idx_students_status ON public.students (status);
CREATE INDEX idx_students_name ON public.students (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_read" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "students_insert" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "students_update" ON public.students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "students_delete" ON public.students FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_date DATE NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  section TEXT NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attendance_date, student_id)
);
CREATE INDEX idx_attendance_date ON public.attendance (attendance_date);
CREATE INDEX idx_attendance_class ON public.attendance (attendance_date, class_name, section);
CREATE INDEX idx_attendance_student ON public.attendance (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_read" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DAILY EXPENSES ============
CREATE TABLE public.daily_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL UNIQUE,
  present_count INTEGER NOT NULL DEFAULT 0 CHECK (present_count >= 0),
  rice_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (rice_kg >= 0),
  dal_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (dal_kg >= 0),
  veg_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (veg_kg >= 0),
  dal_rate NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (dal_rate >= 0),
  veg_rate NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (veg_rate >= 0),
  dal_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  veg_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  masala_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  misc_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (misc_cost >= 0),
  misc_note TEXT,
  total_expense NUMERIC(12,2) NOT NULL DEFAULT 0,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  credits_saved NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_date ON public.daily_expenses (expense_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_expenses TO authenticated;
GRANT ALL ON public.daily_expenses TO service_role;
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_read" ON public.daily_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_insert" ON public.daily_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "expenses_update" ON public.daily_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expenses_delete" ON public.daily_expenses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.daily_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs (created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);