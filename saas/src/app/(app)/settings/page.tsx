import { requireUser } from "@/server/auth/session";
import { getSchool, listClassRates } from "@/server/services/school";
import { classList } from "@/server/services/students";
import { listTeam } from "@/server/services/team";
import { recentAudit } from "@/server/services/audit";
import { PLAN } from "@/lib/plans";
import { PageHeader } from "@/components/app/page-header";
import { SchoolForm, ClassRates, Team, ActivityLog } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [school, rates, lists, team, audit] = await Promise.all([
    getSchool(user.schoolId),
    listClassRates(user.schoolId),
    classList(user.schoolId),
    isAdmin ? listTeam(user.schoolId) : Promise.resolve([]),
    recentAudit(user.schoolId, 25),
  ]);

  return (
    <>
      <PageHeader title="Settings" description={isAdmin ? "School details, meal norms and who can sign in." : "Only your school's admin can change these."} />
      <div className="grid gap-5">
        <SchoolForm school={school} canEdit={isAdmin} />
        <ClassRates
          classes={lists.classes}
          overrides={rates}
          tierRates={{ primary: school.budgetPerStudent, upper: school.budgetPerStudentUpper }}
          canEdit={isAdmin}
        />
        {isAdmin ? (
          <Team
            selfId={user.id}
            maxUsers={PLAN.maxUsers}
            team={team.map((t) => ({ ...t, lastLoginAt: t.lastLoginAt?.toISOString() ?? null }))}
          />
        ) : null}
        <ActivityLog entries={audit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))} />
      </div>
    </>
  );
}
