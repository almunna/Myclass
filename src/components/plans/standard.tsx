"use client";

import * as React from "react";
import { db } from "@/firebase/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** What we store for each saved standard */
type SavedStandard = {
  id: string;
  teacherId: string;
  grade: string; // e.g. "6th"
  code: string; // e.g. "ELA.1.3.a"
  description: string; // e.g. "Identify security safeguards..."
  createdAt?: any;
};

type Props = {
  /** current user’s teacherId (from the plan) */
  teacherId: string;
  /** whatever text you already store in the plan.standards field */
  value: string;
  /** update plan.standards in the parent */
  onChange: (next: string) => void;
  className?: string;
};

type Mode = "idle" | "search" | "add" | "import";

const GRADES = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
];

export default function StandardsControls({
  teacherId,
  value,
  onChange,
  className,
}: Props) {
  const [mode, setMode] = React.useState<Mode>("idle");

  // ---------- helpers for selected text ----------
  const selected = React.useMemo(() => splitStandards(value), [value]);

  function addToSelected(items: SavedStandard[] | SavedStandard) {
    const arr = Array.isArray(items) ? items : [items];
    const strings = new Set(selected);
    for (const s of arr) {
      strings.add(renderStd(s));
    }
    onChange(Array.from(strings).join("; "));
  }

  function removeFromSelected(text: string) {
    onChange(selected.filter((s) => s !== text).join("; "));
  }

  // ---------- SEARCH ----------
  const [allMine, setAllMine] = React.useState<SavedStandard[] | null>(null);
  const [term, setTerm] = React.useState("");

  React.useEffect(() => {
    if (!teacherId) return;
    (async () => {
      const q = query(
        collection(db, "standards"),
        where("teacherId", "==", teacherId)
      );
      const snap = await getDocs(q);
      const rows: SavedStandard[] = [];
      snap.forEach((d) =>
        rows.push({ id: d.id, ...(d.data() as Omit<SavedStandard, "id">) })
      );
      setAllMine(rows);
    })();
  }, [teacherId]);

  const matches = React.useMemo(() => {
    if (!allMine) return [];
    if (!term.trim()) return [];
    const t = term.toLowerCase();
    return allMine.filter(
      (r) =>
        r.code.toLowerCase().includes(t) ||
        r.description.toLowerCase().includes(t) ||
        r.grade.toLowerCase().includes(t)
    );
  }, [allMine, term]);

  // ---------- ADD NEW ----------
  const [grade, setGrade] = React.useState("6th");
  const [code, setCode] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [savingAdd, setSavingAdd] = React.useState(false);

  async function handleSaveNew() {
    if (!teacherId || !code.trim() || !desc.trim()) return;
    setSavingAdd(true);
    try {
      const ref = doc(collection(db, "standards"));
      const payload: Omit<SavedStandard, "id"> = {
        teacherId,
        grade,
        code: code.trim(),
        description: desc.trim(),
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      const created: SavedStandard = { id: ref.id, ...payload };
      // add to local results & selection
      setAllMine((prev) => (prev ? [created, ...prev] : [created]));
      addToSelected(created);
      // reset UI
      setCode("");
      setDesc("");
      setMode("idle");
    } finally {
      setSavingAdd(false);
    }
  }

  // ---------- IMPORT (.xlsx only) ----------
  // Excel columns: Grade, Standard #, Description
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function downloadTemplateXlsx() {
    // dynamic import to keep bundle slim
    const XLSX: any = await import("xlsx");

    // 1) Template sheet with headers + 12 pre-seeded rows
    const headers = ["Grade", "Standard #", "Description"];
    const rows = Array.from({ length: 12 }, () => ["", "", ""]);
    const aoa = [headers, ...rows];
    const wsTemplate = XLSX.utils.aoa_to_sheet(aoa);

    // 2) Grades sheet (source for the dropdown list)
    // Uses your GRADES constant (1st → 12th)
    const gradesAoa = GRADES.map((g) => [g]);
    const wsGrades = XLSX.utils.aoa_to_sheet(gradesAoa);

    // Hide the helper sheet from users
    (wsGrades as any)["!state"] = "hidden";

    // 3) Data validation: dropdown for Template!A2:A13 that points to Grades!A1:A12
    // This creates a single-select list in the Grade column (rows 2–13).
    (wsTemplate as any)["!dataValidation"] = [
      {
        type: "list",
        allowBlank: 1,
        sqref: "A2:A13",
        formulas: ["=Grades!$A$1:$A$12"],
      },
    ];

    // Optional column widths for nicer layout
    (wsTemplate as any)["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 70 }];

    // 4) Build and save workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");
    XLSX.utils.book_append_sheet(wb, wsGrades, "Grades");
    XLSX.writeFile(wb, "standards_template.xlsx");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    try {
      const ext = f.name.toLowerCase().split(".").pop() || "";
      if (ext !== "xlsx") {
        // Not an Excel file; ignore and reset the input.
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const rows = await parseXlsx(await f.arrayBuffer());

      const created: SavedStandard[] = [];
      for (const r of rows) {
        const [g, c, d] = r;
        if (!g || !c || !d) continue;
        const ref = doc(collection(db, "standards"));
        const payload: Omit<SavedStandard, "id"> = {
          teacherId,
          grade: g.trim(),
          code: c.trim(),
          description: d.trim(),
          createdAt: serverTimestamp(),
        };
        await setDoc(ref, payload);
        created.push({ id: ref.id, ...payload });
      }
      if (created.length) {
        setAllMine((prev) => (prev ? [...created, ...prev] : created));
      }
      // don’t auto-select on bulk import; user can search/select afterward
      setMode("idle");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ---------- RENDER ----------
  return (
    <div
      className={cn(
        "mt-1 text-[14px] rounded-xl border bg-card/40 backdrop-blur-sm shadow-sm",
        "p-3 sm:p-4",
        className
      )}
    >
      {/* tiny action bar */}
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3",
          "rounded-lg border bg-background p-1"
        )}
      >
        <button
          type="button"
          className={linkCls(mode === "search")}
          onClick={() => setMode((m) => (m === "search" ? "idle" : "search"))}
        >
          Search
        </button>
        <button
          type="button"
          className={linkCls(mode === "add")}
          onClick={() => setMode((m) => (m === "add" ? "idle" : "add"))}
        >
          Add new
        </button>
        <button
          type="button"
          className={linkCls(mode === "import")}
          onClick={() => setMode((m) => (m === "import" ? "idle" : "import"))}
        >
          Import
        </button>
      </div>

      {/* subtle helper */}
      <p className="mt-2 text-xs text-muted-foreground">
        Select from your saved standards, add a new one, or import in bulk from
        Excel.
      </p>

      {/* SEARCH UI */}
      {mode === "search" && (
        <div className="mt-3 space-y-2 rounded-lg border bg-background p-3">
          <Label className="text-xs">Search</Label>
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Type a code, description, or grade (e.g. 'ELA.1.3.a' or 'cite')"
          />
          <div className="max-h-48 overflow-auto rounded-md border">
            {term && matches.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                No matches.
                <button
                  className="ml-1 underline underline-offset-2"
                  onClick={() => setMode("add")}
                >
                  Add new
                </button>
              </div>
            )}
            {matches.map((m) => {
              const text = renderStd(m);
              const already = selected.includes(text);
              return (
                <label
                  key={m.id}
                  className={cn(
                    "flex items-start gap-3 p-3 border-b last:border-b-0 cursor-pointer",
                    "hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={already}
                    onChange={(e) =>
                      e.target.checked
                        ? addToSelected(m)
                        : removeFromSelected(text)
                    }
                    className="mt-0.5"
                  />
                  <div className="leading-tight">
                    <div className="text-sm">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {m.grade}
                      </span>{" "}
                      <span className="font-medium">{m.code}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {mode === "add" && (
        <div className="mt-3 rounded-lg border bg-background p-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-3">
              <Label className="block w-full mb-1 text-[14px] leading-none tracking-wide text-muted-foreground">
                Grade
              </Label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-2 text-sm"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <Label className="block w-full mb-1 text-[14px] leading-none tracking-wide text-muted-foreground whitespace-nowrap">
                Standard Number
              </Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ELA.1.3.a"
                className="h-10"
              />
            </div>

            {/* 🔧 Make Description span remaining columns (6 → fills full width) */}
            <div className="sm:col-span-5">
              <Label className="block w-full mb-1 text-[14px] leading-none tracking-wide text-muted-foreground">
                Description
              </Label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Identify security safeguards."
                className="h-10"
              />
            </div>

            <div className="sm:col-span-12">
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNew}
                  disabled={savingAdd || !code || !desc}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Import + Template (Excel only) */}
            <div className="sm:col-span-12 mt-1">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex flex-col sm:flex-row items-start gap-3">
                  <div className="w-full sm:w-auto flex-1">
                    <Label className="block w-full mb-1 text-[14px] leading-none tracking-wide text-muted-foreground">
                      Upload File
                    </Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                      onChange={handleImportFile}
                      disabled={importing}
                      className="h-10"
                    />
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Button
                      type="button"
                      onClick={downloadTemplateXlsx}
                      className="bg-blue-500 text-white hover:bg-blue-700"
                    >
                      Download Template
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Template includes a Grade dropdown (1st–12th) and 12 rows
                  ready to fill.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT UI (Excel only) */}
      {mode === "import" && (
        <div className="mt-3 rounded-lg border bg-background p-3">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <div className="w-full sm:w-auto">
              <Label className="text-xs block mb-1">Upload File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                onChange={handleImportFile}
                disabled={importing}
              />
            </div>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                onClick={downloadTemplateXlsx}
                className="bg-blue-500 text-white hover:bg-blue-700"
              >
                Download Template
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Excel columns: <span className="font-medium">Grade</span>,{" "}
            <span className="font-medium">Standard #</span>,{" "}
            <span className="font-medium">Description</span>.
          </p>
        </div>
      )}

      {/* SMALL: currently selected list preview (click to remove) */}
      {selected.length > 0 && (
        <div className="mt-3">
          <Label className="text-xs mb-1 block">Selected</Label>
          <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-2.5">
            {selected.map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  "text-xs rounded-full border px-2.5 py-1",
                  "bg-muted/50 hover:bg-muted/70 transition"
                )}
                title="Remove"
                onClick={() => removeFromSelected(s)}
              >
                {s} <span className="opacity-70">×</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- utils ---------- */

function renderStd(s: Pick<SavedStandard, "grade" | "code" | "description">) {
  // how it shows in the plan.standards string
  return `${s.grade} ${s.code} ${s.description}`;
}

function splitStandards(v: string) {
  if (!v?.trim()) return [];
  return v
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Parse first worksheet of an .xlsx ArrayBuffer into rows [grade, code, desc] */
async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const XLSX: any = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];

  // Read as an array of objects using the header row
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    defval: "",
  });

  // Normalize header keys (lowercase, trim)
  const norm = (s: string) =>
    String(s || "")
      .toLowerCase()
      .trim();

  // Try to find the relevant columns by header
  const getVal = (row: Record<string, any>, keys: string[]) => {
    const entries = Object.entries(row);
    for (const [k, v] of entries) {
      const nk = norm(k);
      if (keys.some((t) => nk.includes(t))) return String(v ?? "").trim();
    }
    return "";
  };

  const out: string[][] = [];
  for (const r of rows) {
    const g = getVal(r, ["grade"]);
    const c = getVal(r, ["standard #", "standard#", "standard"]);
    const d = getVal(r, ["description", "desc"]);
    out.push([g, c, d]);
  }

  // If file had only header and no data, return []
  return out.filter(([g, c, d]) => (g || c || d) && g && c && d);
}

function linkCls(active: boolean) {
  return cn(
    // “segmented” tab-like button look
    "text-sm px-3 py-1.5 rounded-md border transition",
    "bg-transparent hover:bg-muted/50",
    active
      ? "bg-muted/70 border-border font-semibold"
      : "border-transparent text-blue-600"
  );
}
