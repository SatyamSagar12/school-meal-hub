import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  allStudentsQuery,
  bulkInsertStudents,
  classListQuery,
  createStudent,
  deleteStudent,
  logAudit,
  meQuery,
  studentsQuery,
  updateStudent,
} from "@/lib/api";
import { downloadTemplate, exportExcel, readSheet } from "@/lib/export";
import type { Student } from "@/lib/mdm";
import { studentSchema, type StudentFormValues, type StudentPayload } from "@/lib/schemas";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Add, edit, search, filter, import and export the complete student register for your school.",
      },
      { property: "og:title", content: "Students — Mid-Day Meal Manager" },
      { property: "og:description", content: "Complete student register with Excel import and export." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentsPage,
});

const PAGE_SIZE = 15;

const emptyStudent: StudentFormValues = {
  admission_no: "",
  roll_no: "",
  name: "",
  father_name: "",
  mother_name: "",
  gender: "male",
  dob: "",
  class_name: "",
  section: "A",
  mobile: "",
  address: "",
  status: "active",
};

function StudentsPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery());
  const { data: lists } = useQuery(classListQuery());

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [editing, setEditing] = useState<Student | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const filters = { search, classFilter, sectionFilter, statusFilter, page, pageSize: PAGE_SIZE, sortBy, sortAsc };
  const { data, isLoading } = useQuery(studentsQuery(filters));

  const form = useForm<StudentFormValues, unknown, StudentPayload>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyStudent,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const saveMutation = useMutation({
    mutationFn: async (values: StudentPayload) => {
      if (editing) {
        await updateStudent(editing.id, values);
        await logAudit("update", "students", editing.id, { name: values.name });
      } else {
        await createStudent(values);
        await logAudit("create", "students", undefined, { name: values.name });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Student updated" : "Student added");
      setDialogOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate") ? "That admission number already exists" : e.message,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: async (student: Student) => {
      await deleteStudent(student.id);
      await logAudit("delete", "students", student.id, { name: student.name });
    },
    onSuccess: () => {
      toast.success("Student deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const { rows } = await readSheet(file);
      if (!rows.length) throw new Error("The sheet is empty");
      const errors: string[] = [];
      const valid: StudentPayload[] = [];
      rows.forEach((raw, i) => {
        const record = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [
            k.trim().toLowerCase().replace(/\s+/g, "_"),
            v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim(),
          ]),
        );
        const parsed = studentSchema.safeParse({
          ...emptyStudent,
          ...record,
          gender: ["male", "female", "other"].includes(String(record.gender).toLowerCase())
            ? String(record.gender).toLowerCase()
            : "male",
          status: ["active", "inactive", "transferred"].includes(String(record.status).toLowerCase())
            ? String(record.status).toLowerCase()
            : "active",
        });
        if (parsed.success) valid.push(parsed.data);
        else
          errors.push(
            `Row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")} — ${x.message}`).join("; ")}`,
          );
      });
      setImportErrors(errors);
      if (!valid.length) throw new Error("No valid rows found. Check the errors listed below.");
      await bulkInsertStudents(valid);
      await logAudit("import", "students", undefined, { count: valid.length });
      return { imported: valid.length, skipped: errors.length };
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.imported} students${r.skipped ? `, ${r.skipped} skipped` : ""}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleExport() {
    const all = await qc.fetchQuery(allStudentsQuery());
    exportExcel(
      all.map((s) => ({
        admission_no: s.admission_no,
        roll_no: s.roll_no,
        name: s.name,
        father_name: s.father_name,
        mother_name: s.mother_name,
        gender: s.gender,
        dob: s.dob,
        class_name: s.class_name,
        section: s.section,
        mobile: s.mobile,
        address: s.address,
        status: s.status,
      })),
      `students-${new Date().toISOString().slice(0, 10)}`,
      "Students",
    );
    toast.success("Excel file downloaded");
  }

  function openAdd() {
    setEditing(null);
    form.reset(emptyStudent);
    setDialogOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    form.reset({
      admission_no: s.admission_no,
      roll_no: s.roll_no ?? "",
      name: s.name,
      father_name: s.father_name ?? "",
      mother_name: s.mother_name ?? "",
      gender: s.gender,
      dob: s.dob ?? "",
      class_name: s.class_name,
      section: s.section,
      mobile: s.mobile ?? "",
      address: s.address ?? "",
      status: s.status,
    });
    setDialogOpen(true);
  }

  function toggleSort(column: string) {
    if (sortBy === column) setSortAsc((a) => !a);
    else {
      setSortBy(column);
      setSortAsc(true);
    }
  }

  const SortHead = ({ column, label }: { column: string; label: string }) => (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(column)}>
        {label}
        {sortBy === column &&
          (sortAsc ? <ArrowUpAZ className="size-3.5" /> : <ArrowDownAZ className="size-3.5" />)}
      </button>
    </TableHead>
  );

  return (
    <>
      <PageHeader
        title="Students"
        description={`${data?.total ?? 0} record${data?.total === 1 ? "" : "s"} matching your filters`}
        actions={
          <>
            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-1.5 size-4" /> Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMutation.isPending}>
              <Upload className="mr-1.5 size-4" /> {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importMutation.mutate(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-1.5 size-4" /> Export
            </Button>
            <Button onClick={openAdd}>
              <Plus className="mr-1.5 size-4" /> Add student
            </Button>
          </>
        }
      />

      {importErrors.length > 0 && (
        <Card className="mb-4 gap-1 border-destructive/40 p-4">
          <p className="text-sm font-semibold text-destructive">
            {importErrors.length} row(s) were skipped during import
          </p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-xs text-muted-foreground">
            {importErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2 self-start" onClick={() => setImportErrors([])}>
            Dismiss
          </Button>
        </Card>
      )}

      <Card className="mb-4 gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, admission or roll no."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {lists?.classes.map((c) => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sectionFilter} onValueChange={(v) => { setSectionFilter(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {lists?.sections.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead column="admission_no" label="Admission" />
                <SortHead column="roll_no" label="Roll" />
                <SortHead column="name" label="Name" />
                <TableHead className="hidden md:table-cell">Father</TableHead>
                <SortHead column="class_name" label="Class" />
                <TableHead className="hidden lg:table-cell">Mobile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))}
              {!isLoading && !data?.rows.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No students found. Add one or import an Excel sheet to get started.
                  </TableCell>
                </TableRow>
              )}
              {data?.rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.admission_no}</TableCell>
                  <TableCell>{s.roll_no ?? "—"}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.father_name ?? "—"}</TableCell>
                  <TableCell>{s.class_name}-{s.section}</TableCell>
                  <TableCell className="hidden lg:table-cell">{s.mobile ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(s)}>
                      <Pencil className="size-4" />
                    </Button>
                    {me?.isAdmin && (
                      <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {data?.total ?? 0} students
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>
              Records are stored securely in the school database and used for attendance and meal counts.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <FormField control={form.control} name="admission_no" render={({ field }) => (
                <FormItem><FormLabel>Admission number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="roll_no" render={({ field }) => (
                <FormItem><FormLabel>Roll number</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Student name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="father_name" render={({ field }) => (
                <FormItem><FormLabel>Father's name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mother_name" render={({ field }) => (
                <FormItem><FormLabel>Mother's name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dob" render={({ field }) => (
                <FormItem><FormLabel>Date of birth</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="class_name" render={({ field }) => (
                <FormItem><FormLabel>Class</FormLabel><FormControl><Input placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem><FormLabel>Section</FormLabel><FormControl><Input placeholder="A" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input inputMode="tel" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="transferred">Transferred</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Address</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add student"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the student and all their attendance records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
