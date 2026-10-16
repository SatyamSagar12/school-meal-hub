"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  addTeacherAction,
  resetTeacherPasswordAction,
  setClassRateAction,
  setTeacherActiveAction,
  setTeacherRoleAction,
  updateSchoolAction,
} from "@/server/actions/admin";
import { inr, tierForClass, TIER_LABEL, type ClassRateOverride } from "@/lib/mdm";

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="text-muted-foreground mt-0.5 mb-4 text-sm">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

type School = Record<string, string | number | null> & { id: string };

const NORMS = [
  ["ricePerStudentG", "Rice (g per child)"],
  ["dalPerStudentG", "Dal (g per child)"],
  ["vegPerStudentG", "Vegetables (g per child)"],
  ["budgetPerStudent", "Cooking cost budget (₹ per child)"],
  ["masalaPerStudent", "Masala (₹ per child)"],
  ["fuelPerStudent", "Fuel (₹ per child)"],
] as const;

export function SchoolForm({ school, canEdit }: { school: School; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(school).map(([k, v]) => [k, v === null ? "" : String(v)])),
  );
  const bind = (key: string) => ({
    value: form[key] ?? "",
    disabled: !canEdit,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await updateSchoolAction(form);
      if (result.ok) {
        toast.success("Settings saved");
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  return (
    <form onSubmit={save} className="grid gap-5">
      <Panel title="School">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            School name
            <Input {...bind("name")} required />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            UDISE+ code
            <Input {...bind("udiseCode")} inputMode="numeric" placeholder="11 digits (optional)" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            District
            <Input {...bind("district")} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            State
            <Input {...bind("state")} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Academic year
            <Input {...bind("academicYear")} placeholder="2026-2027" />
          </label>
        </div>
      </Panel>

      <Panel
        title="Meal norms"
        description="Per child, per day. Defaults follow PM POSHAN norms; change them to your state's current rates."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {(["", "Upper"] as const).map((suffix) => (
            <div key={suffix} className="grid gap-3">
              <p className="text-sm font-semibold">{suffix ? TIER_LABEL.upper_primary : TIER_LABEL.primary}</p>
              {NORMS.map(([key, label]) => (
                <label key={key} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm">
                  {label}
                  <Input type="number" step="0.01" min="0" inputMode="decimal" {...bind(`${key}${suffix}`)} />
                </label>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function ClassRates({
  classes,
  overrides,
  tierRates,
  canEdit,
}: {
  classes: string[];
  overrides: ClassRateOverride[];
  tierRates: { primary: number; upper: number };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(overrides.filter((o) => o.section === "").map((o) => [o.className, String(o.budgetPerStudent)])),
  );

  function save(className: string) {
    const raw = (values[className] ?? "").trim();
    start(async () => {
      const result = await setClassRateAction({ className, section: "", budgetPerStudent: raw === "" ? null : Number(raw) });
      if (result.ok) {
        toast.success(raw === "" ? `Class ${className} uses its tier rate again` : `Class ${className} rate saved`);
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  return (
    <Panel title="Budget per class" description="Only if a class gets a different rate from its tier. Leave blank to use the tier rate.">
      {classes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Add students first; their classes appear here.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const tier = tierForClass(c);
            return (
              <div key={c} className="flex items-center gap-2 rounded-lg border p-2">
                <span className="w-20 text-sm font-medium">Class {c}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-24"
                  disabled={!canEdit}
                  placeholder={inr(tier === "upper_primary" ? tierRates.upper : tierRates.primary)}
                  value={values[c] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))}
                  aria-label={`Budget per child for class ${c}`}
                />
                {canEdit ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => save(c)}>
                    Save
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

type Member = { id: string; name: string; email: string; role: "ADMIN" | "TEACHER"; isActive: boolean; lastLoginAt: string | null; mustChangePassword: boolean };

export function Team({ team, selfId, maxUsers }: { team: Member[]; selfId: string; maxUsers: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState<{ who: string; password: string } | null>(null);
  const active = team.filter((t) => t.isActive).length;

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) {
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(result.error?.message ?? "Something went wrong");
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await addTeacherAction({ name, email });
      if (!result.ok) return void toast.error(result.error.message);
      setIssued({ who: email, password: result.data.tempPassword });
      setName("");
      setEmail("");
      router.refresh();
    });
  }

  function reset(m: Member) {
    if (!confirm(`Give ${m.name} a new temporary password? They will be signed out.`)) return;
    start(async () => {
      const result = await resetTeacherPasswordAction(m.id);
      if (!result.ok) return void toast.error(result.error.message);
      setIssued({ who: m.email, password: result.data.tempPassword });
      router.refresh();
    });
  }

  return (
    <Panel title="Teachers" description={`${active} of ${maxUsers} logins in use. Add a teacher, then give them the temporary password in person.`}>
      {issued ? (
        <div className="bg-success-muted mb-4 rounded-lg p-3 text-sm">
          Temporary password for <strong>{issued.who}</strong>: <code className="bg-card rounded px-1.5 py-0.5 text-base">{issued.password}</code>
          <p className="text-muted-foreground mt-1 text-xs">Shown once. They will choose their own password when they first sign in.</p>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((m) => (
              <TableRow key={m.id} className={m.isActive ? undefined : "opacity-60"}>
                <TableCell className="font-medium">
                  {m.name} {m.id === selfId ? <Badge variant="outline">you</Badge> : null}
                  {!m.isActive ? <Badge variant="outline">off</Badge> : null}
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role === "ADMIN" ? "Admin" : "Teacher"}</TableCell>
                <TableCell className="space-x-1 text-right whitespace-nowrap">
                  {m.id !== selfId ? (
                    <>
                      <Button size="xs" variant="outline" disabled={pending} onClick={() => reset(m)}>
                        Reset password
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => setTeacherRoleAction(m.id, m.role === "ADMIN" ? "TEACHER" : "ADMIN"), "Role changed")}
                      >
                        Make {m.role === "ADMIN" ? "teacher" : "admin"}
                      </Button>
                      <Button
                        size="xs"
                        variant={m.isActive ? "destructive" : "outline"}
                        disabled={pending}
                        onClick={() => run(() => setTeacherActiveAction(m.id, !m.isActive), m.isActive ? "Login switched off" : "Login switched on")}
                      >
                        {m.isActive ? "Switch off" : "Switch on"}
                      </Button>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="w-52" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-64" />
        </label>
        <Button type="submit" disabled={pending || active >= maxUsers}>
          Add teacher
        </Button>
      </form>
    </Panel>
  );
}

export function ActivityLog({
  entries,
}: {
  entries: { id: string; userName: string | null; action: string; entity: string; details: string | null; createdAt: string }[];
}) {
  return (
    <Panel title="Recent activity" description="Every save, import and change, newest first.">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {entries.map((a) => {
            let detail = "";
            try {
              const d = a.details ? (JSON.parse(a.details) as Record<string, unknown>) : null;
              if (d?.date) detail = ` · ${d.date}`;
            } catch {}
            return (
              <li key={a.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{a.userName ?? "Someone"}</span> {a.action.replace("_", " ")} {a.entity.replaceAll("_", " ")}
                  <span className="text-muted-foreground">{detail}</span>
                </span>
                <time className="text-muted-foreground shrink-0 text-xs">
                  {new Date(a.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
