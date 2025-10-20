"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { db } from "@/firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

/** ---------- Types ---------- */
type Period = {
  id: string;
  teacherId: string;
  schoolYearId: string;
  name: string;
  colorBg?: string;
  colorText?: string;
  totalStudents?: number;
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
  periodId: string; // "" => Event (we will IGNORE events to avoid rule hits)
  periodName?: string;
  date: string; // "yyyy-MM-dd"
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
  attachments?: Attachment[];
  colorBg?: string;
  colorText?: string;
};

type SchoolYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type StudentLogin = {
  periodId?: string;
  periodIds?: string[];
  periods?: Array<string | { id: string }>;
};

/** ---------- Helpers ---------- */
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const onlyMF = (d: Date) => ![0, 6].includes(d.getDay());

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs leading-snug">
      <span className="font-medium">{label}:</span>{" "}
      <span className="whitespace-pre-wrap break-words align-top">{value}</span>
    </div>
  );
}

// Normalize Firestore Timestamp or string to "yyyy-MM-dd"
const normalizePlanDate = (d: any) => {
  try {
    if (d && typeof d?.toDate === "function") {
      return format(d.toDate(), "yyyy-MM-dd");
    }
    if (typeof d === "string") return d;
  } catch {}
  return "";
};

/** ---------- Page ---------- */
export default function StudentPlansPage() {
  return (
    <ProtectedRoute>
      <StudentPlansBody />
    </ProtectedRoute>
  );
}

function StudentPlansBody() {
  const { currentUser } = useAuth();

  // view state
  const [today] = useState(startOfDay(new Date()));
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [view, setView] = useState<"month" | "week" | "day">("month");

  // data
  const [yearsFromPeriods, setYearsFromPeriods] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [allowedPeriodIds, setAllowedPeriodIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<LessonPlan[]>([]);

  // loading flags
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // helper: chunk an array into <=10 id chunks for Firestore 'in' queries
  const chunk10 = (ids: string[]) => {
    const out: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) out.push(ids.slice(i, i + 10));
    return out;
  };

  /** If a student is logged in and has a login doc, limit to their periods */
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser) {
          setAllowedPeriodIds([]);
          return;
        }
        const lref = doc(db, "studentLogins", currentUser.uid);
        const snap = await getDoc(lref).catch(() => null);
        if (!snap?.exists()) {
          // No assignment → keep empty; we’ll avoid broad reads
          setAllowedPeriodIds([]);
          return;
        }
        const ld = snap.data() as StudentLogin;
        const ids: string[] = (() => {
          if (Array.isArray(ld?.periods)) {
            if (ld.periods.length && typeof ld.periods[0] === "object") {
              return (ld.periods as any[]).map((p) => p?.id).filter(Boolean);
            }
            return (ld.periods as any[]).filter((x) => typeof x === "string");
          }
          if (Array.isArray(ld?.periodIds)) return ld.periodIds.filter(Boolean);
          if (ld?.periodId) return [ld.periodId];
          return [];
        })();
        setAllowedPeriodIds(ids);
      } catch (e) {
        console.error("Load studentLogin failed:", e);
        setAllowedPeriodIds([]);
      }
    })();
  }, [currentUser]);

  /** Build school year dropdown from allowed periods ONLY (no schoolYears reads) */
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser) {
          setYearsFromPeriods([]);
          setSelectedYearId("");
          return;
        }
        setLoadingYears(true);

        if (!allowedPeriodIds.length) {
          // No permission to read broadly; show empty and stop
          setYearsFromPeriods([]);
          setSelectedYearId("");
          return;
        }

        // Read only allowed periods (chunked)
        let periodDocs: Period[] = [];
        for (const ids of chunk10(allowedPeriodIds)) {
          const qy = query(
            collection(db, "periods"),
            where(documentId(), "in", ids)
          );
          const snap = await getDocs(qy);
          snap.forEach((d) =>
            periodDocs.push({ id: d.id, ...(d.data() as any) })
          );
        }

        // Derive year IDs from those periods; DO NOT read schoolYears (avoid rules)
        const yearIdSet = new Set(
          periodDocs.map((p) => p.schoolYearId).filter(Boolean)
        );
        const years = Array.from(yearIdSet).map((yid) => ({
          id: yid,
          name: yid, // fallback: show id if we can’t read schoolYears
          startDate: "",
          endDate: "",
        }));

        // Stable sort by id (string desc)
        years.sort((a, b) => String(b.id).localeCompare(String(a.id)));

        setYearsFromPeriods(years);

        // Keep previously selected if still present; else pick first
        setSelectedYearId(
          (prev) => years.find((y) => y.id === prev)?.id || years[0]?.id || ""
        );
      } catch (e) {
        console.error("Build years from allowed periods failed:", e);
        setYearsFromPeriods([]);
        setSelectedYearId("");
      } finally {
        setLoadingYears(false);
      }
    })();
  }, [currentUser, allowedPeriodIds]);

  /** Load periods for selected year (again ONLY from allowed ids) */
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser || !selectedYearId || !allowedPeriodIds.length) {
          setPeriods([]);
          return;
        }
        setLoadingPeriods(true);

        // Fetch only allowed periods (chunked), then filter by schoolYearId client-side
        let arr: Period[] = [];
        for (const ids of chunk10(allowedPeriodIds)) {
          const qy = query(
            collection(db, "periods"),
            where(documentId(), "in", ids)
          );
          const snap = await getDocs(qy);
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        }
        arr = arr.filter((p) => p.schoolYearId === selectedYearId);
        arr.sort((a, b) => a.name.localeCompare(b.name));
        setPeriods(arr);
      } catch (e) {
        console.error("Load periods (allowed only) failed:", e);
        setPeriods([]);
      } finally {
        setLoadingPeriods(false);
      }
    })();
  }, [currentUser, selectedYearId, allowedPeriodIds]);

  /** Visible range (Mon–Fri) */
  const { rangeStart, rangeEnd, gridDates } = useMemo(() => {
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

  /** Load plans ONLY for allowed periods in the selected year (ignore events) */
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser || !selectedYearId || !allowedPeriodIds.length) {
          setPlans([]);
          return;
        }
        setLoadingPlans(true);

        // We restrict reads to plans whose periodId is in allowedPeriodIds
        // (avoid periodId == "" events to prevent rule failures)
        const chunks = chunk10(allowedPeriodIds);
        let collected: LessonPlan[] = [];

        for (const ids of chunks) {
          const ql = query(
            collection(db, "lessonPlans"),
            where("schoolYearId", "==", selectedYearId),
            where("periodId", "in", ids)
          );
          const res = await getDocs(ql);
          res.forEach((docSnap) => {
            const raw = docSnap.data() as any;
            collected.push({
              id: docSnap.id,
              ...raw,
              date: normalizePlanDate(raw?.date),
              periodId: raw?.periodId || "", // will be in ids by query
              periodName: raw?.periodName,
            });
          });
        }

        const startISO = iso(rangeStart);
        const endISO = iso(rangeEnd);

        const filtered = collected.filter(
          (p) => p.date && p.date >= startISO && p.date <= endISO
        );
        filtered.sort((a, b) => a.date.localeCompare(b.date));
        setPlans(filtered);
      } catch (e) {
        console.error("Load plans (allowed only) failed:", e);
        setPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [currentUser, selectedYearId, rangeStart, rangeEnd, allowedPeriodIds]);

  /** Group plans by date */
  const periodMap = useMemo(() => {
    const m = new Map<string, Period>();
    periods.forEach((p) => m.set(p.id, p));
    return m;
  }, [periods]);

  const plansByDate = useMemo(() => {
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
          (periodMap.get(a.periodId)?.name || "") + (a.name || "Untitled");
        const bn =
          (periodMap.get(b.periodId)?.name || "") + (b.name || "Untitled");
        return an.localeCompare(bn);
      });
      map.set(k, arr);
    }
    return map;
  }, [plans, periodMap]);

  /** Header */
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
        {/* Year dropdown built from allowed periods (no schoolYears read) */}
        <Select
          value={selectedYearId}
          onValueChange={setSelectedYearId}
          disabled={loadingYears || yearsFromPeriods.length === 0}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue
              placeholder={
                loadingYears
                  ? "Loading years..."
                  : yearsFromPeriods.length
                  ? "Select school year"
                  : "No periods assigned"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {yearsFromPeriods.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name || y.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
      </div>
    </div>
  );

  /** Cell renderer */
  function renderCell(d: Date) {
    const dateStr = iso(d);
    const inMonth = isSameMonth(d, cursor);
    const isToday = isSameDay(d, today);
    const dayPlans = plansByDate.get(dateStr) || [];

    return (
      <div
        key={dateStr}
        className={cn(
          "border p-2 min-h-[140px] relative",
          !inMonth && "bg-muted/30",
          isToday && "ring-2 ring-primary"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium opacity-70">{format(d, "d")}</div>
        </div>

        <div className="mt-2 space-y-2">
          {dayPlans.length ? (
            dayPlans.map((plan) => {
              const period = periodMap.get(plan.periodId);
              const bg = plan.colorBg || period?.colorBg || "#e6f0ff";
              const tx = plan.colorText || period?.colorText || "#1e3a8a";

              const headerPieces: string[] = [];
              const resolvedPeriodName = period?.name ?? plan.periodName;
              if (resolvedPeriodName) headerPieces.push(resolvedPeriodName);
              if (typeof period?.totalStudents === "number")
                headerPieces.push(`${period.totalStudents} students`);

              return (
                <div
                  key={plan.id}
                  className="rounded-md overflow-hidden border bg-card text-card-foreground border-border"
                >
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
                      <div className="mt-1 text-xs">
                        {plan.attachments.map((a) => (
                          <div key={a.storagePath} className="truncate">
                            •{" "}
                            <a
                              className="underline text-primary hover:text-primary/80"
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              title={a.name}
                            >
                              {a.name}
                            </a>
                          </div>
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
                          No details.
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground italic">
              {loadingPlans ? "Loading plans..." : "No plans."}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent>{headerBar}</CardContent>
      </Card>

      {(loadingYears || loadingPeriods) && (
        <div className="text-sm text-muted-foreground mb-2">Loading data…</div>
      )}

      {!allowedPeriodIds.length && !loadingYears && (
        <div className="text-sm text-muted-foreground mb-4">
          No periods assigned to your account yet.
        </div>
      )}

      <div className={cn("grid grid-cols-5 gap-px bg-border")}>
        {weekdays.map((w) => (
          <div
            key={w}
            className="bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {gridDates.map((d) => (
          <React.Fragment key={iso(d)}>{renderCell(d)}</React.Fragment>
        ))}
      </div>
    </div>
  );
}
