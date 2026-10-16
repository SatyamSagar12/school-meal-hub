import { z } from "zod";
import { isIsoDate } from "@/lib/mdm";

/** Shared by the forms (browser) and the actions (server). */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : null));

export const isoDate = z.string().refine(isIsoDate, "Use a valid date");

export const studentSchema = z.object({
  admissionNo: z.string().trim().min(1, "Admission number is required").max(30),
  rollNo: optionalText(20),
  name: z.string().trim().min(2, "Name is required").max(120),
  fatherName: optionalText(120),
  motherName: optionalText(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dob: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isIsoDate(v), "Use a valid date"),
  className: z.string().trim().min(1, "Class is required").max(20),
  section: z.string().trim().min(1, "Section is required").max(10),
  mobile: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[0-9+\-\s]{6,15}$/.test(v), "Enter a valid mobile number"),
  address: optionalText(300),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED"]),
});

export type StudentInput = z.output<typeof studentSchema>;

const money = (max: number) => z.coerce.number().min(0, "Cannot be negative").max(max);

export const expenseSchema = z.object({
  date: isoDate,
  dalRate: money(10_000),
  vegRate: money(10_000),
  miscCost: money(1_000_000),
  miscNote: optionalText(200),
});

const grams = z.coerce.number().min(0).max(2000);
const rupees = z.coerce.number().min(0).max(1000);

export const schoolSettingsSchema = z.object({
  name: z.string().trim().min(2, "School name is required").max(150),
  udiseCode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{11}$/.test(v), "A UDISE+ code is 11 digits"),
  district: optionalText(80),
  state: optionalText(80),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Use the format 2026-2027"),
  ricePerStudentG: grams,
  dalPerStudentG: grams,
  vegPerStudentG: grams,
  budgetPerStudent: rupees,
  masalaPerStudent: rupees,
  fuelPerStudent: rupees,
  ricePerStudentGUpper: grams,
  dalPerStudentGUpper: grams,
  vegPerStudentGUpper: grams,
  budgetPerStudentUpper: rupees,
  masalaPerStudentUpper: rupees,
  fuelPerStudentUpper: rupees,
});

export const emailSchema = z.email("Enter a valid email").trim().toLowerCase().max(254);
export const nameSchema = z.string().trim().min(2, "Enter your name").max(120);
