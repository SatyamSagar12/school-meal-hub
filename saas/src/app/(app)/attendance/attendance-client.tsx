"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveQuickCountsAction, saveStudentMarksAction } from "@/server/actions/register";
import type { ClassRosterRow } from "@/server/services/attendance";
import {
  classKey,
  classLabel,
  computeBudget,
  computeMealByTier,
  inr,
  kg,
  prettyDate,
  resolvePresentByClass,
  type ClassKey,
  type ClassRateOverride,
  type MealRates,
} from "@/lib/mdm";
import { cn } from "@/lib/utils";

type Student = { id: string; name: string; rollNo: string | null; admissionNo: string; className: string; section: string; present: boolean | null };

export function AttendanceClient(props: {
  date: string;
  today: string;
  mode: "quick" | "student";
  className: string;
  classes: string[];
  roster: ClassRosterRow[];
  students: Student[];
  rates: MealRates;
  overrides: ClassRateOverride[];
}) {
  const { date, mode, roster, students, rates, overrides } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");

  // Seed each class from its saved quick count, else its student-wise tally,
  // else blank — so an untouched class saves nothing by accident.
  const [counts, setCounts] = useState<Record<ClassKey, string>>(() =>
    Object.fromEntries(
      roster.map((c) => [c.key, c.quickCount !== null ? String(c.quickCount) : c.studentMarked > 0 ? String(c.studentPresent) : ""]),
    ),
  );
  const [marks, setMarks] = useState<Record<string, boolean>>(() => Object.fromEntries(students.map((s) => [s.id, s.present ?? true])));

  function go(params: Record<string, string>) {
    const sp = new URLSearchParams({ date, mode, ...(props.className ? { class: props.className } : {}), ...params });
    for (const [k, v] of [...sp.entries()]) if (!v) sp.delete(k);
    router.push(`/attendance?${sp.toString()}`);
  }

  const quickCounts = useMemo(() => {
    const map = new Map<ClassKey, number>();
    for (const [key, raw] of Object.entries(counts)) {
      if (raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) map.set(key, Math.floor(n));
    }
    return map;
  }, [counts]);

  // Saved student-wise tallies, overlaid with live marks for the classes on screen.
  const studentTally = useMemo(() => {
    const map = new Map<ClassKey, number>();
    for (const c of roster) if (c.studentMarked > 0) map.set(c.key, c.studentPresent);
    const live = new Map<ClassKey, number>();
    for (const s of students) {
      const key = classKey(s.className, s.section);
      live.set(key, (live.get(key) ?? 0) + (marks[s.id] ? 1 : 0));
    }
    for (const [key, n] of live) map.set(key, n);
    return map;
  }, [roster, students, marks]);

  // In quick mode the typed counts win; in student mode the saved quick counts do.
  const savedQuick = useMemo(() => new Map(roster.filter((c) => c.quickCount !== null).map((c) => [c.key, c.quickCount!])), [roster]);
  const presentByClass = useMemo(
    () => resolvePresentByClass(mode === "quick" ? quickCounts : savedQuick, studentTally),
    [mode, quickCounts, savedQuick, studentTally],
  );
  const budget = useMemo(() => computeBudget(presentByClass, rates, overrides), [presentByClass, rates, overrides]);
  const meal = useMemo(() => computeMealByTier(presentByClass, rates), [presentByClass, rates]);

  const enrolled = roster.reduce((a, c) => a + c.enrolled, 0);
  const absent = Math.max(0, enrolled - budget.totalPresent);
  const over = roster.filter((c) => (counts[c.key] ?? "").trim() !== "" && Number(counts[c.key]) > c.enrolled);
  const alreadySaved = mode === "quick" ? roster.some((c) => c.quickCount !== null) : students.length > 0 && students.every((s) => s.present !== null);

  const q = search.trim().toLowerCase();
  const visible = students.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q) || (s.rollNo ?? "").toLowerCase().includes(q),
  );

  function save() {
    start(async () => {
      const result =
        mode === "quick"
          ? await saveQuickCountsAction({
              date,
              counts: roster
                .filter((c) => (counts[c.key] ?? "").trim() !== "")
                .map((c) => ({ className: c.className, section: c.section, presentCount: Math.floor(Number(counts[c.key])) })),
            })
          : await saveStudentMarksAction({ date, entries: students.map((s) => ({ studentId: s.id, present: marks[s.id] ?? true })) });
      if (result.ok) {
        toast.success(`Attendance saved for ${prettyDate(date)}`);
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${prettyDate(date)} · ${enrolled} active students`}
        actions={
          <Button onClick={save} disabled={pending || (mode === "quick" && over.length > 0) || roster.length === 0}>
            <CheckCheck /> {pending ? "Saving…" : alreadySaved ? "Update attendance" : "Save attendance"}
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Present" value={budget.totalPresent} tone="success" />
        <StatCard label="Absent" value={absent} tone="danger" />
        <StatCard
          label="Rice required"
          value={kg(meal.total.riceKg)}
          tone="info"
          hint={meal.byTier.upper_primary.present > 0 ? `${meal.byTier.primary.riceKg} kg primary + ${meal.byTier.upper_primary.riceKg} kg upper` : `${meal.total.riceG} g`}
        />
        <StatCard label="Budget" value={inr(budget.totalBudget)} hint={`${kg(meal.total.dalKg)} dal + ${kg(meal.total.vegKg)} veg`} />
      </section>

      <div className="bg-card my-4 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="grid gap-1 text-xs font-medium">
          <span className="text-muted-foreground">Date</span>
          <Input type="date" value={date} max={props.today} onChange={(e) => e.target.value && go({ date: e.target.value })} className="w-44" />
        </label>
        <div className="bg-muted inline-flex rounded-lg p-0.5" role="tablist">
          {(["quick", "student"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => go({ mode: m })}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", mode === m ? "bg-card shadow-xs" : "text-muted-foreground")}
            >
              {m === "quick" ? "Quick count" : "Student-wise"}
            </button>
          ))}
        </div>
        {mode === "quick" ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setCounts(Object.fromEntries(roster.map((c) => [c.key, String(c.enrolled)])))}>
              Fill all with enrolled
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCounts(Object.fromEntries(roster.map((c) => [c.key, ""])))}>
              Clear all
            </Button>
          </>
        ) : (
          <>
            <label className="grid gap-1 text-xs font-medium">
              <span className="text-muted-foreground">Class</span>
              <select
                className="border-input bg-card h-9 rounded-lg border px-2 text-sm"
                value={props.className}
                onChange={(e) => go({ class: e.target.value })}
              >
                <option value="">All classes</option>
                {props.classes.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </label>
            <Input placeholder="Search name, roll or admission no." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
            <Button size="sm" variant="outline" onClick={() => setMarks((m) => ({ ...m, ...Object.fromEntries(visible.map((s) => [s.id, true])) }))}>
              All present
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMarks((m) => ({ ...m, ...Object.fromEntries(visible.map((s) => [s.id, false])) }))}>
              All absent
            </Button>
          </>
        )}
        {alreadySaved ? <Badge variant="secondary">Already saved for this date</Badge> : null}
      </div>

      {mode === "quick" ? (
        <>
          <div className="bg-card overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Rate</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Budget</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                      No active students yet — add students before marking attendance.
                    </TableCell>
                  </TableRow>
                ) : null}
                {roster.map((c) => {
                  const raw = counts[c.key] ?? "";
                  const bad = raw.trim() !== "" && Number(raw) > c.enrolled;
                  const line = budget.perClass.find((p) => p.key === c.key);
                  return (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">
                        {classLabel(c.className, c.section)}
                        {c.quickCount === null && c.studentMarked > 0 ? (
                          <Badge variant="outline" className="ml-2">
                            student-wise
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{c.enrolled}</TableCell>
                      <TableCell className="hidden text-right sm:table-cell">{inr(line?.rate ?? 0)}</TableCell>
                      <TableCell className="hidden text-right sm:table-cell">{inr(line?.budget ?? 0)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={c.enrolled}
                          placeholder="—"
                          aria-label={`Present in class ${classLabel(c.className, c.section)}`}
                          aria-invalid={bad}
                          className="ml-auto w-24 text-right"
                          value={raw}
                          onChange={(e) => setCounts((m) => ({ ...m, [c.key]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {over.length ? (
            <p className="text-destructive mt-2 text-sm">
              {over.map((c) => classLabel(c.className, c.section)).join(", ")} {over.length === 1 ? "has" : "have"} more present than enrolled. Correct it to save.
            </p>
          ) : null}
          <p className="text-muted-foreground mt-2 text-xs">
            Leave a class blank to keep its student-wise marks. A count saved here replaces the student-wise total for that class.
          </p>
        </>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Mark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    No active students match.
                  </TableCell>
                </TableRow>
              ) : null}
              {visible.map((s) => {
                const present = marks[s.id] ?? true;
                return (
                  <TableRow key={s.id} className={present ? undefined : "bg-destructive/5"}>
                    <TableCell>{s.rollNo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{classLabel(s.className, s.section)}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon-sm" variant={present ? "default" : "outline"} aria-label={`Mark ${s.name} present`} onClick={() => setMarks((m) => ({ ...m, [s.id]: true }))}>
                          <Check />
                        </Button>
                        <Button size="icon-sm" variant={present ? "outline" : "destructive"} aria-label={`Mark ${s.name} absent`} onClick={() => setMarks((m) => ({ ...m, [s.id]: false }))}>
                          <X />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
