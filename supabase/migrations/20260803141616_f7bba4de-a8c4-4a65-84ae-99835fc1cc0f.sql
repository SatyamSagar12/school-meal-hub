ALTER TABLE public.settings
  ADD COLUMN rice_per_student_g_upper NUMERIC(10,2) NOT NULL DEFAULT 150,
  ADD COLUMN dal_per_student_g_upper  NUMERIC(10,2) NOT NULL DEFAULT 30,
  ADD COLUMN veg_per_student_g_upper  NUMERIC(10,2) NOT NULL DEFAULT 75,
  ADD COLUMN budget_per_student_upper NUMERIC(10,2) NOT NULL DEFAULT 10.17,
  ADD COLUMN masala_per_student_upper NUMERIC(10,2) NOT NULL DEFAULT 1.80,
  ADD COLUMN fuel_per_student_upper   NUMERIC(10,2) NOT NULL DEFAULT 1.50;

ALTER TABLE public.daily_expenses
  ADD COLUMN present_primary INTEGER NOT NULL DEFAULT 0 CHECK (present_primary >= 0),
  ADD COLUMN present_upper   INTEGER NOT NULL DEFAULT 0 CHECK (present_upper >= 0),
  ADD COLUMN rice_kg_upper   NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (rice_kg_upper >= 0),
  ADD COLUMN dal_kg_upper    NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (dal_kg_upper >= 0),
  ADD COLUMN veg_kg_upper    NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (veg_kg_upper >= 0);

UPDATE public.daily_expenses SET present_primary = present_count WHERE present_primary = 0;