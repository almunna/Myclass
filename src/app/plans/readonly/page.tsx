"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sun,
  Moon,
  Share2,
} from "lucide-react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";
import Link from "next/link";
import { db, auth } from "@/firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; // ✅ added

import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SchoolYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
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
  periodId: string; // required for student read
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
  attachments?: Attachment[];
  colorBg?: string;
  colorText?: string;
  meta?: { createdAt?: any; updatedAt?: any; shiftedFromDate?: string };
};
type UserPrefs = {
  theme?: "light" | "dark";
  defaultView?: "month" | "week" | "day";
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const onlyMF = (d: Date) => {
  const w = d.getDay();
  return w !== 0 && w !== 6;
};
const nsDocId = (teacherId: string, yearId: string) =>
  `${teacherId}__${yearId}`;

export default function PlansReadOnlyPage() {
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();

  // Let students in regardless of subscription
  const isStudent = !!auth.currentUser?.isAnonymous;

  if (subscriptionLoading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!isStudent && !hasAccess) {
    return (
      <ProtectedRoute>
        <NoAccess
          title="Lesson Plan Calendar (Read-only)"
          description="Viewing the calendar requires an active subscription."
        />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <ReadOnlyBody />
    </ProtectedRoute>
  );
}

function ReadOnlyBody() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // 🔑 student session (teacher scope + allowed periodIds)
  const [teacherId, setTeacherId] = useState<string>("");
  const [allowedPeriodIds, setAllowedPeriodIds] = useState<string[]>([]);

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

  // Non-school days
  const [nonSchoolDays, setNonSchoolDays] = useState<string[]>([]);
  const isNonSchool = (date: string) => nonSchoolDays.includes(date);

  // Plans
  const [plans, setPlans] = useState<LessonPlan[]>([]);

  // Prefs (theme only; still read-only)
  const [prefs, setPrefs] = useState<UserPrefs>({
    theme: "light",
    defaultView: "month",
  });

  // Print
  const printRef = useRef<HTMLDivElement>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printPeriodFilter, setPrintPeriodFilter] = useState<string[]>([]);

  // 1) Load student session (robust to anonymous logins)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setTeacherId("");
        setAllowedPeriodIds([]);
        return;
      }

      if (!u.isAnonymous) {
        setTeacherId(u.uid);
        setAllowedPeriodIds([]);
        return;
      }

      try {
        const sessSnap = await getDoc(doc(db, "studentSessions", u.uid));
        if (!sessSnap.exists()) {
          setTeacherId("");
          setAllowedPeriodIds([]);
          return;
        }
        const s = sessSnap.data() as {
          teacherId?: string;
          periodIds?: string[];
        };
        setTeacherId(s.teacherId || "");
        setAllowedPeriodIds(
          Array.isArray(s.periodIds) ? s.periodIds.slice(0, 30) : []
        );
      } catch {
        setTeacherId("");
        setAllowedPeriodIds([]);
      }
    });

    return () => unsub();
  }, []); // ✅ subscribe directly to Firebase Auth

  // 🚦 Guard: while a student is logged in but the session hasn’t loaded, don’t query
  const waitingOnStudentSession = !!auth.currentUser?.isAnonymous && !teacherId;

  // 2) Load prefs (by teacherId)
  useEffect(() => {
    if (!teacherId || waitingOnStudentSession) return;
    (async () => {
      try {
        const prefSnap = await getDoc(doc(db, "userPrefs", teacherId));
        if (prefSnap.exists()) {
          const p = prefSnap.data() as UserPrefs;
          setPrefs(p);
          if (p.defaultView) setView(p.defaultView);
          document.documentElement.classList.toggle("dark", p.theme === "dark");
        }
      } catch {
        // ignore
      }
    })();
  }, [teacherId, waitingOnStudentSession]);

  const toggleTheme = async () => {
    const next = prefs.theme === "dark" ? "light" : "dark";
    setPrefs((s) => ({ ...s, theme: next }));
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  // 3) Load school years (by teacherId)
  useEffect(() => {
    if (!teacherId || waitingOnStudentSession) return;

    (async () => {
      try {
        const qy = query(
          collection(db, "schoolYears"),
          where("teacherId", "==", teacherId)
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
      } catch (err) {
        console.error("schoolYears query failed:", err);
        setYears([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, selectedYearId, waitingOnStudentSession]);

  // 4) Non-school days for year
  useEffect(() => {
    if (!teacherId || !selectedYearId || waitingOnStudentSession) {
      setNonSchoolDays([]);
      return;
    }
    (async () => {
      try {
        const ref = doc(
          db,
          "nonSchoolDays",
          nsDocId(teacherId, selectedYearId)
        );
        const snap = await getDoc(ref);
        const days =
          snap.exists() && Array.isArray(snap.data().dates)
            ? (snap.data().dates as string[])
            : [];
        setNonSchoolDays(days);
      } catch {
        setNonSchoolDays([]);
      }
    })();
  }, [teacherId, selectedYearId, waitingOnStudentSession]);

  // 5) Load periods for selected year
  useEffect(() => {
    if (!teacherId || !selectedYearId || waitingOnStudentSession) {
      setPeriods([]);
      return;
    }
    (async () => {
      try {
        const qp = query(
          collection(db, "periods"),
          where("teacherId", "==", teacherId),
          where("schoolYearId", "==", selectedYearId)
        );
        const res = await getDocs(qp);
        const arr: Period[] = [];
        res.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        arr.sort((a, b) => a.name.localeCompare(b.name));
        setPeriods(arr);
      } catch (err) {
        console.error("periods query failed:", err);
        setPeriods([]);
      }
    })();
  }, [teacherId, selectedYearId, waitingOnStudentSession]);

  // Visible range
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

  // 6) Fetch plans in range — ONLY period-attached plans (no events)
  useEffect(() => {
    if (!teacherId || !selectedYearId || waitingOnStudentSession) {
      setPlans([]);
      return;
    }

    const isStudent = !!auth.currentUser?.isAnonymous;

    (async () => {
      try {
        let collected: LessonPlan[] = [];

        if (isStudent) {
          if (!allowedPeriodIds.length) {
            setPlans([]);
            return;
          }
          const chunks: string[][] = [];
          for (let i = 0; i < allowedPeriodIds.length; i += 10) {
            chunks.push(allowedPeriodIds.slice(i, i + 10));
          }
          for (const chunk of chunks) {
            const ql = query(
              collection(db, "lessonPlans"),
              where("teacherId", "==", teacherId),
              where("schoolYearId", "==", selectedYearId),
              where("periodId", "in", chunk)
            );
            const snap = await getDocs(ql);
            snap.forEach((d) => {
              const data = d.data() as LessonPlan;
              if (!data.periodId) return;
              if (data.date >= iso(rangeStart) && data.date <= iso(rangeEnd)) {
                collected.push({ id: d.id, ...data });
              }
            });
          }
        } else {
          const teacherPeriodIds = periods.map((p) => p.id);
          if (!teacherPeriodIds.length) {
            setPlans([]);
            return;
          }
          const chunks: string[][] = [];
          for (let i = 0; i < teacherPeriodIds.length; i += 10) {
            chunks.push(teacherPeriodIds.slice(i, i + 10));
          }
          for (const chunk of chunks) {
            const ql = query(
              collection(db, "lessonPlans"),
              where("teacherId", "==", teacherId),
              where("schoolYearId", "==", selectedYearId),
              where("periodId", "in", chunk)
            );
            const snap = await getDocs(ql);
            snap.forEach((d) => {
              const data = d.data() as LessonPlan;
              if (!data.periodId) return;
              if (data.date >= iso(rangeStart) && data.date <= iso(rangeEnd)) {
                collected.push({ id: d.id, ...data });
              }
            });
          }
        }

        collected.sort((a, b) => a.date.localeCompare(b.date));
        setPlans(collected);
      } catch (err) {
        console.error("lessonPlans query failed:", err);
        setPlans([]);
      }
    })();
  }, [
    teacherId,
    selectedYearId,
    rangeStart,
    rangeEnd,
    allowedPeriodIds,
    waitingOnStudentSession,
    periods,
  ]);

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

  const headerBar = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            setCursor(
              view === "month" ? addMonths(cursor, -1) : addDays(cursor, -7)
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

        <Button
          variant="default"
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

        <Button variant="outline" asChild>
          <Link href="/sharing">
            <Share2 className="h-4 w-4 mr-2" />
            Sharing
          </Link>
        </Button>
      </div>
    </div>
  );

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
          isToday && "ring-2 ring-primary",
          isNonSchool(dateStr) && "bg-red-100 dark:bg-amber-900/20"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium opacity-70">{format(d, "d")}</div>
        </div>

        <div className="mt-2 space-y-2">
          {dayPlans.length ? (
            dayPlans.map((plan) => {
              const period = periodMap.get(plan.periodId);
              const bg = plan.colorBg ?? period?.colorBg ?? "#e6f0ff";
              const tx = plan.colorText ?? period?.colorText ?? "#1e3a8a";

              const headerPieces: string[] = [];
              const resolvedPeriodName = period?.name ?? plan.periodName;
              if (resolvedPeriodName) headerPieces.push(resolvedPeriodName);
              if (typeof period?.totalStudents === "number")
                headerPieces.push(`${period.totalStudents} students`);

              return (
                <div
                  key={plan.id}
                  className="rounded-md overflow-hidden border bg-card text-card-foreground border-border select-text"
                >
                  <div
                    className="px-2 py-1 text-xs font-semibold flex items-center justify-between"
                    style={{ background: bg, color: tx }}
                  >
                    <span className="truncate">
                      {headerPieces.length
                        ? headerPieces.join(" • ") + " — "
                        : ""}
                      {plan.name?.trim() || "Untitled"}
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
                    {plan.resources && <ResourcesLine value={plan.resources} />}
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
                        {plan.attachments.map((a) => (
                          <a
                            key={a.storagePath}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline text-primary hover:text-primary/80"
                            title={a.name}
                          >
                            <span aria-hidden>📎</span>
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
                          No details added.
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground italic">No plans.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Non-print content */}
      <div className="print:hidden">
        <Toaster />

        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle>Lesson Plan Calendar (Read-only)</CardTitle>
          </CardHeader>
          <CardContent>{headerBar}</CardContent>
        </Card>

        {waitingOnStudentSession ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className={cn("grid grid-cols-5 gap-px bg-border")}>
            {weekdays.map((w) => (
              <div
                key={w}
                className="bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {w}
              </div>
            ))}
            {gridDates.map((d) => renderCell(d))}
          </div>
        )}
      </div>

      {/* Print container */}
      {printOpen && (
        <div
          className="hidden print:block absolute inset-0 bg-white p-6"
          ref={printRef}
        >
          <div className="space-y-3">
            {gridDates.map((d) => {
              const dateStr = iso(d);
              let dayPlans = (plansByDate.get(dateStr) || []) as LessonPlan[];
              if (printPeriodFilter.length) {
                dayPlans = dayPlans.filter((p) =>
                  printPeriodFilter.includes(p.periodId)
                );
              }
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
              if (!printable.length) return null;

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
                          <div
                            className="px-2 py-1 text-sm font-semibold"
                            style={{ background: bg, color: tx }}
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

                          <div className="p-2 text-sm space-y-1">
                            {plan.topic && (
                              <Line label="Topic" value={plan.topic} />
                            )}
                            {plan.objective && (
                              <Line label="Objective" value={plan.objective} />
                            )}
                            {plan.resources && (
                              <ResourcesLine value={plan.resources} />
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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs leading-snug">
      <span className="font-medium">{label}:</span>{" "}
      <span className="whitespace-pre-wrap break-words align-top">{value}</span>
    </div>
  );
}

/** Linkify when the entire value is a single URL; otherwise fall back to Line */
function ResourcesLine({ value }: { value: string }) {
  const trimmed = (value || "").trim();
  const singleUrlRe = /^(https?:\/\/[^\s)]+)$/i;

  if (singleUrlRe.test(trimmed)) {
    return (
      <div className="text-xs leading-snug">
        <span className="font-medium">Resources:</span>{" "}
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary hover:text-primary/80 break-all"
          title={trimmed}
        >
          {trimmed}
        </a>
      </div>
    );
  }

  return <Line label="Resources" value={value} />;
}
