import "server-only";
import { db } from "@/server/db";
import { toRates, type ClassRateOverride, type MealRates } from "@/lib/mdm";
import type { z } from "zod";
import type { schoolSettingsSchema } from "@/lib/schemas";

const SCHOOL_SELECT = {
  id: true,
  name: true,
  udiseCode: true,
  district: true,
  state: true,
  academicYear: true,
  ricePerStudentG: true,
  dalPerStudentG: true,
  vegPerStudentG: true,
  budgetPerStudent: true,
  masalaPerStudent: true,
  fuelPerStudent: true,
  ricePerStudentGUpper: true,
  dalPerStudentGUpper: true,
  vegPerStudentGUpper: true,
  budgetPerStudentUpper: true,
  masalaPerStudentUpper: true,
  fuelPerStudentUpper: true,
} as const;

export async function getSchool(schoolId: string) {
  return db().school.findUniqueOrThrow({ where: { id: schoolId }, select: SCHOOL_SELECT });
}

export type SchoolProfile = Awaited<ReturnType<typeof getSchool>>;

/** Everything a cost calculation needs, in one place. */
export async function mealContext(schoolId: string): Promise<{ rates: MealRates; overrides: ClassRateOverride[] }> {
  const [school, overrides] = await Promise.all([getSchool(schoolId), listClassRates(schoolId)]);
  return { rates: toRates(school), overrides };
}

export async function updateSchool(schoolId: string, data: z.output<typeof schoolSettingsSchema>): Promise<void> {
  await db().school.update({ where: { id: schoolId }, data });
}

export async function listClassRates(schoolId: string): Promise<ClassRateOverride[]> {
  return db().classRate.findMany({
    where: { schoolId },
    select: { className: true, section: true, budgetPerStudent: true },
    orderBy: [{ className: "asc" }, { section: "asc" }],
  });
}

/** `budgetPerStudent` null removes the override, so the class falls back to its tier rate. */
export async function setClassRate(schoolId: string, className: string, section: string, budgetPerStudent: number | null) {
  if (budgetPerStudent === null) {
    await db().classRate.deleteMany({ where: { schoolId, className, section } });
    return;
  }
  await db().classRate.upsert({
    where: { schoolId_className_section: { schoolId, className, section } },
    create: { schoolId, className, section, budgetPerStudent },
    update: { budgetPerStudent },
  });
}
