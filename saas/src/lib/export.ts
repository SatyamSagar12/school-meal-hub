/**
 * Browser-side Excel and PDF. The libraries are loaded on click, not with
 * the page: most visits never export, and together they outweigh the app.
 */

export type Row = Record<string, string | number | null | undefined>;

export async function exportExcel(rows: Row[], fileName: string, sheetName = "Sheet1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export async function exportPdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
  summary?: string[];
  landscape?: boolean;
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: opts.landscape ? "landscape" : "portrait" });
  // The built-in PDF fonts have no rupee sign; "Rs" keeps the columns readable.
  const clean = (s: string) => s.replaceAll("₹", "Rs ");
  doc.setFontSize(15);
  doc.text(clean(opts.title), 14, 16);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(clean(opts.subtitle), 14, 22);
    doc.setTextColor(0);
  }
  let startY = opts.subtitle ? 28 : 24;
  if (opts.summary?.length) {
    doc.setFontSize(9);
    opts.summary.forEach((line, i) => doc.text(clean(line), 14, startY + i * 5));
    startY += opts.summary.length * 5 + 3;
  }
  autoTable(doc, {
    head: [opts.columns.map(clean)],
    body: opts.rows.map((r) => r.map((c) => (typeof c === "string" ? clean(c) : c))),
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [23, 53, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 244, 238] },
  });
  doc.save(`${opts.fileName}.pdf`);
}

export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
}

export const STUDENT_COLUMNS = [
  "admission_no",
  "roll_no",
  "name",
  "father_name",
  "mother_name",
  "gender",
  "dob",
  "class",
  "section",
  "mobile",
  "address",
  "status",
] as const;

export function downloadTemplate() {
  return exportExcel(
    [
      {
        admission_no: "A1001",
        roll_no: "1",
        name: "Anita Kumari",
        father_name: "Ram Kumar",
        mother_name: "Sita Devi",
        gender: "female",
        dob: "2016-05-12",
        class: "5",
        section: "A",
        mobile: "9876543210",
        address: "Ward 4",
        status: "active",
      },
    ],
    "student-import-template",
    "Students",
  );
}
