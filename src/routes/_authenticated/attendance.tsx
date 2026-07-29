import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, CheckCheck, Search, UserX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  attendanceRosterQuery,
  classListQuery,
  classRatesQuery,
  classRosterQuery,
  logAudit,
  saveAttendance,
  saveClassAttendance,
  settingsQuery,
} from "@/lib/api";
import {
  classKey,
  classLabel,
  computeBudget,
  computeMeal,
  inr,
  kg,
  prettyDate,
  resolvePresentByClass,
  todayISO,
  toRates,
  type ClassKey,
} from "@/lib/mdm";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Mark daily present and absent students by class and instantly see the rice, dal and vegetable quantities required.",
      },
      { property: "og:title", content: "Attendance — Mid-Day Meal Manager" },
      {
        property: "og:description",
        content: "Daily attendance marking with live meal quantity calculation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttendancePage,
});

type Marks = Record<string, "present" | "absent">;
type Mode = "quick" | "student";

function AttendancePage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("quick");
  const [date, setDate] = useState(todayISO());
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Marks>({});
  const [counts, setCounts] = useState<Record<ClassKey, string>>({});

  const { data: settings } = useQuery(settingsQuery());
  const { data: lists } = useQuery(classListQuery());
  const { data: rateOverrides } = useQuery(classRatesQuery());
  const { data: roster, isLoading } = useQuery(attendanceRosterQuery(date, classFilter, "all"));
  const { data: classRoster, isLoading: loadingClasses } = useQuery(classRosterQuery(date));

  useEffect(() => {
    if (!roster) return;
    const next: Marks = {};
    for (const s of roster.students) {
      next[s.id] = roster.existing.get(s.id) ?? "present";
    }
    setMarks(next);
  }, [roster]);

  // Seed each class input from its saved quick count, else its per-student
  // tally, else blank — so an untouched class saves nothing by accident.
  useEffect(() => {
    if (!classRoster) return;
    const next: Record<ClassKey, string> = {};
    for (const c of classRoster) {
      next[c.key] =
        c.quickCount !== null
          ? String(c.quickCount)
          : c.studentMarked > 0
            ? String(c.studentPresent)
            : "";
    }
    setCounts(next);
  }, [classRoster]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (roster?.students ?? []).filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        (s.roll_no ?? "").toLowerCase().includes(q),
    );
  }, [roster, search]);

  const rates = toRates(settings);

  // Quick-count entries the user has actually filled in.
  const quickCounts = useMemo(() => {
    const map = new Map<ClassKey, number>();
    for (const [key, raw] of Object.entries(counts)) {
      if (raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) map.set(key, Math.floor(n));
    }
    return map;
  }, [counts]);

  // Per-student tallies: saved counts for classes not on screen, overlaid with
  // live marks for the classes currently loaded in the roster.
  const studentTally = useMemo(() => {
    const map = new Map<ClassKey, number>();
    for (const c of classRoster ?? []) {
      if (c.studentMarked > 0) map.set(c.key, c.studentPresent);
    }
    const live = new Map<ClassKey, number>();
    for (const s of roster?.students ?? []) {
      const key = classKey(s.class_name, s.section);
      const isPresent = (marks[s.id] ?? "present") === "present";
      live.set(key, (live.get(key) ?? 0) + (isPresent ? 1 : 0));
    }
    for (const [key, count] of live) map.set(key, count);
    return map;
  }, [classRoster, roster, marks]);

  // Quick counts win per class — the single source of truth for the day's total.
  const presentByClass = useMemo(
    () => resolvePresentByClass(quickCounts, studentTally),
    [quickCounts, studentTally],
  );

  const budget = useMemo(
    () => computeBudget(presentByClass, rates, rateOverrides),
    [presentByClass, rates, rateOverrides],
  );

  const present = budget.totalPresent;
  const totalEnrolled = (classRoster ?? []).reduce((a, c) => a + c.enrolled, 0);
  const absent = Math.max(0, totalEnrolled - present);
  const meal = computeMeal(present, rates);
  const alreadySaved =
    mode === "quick"
      ? (classRoster ?? []).some((c) => c.quickCount !== null)
      : (roster?.alreadySaved ?? false);

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "quick") {
        const rows = (classRoster ?? [])
          .filter((c) => (counts[c.key] ?? "").trim() !== "")
          .map((c) => ({
            className: c.className,
            section: c.section,
            presentCount: Math.floor(Number(counts[c.key])),
            enrolledCount: c.enrolled,
          }));
        if (!rows.length) throw new Error("Enter a present count for at least one class");
        // saveClassAttendance re-checks this, but fail early with the same rule.
        const bad = rows.find((r) => r.presentCount > r.enrolledCount);
        if (bad) {
          throw new Error(
            `Class ${classLabel(bad.className, bad.section)}: present count cannot exceed ${bad.enrolledCount} enrolled`,
          );
        }
        await saveClassAttendance(date, rows);
        await logAudit("save", "class_attendance", undefined, {
          date,
          classes: rows.length,
          present,
        });
        return;
      }
      const rows = (roster?.students ?? []).map((s) => ({
        student: s,
        status: marks[s.id] ?? ("present" as const),
      }));
      if (!rows.length) throw new Error("There are no active students to mark");
      await saveAttendance(date, rows);
      await logAudit("save", "attendance", undefined, { date, present, absent });
    },
    onSuccess: () => {
      toast.success(`Attendance saved for ${prettyDate(date)}`);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dayStats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setAllVisible(status: "present" | "absent") {
    setMarks((m) => {
      const next = { ...m };
      for (const s of visible) next[s.id] = status;
      return next;
    });
  }

  function fillAllEnrolled() {
    setCounts(() => {
      const next: Record<ClassKey, string> = {};
      for (const c of classRoster ?? []) next[c.key] = String(c.enrolled);
      return next;
    });
  }

  function clearAllCounts() {
    setCounts(() => {
      const next: Record<ClassKey, string> = {};
      for (const c of classRoster ?? []) next[c.key] = "";
      return next;
    });
  }

  const overCapacity = (classRoster ?? []).filter((c) => {
    const raw = (counts[c.key] ?? "").trim();
    return raw !== "" && Number(raw) > c.enrolled;
  });

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${prettyDate(date)} · ${roster?.students.length ?? 0} active students`}
        actions={
          <Button
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              (mode === "quick" ? loadingClasses || overCapacity.length > 0 : isLoading)
            }
          >
            <CheckCheck className="mr-1.5 size-4" />
            {save.isPending ? "Saving…" : alreadySaved ? "Update attendance" : "Save attendance"}
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={present} icon={Check} tone="success" loading={isLoading} />
        <StatCard label="Absent" value={absent} icon={UserX} tone="danger" loading={isLoading} />
        <StatCard
          label="Rice required"
          value={kg(meal.riceKg)}
          icon={CalendarDays}
          tone="info"
          hint={`${meal.riceG} g`}
        />
        <StatCard
          label="Budget"
          value={inr(budget.totalBudget)}
          icon={CalendarDays}
          hint={`${kg(meal.dalKg)} dal + ${kg(meal.vegKg)} veg`}
        />
      </section>

      <Card className="my-4 gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="att-date"
            >
              Date
            </label>
            <Input
              id="att-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {mode === "student" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Class
                </label>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {lists?.classes.map((c) => (
                      <SelectItem key={c} value={c}>
                        Class {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name, roll or admission number"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "quick" ? (
            <>
              <Button size="sm" variant="outline" onClick={fillAllEnrolled}>
                Fill all with enrolled
              </Button>
              <Button size="sm" variant="outline" onClick={clearAllCounts}>
                Clear all
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setAllVisible("present")}>
                Mark all present
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAllVisible("absent")}>
                Mark all absent
              </Button>
            </>
          )}
          {alreadySaved && (
            <Badge variant="secondary" className="self-center">
              Already saved for this date
            </Badge>
          )}
        </div>
      </Card>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="mb-3">
          <TabsTrigger value="quick">Quick count</TabsTrigger>
          <TabsTrigger value="student">Student-wise</TabsTrigger>
        </TabsList>

        <TabsContent value="quick">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Rate</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Budget</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingClasses &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  {!loadingClasses && !(classRoster ?? []).length && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No active students yet — add students before marking attendance.
                      </TableCell>
                    </TableRow>
                  )}
                  {(classRoster ?? []).map((c) => {
                    const raw = counts[c.key] ?? "";
                    const over = raw.trim() !== "" && Number(raw) > c.enrolled;
                    const line = budget.perClass.find((p) => p.key === c.key);
                    return (
                      <TableRow key={c.key}>
                        <TableCell className="font-medium">
                          {classLabel(c.className, c.section)}
                          {c.quickCount === null && c.studentMarked > 0 && (
                            <Badge variant="outline" className="ml-2">
                              student-wise
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.enrolled}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">
                          {inr(line?.rate ?? 0)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">
                          {inr(line?.budget ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max={c.enrolled}
                            inputMode="numeric"
                            placeholder="—"
                            aria-label={`Present count for class ${classLabel(c.className, c.section)}`}
                            aria-invalid={over}
                            className={`ml-auto w-24 text-right tabular-nums ${
                              over ? "border-destructive" : ""
                            }`}
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
          </Card>
          {overCapacity.length > 0 && (
            <p className="mt-2 text-sm text-destructive">
              {overCapacity.map((c) => classLabel(c.className, c.section)).join(", ")}{" "}
              {overCapacity.length === 1 ? "has" : "have"} a present count above the enrolled
              number. Saving is blocked until this is corrected.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Leave a class blank to keep using its student-wise marks. A saved count here replaces
            the student-wise total for that class.
          </p>
        </TabsContent>

        <TabsContent value="student">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="hidden md:table-cell">Admission</TableHead>
                    <TableHead className="text-right">Mark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  {!isLoading && !visible.length && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No active students match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {visible.map((s) => {
                    const status = marks[s.id] ?? "present";
                    return (
                      <TableRow
                        key={s.id}
                        className={status === "absent" ? "bg-destructive/5" : undefined}
                      >
                        <TableCell>{s.roll_no ?? "—"}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          {s.class_name}-{s.section}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{s.admission_no}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant={status === "present" ? "default" : "outline"}
                              onClick={() => setMarks((m) => ({ ...m, [s.id]: "present" }))}
                              aria-label={`Mark ${s.name} present`}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={status === "absent" ? "destructive" : "outline"}
                              onClick={() => setMarks((m) => ({ ...m, [s.id]: "absent" }))}
                              aria-label={`Mark ${s.name} absent`}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
