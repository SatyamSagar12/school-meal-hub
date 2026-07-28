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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { attendanceRosterQuery, classListQuery, logAudit, saveAttendance, settingsQuery } from "@/lib/api";
import { computeMeal, kg, prettyDate, todayISO, toRates } from "@/lib/mdm";

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
      { property: "og:description", content: "Daily attendance marking with live meal quantity calculation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttendancePage,
});

type Marks = Record<string, "present" | "absent">;

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Marks>({});

  const { data: settings } = useQuery(settingsQuery());
  const { data: lists } = useQuery(classListQuery());
  const { data: roster, isLoading } = useQuery(attendanceRosterQuery(date, classFilter, "all"));

  useEffect(() => {
    if (!roster) return;
    const next: Marks = {};
    for (const s of roster.students) {
      next[s.id] = roster.existing.get(s.id) ?? "present";
    }
    setMarks(next);
  }, [roster]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (roster?.students ?? []).filter(
      (s) =>
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.admission_no.toLowerCase().includes(q) ||
          (s.roll_no ?? "").toLowerCase().includes(q)),
    );
  }, [roster, search]);

  const present = Object.values(marks).filter((m) => m === "present").length;
  const absent = Object.values(marks).filter((m) => m === "absent").length;
  const meal = computeMeal(present, toRates(settings));
  const alreadySaved = roster?.alreadySaved ?? false;

  const save = useMutation({
    mutationFn: async () => {
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

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${prettyDate(date)} · ${roster?.students.length ?? 0} active students`}
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            <CheckCheck className="mr-1.5 size-4" />
            {save.isPending ? "Saving…" : alreadySaved ? "Update attendance" : "Save attendance"}
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={present} icon={Check} tone="success" loading={isLoading} />
        <StatCard label="Absent" value={absent} icon={UserX} tone="danger" loading={isLoading} />
        <StatCard label="Rice required" value={kg(meal.riceKg)} icon={CalendarDays} tone="info" hint={`${meal.riceG} g`} />
        <StatCard label="Dal + vegetables" value={`${kg(meal.dalKg)} + ${kg(meal.vegKg)}`} icon={CalendarDays} />
      </section>

      <Card className="my-4 gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="att-date">Date</label>
            <Input id="att-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {lists?.classes.map((c) => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name, roll or admission number" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAllVisible("present")}>Mark all present</Button>
          <Button size="sm" variant="outline" onClick={() => setAllVisible("absent")}>Mark all absent</Button>
          {alreadySaved && <Badge variant="secondary" className="self-center">Already saved for this date</Badge>}
        </div>
      </Card>

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
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))}
              {!isLoading && !visible.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No active students match these filters.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((s) => {
                const status = marks[s.id] ?? "present";
                return (
                  <TableRow key={s.id} className={status === "absent" ? "bg-destructive/5" : undefined}>
                    <TableCell>{s.roll_no ?? "—"}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.class_name}-{s.section}</TableCell>
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
    </>
  );
}
