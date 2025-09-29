"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --------- unchanged lists ----------
const DEFAULT_BEHAVIORS = [
  "Caring",
  "Disrespectful",
  "Disrupting others",
  "Excessive talking",
  "Helpful",
  "Not staying on task",
  "Showed kindness",
  "Showed leadership",
  "Other",
];

const DEFAULT_ACTIONS = [
  "Emailed dean/admin",
  "Emailed parent(s)",
  "Requested parent meeting",
  "Gave warning",
  "Other",
];

type BehaviorRow = {
  id: string;
  date?: string; // "yyyy-mm-dd"
  time?: string; // "HH:mm"
  isPositive?: boolean;
  behaviors?: string[];
  notes?: string;
  actions?: string[];
  createdAt?: any; // Firestore Timestamp
};

function toSortableDate(r: BehaviorRow): Date {
  // 🔧 Parse as LOCAL TIME to avoid UTC/local mismatches during filtering
  if (r?.date) {
    const [y, m, d] = r.date.split("-").map(Number);
    const [hh, mi] = (r.time ?? "00:00").split(":").map(Number);
    const local = new Date(y, (m || 1) - 1, d || 1, hh || 0, mi || 0, 0, 0);
    if (!isNaN(local.getTime())) return local;
  }
  const ts = r?.createdAt as any;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return new Date(0);
}

function displayDate(r: BehaviorRow): { dateText: string; timeText?: string } {
  if (r.date) return { dateText: r.date, timeText: r.time };
  const ts = r.createdAt as any;
  if (ts && typeof ts.toDate === "function") {
    const d: Date = ts.toDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return { dateText: `${yyyy}-${mm}-${dd}`, timeText: `${hh}:${mi}` };
  }
  return { dateText: "-" };
}

// ---------- Suspense wrapper page (NEW) ----------
export default function BehaviorHistoryPage() {
  return (
    <Suspense
      fallback={<main className="container mx-auto px-4 py-8">Loading…</main>}
    >
      <BehaviorHistoryBody />
    </Suspense>
  );
}

// ---------- Your original logic moved into a child that runs under Suspense ----------
function BehaviorHistoryBody() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId") ?? "";
  const studentName = searchParams.get("studentName") ?? "Student";

  const [rows, setRows] = useState<BehaviorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | "positive" | "negative">(
    "all"
  );
  const [behaviorFilter, setBehaviorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  // Fetch Firestore data
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      const qRef = query(
        collection(db, "behaviors"),
        where("studentId", "==", studentId)
      );
      const snap = await getDocs(qRef);
      const list: BehaviorRow[] = snap.docs.map((d) => {
        const data = d.data() as Omit<BehaviorRow, "id">;
        return { id: d.id, ...data };
      });
      list.sort(
        (a, b) => toSortableDate(b).getTime() - toSortableDate(a).getTime()
      );
      setRows(list);
      setLoading(false);
    })();
  }, [studentId]);

  // Totals
  const positives = useMemo(
    () => rows.filter((r) => r.isPositive).length,
    [rows]
  );
  const negatives = useMemo(
    () => rows.filter((r) => !r.isPositive).length,
    [rows]
  );

  // Apply filters
  const filteredRows = useMemo(() => {
    let list = rows.slice();

    // replace the start/end date parsing in filteredRows with this:
    if (startDate) {
      const [y, m, d] = startDate.split("-").map(Number);
      const s = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0); // local midnight
      list = list.filter((r) => toSortableDate(r) >= s);
    }
    if (endDate) {
      const [y, m, d] = endDate.split("-").map(Number);
      const e = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999); // local end of day
      list = list.filter((r) => toSortableDate(r) <= e);
    }

    if (typeFilter !== "all") {
      list = list.filter((r) =>
        typeFilter === "positive" ? r.isPositive : !r.isPositive
      );
    }
    if (behaviorFilter !== "all") {
      list = list.filter(
        (r) =>
          Array.isArray(r.behaviors) && r.behaviors.includes(behaviorFilter)
      );
    }
    if (actionFilter !== "all") {
      list = list.filter(
        (r) => Array.isArray(r.actions) && r.actions.includes(actionFilter)
      );
    }

    list.sort(
      (a, b) => toSortableDate(b).getTime() - toSortableDate(a).getTime()
    );
    return list;
  }, [rows, startDate, endDate, typeFilter, behaviorFilter, actionFilter]);

  // Print (opens browser print dialog)
  const handlePrint = () => {
    window.print();
  };

  // Download PDF (no print dialog) — unchanged
  const handleDownloadPDF = async () => {
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import("jspdf"),
      import("html2canvas").then((m) => m.default),
    ]);

    const node =
      (document.querySelector("main") as HTMLElement) ?? document.body;

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      onclone: (doc) => {
        const win = doc.defaultView!;
        doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const cs = win.getComputedStyle(el);

          const maybeFix = (prop: string, fallback: string) => {
            const val = cs.getPropertyValue(prop);
            if (val && val.includes("oklch")) {
              el.style.setProperty(prop, fallback, "important");
            }
          };

          maybeFix("color", "#111111");
          maybeFix("background-color", "#ffffff");
          maybeFix("border-color", "#e5e7eb");
          maybeFix("border-top-color", "#e5e7eb");
          maybeFix("border-right-color", "#e5e7eb");
          maybeFix("border-bottom-color", "#e5e7eb");
          maybeFix("border-left-color", "#e5e7eb");
          maybeFix("outline-color", "#e5e7eb");

          el.style.setProperty("box-shadow", "none", "important");
          el.style.setProperty("text-shadow", "none", "important");
        });
      },
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    let remainingHeight = imgHeight - pageHeight;

    while (remainingHeight > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
    }

    const safeName = (studentName ?? "Student").replace(/[^\w\-]+/g, "_");
    pdf.save(`behavior-history_${safeName}.pdf`);
  };

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Behavior History — {studentName}</h1>
        <div className="flex gap-2">
          <span className="inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold bg-green-100 text-green-700">
            Positive: {positives}
          </span>
          <span className="inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold bg-red-100 text-red-700">
            Negative: {negatives}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
        <div>
          <div className="text-sm font-medium mb-1">Start date</div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full h-9 border rounded-md px-2"
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-1">End date</div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full h-9 border rounded-md px-2"
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Filter by type</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={typeFilter === "all" ? "default" : "outline"}
              onClick={() => setTypeFilter("all")}
              className="h-8"
            >
              All
            </Button>
            <Button
              type="button"
              variant={typeFilter === "positive" ? "default" : "outline"}
              onClick={() => setTypeFilter("positive")}
              className="h-8 bg-green-500 text-white hover:bg-green-500/90"
            >
              Positive
            </Button>
            <Button
              type="button"
              variant={typeFilter === "negative" ? "default" : "outline"}
              onClick={() => setTypeFilter("negative")}
              className="h-8 bg-red-500 text-white hover:bg-red-500/90"
            >
              Negative
            </Button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Filter by behavior</div>
          <select
            className="w-full h-9 border rounded-md px-2"
            value={behaviorFilter}
            onChange={(e) => setBehaviorFilter(e.target.value)}
          >
            <option value="all">All behaviors</option>
            {DEFAULT_BEHAVIORS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Filter by action</div>
          <select
            className="w-full h-9 border rounded-md px-2"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All actions</option>
            {DEFAULT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12%]">Date</TableHead>
              <TableHead className="w-[10%]">Type</TableHead>
              <TableHead className="w-[22%]">Behavior</TableHead>
              <TableHead className="w-[36%]">Notes</TableHead>
              <TableHead className="w-[20%]">Action taken</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-6"
                >
                  No behavior records match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => {
                const { dateText, timeText } = displayDate(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="leading-tight">
                        <div>{dateText}</div>
                        {timeText && (
                          <div className="text-xs text-muted-foreground">
                            {timeText}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                          r.isPositive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.isPositive ? "Positive" : "Negative"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-pre-line">
                      {Array.isArray(r.behaviors) && r.behaviors.length
                        ? r.behaviors.join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-pre-line">
                      {r.notes || "-"}
                    </TableCell>
                    <TableCell className="whitespace-pre-line">
                      {Array.isArray(r.actions) && r.actions.length
                        ? r.actions.join("\n")
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer actions: Print + Download PDF */}
      <div className="flex justify-end mt-4 gap-2">
        <Button variant="outline" onClick={handlePrint}>
          Print
        </Button>
        <Button variant="outline" onClick={handleDownloadPDF}>
          Download PDF
        </Button>
      </div>
    </main>
  );
}
