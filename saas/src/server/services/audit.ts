import "server-only";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";

/**
 * Who did what. Append-only: nothing in the app updates or deletes a row.
 * The name is copied in so the log still reads after a teacher is removed.
 */
export async function logAudit(
  user: Pick<SessionUser, "id" | "schoolId" | "name">,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  await db().auditLog.create({
    data: {
      schoolId: user.schoolId,
      userId: user.id,
      userName: user.name,
      action,
      entity,
      entityId: entityId ?? null,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function recentAudit(schoolId: string, take = 30) {
  return db().auditLog.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, userName: true, action: true, entity: true, details: true, createdAt: true },
  });
}
