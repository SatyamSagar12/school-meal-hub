import { requireUser } from "@/server/auth/session";
import { classList, listStudents, PAGE_SIZE } from "@/server/services/students";
import { StudentsClient } from "./students-client";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    q: (sp.q ?? "").slice(0, 100),
    className: (sp.class ?? "").slice(0, 20),
    section: (sp.section ?? "").slice(0, 10),
    status: sp.status ?? "ACTIVE",
    page: Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1),
  };
  const [{ rows, total }, lists] = await Promise.all([listStudents(user.schoolId, filters), classList(user.schoolId)]);

  return (
    <StudentsClient
      filters={filters}
      rows={rows.map(({ createdAt, updatedAt, createdById, schoolId, ...s }) => {
        void createdAt;
        void updatedAt;
        void createdById;
        void schoolId;
        return s;
      })}
      total={total}
      pageSize={PAGE_SIZE}
      classes={lists.classes}
      sections={lists.sections}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
