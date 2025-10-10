"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Paperclip,
  Plus,
  Printer,
  Save,
  Sun,
  Moon,
} from "lucide-react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";

import { db, storage } from "@/firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LessonPlanModal } from "@/components/plans/LessonPlanModal";

// ---------------- Types ----------------
type SchoolYear = {
  id: string;
  name: string; // required
  startDate: string; // "yyyy-mm-dd"
  endDate: string; // "yyyy-mm-dd"
  isActive?: boolean;
  teacherId: string;
};

type Period = {
  id: string;
  teacherId: string;
  schoolYearId: string;
  name: string;
  colorBg?: string;
  colorText?: string;
  totalStudents?: number;
  // (optional times etc.)
};

type Attachment = {
  name: string;
  type: string;
  size: number;
  storagePath: string;
  url: string;
};

type LessonPlan = {
  id?: string;
  teacherId: string;
  schoolYearId: string;
  /** periodId kept for compatibility with LessonPlanModal; if not chosen, we still generate a UUID (legacy) */
  periodId: string;
  date: string; // YYYY-MM-DD
  periodName?: string;
  /** Manual plan fields */
  name?: string;
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"

  topic?: string;
  objective?: string;
  resources?: string;
  assignments?: string;
  homework?: string;
  notes?: string;
  standards?: string;
  attachments?: Attachment[];

  /** Card header colors (per plan; falls back to period colors) */
  colorBg?: string;
  colorText?: string;

  meta?: {
    createdAt?: any;
    updatedAt?: any;
    shiftedFromDate?: string;
  };
};

type UserPrefs = {
  theme?: "light" | "dark";
  defaultView?: "month" | "week" | "day";
};

// ---------------- Helpers ----------------
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const onlyMF = (d: Date) => {
  const w = d.getDay(); // 0 Sun ... 6 Sat
  return w !== 0 && w !== 6;
};
const nextBusinessDay = (d: Date, dir: 1 | -1) => {
  let t = addDays(d, dir);
  while (!onlyMF(t)) t = addDays(t, dir);
  return t;
};
const uid = () => crypto.randomUUID();

// Remove every `undefined` recursively so Firestore is happy
function clean<T>(obj: T): T {
  const recur = (x: any): any => {
    if (Array.isArray(x)) return x.map(recur).filter((v) => v !== undefined);
    if (x && typeof x === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(x)) {
        if (v === undefined) continue; // DROP undefined
        out[k] = recur(v);
      }
      return out;
    }
    return x;
  };
  return recur(obj);
}

// ---------------- Quick Plan Modal (Create + Edit with preview) ----------------
function QuickPlanModal({
  open,
  onOpenChange,
  initialDate,
  onCreate,
  // edit mode support
  editPlan,
  onUpdate,
  // live preview
  onPreviewColors,
  // period props
  periods,
  selectedPeriodId,
  onChangePeriodId,

  // NEW: mode controls from parent (used only when creating)
  isEventMode,
  onRequestEvent,
  onRequestPlan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate: string | null;
  onCreate: (
    plan: Pick<
      LessonPlan,
      "name" | "startTime" | "endTime" | "colorBg" | "colorText"
    >
  ) => void;
  editPlan?: LessonPlan;
  onUpdate?: (
    patch: Pick<
      LessonPlan,
      "name" | "startTime" | "endTime" | "colorBg" | "colorText"
    >
  ) => void;
  onPreviewColors?: (
    v: { colorBg?: string; colorText?: string } | null
  ) => void;
  periods: Period[];
  selectedPeriodId: string | null;
  onChangePeriodId: (v: string | null) => void;

  // NEW
  isEventMode: boolean;
  onRequestEvent?: () => void;
  onRequestPlan?: () => void;
}) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [colorBg, setColorBg] = useState("#e6f0ff");
  const [colorText, setColorText] = useState("#1e3a8a");

  // 🔎 Detect what we're editing (plan vs event)
  const isEditing = !!editPlan;
  const isEditingEvent = !!editPlan && !editPlan.periodId; // periodId === "" => Event
  const isEditingPlan = !!editPlan && !!editPlan.periodId; // periodId set   => Plan

  // UI visibility rules
  const showPeriodDropdown = !isEventMode && !isEditingEvent; // hide for events (new or editing event)
  const showTimeInputs = isEventMode || isEditingEvent; // only for events (new or editing event)

  useEffect(() => {
    if (open) {
      if (editPlan) {
        setName(editPlan.name || "");
        setStartTime(editPlan.startTime || "");
        setEndTime(editPlan.endTime || "");
        setColorBg(editPlan.colorBg || "");
        setColorText(editPlan.colorText || "");
        onPreviewColors?.({
          colorBg: editPlan.colorBg,
          colorText: editPlan.colorText,
        });

        // When editing: force the right selection for period
        if (isEditingEvent) {
          onChangePeriodId(null); // Event: no period
        } else {
          onChangePeriodId(editPlan.periodId || periods[0]?.id || null);
        }
      } else {
        // Creating: reset
        setName("");
        setStartTime("");
        setEndTime("");
        setColorBg("");
        setColorText("");
        // In Plan mode, preselect first period; in Event mode, no period
        onChangePeriodId(null);
        onPreviewColors?.(null);
      }
    } else {
      onPreviewColors?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPlan, isEventMode]);

  const periodColorHint = useMemo(() => {
    const p = periods.find((x) => x.id === selectedPeriodId);
    return p ? { colorBg: p.colorBg, colorText: p.colorText } : {};
  }, [periods, selectedPeriodId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onPreviewColors?.(null);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <DialogTitle>
              {isEditing ? (isEditingEvent ? "Edit Event" : "Edit Plan") : null}
            </DialogTitle>

            {/* Mode toggle buttons only when creating (not editing) */}
            {!isEditing && (
              <div className="flex items-center gap-2">
                <Button
                  variant={isEventMode ? "outline" : "default"}
                  size="sm"
                  onClick={() => onRequestPlan?.()}
                >
                  New Plan
                </Button>
                <Button
                  variant={isEventMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => onRequestEvent?.()}
                >
                  New Event
                </Button>
              </div>
            )}
          </div>

          <DialogDescription>
            {initialDate
              ? format(parseISO(initialDate), "EEEE, MMM d, yyyy")
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Period dropdown (hidden for Event) */}
          {showPeriodDropdown && (
            <div className="space-y-1">
              <Label>Class Period</Label>
              <Select
                value={selectedPeriodId || ""}
                onValueChange={(v) => onChangePeriodId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {typeof p.totalStudents === "number"
                        ? ` · ${p.totalStudents} students`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>
              {isEditingEvent || isEventMode ? "Event Name" : "Plan Name"}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isEditingEvent || isEventMode
                  ? "e.g., Assembly / Field Trip"
                  : "e.g., Algebra: Linear Equations"
              }
            />
          </div>

          {/* Time inputs (only for Event) */}
          {showTimeInputs && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Header Background</Label>
              <Input
                type="color"
                value={colorBg || periodColorHint.colorBg || "#e6f0ff"}
                onChange={(e) => {
                  const v = e.target.value;
                  setColorBg(v);
                  if (editPlan) onPreviewColors?.({ colorBg: v, colorText });
                }}
              />
              {!colorBg && periodColorHint.colorBg && (
                <p className="text-[11px] text-muted-foreground">
                  Inheriting from period
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Header Text Color</Label>
              <Input
                type="color"
                value={colorText || periodColorHint.colorText || "#1e3a8a"}
                onChange={(e) => {
                  const v = e.target.value;
                  setColorText(v);
                  if (editPlan) onPreviewColors?.({ colorBg, colorText: v });
                }}
              />
              {!colorText && periodColorHint.colorText && (
                <p className="text-[11px] text-muted-foreground">
                  Inheriting from period
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => {
              onPreviewColors?.(null); // revert
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              // 🧠 Don’t overwrite hidden fields:
              // - If time inputs are hidden (Plan), don't include times in payload
              // - If period dropdown is hidden (Event), parent already handles periodId=""
              const payloadBase = { name, colorBg, colorText } as Pick<
                LessonPlan,
                "name" | "startTime" | "endTime" | "colorBg" | "colorText"
              >;

              const payload = showTimeInputs
                ? { ...payloadBase, startTime, endTime }
                : payloadBase;

              if (editPlan && onUpdate) {
                onUpdate(payload);
              } else {
                onCreate(payload);
              }
              onPreviewColors?.(null); // saved -> preview cleared
              onOpenChange(false);
            }}
            disabled={!name.trim()}
          >
            <Save className="h-4 w-4 mr-2" /> {isEditing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Page ----------------
export default function PlansPage() {
  const { currentUser } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  if (subscriptionLoading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }
  if (!hasAccess) {
    return (
      <ProtectedRoute>
        <NoAccess
          title="Lesson Plan Calendar"
          description="Access to the calendar requires an active subscription."
        />
      </ProtectedRoute>
    );
  }
  return (
    <ProtectedRoute>
      <PlansBody />
    </ProtectedRoute>
  );
}

function PlansBody() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  // View state
  const [today] = useState<Date>(startOfDay(new Date()));
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [view, setView] = useState<"month" | "week" | "day">("month");

  // Data
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  // Periods
  const [periods, setPeriods] = useState<Period[]>([]);
  const periodMap = useMemo(() => {
    const m = new Map<string, Period>();
    periods.forEach((p) => m.set(p.id, p));
    return m;
  }, [periods]);

  // live color preview for the plan currently being edited in the quick modal
  const [colorPreview, setColorPreview] = useState<{
    planId: string;
    colorBg?: string;
    colorText?: string;
  } | null>(null);

  // Plans in current range
  const [plans, setPlans] = useState<LessonPlan[]>([]);

  // Prefs
  const [prefs, setPrefs] = useState<UserPrefs>({
    theme: "light",
    defaultView: "month",
  });

  // Editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick-create / quick-edit modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDate, setQuickDate] = useState<string | null>(null);
  const [quickEditPlan, setQuickEditPlan] = useState<LessonPlan | null>(null);
  const [quickPeriodId, setQuickPeriodId] = useState<string | null>(null);

  // Clipboard for copy/paste + bump days
  const [clipboard, setClipboard] = useState<{ block: LessonPlan[] } | null>(
    null
  );

  // ⬇️ split into two independent counts
  const [shiftCountForward, setShiftCountForward] = useState<number>(1);
  const [shiftCountBackward, setShiftCountBackward] = useState<number>(1);
  const [cascadeShift, setCascadeShift] = useState<boolean>(false); // NEW

  // Floating context menu (right-click)
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    date: string;
    plan?: LessonPlan;
  } | null>(null);

  // Print
  const printRef = useRef<HTMLDivElement>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printPeriodFilter, setPrintPeriodFilter] = useState<string[]>([]); // NEW multi-select

  // Copy year dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFromYearId, setCopyFromYearId] = useState<string>("");
  const [copyFromPeriodId, setCopyFromPeriodId] = useState<string>("");
  const [copyFromYearPeriods, setCopyFromYearPeriods] = useState<Period[]>([]);
  // Load prefs
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const prefRef = doc(db, "userPrefs", currentUser.uid);
      const snap = await getDoc(prefRef);
      if (snap.exists()) {
        const p = snap.data() as UserPrefs;
        setPrefs(p);
        if (p.defaultView) setView(p.defaultView);
        document.documentElement.classList.toggle("dark", p.theme === "dark");
      }
    })();
  }, [currentUser]);

  const toggleTheme = async () => {
    if (!currentUser) return;
    const next = prefs.theme === "dark" ? "light" : "dark";
    const prefRef = doc(db, "userPrefs", currentUser.uid);
    await setDoc(prefRef, { ...prefs, theme: next }, { merge: true });
    setPrefs((s) => ({ ...s, theme: next }));
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  useEffect(() => {
    if (!currentUser || !copyFromYearId) {
      setCopyFromYearPeriods([]);
      return;
    }
    (async () => {
      const qp = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser.uid),
        where("schoolYearId", "==", copyFromYearId)
      );
      const res = await getDocs(qp);
      const arr: Period[] = [];
      res.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => a.name.localeCompare(b.name));
      setCopyFromYearPeriods(arr);
    })();
  }, [currentUser, copyFromYearId]);

  // Load years
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const qy = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser.uid)
      );
      const res = await getDocs(qy);
      const arr: SchoolYear[] = [];
      res.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
      setYears(arr);
      if (arr.length && !selectedYearId) {
        const active = arr.find((y) => y.isActive) || arr[0];
        setSelectedYearId(active.id);
      }
    })();
  }, [currentUser, selectedYearId]);

  // Load periods for selected year
  useEffect(() => {
    if (!currentUser || !selectedYearId) {
      setPeriods([]);
      return;
    }
    (async () => {
      const qp = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser.uid),
        where("schoolYearId", "==", selectedYearId)
      );
      const res = await getDocs(qp);
      const arr: Period[] = [];
      res.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => a.name.localeCompare(b.name));
      setPeriods(arr);
    })();
  }, [currentUser, selectedYearId]);

  const { rangeStart, rangeEnd, gridDates } = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      const days: Date[] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
      // ⬇️ keep only Mon–Fri
      const weekdaysOnly = days.filter(onlyMF);
      return { rangeStart: start, rangeEnd: end, gridDates: weekdaysOnly };
    }
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = endOfWeek(cursor, { weekStartsOn: 1 });
      const days: Date[] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
      // ⬇️ keep only Mon–Fri
      const weekdaysOnly = days.filter(onlyMF);
      return { rangeStart: start, rangeEnd: end, gridDates: weekdaysOnly };
    }
    // day view unchanged
    return { rangeStart: cursor, rangeEnd: cursor, gridDates: [cursor] };
  }, [cursor, view]);

  // Fetch plans in range (no period filter anymore)
  useEffect(() => {
    if (!currentUser || !selectedYearId) {
      setPlans([]);
      return;
    }
    (async () => {
      const ql = query(
        collection(db, "lessonPlans"),
        where("teacherId", "==", currentUser.uid),
        where("schoolYearId", "==", selectedYearId)
      );
      const res = await getDocs(ql);
      const collected: LessonPlan[] = [];
      res.forEach((d) => {
        const data = d.data() as LessonPlan;
        if (data.date >= iso(rangeStart) && data.date <= iso(rangeEnd)) {
          collected.push({ id: d.id, ...data });
        }
      });
      collected.sort((a, b) => a.date.localeCompare(b.date));
      setPlans(collected);
    })();
  }, [currentUser, selectedYearId, rangeStart, rangeEnd]);

  // Plans maps
  const plansByDate = useMemo(() => {
    const map = new Map<string, LessonPlan[]>();
    for (const p of plans) {
      const arr = map.get(p.date) || [];
      arr.push(p);
      map.set(p.date, arr);
    }
    // keep a predictable per-day order (by startTime then name)
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const at = a.startTime || "";
        const bt = b.startTime || "";
        if (at !== bt) return at.localeCompare(bt);
        const an =
          (periodMap.get(a.periodId)?.name || "") + (a.name || "Untitled");
        const bn =
          (periodMap.get(b.periodId)?.name || "") + (b.name || "Untitled");
        return an.localeCompare(bn);
      });
      map.set(k, arr);
    }
    return map;
  }, [plans, periodMap]);

  // ---------- Quick create ----------
  function openQuickCreate(date: string) {
    if (!selectedYearId) {
      toast({ title: "Select a School Year first", variant: "destructive" });
      return;
    }
    setQuickDate(date);
    setQuickEditPlan(null); // ensure create mode
    setQuickPeriodId(null); // no default selection → shows "Select period"

    setColorPreview(null); // clear any stray preview
    setQuickOpen(true);
  }

  // ---------- Quick create ----------
  async function createQuickPlan(
    payload: Pick<
      LessonPlan,
      "name" | "startTime" | "endTime" | "colorBg" | "colorText"
    >
  ) {
    if (!currentUser || !selectedYearId || !quickDate) return;

    // Use selected period (required for Plan)
    const chosenPeriodId = quickPeriodId || uid(); // legacy-safe
    const periodObj = periods.find((p) => p.id === chosenPeriodId);

    // If user didn't set times in the modal, inherit from Period page
    const resolvedStart =
      payload.startTime || (periodObj as any)?.startTime || undefined;
    const resolvedEnd =
      payload.endTime || (periodObj as any)?.endTime || undefined;

    const id = `${currentUser.uid}__${selectedYearId}__${chosenPeriodId}__${quickDate}`;
    const plan: LessonPlan = {
      id,
      teacherId: currentUser.uid,
      schoolYearId: selectedYearId,
      periodId: chosenPeriodId,
      date: quickDate,
      name: payload.name?.trim(),
      startTime: resolvedStart,
      endTime: resolvedEnd,
      colorBg: payload.colorBg || undefined,
      colorText: payload.colorText || undefined,
      attachments: [],
      meta: { createdAt: new Date(), updatedAt: new Date() },
    };
    await setDoc(doc(db, "lessonPlans", id), clean(plan), { merge: true });

    setPlans((prev) => {
      const next = prev.filter(
        (p) => !(p.date === plan.date && p.periodId === plan.periodId)
      );
      next.push(plan);
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
    setQuickOpen(false);
  }

  async function createQuickEvent(
    payload: Pick<
      LessonPlan,
      "name" | "startTime" | "endTime" | "colorBg" | "colorText"
    >
  ) {
    if (!currentUser || !selectedYearId || !quickDate) return;

    // Event has NO period
    const chosenPeriodId = ""; // keep empty to indicate "no period"
    const base = `${currentUser.uid}__${selectedYearId}__${
      chosenPeriodId || uid()
    }__${quickDate}`;
    const id = makeUniqueId(base, plans);

    const plan: LessonPlan = {
      id,
      teacherId: currentUser.uid,
      schoolYearId: selectedYearId,
      periodId: chosenPeriodId, // ""
      date: quickDate,
      name: payload.name?.trim(),
      startTime: payload.startTime || undefined,
      endTime: payload.endTime || undefined,
      colorBg: payload.colorBg || undefined,
      colorText: payload.colorText || undefined,
      attachments: [],
      meta: { createdAt: new Date(), updatedAt: new Date() },
    };

    await setDoc(doc(db, "lessonPlans", id), clean(plan), { merge: true });

    setPlans((prev) =>
      [...prev, plan].sort((a, b) => a.date.localeCompare(b.date))
    );
    setQuickOpen(false);
  }

  const [quickIsEvent, setQuickIsEvent] = useState<boolean>(false);

  function openQuickCreateEvent(date: string) {
    if (!selectedYearId) {
      toast({ title: "Select a School Year first", variant: "destructive" });
      return;
    }
    setQuickDate(date);
    setQuickEditPlan(null);
    setQuickPeriodId(null); // ensure no period chosen
    setQuickIsEvent(true); // <-- add this state (see next step)
    setColorPreview(null);
    setQuickOpen(true);
  }

  // Compose the “base” (without any suffix)
  const baseIdOf = (
    teacherId: string,
    schoolYearId: string,
    periodId: string,
    date: string
  ) => `${teacherId}__${schoolYearId}__${periodId}__${date}`;

  // If an id starts with base, return the trailing suffix, else "".
  const suffixOf = (id: string, base: string) =>
    id.startsWith(base) ? id.slice(base.length) : "";

  // Make a unique id by appending __copyN if needed (checks current state array)
  const makeUniqueId = (base: string, existing: Array<{ id?: string }>) => {
    let candidate = base;
    let n = 2;
    const has = (x: string) => existing.some((p) => p.id === x);
    while (has(candidate)) {
      candidate = `${base}__copy${n++}`;
    }
    return candidate;
  };

  // quick edit updater
  async function updateQuickPlan(
    patch: Pick<
      LessonPlan,
      "name" | "startTime" | "endTime" | "colorBg" | "colorText"
    >
  ) {
    if (!quickEditPlan?.id) return;
    const finalPatch: Partial<LessonPlan> = {
      ...patch,
      ...(quickPeriodId ? { periodId: quickPeriodId } : {}),
      meta: { ...(quickEditPlan.meta || {}), updatedAt: new Date() },
    };
    await setDoc(doc(db, "lessonPlans", quickEditPlan.id), clean(finalPatch), {
      merge: true,
    });

    setPlans((prev) =>
      prev
        .map((pl) =>
          pl.id === quickEditPlan.id ? { ...pl, ...finalPatch } : pl
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    );
    setQuickEditPlan(null);
    toast({ title: "Updated plan." });
  }

  // ---------- Full editor ----------
  function openEditor(plan: LessonPlan) {
    setEditingPlan(plan);
    setEditorOpen(true);
  }

  async function savePlan() {
    if (!editingPlan) return;
    try {
      setEditorLoading(true);
      const {
        id,
        teacherId,
        schoolYearId,
        periodId,
        date,
        name,
        startTime,
        endTime,
        topic,
        objective,
        resources,
        assignments,
        homework,
        notes,
        standards,
        attachments = [],
        colorBg,
        colorText,
        meta,
      } = editingPlan;

      const planData: LessonPlan = {
        teacherId,
        schoolYearId,
        periodId,
        date,
        ...(name?.trim() ? { name } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(topic?.trim() ? { topic } : {}),
        ...(objective?.trim() ? { objective } : {}),
        ...(resources?.trim() ? { resources } : {}),
        ...(assignments?.trim() ? { assignments } : {}),
        ...(homework?.trim() ? { homework } : {}),
        ...(notes?.trim() ? { notes } : {}),
        ...(standards?.trim() ? { standards } : {}),
        ...(attachments.length ? { attachments } : {}),
        ...(colorBg ? { colorBg } : {}),
        ...(colorText ? { colorText } : {}),
        meta: {
          ...(meta || {}),
          updatedAt: new Date(),
          ...(meta?.createdAt ? {} : { createdAt: new Date() }),
        },
      };

      const finalId =
        id || `${teacherId}__${schoolYearId}__${periodId || uid()}__${date}`;
      await setDoc(doc(db, "lessonPlans", finalId), clean(planData), {
        merge: true,
      });

      setEditorOpen(false);
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== finalId);
        next.push({ ...planData, id: finalId });
        return next.sort((a, b) => a.date.localeCompare(b.date));
      });
      toast({ title: "Saved plan." });
    } finally {
      setEditorLoading(false);
    }
  }

  async function deleteAttachment(att: Attachment) {
    if (!editingPlan) return;
    try {
      await deleteObject(storageRef(storage, att.storagePath));
    } catch {
      // ignore
    }
    setEditingPlan((p) =>
      p
        ? {
            ...p,
            attachments: (p.attachments || []).filter(
              (a) => a.storagePath !== att.storagePath
            ),
          }
        : p
    );
  }

  // ---------- Full editor (in PlansPage) ----------
  // ---------- Full editor (in PlansPage) ----------
  async function handleUploadAttachment(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!editingPlan || !currentUser) return;

    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Snapshot values we rely on during async work
    const planSnap = editingPlan;
    const userId = currentUser.uid;
    const dateISO = planSnap.date;

    // Start from the latest we have *right now*
    const existing = [...(planSnap.attachments ?? [])];

    // Storage base path (yyyy/MM buckets)
    const basePath = `lessonplan_attachments/${userId}/${format(
      parseISO(dateISO),
      "yyyy/MM"
    )}`;

    // Upload everything in parallel, produce Attachment objects
    const uploaded: Attachment[] = await Promise.all(
      files.map(async (file) => {
        const storagePath = `${basePath}/${crypto.randomUUID()}_${file.name}`;
        const sref = storageRef(storage, storagePath);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);
        return {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          storagePath,
          url,
        } as Attachment;
      })
    );

    // Merge + de-dup by storagePath (defensive)
    const byPath = new Map<string, Attachment>();
    for (const a of [...existing, ...uploaded]) byPath.set(a.storagePath, a);
    const nextAttachments = Array.from(byPath.values());

    // Ensure we have a document id
    const finalId =
      planSnap.id ||
      `${planSnap.teacherId}__${planSnap.schoolYearId}__${
        planSnap.periodId || uid()
      }__${dateISO}`;

    // Persist once with the *full* new array
    await setDoc(
      doc(db, "lessonPlans", finalId),
      clean({
        attachments: nextAttachments,
        meta: {
          ...(planSnap.meta || {}),
          updatedAt: new Date(),
          ...(planSnap.meta?.createdAt ? {} : { createdAt: new Date() }),
        },
      }),
      { merge: true }
    );

    // Reflect in modal state (functional update to avoid stale merges)
    setEditingPlan((prev) => {
      if (!prev) return prev;
      // merge again in case something else updated between await points
      const mergeMap = new Map<string, Attachment>();
      for (const a of [...(prev.attachments ?? []), ...nextAttachments])
        mergeMap.set(a.storagePath, a);
      return {
        ...prev,
        id: finalId,
        attachments: Array.from(mergeMap.values()),
        meta: {
          ...(prev.meta || {}),
          updatedAt: new Date(),
          ...(prev.meta?.createdAt ? {} : { createdAt: new Date() }),
        },
      };
    });

    // Reflect in calendar state
    setPlans((prev) => {
      const mergeMap = new Map<string, Attachment>();
      // find current plan in list (if present)
      const updated = prev.map((pl) => {
        if (pl.id !== finalId) return pl;
        for (const a of [...(pl.attachments ?? []), ...nextAttachments])
          mergeMap.set(a.storagePath, a);
        return {
          ...pl,
          attachments: Array.from(mergeMap.values()),
          meta: {
            ...(pl.meta || {}),
            updatedAt: new Date(),
            ...(pl.meta?.createdAt ? {} : { createdAt: new Date() }),
          },
        };
      });
      // If plan wasn’t in prev (new draft), add it
      if (!updated.some((p) => p.id === finalId)) {
        updated.push({
          ...planSnap,
          id: finalId,
          attachments: nextAttachments,
          meta: {
            ...(planSnap.meta || {}),
            updatedAt: new Date(),
            ...(planSnap.meta?.createdAt ? {} : { createdAt: new Date() }),
          },
        });
      }
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });

    // Clear the input so the same files can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---------- Context menu (copy/paste/bump/cascade) ----------
  function onCellContext(e: React.MouseEvent, date: string, plan?: LessonPlan) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, date, plan });
  }

  function copyBlock(plan?: LessonPlan) {
    if (!plan) {
      toast({ title: "Nothing to copy here.", variant: "destructive" });
      return;
    }
    setClipboard({ block: [plan] });
    toast({ title: "Copied plan." });
  }

  /** PASTE a copied plan onto a date */
  async function pasteAt(date: string) {
    if (!clipboard?.block?.length || !currentUser || !selectedYearId) return;

    const src = clipboard.block[0];
    const newPid = src.periodId || uid();

    const base = baseIdOf(currentUser.uid, selectedYearId, newPid, date);
    const id = makeUniqueId(base, plans); // <- ensure uniqueness

    const { id: _drop, ...rest } = src;

    const payload: LessonPlan = {
      ...rest,
      teacherId: currentUser.uid,
      schoolYearId: selectedYearId,
      periodId: newPid,
      date,
      meta: { createdAt: new Date(), updatedAt: new Date() },
    };

    await setDoc(doc(db, "lessonPlans", id), clean(payload), { merge: true });

    setPlans((prev) =>
      [...prev, { ...payload, id }].sort((a, b) => a.date.localeCompare(b.date))
    );

    toast({ title: "Pasted plan." });
  }

  // Replace the whole shift(...) function with this
  async function shift(
    plan: LessonPlan,
    dir: 1 | -1,
    count: number
  ): Promise<LessonPlan[]> {
    if (!currentUser || !selectedYearId || !plan?.id) return [];

    const computeShiftedDate = (baseISO: string, step: number) => {
      const t = addDays(parseISO(baseISO), dir * step); // literal calendar days
      return iso(t);
    };

    const toChange: LessonPlan[] = [];

    if (cascadeShift && plan.periodId) {
      const samePeriodPlans = plans
        .filter(
          (p) =>
            p.schoolYearId === selectedYearId &&
            p.periodId === plan.periodId &&
            (p.date === plan.date ||
              isAfter(parseISO(p.date), parseISO(plan.date)))
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      for (const p of samePeriodPlans) {
        const newDate = computeShiftedDate(p.date, count);
        toChange.push({ ...p, date: newDate });
      }
    } else {
      const newDate = computeShiftedDate(plan.date, count);
      toChange.push({ ...plan, date: newDate });
    }

    const batch = writeBatch(db);
    const changed: LessonPlan[] = [];
    for (const p of toChange) {
      const base = baseIdOf(
        currentUser.uid,
        selectedYearId,
        p.periodId || uid(),
        p.date
      );
      const dstId = makeUniqueId(base, plans);

      const dstRef = doc(db, "lessonPlans", dstId);
      const srcRef = p.id ? doc(db, "lessonPlans", p.id) : null;

      const { id: _omit, ...rest } = p;
      const payload: LessonPlan = {
        ...rest,
        meta: {
          ...(p.meta || {}),
          shiftedFromDate: p.meta?.shiftedFromDate || p.date,
          updatedAt: new Date(),
        },
      };
      batch.set(dstRef, clean(payload), { merge: true });
      if (srcRef) batch.delete(srcRef);
      changed.push({ ...payload, id: dstId });
    }
    await batch.commit();

    setPlans((prev) => {
      const next = prev.filter((p) => !toChange.find((c) => c.id === p.id));
      next.push(...changed);
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });

    toast({
      title: `Shifted ${toChange.length} plan${
        toChange.length > 1 ? "s" : ""
      } ${dir === 1 ? "forward" : "backward"} by ${count} day${
        count > 1 ? "s" : ""
      }`,
    });

    return changed;
  }

  /** BUMP every plan on a given date by N business days (unchanged) */
  async function bumpDate(date: string, dir: 1 | -1, count: number) {
    if (!currentUser || !selectedYearId) return;
    const items = (plansByDate.get(date) || []).filter((p) => !!p.id);
    if (!items.length) {
      toast({
        title: "No plans on this date to move.",
        variant: "destructive",
      });
      return;
    }

    const batch = writeBatch(db);
    const changed: LessonPlan[] = [];

    for (const plan of items) {
      // compute new target date (skip weekends)
      const target = addDays(parseISO(plan.date), dir * count);
      const newDate = iso(target);

      const base = baseIdOf(
        currentUser.uid,
        selectedYearId,
        plan.periodId || uid(),
        newDate
      );
      const dstId = makeUniqueId(base, plans);

      const dstRef = doc(db, "lessonPlans", dstId);
      const srcRef = doc(db, "lessonPlans", plan.id!);

      const { id: _omit, ...rest } = plan;

      const payload: LessonPlan = {
        ...rest,
        date: newDate,
        meta: {
          ...(plan.meta || {}),
          shiftedFromDate: plan.date,
          updatedAt: new Date(),
        },
      };

      batch.set(dstRef, clean(payload), { merge: true });
      batch.delete(srcRef);
      changed.push({ ...payload, id: dstId });
    }

    await batch.commit();

    // reflect in UI
    setPlans((prev) => {
      const keep = prev.filter((p) => p.date !== date);
      const next = [...keep, ...changed];
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });

    toast({
      title: `Moved ${items.length} plan${items.length > 1 ? "s" : ""} ${
        dir === 1 ? "forward" : "backward"
      } by ${count} day${count > 1 ? "s" : ""}.`,
    });
  }

  // Always give the modal a stable, non-null plan object
  const planSafe: LessonPlan = useMemo(() => {
    return (
      editingPlan ?? {
        id: "__draft__",
        teacherId: currentUser?.uid ?? "",
        schoolYearId: selectedYearId || "",
        periodId: "",
        date: iso(cursor),
        attachments: [],
        meta: {},
      }
    );
  }, [editingPlan, currentUser, selectedYearId, cursor]);

  // Always give the modal a stable period shape (even if not found)
  const periodForModal = useMemo(() => {
    const pid = editingPlan?.periodId ?? "";
    const p = periods.find((x) => x.id === pid);
    if (!p) {
      return { id: "", name: "Class Period", studentCount: 0 };
    }
    const raw =
      (p as any).totalStudents ??
      (p as any).studentCount ??
      (p as any).studentsCount ??
      (p as any).count;
    const n = Number(raw);
    return {
      id: p.id,
      name: p.name,
      startTime: undefined,
      endTime: undefined,
      studentCount: Number.isFinite(n) ? n : 0,
      colorBg: p.colorBg,
      colorText: p.colorText,
      grade: undefined,
    };
  }, [periods, editingPlan?.periodId]);

  // close floating menu only when the event is *outside* the menu
  useEffect(() => {
    if (!menu) return;

    const isInsideMenu = (target: EventTarget | null) =>
      target instanceof Node &&
      !!menuRef.current &&
      menuRef.current.contains(target);

    const onDocClick = (e: MouseEvent) => {
      if (isInsideMenu(e.target)) return;
      setMenu(null);
    };

    const onDocContextMenu = (e: MouseEvent) => {
      if (isInsideMenu(e.target)) return;
      setMenu(null);
    };

    const onScroll = (e: Event) => {
      if (isInsideMenu(e.target)) return;
      setMenu(null);
    };

    // use capture phase so we run early, but still respect inside checks
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("contextmenu", onDocContextMenu, true);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("contextmenu", onDocContextMenu, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  // ---------- Year copy (period → new year M–F alignment) ----------
  async function copyPeriodFromYearToCurrent() {
    if (!currentUser || !selectedYearId || !copyFromYearId || !copyFromPeriodId)
      return;

    const targetYear = years.find((y) => y.id === selectedYearId);
    if (!targetYear) {
      toast({
        title: "Select a target school year first.",
        variant: "destructive",
      });
      return;
    }

    // Load all plans for source year + chosen period
    const qSrc = query(
      collection(db, "lessonPlans"),
      where("teacherId", "==", currentUser.uid),
      where("schoolYearId", "==", copyFromYearId),
      where("periodId", "==", copyFromPeriodId)
    );
    const srcSnap = await getDocs(qSrc);
    let srcPlans: LessonPlan[] = [];
    srcSnap.forEach((d) => srcPlans.push({ id: d.id, ...(d.data() as any) }));
    srcPlans.sort((a, b) => a.date.localeCompare(b.date));

    if (!srcPlans.length) {
      toast({ title: "No plans found for that period in the chosen year." });
      return;
    }

    // Compute the target dates starting from targetYear.startDate
    const batch = writeBatch(db);
    const written: LessonPlan[] = [];
    srcPlans.forEach((src) => {
      // Keep same month/day; change only the year to the target year's
      const targetYearNumber = parseISO(targetYear.startDate).getFullYear();
      const srcDate = parseISO(src.date);
      let dstDate = iso(
        new Date(targetYearNumber, srcDate.getMonth(), srcDate.getDate())
      );

      // If destination lands on Sat/Sun, push to next business day (Mon–Fri)
      if (!onlyMF(parseISO(dstDate))) {
        dstDate = iso(nextBusinessDay(parseISO(dstDate), +1));
      }

      // Ensure unique ids (avoids React key collisions if duplicates land on same day/period)
      const base = `${currentUser.uid}__${selectedYearId}__${
        src.periodId || uid()
      }__${dstDate}`;
      const existing = [...plans, ...written];
      const dstId = makeUniqueId(base, existing);

      const dstRef = doc(db, "lessonPlans", dstId);

      // Resolve the period's name from the *source* year's periods, so it survives even if
      // the target year doesn't have the same period id
      const srcPeriod = copyFromYearPeriods.find((p) => p.id === src.periodId);

      // Light copy; keep plan content and colors
      const { id: _drop, schoolYearId: _oldYear, meta: _m, ...rest } = src;
      const payload: LessonPlan = {
        ...rest,
        schoolYearId: selectedYearId,
        date: dstDate,
        // add periodName so UI can display it even if periodMap misses
        periodName: srcPeriod?.name,
        meta: { createdAt: new Date(), updatedAt: new Date() },
      };

      batch.set(dstRef, clean(payload), { merge: true });
      written.push({ ...payload, id: dstId });
    });

    await batch.commit();

    // reflect if the copied range intersects the current visible range
    setPlans((prev) => {
      const within = written.filter((p) =>
        isWithinInterval(parseISO(p.date), {
          start: parseISO(iso(rangeStart)),
          end: parseISO(iso(rangeEnd)),
        })
      );
      if (!within.length) return prev;
      const next = [...prev, ...within];
      next.sort((a, b) => a.date.localeCompare(b.date));
      return next;
    });

    toast({ title: `Copied ${srcPlans.length} plans into current year.` });
    setCopyDialogOpen(false);
  }

  // ---------- Header bar ----------
  const headerBar = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            setCursor(
              view === "month" ? subMonths(cursor, 1) : addDays(cursor, -7)
            )
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            setCursor(
              view === "month" ? addMonths(cursor, 1) : addDays(cursor, 7)
            )
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          onClick={() => setCursor(startOfDay(new Date()))}
        >
          Today
        </Button>
        <div className="font-semibold text-lg flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          {view === "month" && format(cursor, "MMMM yyyy")}
          {view === "week" &&
            `${format(
              startOfWeek(cursor, { weekStartsOn: 1 }),
              "MMM d"
            )} – ${format(
              endOfWeek(cursor, { weekStartsOn: 1 }),
              "MMM d, yyyy"
            )}`}
          {view === "day" && format(cursor, "EEEE, MMM d, yyyy")}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* School Year (required) */}
        <Select value={selectedYearId} onValueChange={setSelectedYearId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select School Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View switch */}
        <Select value={view} onValueChange={(v: any) => setView(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="day">Day</SelectItem>
          </SelectContent>
        </Select>

        {/* Theme toggle */}
        <Button variant="outline" onClick={toggleTheme}>
          {prefs.theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 mr-2" /> Light
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 mr-2" /> Dark
            </>
          )}
        </Button>

        {/* Print */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Printer className="h-4 w-4 mr-2" /> Print {view}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Include periods (optional)
            </div>
            <DropdownMenuSeparator />
            {periods.length ? (
              periods.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={printPeriodFilter.includes(p.id)}
                  onCheckedChange={(ck) => {
                    setPrintPeriodFilter((prev) =>
                      ck ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                    );
                  }}
                >
                  {p.name}
                  {typeof p.totalStudents === "number"
                    ? ` · ${p.totalStudents}`
                    : ""}
                </DropdownMenuCheckboxItem>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No periods
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setPrintOpen(true);
                setTimeout(() => {
                  window.print();
                  setPrintOpen(false);
                }, 100);
              }}
            >
              Print now
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copy Year */}
        <Button variant="outline" onClick={() => setCopyDialogOpen(true)}>
          Copy Year (Period)
        </Button>
      </div>
    </div>
  );

  // ---------- Cells ----------
  function renderCell(d: Date) {
    const dateStr = iso(d);
    const inMonth = isSameMonth(d, cursor);
    const isToday = isSameDay(d, today);
    const dayPlans = plansByDate.get(dateStr) || [];

    return (
      <div
        key={dateStr}
        className={cn(
          "border p-2 min-h-[140px] relative group",
          !inMonth && "bg-muted/30",
          isToday && "ring-2 ring-primary"
        )}
        onContextMenu={(e) => onCellContext(e, dateStr)}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium opacity-70">{format(d, "d")}</div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Add plan"
              onClick={() => openQuickCreate(dateStr)}
            >
              <Plus className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  More options…
                </div>
                <DropdownMenuSeparator />
                {/* Cascade toggle applies when a plan context is open */}
                <DropdownMenuCheckboxItem
                  checked={cascadeShift}
                  onCheckedChange={(v) => setCascadeShift(!!v)}
                  disabled={!menu?.plan}
                >
                  Cascade future (same period)
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {dayPlans.length ? (
            dayPlans.map((plan) => {
              // Apply live preview colors when editing this plan in the quick modal
              const previewHit =
                colorPreview && colorPreview.planId === plan.id
                  ? colorPreview
                  : null;

              const period = periodMap.get(plan.periodId);
              const bg =
                previewHit?.colorBg ??
                plan.colorBg ??
                period?.colorBg ??
                "#e6f0ff";
              const tx =
                previewHit?.colorText ??
                plan.colorText ??
                period?.colorText ??
                "#1e3a8a";

              const headerPieces: string[] = [];
              const resolvedPeriodName = period?.name ?? plan.periodName;
              if (resolvedPeriodName) headerPieces.push(resolvedPeriodName);
              if (typeof period?.totalStudents === "number")
                headerPieces.push(`${period.totalStudents} students`);

              return (
                <div
                  key={plan.id}
                  onDoubleClick={() => openEditor(plan)}
                  onClick={() => openEditor(plan)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // prevent parent cell from overwriting
                    onCellContext(e, dateStr, plan);
                  }}
                  className="rounded-md overflow-hidden border cursor-pointer bg-card text-card-foreground border-border"
                >
                  {/* Plan header */}
                  <div
                    className="px-2 py-1 text-xs font-semibold flex items-center justify-between"
                    style={{ background: bg, color: tx }}
                  >
                    <span className="truncate">
                      {headerPieces.length
                        ? headerPieces.join(" • ") + " — "
                        : ""}
                      {plan.name || "Untitled"}
                      {plan.startTime && plan.endTime
                        ? ` · ${plan.startTime}–${plan.endTime}`
                        : ""}
                    </span>
                  </div>

                  {/* Body: show non-empty sections */}
                  <div className="p-2 space-y-1 text-xs">
                    {plan.topic && <Line label="Topic" value={plan.topic} />}
                    {plan.objective && (
                      <Line label="Objective" value={plan.objective} />
                    )}
                    {plan.resources && (
                      <Line label="Resources" value={plan.resources} />
                    )}
                    {plan.assignments && (
                      <Line label="Assignments" value={plan.assignments} />
                    )}
                    {plan.homework && (
                      <Line label="Homework" value={plan.homework} />
                    )}
                    {plan.notes && <Line label="Notes" value={plan.notes} />}
                    {plan.standards && (
                      <Line label="Standards" value={plan.standards} />
                    )}

                    {!!plan.attachments?.length && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {plan.attachments!.map((a) => (
                          <a
                            key={a.storagePath}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline text-primary hover:text-primary/80"
                            title={a.name}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">
                              {a.name}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    {!plan.topic &&
                      !plan.objective &&
                      !plan.resources &&
                      !plan.assignments &&
                      !plan.homework &&
                      !plan.notes &&
                      !plan.standards &&
                      !plan.attachments?.length && (
                        <div className="text-muted-foreground italic">
                          Click to add details…
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground italic">
              Click + to add a plan…
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* === START: Non-print content is hidden during print to avoid blank pages === */}
      <div className="print:hidden">
        <Toaster />

        {/* Header / Controls */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle>Lesson Plan Calendar</CardTitle>
          </CardHeader>
          <CardContent>{headerBar}</CardContent>
        </Card>

        {/* Grid */}
        <div
          className={cn(
            "grid grid-cols-5 gap-px bg-border print:bg-transparent"
          )}
        >
          {/* Weekday header */}
          {weekdays.map((w) => (
            <div
              key={w}
              className="bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent"
            >
              {w}
            </div>
          ))}
          {/* Days */}
          {gridDates.map((d) => renderCell(d))}
        </div>

        {/* Floating Right-click Context Menu */}
        {menu && (
          <div
            ref={menuRef}
            className="fixed z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md"
            style={{ left: menu.x, top: menu.y }}
          >
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {menu.date}
              {menu.plan ? ` · ${menu.plan.name || "Untitled"}` : ""}
            </div>

            <div className="py-1">
              {/* Edit (plan only) */}
              {menu.plan && (
                <button
                  className="w-full px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => {
                    setQuickDate(menu.date);
                    setQuickEditPlan(menu.plan!); // open in edit mode
                    setQuickPeriodId(menu.plan!.periodId || null);
                    // initialize preview with current colors
                    setColorPreview({
                      planId: menu.plan!.id!,
                      colorBg: menu.plan!.colorBg,
                      colorText: menu.plan!.colorText,
                    });
                    setQuickOpen(true);
                    setMenu(null);
                  }}
                >
                  Edit
                </button>
              )}

              {/* Copy (plan only) */}
              {menu.plan && (
                <button
                  className="w-full px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => {
                    copyBlock(menu.plan!);
                    setMenu(null);
                  }}
                >
                  Copy
                </button>
              )}

              {/* Paste (available for date or plan) */}
              <button
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-muted/40",
                  !clipboard?.block?.length && "opacity-50 cursor-not-allowed"
                )}
                disabled={!clipboard?.block?.length}
                onClick={() => {
                  if (!clipboard?.block?.length) return;
                  pasteAt(menu.date);
                  setMenu(null);
                }}
              >
                Paste
              </button>

              {/* ---- Bump Forward ---- */}
              <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                Push Forward
                {!menu.plan && " (all plans on this date)"}
              </div>
              <div className="px-3 pb-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={shiftCountForward}
                  onChange={(e) =>
                    setShiftCountForward(
                      Math.max(1, Number(e.target.value || 1))
                    )
                  }
                  className="w-16 h-8 rounded border bg-background px-2 text-sm"
                />
                <button
                  className="ml-auto rounded px-2 py-1 text-sm border hover:bg-muted/40"
                  onClick={async () => {
                    if (menu.plan) {
                      // shift one plan forward; get its new version back
                      const moved = await shift(
                        menu.plan!,
                        +1,
                        shiftCountForward
                      );
                      // If not cascading, retarget to the moved plan so next Apply hits the new one
                      if (!cascadeShift && moved[0]) {
                        setMenu({
                          ...menu,
                          date: moved[0].date,
                          plan: moved[0],
                        });
                      }
                    } else {
                      // bump whole day forward; retarget the menu to the new date
                      const newDate = iso(
                        addDays(parseISO(menu.date), +1 * shiftCountForward)
                      );
                      await bumpDate(menu.date, +1, shiftCountForward);
                      setMenu({ ...menu, date: newDate });
                    }
                    // Reset counts after applying
                    setShiftCountForward(1);
                    setShiftCountBackward(1);
                  }}
                >
                  Apply
                </button>
              </div>

              {/* ---- Bump Backward ---- */}
              <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                Push Backward
                {!menu.plan && " (all plans on this date)"}
              </div>
              <div className="px-3 pb-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={shiftCountBackward}
                  onChange={(e) =>
                    setShiftCountBackward(
                      Math.max(1, Number(e.target.value || 1))
                    )
                  }
                  className="w-16 h-8 rounded border bg-background px-2 text-sm"
                />
                <button
                  className="ml-auto rounded px-2 py-1 text-sm border hover:bg-muted/40"
                  onClick={async () => {
                    if (menu.plan) {
                      const moved = await shift(
                        menu.plan!,
                        -1,
                        shiftCountBackward
                      );
                      if (!cascadeShift && moved[0]) {
                        setMenu({
                          ...menu,
                          date: moved[0].date,
                          plan: moved[0],
                        });
                      }
                    } else {
                      const newDate = iso(
                        addDays(parseISO(menu.date), -1 * shiftCountBackward)
                      );
                      await bumpDate(menu.date, -1, shiftCountBackward);
                      setMenu({ ...menu, date: newDate });
                    }
                    setShiftCountForward(1);
                    setShiftCountBackward(1);
                  }}
                >
                  Apply
                </button>
              </div>

              {/* ---- Cascade toggle (visible when a plan is selected) ---- */}
              <div className="px-3 pt-2 pb-2 text-xs flex items-center gap-2">
                <input
                  id="cascadeToggle"
                  type="checkbox"
                  className="h-3 w-3"
                  checked={!!cascadeShift}
                  onChange={(e) => setCascadeShift(e.target.checked)}
                  disabled={!menu.plan}
                />
                <label htmlFor="cascadeToggle">
                  Cascade future (same period)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Quick Create / Edit Modal */}
        <QuickPlanModal
          open={quickOpen}
          onOpenChange={(v) => {
            if (!v) {
              setQuickEditPlan(null);
              setColorPreview(null);
              setQuickIsEvent(false); // reset mode on close
            }
            setQuickOpen(v);
          }}
          initialDate={quickDate}
          onCreate={quickIsEvent ? createQuickEvent : createQuickPlan}
          editPlan={quickEditPlan || undefined}
          onUpdate={updateQuickPlan}
          onPreviewColors={(v) => {
            if (!quickEditPlan?.id || !v) {
              setColorPreview(null);
            } else {
              setColorPreview({ planId: quickEditPlan.id, ...v });
            }
          }}
          // In Event mode, hide period dropdown by giving an empty list + null selection
          periods={quickIsEvent ? [] : periods}
          selectedPeriodId={quickIsEvent ? null : quickPeriodId}
          onChangePeriodId={setQuickPeriodId}
          // NEW: mode wiring
          isEventMode={quickIsEvent}
          onRequestEvent={() => {
            setQuickIsEvent(true);
            setQuickPeriodId(null); // ensure no period in Event mode
          }}
          onRequestPlan={() => {
            setQuickIsEvent(false);
            // restore a default period when switching back to Plan mode
            if (!quickPeriodId && periods[0]) setQuickPeriodId(periods[0].id);
          }}
        />

        {/* Full Editor */}
        <LessonPlanModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          plan={planSafe}
          period={
            editingPlan
              ? (() => {
                  const p = periods.find((x) => x.id === editingPlan.periodId);

                  // coerce to a number safely
                  const raw =
                    (p as any)?.totalStudents ??
                    (p as any)?.studentCount ??
                    (p as any)?.studentsCount ??
                    (p as any)?.count;
                  const studentCount = Number.isFinite(Number(raw))
                    ? Number(raw)
                    : 0;

                  return {
                    id: p?.id ?? (editingPlan.periodId || ""),
                    // ⬇️ key line: use plan.periodName if no matching period in target year
                    name: p?.name ?? editingPlan.periodName ?? "Class Period",
                    startTime: undefined,
                    endTime: undefined,
                    studentCount,
                    colorBg: p?.colorBg,
                    colorText: p?.colorText,
                    grade: undefined,
                  };
                })()
              : { id: "", name: "Class Period", studentCount: 0 }
          }
          onChangePlan={setEditingPlan}
          onSave={savePlan}
          onUploadAttachment={handleUploadAttachment}
          onDeleteAttachment={deleteAttachment}
          saving={editorLoading}
        />
      </div>
      {/* === END: Non-print content hidden during print === */}

      {/* Print container */}
      {printOpen && (
        <div
          className="hidden print:block absolute inset-0 bg-white p-6"
          ref={printRef}
        >
          {/* PRINT: only days that have at least one non-empty plan; now filtered by selected periods if any */}
          <div className="space-y-3">
            {gridDates.map((d) => {
              const dateStr = iso(d);
              let dayPlans = (plansByDate.get(dateStr) || []) as LessonPlan[];

              if (printPeriodFilter.length) {
                dayPlans = dayPlans.filter((p) =>
                  printPeriodFilter.includes(p.periodId)
                );
              }

              // a plan is "printable" if it has any real content:
              const printable = dayPlans.filter((plan) => {
                const name = (plan.name ?? "").trim();
                const nameIsMeaningful =
                  !!name && name.toLowerCase() !== "untitled";
                const hasTimes = !!(plan.startTime || plan.endTime);
                const hasAttachments = (plan.attachments?.length ?? 0) > 0;
                const hasTextSections = [
                  plan.topic,
                  plan.objective,
                  plan.resources,
                  plan.assignments,
                  plan.homework,
                  plan.notes,
                  plan.standards,
                ].some((v) => !!v && !!v.trim());

                return (
                  nameIsMeaningful ||
                  hasTimes ||
                  hasAttachments ||
                  hasTextSections
                );
              });

              if (printable.length === 0) return null;

              return (
                <div key={dateStr} className="break-inside-avoid">
                  <h2 className="font-semibold">{format(d, "EEEE, MMM d")}</h2>

                  <div className="grid md:grid-cols-2 gap-2">
                    {printable.map((plan) => {
                      const period = periodMap.get(plan.periodId);
                      const bg = plan.colorBg || period?.colorBg || "#e6f0ff";
                      const tx =
                        plan.colorText || period?.colorText || "#1e3a8a";
                      const headerPieces: string[] = [];
                      const resolvedPeriodName =
                        period?.name ?? plan.periodName;
                      if (resolvedPeriodName)
                        headerPieces.push(resolvedPeriodName);
                      if (typeof period?.totalStudents === "number")
                        headerPieces.push(`${period.totalStudents} students`);

                      return (
                        <div key={plan.id} className="border rounded">
                          {/* header strip uses per-plan -> period colors */}
                          <div
                            className="px-2 py-1 text-sm font-semibold"
                            style={{
                              background: bg,
                              color: tx,
                            }}
                          >
                            {headerPieces.length
                              ? headerPieces.join(" • ") + " — "
                              : ""}
                            {(plan.name && plan.name.trim()) || "Untitled"}
                            {plan.startTime && plan.endTime
                              ? ` · ${plan.startTime}–${plan.endTime}`
                              : plan.startTime
                              ? ` · ${plan.startTime}`
                              : plan.endTime
                              ? ` · –${plan.endTime}`
                              : ""}
                          </div>

                          {/* body shows only present sections */}
                          <div className="p-2 text-sm space-y-1">
                            {plan.topic && (
                              <Line label="Topic" value={plan.topic} />
                            )}
                            {plan.objective && (
                              <Line label="Objective" value={plan.objective} />
                            )}
                            {plan.resources && (
                              <Line label="Resources" value={plan.resources} />
                            )}
                            {plan.assignments && (
                              <Line
                                label="Assignments"
                                value={plan.assignments}
                              />
                            )}
                            {plan.homework && (
                              <Line label="Homework" value={plan.homework} />
                            )}
                            {plan.notes && (
                              <Line label="Notes" value={plan.notes} />
                            )}
                            {plan.standards && (
                              <Line label="Standards" value={plan.standards} />
                            )}
                            {!!plan.attachments?.length && (
                              <div className="mt-1">
                                {plan.attachments.map((a) => (
                                  <div key={a.storagePath} className="truncate">
                                    • {a.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Copy Year Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Period’s Year Schedule</DialogTitle>
            <DialogDescription>
              Copy from a previous school year into the currently selected year,
              aligned to the new start date (Mon–Fri only).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>From School Year</Label>
              <Select value={copyFromYearId} onValueChange={setCopyFromYearId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a previous year" />
                </SelectTrigger>
                <SelectContent>
                  {years
                    .filter((y) => y.id !== selectedYearId)
                    .map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Period</Label>
              <Select
                value={copyFromPeriodId}
                onValueChange={setCopyFromPeriodId}
                disabled={!copyFromYearId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All Periods</SelectItem>
                  {copyFromYearPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {copyFromYearId && copyFromYearId !== selectedYearId && (
                <p className="text-[11px] text-muted-foreground">
                  Uses existing plans from that year; period id must match. (If
                  your periods differ by year, keep the same period id.)
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={copyPeriodFromYearToCurrent}
              disabled={!copyFromYearId || !copyFromPeriodId}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hide global header/logo/menu only in print */}
      <style jsx global>{`
        @media print {
          header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------- Subcomponents ----------------
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs leading-snug">
      <span className="font-medium">{label}:</span>{" "}
      <span className="whitespace-pre-wrap break-words align-top">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px]"
      />
    </div>
  );
}
