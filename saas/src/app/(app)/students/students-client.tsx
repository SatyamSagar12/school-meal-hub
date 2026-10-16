"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteStudentAction, exportStudentsAction, importStudentsAction, saveStudentAction } from "@/server/actions/register";
import { downloadTemplate, exportExcel, readSheet } from "@/lib/export";
import { classLabel } from "@/lib/mdm";

type Student = {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  name: string;
  fatherName: string | null;
  motherName: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  dob: string | null;
  className: string;
  section: string;
  mobile: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE" | "TRANSFERRED";
};

type Filters = { q: string; className: string; section: string; status: string; page: number };

const EMPTY = {
  admissionNo: "",
  rollNo: "",
  name: "",
  fatherName: "",
  motherName: "",
  gender: "MALE",
  dob: "",
  className: "",
  section: "A",
  mobile: "",
  address: "",
  status: "ACTIVE",
};

const selectClass = "border-input bg-card h-9 rounded-lg border px-2 text-sm";

/** Excel cells arrive as strings, numbers or Dates; the server schema wants trimmed strings. */
function cell(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function fromSheet(r: Record<string, unknown>, index: number) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(r).find((h) => h.trim().toLowerCase().replace(/\s+/g, "_") === k);
      if (hit) return cell(r[hit]);
    }
    return "";
  };
  return {
    __row: index + 2,
    admissionNo: get("admission_no", "admission"),
    rollNo: get("roll_no", "roll"),
    name: get("name", "student_name"),
    fatherName: get("father_name"),
    motherName: get("mother_name"),
    gender: (get("gender") || "male").toUpperCase(),
    dob: get("dob", "date_of_birth"),
    className: get("class", "class_name"),
    section: get("section") || "A",
    mobile: get("mobile", "phone"),
    address: get("address"),
    status: (get("status") || "active").toUpperCase(),
  };
}

export function StudentsClient(props: {
  filters: Filters;
  rows: Student[];
  total: number;
  pageSize: number;
  classes: string[];
  sections: string[];
  isAdmin: boolean;
}) {
  const { filters, rows, total, pageSize } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function go(params: Partial<Record<keyof Filters | "class", string>>) {
    const sp = new URLSearchParams({
      q: filters.q,
      class: filters.className,
      section: filters.section,
      status: filters.status,
      page: "1",
      ...params,
    });
    for (const [k, v] of [...sp.entries()]) if (!v) sp.delete(k);
    router.push(`/students?${sp.toString()}`);
  }

  function openForm(s: Student | null) {
    setEditing(s);
    setForm(s ? Object.fromEntries(Object.entries({ ...EMPTY, ...s }).map(([k, v]) => [k, v === null ? "" : String(v)])) : EMPTY);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await saveStudentAction(editing?.id ?? null, form);
      if (result.ok) {
        toast.success(editing ? "Student updated" : "Student added");
        setOpen(false);
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  function remove(s: Student) {
    if (!confirm(`Delete ${s.name}? Their attendance history goes with them. To keep it, set the status to Transferred instead.`)) return;
    start(async () => {
      const result = await deleteStudentAction(s.id);
      if (result.ok) {
        toast.success("Student deleted");
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  function importFile(file: File) {
    start(async () => {
      try {
        const sheet = (await readSheet(file)).map(fromSheet).filter((r) => r.name || r.admissionNo);
        if (!sheet.length) return void toast.error("That sheet has no rows.");
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];
        // Small batches keep every request well inside a Worker's limits.
        for (let i = 0; i < sheet.length; i += 100) {
          const result = await importStudentsAction(sheet.slice(i, i + 100));
          if (!result.ok) return void toast.error(result.error.message);
          imported += result.data.imported;
          skipped += result.data.skipped;
          errors.push(...result.data.errors);
        }
        setImportErrors(errors);
        toast.success(`Imported ${imported} students${skipped ? `; ${skipped} already existed` : ""}${errors.length ? `; ${errors.length} rows had errors` : ""}`);
        router.refresh();
      } catch {
        toast.error("Could not read that file. Use the Excel template.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function exportAll() {
    start(async () => {
      const result = await exportStudentsAction(filters);
      if (!result.ok) return void toast.error(result.error.message);
      await exportExcel(result.data, "students", "Students");
    });
  }

  const input = (key: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <Input value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
    </label>
  );

  return (
    <>
      <PageHeader
        title="Students"
        description={`${total} ${filters.status === "ACTIVE" ? "active " : ""}student${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadTemplate()}>
              <FileSpreadsheet /> Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
              <Upload /> Import
            </Button>
            <Button variant="outline" onClick={exportAll} disabled={pending}>
              <Download /> Export
            </Button>
            <Button onClick={() => openForm(null)}>
              <Plus /> Add student
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </>
        }
      />

      {importErrors.length ? (
        <div className="bg-warning-muted text-warning mb-4 rounded-xl p-4 text-sm">
          <p className="font-medium">{importErrors.length} row(s) were skipped:</p>
          <ul className="mt-1 list-disc pl-5">
            {importErrors.slice(0, 10).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <button className="mt-2 underline" onClick={() => setImportErrors([])}>
            Dismiss
          </button>
        </div>
      ) : null}

      <form
        className="bg-card mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
        }}
      >
        <Input name="q" defaultValue={filters.q} placeholder="Search name, roll or admission no." className="w-64" />
        <select aria-label="Class" className={selectClass} value={filters.className} onChange={(e) => go({ class: e.target.value })}>
          <option value="">All classes</option>
          {props.classes.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
        <select aria-label="Section" className={selectClass} value={filters.section} onChange={(e) => go({ section: e.target.value })}>
          <option value="">All sections</option>
          {props.sections.map((s) => (
            <option key={s} value={s}>
              Section {s}
            </option>
          ))}
        </select>
        <select aria-label="Status" className={selectClass} value={filters.status} onChange={(e) => go({ status: e.target.value })}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="ALL">All</option>
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      <div className="bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adm. no</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="hidden md:table-cell">Roll</TableHead>
              <TableHead className="hidden md:table-cell">Father</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                  No students found. Add one, or import the Excel template.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.admissionNo}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{classLabel(s.className, s.section)}</TableCell>
                <TableCell className="hidden md:table-cell">{s.rollNo ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{s.fatherName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "ACTIVE" ? "secondary" : "outline"}>{s.status.toLowerCase()}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => openForm(s)}>
                    <Pencil />
                  </Button>
                  {props.isAdmin ? (
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => go({ page: String(filters.page - 1) })}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {filters.page} of {pages}
          </span>
          <Button size="sm" variant="outline" disabled={filters.page >= pages} onClick={() => go({ page: String(filters.page + 1) })}>
            Next
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {input("admissionNo", "Admission no *", { required: true })}
            {input("name", "Name *", { required: true })}
            {input("className", "Class *", { required: true, placeholder: "e.g. 5" })}
            {input("section", "Section *", { required: true })}
            {input("rollNo", "Roll no")}
            {input("dob", "Date of birth", { type: "date" })}
            {input("fatherName", "Father's name")}
            {input("motherName", "Mother's name")}
            {input("mobile", "Mobile", { inputMode: "tel" })}
            <label className="grid gap-1 text-sm font-medium">
              Gender
              <select className={selectClass} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Status
              <select className={selectClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </label>
            {input("address", "Address")}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
