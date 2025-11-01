"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Loader2,
  Moon,
  Sun,
  Printer,
  MoreHorizontal,
  Plus,
  Paperclip,
} from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type LessonPlan = {
  id?: string;
  teacherId: string;
  schoolYearId: string;
  periodId: string; // "" means Event
  date: string; // YYYY-MM-DD
  periodName?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  topic?: string;
  objective?: string;
  resources?: string;
  assignments?: string;
  homework?: string;
  notes?: string;
  standards?: string;
  colorBg?: string;
  colorText?: string;
  attachments?: { name: string; url: string; storagePath: string }[];
  meta?: any;
};

type Period = {
  id: string;
  name: string;
  teacherId: string;
  schoolYearId: string;
  colorBg?: string;
  colorText?: string;
  totalStudents?: number;
};

type SchoolYear = {
  id: string;
  name: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
};

// ---------- Helpers ----------
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const EVENT_SENTINEL = "__EVENT__";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const onlyMF = (d: Date) => {
  const w = d.getDay(); // 0 Sun ... 6 Sat
  return w !== 0 && w !== 6;
};

function to12h(hhmm?: string) {
  if (!hhmm) return "";
  try {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return hhmm;
  }
}

// strip undefined for Firestore
function clean<T>(obj: T): T {
  const recur = (x: any): any =>
    Array.isArray(x)
      ? x.map(recur).filter((v) => v !== undefined)
      : x && typeof x === "object"
      ? Object.fromEntries(
          Object.entries(x)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, recur(v)])
        )
      : x;
  return recur(obj);
}

function ResourcesLine({ value }: { value: string }) {
  const trimmed = value.trim();
  const singleUrlRe = /^(https?:\/\/[^\s)]+)$/i;

  if (singleUrlRe.test(trimmed)) {
    const stop = (e: React.SyntheticEvent) => {
      e.stopPropagation();
    };
    return (
      <div className="text-xs leading-snug">
        <span className="font-medium">Resources:</span>{" "}
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary hover:text-primary/80 break-all"
          title={trimmed}
          onClick={stop}
          onMouseDown={stop}
          onDoubleClick={stop}
          onTouchStart={stop}
        >
          {trimmed}
        </a>
      </div>
    );
  }
  return <Line label="Resources" value={value} />;
}

const gradePrefixRE = /^\s*(?:1st|2nd|3rd|[4-9]th|1[0-2]th)\b\.?\s*/i;
function stripGradePrefix(s: string) {
  return s.replace(gradePrefixRE, "");
}
function Line({ label, value }: { label: string; value: string }) {
  if (label.toLowerCase() === "standards") {
    const items = (value || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(stripGradePrefix);
    return (
      <div className="text-xs leading-snug">
        <span className="font-medium">{label}:</span>{" "}
        {items.length ? (
          <div className="mt-0.5 whitespace-pre-wrap break-words">
            {items.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        ) : (
          <span className="whitespace-pre-wrap break-words align-top">
            {value}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="text-xs leading-snug">
      <span className="font-medium">{label}:</span>{" "}
      <span className="whitespace-pre-wrap break-words align-top">{value}</span>
    </div>
  );
}

// ---------- Main ----------
export default function ShareClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const ownerId = params.get("ownerId") || "";
  const schoolYearId = params.get("schoolYearId") || "";
  const defaultDate = params.get("date") || ""; // optional

  const [checkingGate, setCheckingGate] = React.useState(true);
  const [allowed, setAllowed] = React.useState(false);
  const [plans, setPlans] = React.useState<LessonPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(true);

  // NEW: share window read from planShares
  const [shareWindow, setShareWindow] = React.useState<{
    limitType?: "none" | "single" | "range";
    singleDate?: string | null;
    from?: string | null;
    to?: string | null;
  }>({});

  // Viewer prefs (theme + view to mirror Plans page UI)
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [view, setView] = React.useState<"month" | "week" | "day">("week");
  const [today] = React.useState<Date>(startOfDay(new Date()));
  const [cursor, setCursor] = React.useState<Date>(startOfDay(new Date()));

  // Print state
  const [printOpen, setPrintOpen] = React.useState(false);

  // For copying into viewer's calendar
  const [myYears, setMyYears] = React.useState<SchoolYear[]>([]);
  const [myPeriods, setMyPeriods] = React.useState<Period[]>([]);
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [copyPlan, setCopyPlan] = React.useState<LessonPlan | null>(null);
  const [copyYearId, setCopyYearId] = React.useState<string>("");
  const [copyPeriodId, setCopyPeriodId] = React.useState<string>(""); // "" means Event
  const [copyDate, setCopyDate] = React.useState<string>("");
  const [copySaving, setCopySaving] = React.useState(false);

  // ---------- Access gate ----------
  React.useEffect(() => {
    (async () => {
      try {
        if (!ownerId || !schoolYearId) {
          setAllowed(false);
          setCheckingGate(false);
          return;
        }
        // Must be signed-in with the email the owner granted
        if (!currentUser?.email) {
          setAllowed(false);
          setCheckingGate(false);
          return;
        }
        // Use exact case for email to match share doc ID and rules
        const exactEmail = currentUser.email;
        // Share entries: planShares/{ownerId}/{schoolYearId}/{exactEmail}
        const gateRef = doc(
          db,
          "planShares",
          ownerId,
          schoolYearId,
          exactEmail
        );
        const gateSnap = await getDoc(gateRef);
        if (gateSnap.exists()) {
          setAllowed(true);
          const data = gateSnap.data() as any;
          setShareWindow({
            limitType: data?.limitType ?? "none",
            singleDate: data?.singleDate ?? null,
            from: data?.from ?? null,
            to: data?.to ?? null,
          });
          // If the link has no ?date but the share is single-day, jump to that date
          if (
            !defaultDate &&
            data?.limitType === "single" &&
            data?.singleDate
          ) {
            setCursor(startOfDay(parseISO(data.singleDate)));
          }
        } else {
          setAllowed(false);
        }
      } catch {
        setAllowed(false);
      } finally {
        setCheckingGate(false);
      }
    })();
  }, [ownerId, schoolYearId, currentUser?.email, defaultDate]);

  // ---------- Load owner lesson plans (read-only view) ----------
  React.useEffect(() => {
    (async () => {
      if (!allowed) {
        setPlans([]);
        setLoadingPlans(false);
        return;
      }
      setLoadingPlans(true);
      try {
        const constraints: any[] = [
          where("teacherId", "==", ownerId),
          where("schoolYearId", "==", schoolYearId),
        ];

        if (shareWindow?.limitType === "single" && shareWindow.singleDate) {
          constraints.push(where("date", "==", shareWindow.singleDate));
        } else if (shareWindow?.limitType === "range") {
          // Open-ended range support to satisfy security rules:
          if (shareWindow.from && shareWindow.to) {
            constraints.push(where("date", ">=", shareWindow.from));
            constraints.push(where("date", "<=", shareWindow.to));
          } else if (shareWindow.from && !shareWindow.to) {
            constraints.push(where("date", ">=", shareWindow.from));
          } else if (!shareWindow.from && shareWindow.to) {
            constraints.push(where("date", "<=", shareWindow.to));
          }
        }

        const ql = query(collection(db, "lessonPlans"), ...constraints);
        const snap = await getDocs(ql);
        const collected: LessonPlan[] = [];
        snap.forEach((d) => collected.push({ id: d.id, ...(d.data() as any) }));
        collected.sort((a, b) =>
          a.date === b.date
            ? (a.periodId || "").localeCompare(b.periodId || "")
            : a.date.localeCompare(b.date)
        );
        setPlans(collected);
        // If defaultDate is provided, jump cursor to that week/day (nicety)
        if (defaultDate) setCursor(startOfDay(parseISO(defaultDate)));
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [allowed, ownerId, schoolYearId, shareWindow, defaultDate]);

  // ---------- Load viewer’s years/periods for copy dialog ----------
  React.useEffect(() => {
    (async () => {
      if (!currentUser?.uid) return;
      const qy = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser.uid)
      );
      const ys = await getDocs(qy);
      const arr: SchoolYear[] = [];
      ys.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
      setMyYears(arr);

      const active = arr.find((y) => y.isActive) || arr[0];
      if (active) {
        setCopyYearId(active.id);
        const qp = query(
          collection(db, "periods"),
          where("teacherId", "==", currentUser.uid),
          where("schoolYearId", "==", active.id)
        );
        const ps = await getDocs(qp);
        const parr: Period[] = [];
        ps.forEach((d) => parr.push({ id: d.id, ...(d.data() as any) }));
        parr.sort((a, b) => a.name.localeCompare(b.name));
        setMyPeriods(parr);
      }
    })();
  }, [currentUser?.uid]);

  React.useEffect(() => {
    (async () => {
      if (!currentUser?.uid || !copyYearId) return;
      const qp = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser.uid),
        where("schoolYearId", "==", copyYearId)
      );
      const ps = await getDocs(qp);
      const parr: Period[] = [];
      ps.forEach((d) => parr.push({ id: d.id, ...(d.data() as any) }));
      parr.sort((a, b) => a.name.localeCompare(b.name));
      setMyPeriods(parr);
      if (copyPeriodId && !parr.find((p) => p.id === copyPeriodId)) {
        setCopyPeriodId(""); // fall back to Event if previous selection not present
      }
    })();
  }, [currentUser?.uid, copyYearId]);

  // ---------- periodLabel MUST be defined before use ----------
  const periodLabel = React.useCallback(
    (periodId: string, fallback?: string) => {
      if (!periodId) return fallback || "Event";
      return fallback || "Class Period";
    },
    []
  );

  // ---------- Group plans by date ----------
  const plansByDate = React.useMemo(() => {
    const map = new Map<string, LessonPlan[]>();
    for (const p of plans) {
      const arr = map.get(p.date) || [];
      arr.push(p);
      map.set(p.date, arr);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const at = a.startTime || "";
        const bt = b.startTime || "";
        if (at !== bt) return at.localeCompare(bt);
        const an =
          (a.periodName || periodLabel(a.periodId) || "") + (a.name || "");
        const bn =
          (b.periodName || periodLabel(b.periodId) || "") + (b.name || "");
        return an.localeCompare(bn);
      });
      map.set(k, arr);
    }
    return map;
  }, [plans, periodLabel]);

  // ---------- View range like Plans page ----------
  const { rangeStart, rangeEnd, gridDates } = React.useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      const days: Date[] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
      return {
        rangeStart: start,
        rangeEnd: end,
        gridDates: days.filter(onlyMF),
      };
    }
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = endOfWeek(cursor, { weekStartsOn: 1 });
      const days: Date[] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
      return {
        rangeStart: start,
        rangeEnd: end,
        gridDates: days.filter(onlyMF),
      };
    }
    return { rangeStart: cursor, rangeEnd: cursor, gridDates: [cursor] };
  }, [cursor, view]);

  // ---------- Copy plan into viewer's calendar ----------
  async function copyIntoMyCalendar() {
    if (!currentUser?.uid || !copyPlan || !copyYearId) return;
    setCopySaving(true);
    try {
      const dstPeriodId = copyPeriodId || ""; // map sentinel to "" already via state
      const base = `${currentUser.uid}__${copyYearId}__${
        dstPeriodId || crypto.randomUUID()
      }__${copyDate || copyPlan.date}`;
      let finalId = base;
      const existing = await getDoc(doc(db, "lessonPlans", base));
      if (existing.exists()) finalId = `${base}__copy${Date.now()}`;

      const payload: LessonPlan = clean({
        teacherId: currentUser.uid,
        schoolYearId: copyYearId,
        periodId: dstPeriodId,
        date: copyDate || copyPlan.date,
        name: copyPlan.name || undefined,
        startTime: copyPlan.startTime || undefined,
        endTime: copyPlan.endTime || undefined,
        topic: copyPlan.topic || undefined,
        objective: copyPlan.objective || undefined,
        resources: copyPlan.resources || undefined,
        assignments: copyPlan.assignments || undefined,
        homework: copyPlan.homework || undefined,
        notes: copyPlan.notes || undefined,
        standards: copyPlan.standards || undefined,
        attachments: Array.isArray(copyPlan.attachments)
          ? copyPlan.attachments.map((a) => ({
              name: a.name,
              url: a.url,
              storagePath: a.storagePath,
            }))
          : [],
        colorBg: copyPlan.colorBg || undefined,
        colorText: copyPlan.colorText || undefined,
        meta: { createdAt: new Date(), updatedAt: new Date() },
      });

      await setDoc(doc(db, "lessonPlans", finalId), payload, { merge: true });

      toast({
        title: "Copied to your calendar",
        description: `${format(parseISO(payload.date), "MMM d, yyyy")} • ${
          dstPeriodId ? "Plan" : "Event"
        }`,
      });
      setCopyOpen(false);
      setCopyPlan(null);
      setCopyPeriodId("");
      setCopyDate("");
    } catch (err: any) {
      toast({
        title: "Could not copy",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setCopySaving(false);
    }
  }

  // ---------- Header bar (mirrors Plans page) ----------
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
        <Select
          value={view}
          onValueChange={(v: "month" | "week" | "day") => setView(v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="day">Day</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next);
            document.documentElement.classList.toggle("dark", next === "dark");
          }}
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 mr-2" /> Light
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 mr-2" /> Dark
            </>
          )}
        </Button>

        <Button
          onClick={() => {
            setPrintOpen(true);
            setTimeout(() => {
              window.print();
              setPrintOpen(false);
            }, 100);
          }}
        >
          <Printer className="h-4 w-4 mr-2" /> Print {view}
        </Button>
      </div>
    </div>
  );

  // ---------- Cell renderer (visually identical cards) ----------
  function renderCell(d: Date) {
    const dateStr = iso(d);
    const inMonth = isSameMonth(d, cursor);
    const isToday = isSameDay(d, today);
    const dayPlans = (plansByDate.get(dateStr) || []) as LessonPlan[];

    // Events first (periodId === "")
    const events = dayPlans.filter((pl) => !pl.periodId);
    const classPlans = dayPlans.filter((pl) => !!pl.periodId);

    return (
      <div
        key={dateStr}
        className={cn(
          "border p-2 min-h-[140px] relative group",
          !inMonth && "bg-muted/30",
          isToday && "ring-2 ring-primary"
        )}
      >
        {/* header with date + actions (read-only; only + to open copy dialog on empty space) */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium opacity-70">{format(d, "d")}</div>
          <div className="flex items-center gap-1">
            {/* Keep icons for symmetry; create is disabled (share is read-only) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled
              title="Read-only"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled
              title="Read-only"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {/* Events */}
          {events.map((plan) => (
            <PlanCard
              key={plan.id || `${plan.date}-evt-${plan.name}`}
              plan={plan}
            />
          ))}

          {/* Period-attached plans (no placeholders since we can’t read owner’s periods) */}
          {classPlans.map((plan) => (
            <PlanCard
              key={plan.id || `${plan.date}-${plan.periodId}-${plan.name}`}
              plan={plan}
            />
          ))}

          {events.length === 0 && classPlans.length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              No plans.
            </div>
          )}
        </div>
      </div>
    );
  }

  function PlanCard({ plan }: { plan: LessonPlan }) {
    const periodName = periodLabel(plan.periodId, plan.periodName);
    const headerPieces: string[] = [];
    if (periodName) headerPieces.push(periodName);
    if (plan.startTime && plan.endTime) {
      headerPieces.push(`${to12h(plan.startTime)}–${to12h(plan.endTime)}`);
    } else if (plan.startTime) {
      headerPieces.push(to12h(plan.startTime));
    } else if (plan.endTime) {
      headerPieces.push(`–${to12h(plan.endTime)}`);
    }

    const bg = plan.colorBg || "#e6f0ff";
    const tx = plan.colorText || "#1e3a8a";

    return (
      <div className="rounded-md overflow-hidden border bg-card text-card-foreground border-border">
        <div
          className="px-2 py-1 text-xs font-semibold"
          style={{ background: bg, color: tx }}
        >
          <span className="truncate">
            {headerPieces.join(" • ") || "Event"}
            {plan.name?.trim() ? ` — ${plan.name.trim()}` : ""}
          </span>
        </div>
        <div className="p-2 space-y-1 text-xs">
          {plan.topic && <Line label="Topic" value={plan.topic} />}
          {plan.objective && <Line label="Objective" value={plan.objective} />}
          {plan.resources && <ResourcesLine value={plan.resources} />}
          {plan.assignments && (
            <Line label="Assignments" value={plan.assignments} />
          )}
          {plan.homework && <Line label="Homework" value={plan.homework} />}
          {plan.notes && <Line label="Notes" value={plan.notes} />}
          {plan.standards && <Line label="Standards" value={plan.standards} />}
          {!!plan.attachments?.length && (
            <div className="flex flex-wrap gap-2 mt-1">
              {plan.attachments.map((a) => (
                <a
                  key={a.storagePath}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline text-primary hover:text-primary/80"
                  title={a.name}
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{a.name}</span>
                </a>
              ))}
            </div>
          )}

          {/* Copy button (unchanged) */}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={() => {
                setCopyPlan(plan);
                setCopyDate(plan.date);
                setCopyOpen(true);
              }}
            >
              <Clipboard className="h-4 w-4" />
              Copy to my calendar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Render ----------
  if (checkingGate) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking access…
      </div>
    );
  }

  if (!currentUser?.email) {
    return (
      <div className="p-6 text-sm">
        Please{" "}
        <button
          className="underline"
          onClick={() =>
            router.push(
              `/login?redirect=${encodeURIComponent(
                `/share?ownerId=${ownerId}&schoolYearId=${schoolYearId}`
              )}`
            )
          }
        >
          sign in
        </button>{" "}
        with the email that was granted access, then reload this page.
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="p-6 text-sm">
        Your email (<span className="font-mono">{currentUser.email}</span>)
        doesn't have access for this share link, or the link is invalid.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header card (like Plans page) */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Shared Lesson Plans (Read-only)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You’re viewing plans from <span className="font-mono">{ownerId}</span>{" "}
          • School Year <span className="font-mono">{schoolYearId}</span>. You
          can copy a plan into your own calendar.
        </CardContent>
      </Card>

      {/* Controls bar (identical to Plans page) */}
      <Card className="mb-4">
        <CardContent>{headerBar}</CardContent>
      </Card>

      {/* Grid header (Mon–Fri) */}
      <div
        className={cn("grid grid-cols-5 gap-px bg-border print:bg-transparent")}
      >
        {weekdays.map((w) => (
          <div
            key={w}
            className="bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent"
          >
            {w}
          </div>
        ))}
        {loadingPlans ? (
          <div className="col-span-5 p-6 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading plans…
          </div>
        ) : (
          gridDates.map((d) => renderCell(d))
        )}
      </div>

      {/* Copy dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="sm:max-w/[520px]">
          <DialogHeader>
            <DialogTitle>Copy plan to your calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>School Year</Label>
              <Select value={copyYearId} onValueChange={setCopyYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your school year" />
                </SelectTrigger>
                <SelectContent>
                  {myYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Period (choose “Copy as Event” for no period)</Label>
              <Select
                value={copyPeriodId ? copyPeriodId : EVENT_SENTINEL}
                onValueChange={(v) => {
                  if (v === EVENT_SENTINEL) setCopyPeriodId("");
                  else setCopyPeriodId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="(Optional) Select your period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVENT_SENTINEL}>
                    — Copy as Event —
                  </SelectItem>
                  {myPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={copyIntoMyCalendar}
              disabled={!copyYearId || !copyDate || copySaving}
            >
              {copySaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Copying…
                </>
              ) : (
                "Copy"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS tweaks to match Plans page */}
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
