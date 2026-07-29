CREATE TABLE public.class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_date DATE NOT NULL,
  class_name TEXT NOT NULL,
  section TEXT NOT NULL,
  present_count INTEGER NOT NULL DEFAULT 0 CHECK (present_count >= 0),
  enrolled_count INTEGER NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attendance_date, class_name, section)
);
CREATE INDEX idx_class_attendance_date ON public.class_attendance (attendance_date);
CREATE INDEX idx_class_attendance_class ON public.class_attendance (attendance_date, class_name, section);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_attendance TO authenticated;
GRANT ALL ON public.class_attendance TO service_role;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_attendance_read" ON public.class_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "class_attendance_insert" ON public.class_attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "class_attendance_update" ON public.class_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "class_attendance_delete" ON public.class_attendance FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_class_attendance_updated BEFORE UPDATE ON public.class_attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.class_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  budget_per_student NUMERIC(10,2) NOT NULL CHECK (budget_per_student >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_name, section)
);
CREATE INDEX idx_class_rates_class ON public.class_rates (class_name, section);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_rates TO authenticated;
GRANT ALL ON public.class_rates TO service_role;
ALTER TABLE public.class_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_rates_read" ON public.class_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "class_rates_insert" ON public.class_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "class_rates_update" ON public.class_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "class_rates_delete" ON public.class_rates FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_class_rates_updated BEFORE UPDATE ON public.class_rates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.settings ALTER COLUMN budget_per_student SET DEFAULT 6.78;
UPDATE public.settings SET budget_per_student = 6.78 WHERE id = true AND budget_per_student = 6.75;