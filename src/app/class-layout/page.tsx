"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  RoomLayout,
  RoomLayoutData,
  SeatCell,
} from "@/components/classlayout/RoomLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shuffle, Undo2, Save, Trash2, X, PaintBucket } from "lucide-react";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
/* 🔥 Firestore */
import { db } from "@/firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* ---------------------------------- LS ---------------------------------- */
/* Kept the constants & function names the same, but re-implemented them to use Firestore under the hood. */

const LS_LAYOUTS_KEY = "mcl_class_layouts";
const LS_ASSIGN_PREFIX = "mcl_assign_"; // kept for key shape; not used for localStorage anymore

const layoutIdFromName = (name?: string) =>
  (name || "New Layout").trim().toLowerCase().replace(/\s+/g, "-");

/* === Firestore sanitize helpers (tiny, safe, and only used on writes) === */
const omitUndefined = <T extends Record<string, any>>(obj: T): T => {
  const out: any = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

const sanitizeCell = (c: SeatCell): SeatCell => {
  const base: any = {
    id: c.id,
    row: c.row,
    col: c.col,
    type: c.type,
  };
  if (c.color !== undefined) base.color = c.color;
  if (c.studentId !== undefined) base.studentId = c.studentId;
  return base as SeatCell;
};

async function loadLayouts(uid?: string): Promise<RoomLayoutData[]> {
  if (!uid) return [];
  const colRef = collection(db, "users", uid, "roomLayouts");
  const snap = await getDocs(query(colRef, orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => {
    const data = d.data() as RoomLayoutData;
    // Ensure name exists (fallback to id)
    return { ...data, name: data.name ?? d.id };
  });
}

// Kept name/signature; now no-op for Firestore listing, we rely on loadLayouts()
function saveLayouts(_list: RoomLayoutData[]) {
  /* no-op: Firestore is source of truth */
}

async function loadAssignments(layoutName?: string, uid?: string) {
  if (!uid || !layoutName) return {};
  try {
    const id = layoutIdFromName(layoutName);
    const ref = doc(db, "users", uid, "roomLayouts", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {};
    const data = snap.data() as RoomLayoutData;
    const map: Record<string, string> = {};
    (data.cells || []).forEach((c: any) => {
      if (
        c?.type === "seat" &&
        typeof c?.studentId === "string" &&
        c.studentId
      ) {
        map[c.id] = c.studentId;
      }
    });
    return map;
  } catch {
    return {};
  }
}

async function saveAssignments(
  layoutName?: string,
  a?: Record<string, string>,
  uid?: string
) {
  if (!uid || !layoutName) return;
  try {
    // Merge assignments into cells and persist
    const id = layoutIdFromName(layoutName);
    const ref = doc(db, "users", uid, "roomLayouts", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as RoomLayoutData;

    // sanitize each cell (no undefined color/studentId)
    const nextCells = (data.cells || []).map((c: any) => {
      const base: SeatCell =
        c.type === "seat" ? { ...c, studentId: a?.[c.id] } : { ...c };
      return sanitizeCell(base);
    });

    await setDoc(
      ref,
      {
        ...omitUndefined(data),
        cells: nextCells,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    /* swallow */
  }
}

/* ------------------------------- Defaults -------------------------------- */
const defaultLayout: RoomLayoutData = {
  rows: 7,
  cols: 12,
  defaultSeatColor: "#3e4b5a",
  cells: Array.from({ length: 7 * 12 }).map((_, i) => {
    const r = Math.floor(i / 12);
    const c = i % 12;
    const isAisle = c === 5 || c === 6;
    return {
      id: `${r}-${c}`,
      row: r,
      col: c,
      type: isAisle ? "removed" : "seat",
      color: isAisle ? undefined : "#3e4b5a",
    } as SeatCell;
  }),
};

type ShuffleMode = "random" | "byName" | "byGender";

/* --------------------------- Small UI helpers --------------------------- */
const DEFAULT_AVATAR_BG = "#34d399";
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
};

const extractGender = (tag: string): "M" | "F" | "U" => {
  const m = tag.match(/[\(\|\-\s]([MF])[\)\s]?$/i);
  if (!m) return "U";
  const g = m[1].toUpperCase();
  return g === "M" || g === "F" ? (g as "M" | "F") : "U";
};
const fullName = (first?: string, last?: string) =>
  [first, last].filter(Boolean).join(", ").replace(/\s+,/g, ",");

const makeUnique = (items: string[]) => {
  const counts = new Map<string, number>();
  return items.map((name) => {
    const c = (counts.get(name) ?? 0) + 1;
    counts.set(name, c);
    return c === 1 ? name : `${name} (${c})`;
  });
};

/** Format seat label as "First LastInitial." */
const seatLabelFromDisplayName = (displayName: string): string => {
  if (!displayName) return "";
  const base = displayName.split(" - ")[0].trim();
  if (!base) return "";

  if (base.includes(",")) {
    const [lastRaw, firstRaw] = base.split(",");
    const first = (firstRaw || "").trim().split(/\s+/)[0] || "";
    const last = (lastRaw || "").trim().split(/\s+/)[0] || "";
    if (!first) return base;
    return last ? `${first} ${last[0].toUpperCase()}.` : first;
  }

  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
};

/* ------------------------------ Component ------------------------------ */
const NONE_VALUE = "__unassigned__";

// helper: always use defaultSeatColor when resetting a seat
const getDefaultSeatColor = (lay?: RoomLayoutData) =>
  lay?.defaultSeatColor ?? "#3e4b5a";

export default function ClassLayoutPage() {
  const { currentUser } = useAuth();

  /* Layout state */
  const [layouts, setLayouts] = useState<RoomLayoutData[]>([]);
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [selectedLayoutName, setSelectedLayoutName] = useState<string>("");
  const [layout, setLayout] = useState<RoomLayoutData | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);

  /* NEW: track which seat is selected for coloring */
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  /* Filters/top controls */

  const [periodId, setPeriodId] = useState<string>("all");

  /* Firestore-driven */
  const [periods, setPeriods] = useState<{ id: string; name: string }[]>([]);
  const [studentPool, setStudentPool] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  /* ------------------------------ Effects ------------------------------ */

  // Load layouts list from Firestore whenever user changes
  useEffect(() => {
    (async () => {
      if (!currentUser?.uid) {
        setLayouts([]);
        setSelectedLayoutName("");
        setLayout(null);
        setAssignments({});
        return;
      }
      try {
        const rows = await loadLayouts(currentUser.uid);
        setLayouts(rows);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load layouts");
      }
    })();
  }, [currentUser?.uid]);

  // When active layout name changes, pull assignments from Firestore doc cells
  useEffect(() => {
    (async () => {
      if (!selectedLayoutName) {
        setAssignments({});
        return;
      }
      const map = await loadAssignments(selectedLayoutName, currentUser?.uid);
      setAssignments(map);
    })();
  }, [selectedLayoutName, currentUser?.uid]);

  // Persist assignments changes to Firestore (kept same callsite)
  useEffect(() => {
    if (!layout?.name || !currentUser?.uid) return;
    // debounce slightly to avoid thrash if many changes—simple microtask delay
    const t = setTimeout(() => {
      saveAssignments(layout.name!, assignments, currentUser.uid);
    }, 150);
    return () => clearTimeout(t);
  }, [layout?.name, assignments, currentUser?.uid]);

  // Periods
  useEffect(() => {
    const fetchPeriods = async () => {
      if (!currentUser?.uid) return;
      try {
        const q = query(
          collection(db, "periods"),
          where("teacherId", "==", currentUser.uid)
        );
        const snap = await getDocs(q);
        const rows: { id: string; name: string }[] = [];
        snap.forEach((d) =>
          rows.push({ id: d.id, name: d.get("name") || "Untitled" })
        );
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setPeriods(rows);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load periods");
      }
    };
    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Keep assignments valid when grid changes
  useEffect(() => {
    if (!layout) return;
    const validSeatIds = new Set(
      layout.cells.filter((c) => c.type === "seat").map((c) => c.id)
    );
    setAssignments((prev) => {
      const entries = Object.entries(prev).filter(([seatId]) =>
        validSeatIds.has(seatId)
      );
      if (entries.length === Object.keys(prev).length) return prev;
      const next: Record<string, string> = {};
      for (const [k, v] of entries) next[k] = v;
      return next;
    });
  }, [layout?.cells]);

  // Students filtered by period
  useEffect(() => {
    const fetchStudents = async () => {
      if (!currentUser?.uid) {
        setStudentPool([]);
        return;
      }
      try {
        const snap = await getDocs(
          query(
            collection(db, "students"),
            where("teacherId", "==", currentUser.uid)
          )
        );

        type Row = {
          name: string;
          gender?: string;
          singlePeriodId?: string;
          multiPeriodIds?: string[];
        };

        const rows: Row[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;

          const singlePeriodId: string | undefined = data.periodId;
          const multiPeriodIds: string[] | undefined = Array.isArray(
            data.periods
          )
            ? data.periods
                .map((p: any) => (typeof p?.id === "string" ? p.id : null))
                .filter(Boolean)
            : undefined;

          const nm: string =
            (typeof data.name === "string" && data.name.trim()) ||
            [data.lastName, data.firstName].filter(Boolean).join(", ") ||
            "Unnamed";

          const gender =
            typeof data.gender === "string"
              ? data.gender.toUpperCase()
              : undefined;

          rows.push({
            name: nm,
            gender,
            singlePeriodId,
            multiPeriodIds,
          });
        });

        const matchesPeriod = (r: Row): boolean => {
          if (!periodId || periodId === "all") return true;
          if (r.multiPeriodIds?.length)
            return r.multiPeriodIds.includes(periodId);
          if (r.singlePeriodId) return r.singlePeriodId === periodId;
          return false;
        };

        const filtered = rows.filter((r) => matchesPeriod(r));

        const tokenFirst = (s: string) =>
          (s.trim().split(/\s+/)[0] || "").toLowerCase();
        const tokenLast = (s: string) => {
          const parts = s.trim().split(/\s+/);
          return (parts[parts.length - 1] || "").toLowerCase();
        };
        filtered.sort((a, b) => {
          const la = tokenLast(a.name);
          const lb = tokenLast(b.name);
          if (la !== lb) return la.localeCompare(lb);
          return tokenFirst(a.name).localeCompare(tokenFirst(b.name));
        });

        const displayNames = filtered.map((r) =>
          r.gender === "M" || r.gender === "F"
            ? `${r.name} - ${r.gender}`
            : r.name
        );

        const uniqueNames = makeUnique(displayNames);

        const allowed = new Set(uniqueNames);
        setAssignments((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const seatId of Object.keys(next)) {
            if (!allowed.has(next[seatId])) {
              delete next[seatId];
              changed = true;
            }
          }
          return changed ? next : prev;
        });

        setStudentPool(uniqueNames);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load students");
        setStudentPool([]);
      }
    };
    fetchStudents();
  }, [currentUser?.uid, periodId]);

  const seatCells = useMemo(
    () => (layout ? layout.cells.filter((c) => c.type === "seat") : []),
    [layout]
  );

  /* ------------------------------- Layout IO ------------------------------- */
  const saveLayoutAs = async (name: string, data: RoomLayoutData) => {
    if (!currentUser?.uid) {
      toast.error("Not signed in");
      return;
    }
    const cleanName = (name || "New Layout").trim();
    const id = layoutIdFromName(cleanName);

    // Merge assignments into cells and sanitize
    const safeCells = data.cells.map((c) => {
      const withAssign: SeatCell =
        c.type === "seat" ? { ...c, studentId: assignments[c.id] } : { ...c };
      return sanitizeCell(withAssign);
    });

    const payload: RoomLayoutData = omitUndefined({
      ...data,
      name: cleanName,
      cells: safeCells,
      rows: data.rows,
      cols: data.cols,
      defaultSeatColor: data.defaultSeatColor,
    });

    const ref = doc(db, "users", currentUser.uid, "roomLayouts", id);
    await setDoc(
      ref,
      {
        ...payload,
        teacherId: currentUser.uid,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Refresh list from Firestore
    const rows = await loadLayouts(currentUser.uid);
    setLayouts(rows);
    setLayout(payload);
    setSelectedLayoutName(cleanName);
    saveLayouts(rows); // no-op, kept for signature
    toast.success(`Layout saved as "${cleanName}"`);
    setLayoutModalOpen(false);
  };

  const deleteLayout = async (name: string) => {
    if (!currentUser?.uid) {
      toast.error("Not signed in");
      return;
    }
    const id = layoutIdFromName(name);
    await deleteDoc(doc(db, "users", currentUser.uid, "roomLayouts", id));
    const rows = await loadLayouts(currentUser.uid);
    setLayouts(rows);
    if (selectedLayoutName === name) {
      setSelectedLayoutName("");
      setLayout(null);
      setAssignments({});
    }
    // clear any old local cache key (kept behavior shape)
    if (typeof window !== "undefined") {
      localStorage.removeItem(LS_ASSIGN_PREFIX + name);
    }
    saveLayouts(rows); // no-op
    toast.success(`Deleted layout "${name}"`);
  };

  const selectLayout = async (name: string) => {
    if (!name) {
      setSelectedLayoutName("");
      setLayout(null);
      setAssignments({});
      return;
    }
    if (!currentUser?.uid) return;

    const id = layoutIdFromName(name);
    const ref = doc(db, "users", currentUser.uid, "roomLayouts", id);
    const snap = await getDoc(ref);

    let found: RoomLayoutData | undefined;
    if (snap.exists()) {
      found = snap.data() as RoomLayoutData;
      // ensure name
      if (!found.name) found.name = name;
    } else {
      // fallback to in-memory list (rare)
      found = layouts.find((l) => l.name === name);
    }

    if (found) {
      setSelectedLayoutName(found.name ?? name);
      setLayout(found);

      // Prefer assignments from Firestore cells; fallback to constructed map
      const fromFS: Record<string, string> = {};
      found.cells.forEach((c) => {
        if (c.type === "seat" && c.studentId) fromFS[c.id] = c.studentId;
      });
      setAssignments(fromFS);
    }
  };

  /* --------------------------- Drag & Drop logic --------------------------- */
  const onDropToSeat = (e: React.DragEvent<HTMLDivElement>, cell: SeatCell) => {
    const name = e.dataTransfer.getData("text/plain");
    if (!layout || !name || cell.type !== "seat") return;

    // determine the previous seat (if any) for this student BEFORE we change state
    const prevSeatId =
      Object.entries(assignments).find(([, n]) => n === name)?.[0] ?? null;

    setAssignments((prev) => {
      const copy = { ...prev };
      // remove any existing placement for this student
      for (const k of Object.keys(copy)) {
        if (copy[k] === name) delete copy[k];
      }
      // set new placement
      copy[cell.id] = name;
      return copy;
    });

    // ✅ Update colors: new seat -> green; previous seat (if any) -> default gray
    const next = structuredClone(layout) as RoomLayoutData;

    // reset previous seat color to default gray
    if (prevSeatId) {
      const pIdx = next.cells.findIndex((c) => c.id === prevSeatId);
      if (pIdx >= 0 && next.cells[pIdx].type === "seat") {
        next.cells[pIdx].color = getDefaultSeatColor(layout);
      }
    }

    // color the new seat green
    const idx = next.cells.findIndex((c) => c.id === cell.id);
    if (idx >= 0 && next.cells[idx].type === "seat") {
      next.cells[idx].color = "#34d399";
    }

    setLayout(next);
    setSelectedSeatId(cell.id);
    e.preventDefault();
  };

  const allowDrop = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  /* ------------------------------- Toolbar ------------------------------- */
  const clearAssignments = () => {
    setAssignments({});
    if (layout) {
      const next = structuredClone(layout) as RoomLayoutData;
      next.cells = next.cells.map((c) =>
        c.type === "seat" ? { ...c, color: "rgb(62, 75, 60)" } : c
      );
      next.defaultSeatColor = "rgb(62, 75, 60)";
      setLayout(next);
    }
    toast.message("Cleared all seat assignments and reset seat colors.");
  };

  const setSeatColorSelected = (color: string) => {
    if (!layout || !selectedSeatId) return;
    const next = structuredClone(layout) as RoomLayoutData;
    const idx = next.cells.findIndex((c) => c.id === selectedSeatId);
    if (idx >= 0 && next.cells[idx].type === "seat") {
      next.cells[idx].color = color;
      setLayout(next);
    }
  };

  const shuffle = (arr: string[]): string[] => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  };

  const assignByMode = (mode: ShuffleMode) => {
    const pool = studentPool.slice();
    if (!pool.length) return toast.error("No students to place.");
    const seats = seatCells;
    if (!seats.length) return toast.error("No seats available.");

    let order = pool.slice();

    if (mode === "random") order = shuffle(order);
    if (mode === "byName") order = order.sort((a, b) => a.localeCompare(b));
    if (mode === "byGender") {
      const males = order.filter((n) => extractGender(n) === "M");
      const females = order.filter((n) => extractGender(n) === "F");
      const unknown = order.filter((n) => extractGender(n) === "U");
      const alt: string[] = [];
      const max = Math.max(males.length, females.length);
      for (let i = 0; i < max; i++) {
        if (i < females.length) alt.push(females[i]);
        if (i < males.length) alt.push(males[i]);
      }
      order = alt.concat(unknown);
    }

    const nextAssignments: Record<string, string> = {};
    const count = Math.min(order.length, seats.length);
    for (let i = 0; i < count; i++) nextAssignments[seats[i].id] = order[i];

    setAssignments(nextAssignments);

    // ✅ Color assigned seats green; unassigned seats reset to default gray
    if (layout) {
      const updated = structuredClone(layout) as RoomLayoutData;
      const def = getDefaultSeatColor(layout);
      updated.cells = updated.cells.map((c) =>
        c.type === "seat"
          ? { ...c, color: nextAssignments[c.id] ? "#34d399" : def }
          : c
      );
      setLayout(updated);
    }

    toast.success(
      mode === "byGender" ? "Shuffled by gender." : "Shuffled seats."
    );
  };

  /* ------------------------------- Derived ------------------------------- */
  const assignedNames = new Set(Object.values(assignments));
  const unseatedStudents = studentPool.filter((n) => !assignedNames.has(n));

  const colorOfStudent = (studentName: string | null): string | null => {
    if (!studentName || !layout) return null;
    const seatId = Object.entries(assignments).find(
      ([, name]) => name === studentName
    )?.[0];
    if (!seatId) return null;
    const cell = layout.cells.find((c) => c.id === seatId);
    return cell?.color ?? layout.defaultSeatColor ?? null;
  };

  const selectedSeatColor =
    (layout &&
      selectedSeatId &&
      (layout.cells.find((c) => c.id === selectedSeatId)?.color ??
        layout.defaultSeatColor)) ||
    layout?.defaultSeatColor ||
    "#3e4b5a";

  const selectedSeatStudent = selectedSeatId
    ? assignments[selectedSeatId]
    : null;

  if (subscriptionLoading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  // Show no access if user doesn't have subscription
  if (!hasAccess) {
    return (
      <ProtectedRoute>
        <NoAccess
          title="Students Management"
          description="Access to student management requires an active subscription."
        />
      </ProtectedRoute>
    );
  }
  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="w-full mx-auto px-4 py-6 space-y-4">
      <Tabs defaultValue="arrangement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="arrangement">Sitting Arrangement</TabsTrigger>
        </TabsList>

        <TabsContent value="arrangement" className="space-y-4">
          {/* Top controls */}
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
              {/* Layout select */}
              <div className="md:col-span-3">
                <Label>Layout</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedLayoutName}
                    onValueChange={selectLayout}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a layout" />
                    </SelectTrigger>
                    <SelectContent>
                      {layouts.map((l) => (
                        <SelectItem key={l.name} value={l.name!}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Periods */}
              <div className="md:col-span-3">
                <Label>Period</Label>
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All periods</SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {periods.length === 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        No periods found for your account
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="md:col-span-6 flex gap-2 justify-end">
                <Button
                  type="button"
                  onClick={() =>
                    layout &&
                    saveLayoutAs(layout.name ?? "New Layout", {
                      ...layout,
                      cells: layout.cells.map((c) =>
                        c.type === "seat"
                          ? { ...c, studentId: assignments[c.id] }
                          : c
                      ),
                    })
                  }
                  className="gap-1"
                >
                  <Save className="w-4 h-4" />
                  Save
                </Button>
                {selectedLayoutName && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => deleteLayout(selectedLayoutName)}
                    className="gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLayoutModalOpen(true)}
                >
                  Open Room Layout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 3-column layout. Grid itself is empty until a layout is selected. */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Left: students */}
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Students</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[70vh] overflow-auto pr-2">
                {unseatedStudents.map((name) => {
                  const seatColor = colorOfStudent(name) ?? DEFAULT_AVATAR_BG;
                  return (
                    <div
                      key={name}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", name);
                        setSelectedStudent(name);
                      }}
                      onDragEnd={() => setSelectedStudent(null)}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 bg-background cursor-grab active:cursor-grabbing"
                      title="Drag onto a seat"
                    >
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                        style={{ background: seatColor, color: "#053B1F" }}
                      >
                        {getInitials(name)}
                      </div>
                      <div className="flex-1 text-sm">{name}</div>
                    </div>
                  );
                })}
                {unseatedStudents.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Everyone is seated (for this period).
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Center: grid + toolbar */}
            <div className="xl:col-span-6 space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Arrange</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-1"
                      onClick={() => assignByMode("random")}
                    >
                      <Shuffle className="w-4 h-4" /> Shuffle
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => assignByMode("byGender")}
                    >
                      Shuffle by Gender
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-1"
                      onClick={clearAssignments}
                    >
                      <Undo2 className="w-4 h-4" /> Clear All
                    </Button>
                    <div className="flex items-center gap-2 ml-auto">
                      <PaintBucket className="w-4 h-4 opacity-70" />
                      <Label className="text-xs">Color Seats</Label>
                      <input
                        type="color"
                        value={selectedSeatColor}
                        onChange={(e) => setSeatColorSelected(e.target.value)}
                        className="h-8 w-12 rounded border"
                        title="Seat color (applies to the selected seat)"
                      />
                    </div>
                  </div>

                  {/* Seat grid */}
                  <div className="overflow-auto border rounded-md p-3 bg-slate-900/10">
                    {layout ? (
                      <div
                        className="grid gap-2 justify-center"
                        style={{
                          gridTemplateColumns: `repeat(${layout.cols}, minmax(36px, 1fr))`,
                        }}
                      >
                        {layout.cells.map((c) => {
                          if (c.type === "removed") {
                            return (
                              <div
                                key={c.id}
                                className="h-[46px] rounded bg-white/70 border border-dashed"
                              />
                            );
                          }
                          if (c.type === "teacher") {
                            return (
                              <div
                                key={c.id}
                                className="h-[46px] rounded border bg-amber-50 text-[10px] flex items-center justify-center font-medium"
                              >
                                TEACHER
                              </div>
                            );
                          }
                          if (c.type === "door") {
                            return (
                              <div
                                key={c.id}
                                className="h-[46px] rounded border bg-slate-50 text-[10px] flex items-center justify-center"
                              >
                                DOOR
                              </div>
                            );
                          }

                          const name = assignments[c.id];
                          const seatText = name
                            ? seatLabelFromDisplayName(name)
                            : "";

                          const seatBg = c.color ?? layout.defaultSeatColor;

                          const isSelected = selectedSeatId === c.id;

                          return (
                            <div
                              key={c.id}
                              onDragOver={allowDrop}
                              onDrop={(e) => onDropToSeat(e, c)}
                              onClick={() => setSelectedSeatId(c.id)}
                              className={`h-[46px] rounded border flex items-center justify-center relative ${
                                isSelected ? "ring-2 ring-primary/40" : ""
                              }`}
                              style={{ background: seatBg }}
                              title={
                                name
                                  ? `${name}\n(Drag to move, double-click to unassign)`
                                  : "Empty"
                              }
                              onDoubleClick={() => {
                                if (!name || !layout) return;
                                setAssignments((prev) => {
                                  const copy = { ...prev };
                                  delete copy[c.id];
                                  return copy;
                                });
                                // reset this seat color back to default gray on unassign
                                const next = structuredClone(
                                  layout
                                ) as RoomLayoutData;
                                const idx = next.cells.findIndex(
                                  (x) => x.id === c.id
                                );
                                if (
                                  idx >= 0 &&
                                  next.cells[idx].type === "seat"
                                ) {
                                  next.cells[idx].color =
                                    getDefaultSeatColor(layout);
                                  setLayout(next);
                                }
                              }}
                            >
                              {/* Seat numbers removed to improve name visibility */}
                              {name ? (
                                <div
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", name);
                                    setSelectedStudent(name);
                                  }}
                                  onDragEnd={() => setSelectedStudent(null)}
                                  className="text-emerald-950 text-sm font-semibold cursor-grab"
                                >
                                  {seatText}
                                </div>
                              ) : (
                                <div className="text-[11px] text-white/70">
                                  Empty
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[480px]" />
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Tip: click a seat to select it, then use the color picker to
                    paint just that seat. Drag a name from the left onto a seat.
                    Drag a seated label to another seat to move. Double-click to
                    unassign.
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: details */}
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedSeatStudent ? selectedSeatStudent : "Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSeatStudent ? (
                  <>
                    <div
                      className="w-full h-40 rounded-md"
                      style={{
                        background:
                          colorOfStudent(selectedSeatStudent) ??
                          DEFAULT_AVATAR_BG,
                      }}
                    />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Attendance</div>
                      <div className="text-xs">09/14/2025</div>
                      <div className="text-sm mt-2">No Class Day</div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Select or drag a student to view details.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ROOM LAYOUT MODAL */}
      <Dialog open={layoutModalOpen} onOpenChange={setLayoutModalOpen}>
        <DialogContent className="sm:max-w-[95vw] w-[100vw] h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
            <DialogHeader className="p-0">
              <DialogTitle>Room Layouts</DialogTitle>
              <DialogDescription className="sr-only">
                Create or edit your room seating layout.
              </DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>

          <div className="p-4">
            <RoomLayout
              value={layout ?? defaultLayout}
              onChange={setLayout}
              allowSaveAs
              onSaveAs={saveLayoutAs}
              showTitle
            />
          </div>

          <DialogFooter className="px-4 pb-4">
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button
              onClick={() =>
                saveLayoutAs(
                  (layout?.name ?? "New Layout") as string,
                  (layout ?? defaultLayout) as RoomLayoutData
                )
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
