import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveFile } from "./native";

export type Row = Record<string, string | number | null | undefined>;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function exportExcel(rows: Row[], fileName: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return saveFile(new Blob([bytes], { type: XLSX_MIME }), `${fileName}.xlsx`);
}

/** The PDF's built-in fonts have no ₹ glyph (it prints as "¹"), so spell it out. */
const pdfText = <T>(value: T): T =>
  (typeof value === "string" ? value.replace(/₹\s?/g, "Rs. ") : value) as T;

export function exportPdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
  summary?: string[];
  landscape?: boolean;
}) {
  const doc = new jsPDF({ orientation: opts.landscape ? "landscape" : "portrait" });
  doc.setFontSize(15);
  doc.text(pdfText(opts.title), 14, 16);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(pdfText(opts.subtitle), 14, 22);
    doc.setTextColor(0);
  }
  let startY = opts.subtitle ? 28 : 24;
  if (opts.summary?.length) {
    doc.setFontSize(9);
    opts.summary.forEach((line, i) => doc.text(pdfText(line), 14, startY + i * 5));
    startY += opts.summary.length * 5 + 3;
  }
  autoTable(doc, {
    head: [opts.columns.map(pdfText)],
    body: opts.rows.map((row) => row.map(pdfText)),
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
  });
  return saveFile(doc.output("blob"), `${opts.fileName}.pdf`);
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function readSheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

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
        dob: "2014-05-12",
        class_name: "5",
        section: "A",
        mobile: "9876543210",
        address: "Village Road, Ward 4",
        status: "active",
      },
    ],
    "student-import-template",
    "Students",
  );
}
