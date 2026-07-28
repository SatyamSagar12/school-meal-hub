import { z } from "zod";

export const genderEnum = z.enum(["male", "female", "other"]);
export const statusEnum = z.enum(["active", "inactive", "transferred"]);

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer`).optional().or(z.literal(""));

export const studentSchema = z.object({
  admission_no: z.string().trim().min(1, "Admission number is required").max(30),
  roll_no: optionalText(20),
  name: z.string().trim().min(2, "Name is required").max(120),
  father_name: optionalText(120),
  mother_name: optionalText(120),
  gender: genderEnum,
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),
  class_name: z.string().trim().min(1, "Class is required").max(20),
  section: z.string().trim().min(1, "Section is required").max(10),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{6,15}$/, "Enter a valid mobile number")
    .optional()
    .or(z.literal("")),
  address: optionalText(300),
  status: statusEnum,
});

export type StudentFormValues = z.output<typeof studentSchema>;
export type StudentPayload = StudentFormValues;

/** Convert empty optional strings to nulls for the database. */
export function toStudentRow(v: StudentFormValues) {
  const blank = (x?: string | null) => (x && x.trim() ? x.trim() : null);
  return {
    admission_no: v.admission_no,
    name: v.name,
    class_name: v.class_name,
    section: v.section,
    gender: v.gender,
    status: v.status,
    roll_no: blank(v.roll_no),
    father_name: blank(v.father_name),
    mother_name: blank(v.mother_name),
    dob: blank(v.dob),
    mobile: blank(v.mobile),
    address: blank(v.address),
  };
}

export const expenseSchema = z.object({
  dal_rate: z.coerce.number().min(0, "Cannot be negative").max(10000),
  veg_rate: z.coerce.number().min(0, "Cannot be negative").max(10000),
  misc_cost: z.coerce.number().min(0, "Cannot be negative").max(1000000),
  misc_note: z.string().trim().max(200).optional().or(z.literal("")),
});
export type ExpenseFormValues = z.input<typeof expenseSchema>;

export const settingsSchema = z.object({
  school_name: z.string().trim().min(2, "School name is required").max(150),
  academic_year: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Use format 2025-2026"),
  rice_per_student_g: z.coerce.number().min(0).max(2000),
  dal_per_student_g: z.coerce.number().min(0).max(2000),
  veg_per_student_g: z.coerce.number().min(0).max(2000),
  budget_per_student: z.coerce.number().min(0).max(1000),
  masala_per_student: z.coerce.number().min(0).max(1000),
  fuel_per_student: z.coerce.number().min(0).max(1000),
});
export type SettingsFormValues = z.input<typeof settingsSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export const signUpSchema = signInSchema.extend({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
});

export const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
