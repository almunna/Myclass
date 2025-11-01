"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, ArrowUpDown, Check, FileBarChart, Printer } from "lucide-react";
import { format } from "date-fns";
import { CustomDatePicker } from "@/components/ui/date-picker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";
import {
  useAttendancePrint,
  PrintStyles,
  PrintArea,
} from "@/components/attendence/print";

interface Student {
  id: string;
  name: string;
  studentId: string;
  periods: {
    id: string;
    name: string;
  }[];
}

interface Period {
  id: string;
  name: string;
  schoolYearName?: string;
}

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "tardy";
  periodId?: string;
}

interface AttendanceSession {
  id: string;
  teacherId: string;
  periodId: string;
  periodName: string;
  date: string;
  records: AttendanceRecord[];
  lastModified: any;
}

type SortMode = "first" | "last";

export default function AttendancePage() {
  const { currentUser } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();

  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [schoolYears, setSchoolYears] = useState<
    { id: string; name: string }[]
  >([]);

  const [selectedSchoolYearId, setSelectedSchoolYearId] =
    useState<string>("all");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(
    null
  );

  const [sortMode, setSortMode] = useState<SortMode>("first");
  const [activeTab, setActiveTab] = useState("take-attendance");

  const [reportStartDate, setReportStartDate] = useState<Date>(new Date());
  const [reportEndDate, setReportEndDate] = useState<Date>(new Date());
  const [reportPeriodId, setReportPeriodId] = useState<string>("all");
  const [reportStudentId, setReportStudentId] = useState<string>("all");
  const [reportData, setReportData] = useState<any[]>([]);

  const [analyticsData, setAnalyticsData] = useState<any>({
    summary: { present: 0, absent: 0, tardy: 0 },
    dailyTrends: [],
    studentStats: [],
    periodStats: [],
  });

  // 🔹 Archived students are fetched and used ONLY in Reports (not in Take Attendance)
  const [archivedStudents, setArchivedStudents] = useState<Student[]>([]);

  // 🔹 Roster filter for Reports: active / archived / both
  const [reportRoster, setReportRoster] = useState<"active" | "archived">(
    "active"
  );

  // ⬇️ Printing setup (only for the Reports section)
  const { containerRef, handlePrint } = useAttendancePrint();
  const fmt = (d: Date) => format(d, "MMM d, yyyy");

  // 🔹 When period changes, clean old records
  useEffect(() => {
    setExistingSessionId(null);
    setHasUnsavedChanges(false);
    setAttendanceRecords([]);
  }, [selectedPeriodId]);

  // 🔒 Strictly current period records (no fallback)
  const periodRecords = useMemo(
    () => attendanceRecords.filter((r) => r.periodId === selectedPeriodId),
    [attendanceRecords, selectedPeriodId]
  );

  const nameCollator = useMemo(
    () => new Intl.Collator(undefined, { sensitivity: "base", numeric: true }),
    []
  );

  // Reports dropdown: show Active/Archived/Both depending on roster selection
  const reportStudents = useMemo(() => {
    const source =
      reportRoster === "active"
        ? students
        : reportRoster === "archived"
        ? archivedStudents
        : [
            ...students,
            ...archivedStudents.filter(
              (a) => !students.some((s) => s.id === a.id)
            ),
          ];

    const base =
      reportPeriodId === "all"
        ? source
        : source.filter((s) =>
            (s.periods || []).some((p) => p.id === reportPeriodId)
          );

    // sort A→Z by name
    return [...base].sort((a, b) =>
      nameCollator.compare(a.name || "", b.name || "")
    );
  }, [students, archivedStudents, reportPeriodId, reportRoster, nameCollator]);

  useEffect(() => {
    if (currentUser) {
      fetchPeriods();
      fetchStudents();
      fetchArchivedStudents(); // ← archived fetched separately; not mixed into `students`
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedPeriodId && selectedPeriodId !== "all") {
      const filtered = students.filter((student) =>
        student.periods.some((p) => p.id === selectedPeriodId)
      );
      setFilteredStudents(filtered);
      initializeAttendanceRecords(filtered);
    } else {
      setFilteredStudents([]);
      setAttendanceRecords([]);
    }
  }, [selectedPeriodId, students]);

  useEffect(() => {
    if (selectedPeriodId && selectedDate) {
      loadExistingAttendance();
    }
  }, [selectedPeriodId, selectedDate]); // NOTE: no filteredStudents dependency

  const fetchPeriods = async () => {
    try {
      const schoolYearsQuery = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser?.uid)
      );
      const schoolYearsSnapshot = await getDocs(schoolYearsQuery);
      const schoolYearsList = schoolYearsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unnamed School Year",
      }));

      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser?.uid)
      );
      const periodsSnapshot = await getDocs(periodsQuery);

      const periodsList = periodsSnapshot.docs.map((doc) => {
        const data = doc.data();
        const schoolYear = schoolYearsList.find(
          (sy) => sy.id === data.schoolYearId
        );
        return {
          id: doc.id,
          name: data.name,
          schoolYearName: schoolYear?.name || "Unknown School Year",
        };
      });

      const sortedPeriods = periodsList.sort((a, b) =>
        a.schoolYearName !== b.schoolYearName
          ? a.schoolYearName!.localeCompare(b.schoolYearName!)
          : a.name.localeCompare(b.name)
      );

      setPeriods(sortedPeriods);
      setSchoolYears(
        schoolYearsList.sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error("Error fetching periods:", error);
      toast.error("Failed to load periods");
    }
  };

  const fetchStudents = async () => {
    try {
      const q = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser?.uid)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          studentId: data.studentId,
          periods: data.periods || [],
        };
      });
      setStudents(list);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
      setLoading(false);
    }
  };

  // 🔹 Fetch archived separately; not mixed into active roster anywhere
  const fetchArchivedStudents = async () => {
    try {
      const q = query(
        collection(db, "archivedStudents"),
        where("teacherId", "==", currentUser?.uid)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          studentId: data.studentId,
          periods: data.periods || [],
        } as Student;
      });
      setArchivedStudents(list);
    } catch (error) {
      console.error("Error fetching archived students:", error);
      toast.error("Failed to load archived students");
    }
  };

  const initializeAttendanceRecords = (list: Student[]) => {
    const records = list.map((student) => ({
      studentId: student.id,
      studentName: student.name,
      status: "present" as const,
      periodId: selectedPeriodId,
    }));
    setAttendanceRecords(records);
    setHasUnsavedChanges(false);
  };

  // ✅ Derive roster from `students` (not `filteredStudents`) to avoid race
  const loadExistingAttendance = async () => {
    if (!selectedPeriodId || !selectedDate || !currentUser) return;
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Build current roster directly from ACTIVE `students` only (archived are excluded from taking attendance)
      const roster = students.filter((s) =>
        (s.periods || []).some((p) => p.id === selectedPeriodId)
      );

      const qy = query(
        collection(db, "attendance"),
        where("teacherId", "==", currentUser.uid),
        where("periodId", "==", selectedPeriodId),
        where("date", "==", dateStr)
      );
      const snap = await getDocs(qy);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data() as AttendanceSession;

        // Normalize periodId on loaded records
        const withPeriodTag = (data.records || []).map((r) => ({
          ...r,
          periodId: r.periodId ?? data.periodId,
        }));

        // Merge roster students missing a record
        const hasRecord = new Map(
          withPeriodTag
            .filter((r) => r.periodId === selectedPeriodId)
            .map((r) => [r.studentId, true])
        );

        const merged = [
          ...withPeriodTag,
          ...roster
            .filter((s) => !hasRecord.get(s.id))
            .map((s) => ({
              studentId: s.id,
              studentName: s.name,
              status: "present" as const,
              periodId: selectedPeriodId,
            })),
        ];

        setAttendanceRecords(merged);
        setExistingSessionId(docSnap.id);
        setHasUnsavedChanges(false);
        toast.success("Loaded existing attendance for this date");
      } else {
        setExistingSessionId(null);
        if (roster.length > 0) initializeAttendanceRecords(roster);
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast.error("Failed to load existing attendance");
    }
  };

  const updateAttendanceStatus = (
    studentId: string,
    status: "present" | "absent" | "tardy"
  ) => {
    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record.studentId === studentId && record.periodId === selectedPeriodId
          ? { ...record, status }
          : record
      )
    );
    setHasUnsavedChanges(true);
  };

  // ✅ Only affect current period’s records
  const markAllAsPresent = () => {
    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record.periodId === selectedPeriodId
          ? { ...record, status: "present" as const }
          : record
      )
    );
    setHasUnsavedChanges(true);
    toast.success("All students marked as present");
  };

  // ✅ Save only current period’s records
  const saveAttendance = async () => {
    if (!selectedPeriodId || !selectedDate || !currentUser) {
      toast.error("Please select a period and date");
      return;
    }
    if (attendanceRecords.length === 0) {
      toast.error("No students to save attendance for");
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const sessionId = `${currentUser.uid}_${selectedPeriodId}_${dateStr}`;
      const period = periods.find((p) => p.id === selectedPeriodId);

      const attendanceSession: AttendanceSession = {
        id: sessionId,
        teacherId: currentUser.uid,
        periodId: selectedPeriodId,
        periodName: period?.name || "Unknown Period",
        date: dateStr,
        records: attendanceRecords.filter(
          (r) => r.periodId === selectedPeriodId
        ),
        lastModified: new Date(),
      };

      await setDoc(doc(db, "attendance", sessionId), attendanceSession);
      setExistingSessionId(sessionId);
      setHasUnsavedChanges(false);
      toast.success("Attendance saved successfully");
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const getFirstName = (n: string) =>
    (n || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  const getLastName = (n: string) => {
    const parts = (n || "").trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  const getSortedStudents = () => {
    const list = filteredStudents.map((student) => {
      const record = attendanceRecords.find(
        (r) => r.studentId === student.id && r.periodId === selectedPeriodId
      );
      return { ...student, attendanceStatus: record?.status || "present" };
    });

    return [...list].sort((a, b) => {
      const fa = getFirstName(a.name),
        fb = getFirstName(b.name),
        la = getLastName(a.name),
        lb = getLastName(b.name);
      if (sortMode === "first") {
        if (fa !== fb) return fa.localeCompare(fb);
        if (la !== lb) return la.localeCompare(lb);
      } else {
        if (la !== lb) return la.localeCompare(lb);
        if (fa !== fb) return fa.localeCompare(fb);
      }
      return (a.studentId || "").localeCompare(b.studentId || "");
    });
  };

  // ---- Totals must reflect only the visible roster in the current period ----
  const getStatusFor = (studentId: string) => {
    const rec = attendanceRecords.find(
      (r) => r.studentId === studentId && r.periodId === selectedPeriodId
    );
    return rec?.status ?? "present";
  };

  const presentCount = useMemo(
    () =>
      filteredStudents.filter((s) => getStatusFor(s.id) === "present").length,
    [filteredStudents, attendanceRecords, selectedPeriodId]
  );
  const tardyCount = useMemo(
    () => filteredStudents.filter((s) => getStatusFor(s.id) === "tardy").length,
    [filteredStudents, attendanceRecords, selectedPeriodId]
  );
  const absentCount = useMemo(
    () =>
      filteredStudents.filter((s) => getStatusFor(s.id) === "absent").length,
    [filteredStudents, attendanceRecords, selectedPeriodId]
  );

  // -------------------
  // Analytics helpers
  // -------------------

  const generateAnalytics = (records: any[]) => {
    const summary = {
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      tardy: records.filter((r) => r.status === "tardy").length,
    };

    const dailyData = records.reduce((acc, record) => {
      const date = record.date;
      if (!acc[date]) {
        acc[date] = { date, present: 0, absent: 0, tardy: 0 };
      }
      acc[date][record.status]++;
      return acc;
    }, {} as Record<string, any>);

    const dailyTrends = Object.values(dailyData)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((day: any) => ({
        ...day,
        date: format(new Date(day.date), "MMM d"),
        total: day.present + day.absent + day.tardy,
        attendanceRate: Math.round(
          (day.present / (day.present + day.absent + day.tardy)) * 100
        ),
      }));

    const studentData = records.reduce((acc, record) => {
      const studentId = record.studentId;
      if (!acc[studentId]) {
        acc[studentId] = {
          studentName: record.studentName,
          present: 0,
          absent: 0,
          tardy: 0,
        };
      }
      acc[studentId][record.status]++;
      return acc;
    }, {} as Record<string, any>);

    const studentStats = Object.values(studentData)
      .map((student: any) => ({
        ...student,
        total: student.present + student.absent + student.tardy,
        attendanceRate: Math.round(
          (student.present /
            (student.present + student.absent + student.tardy)) *
            100
        ),
      }))
      .sort((a: any, b: any) => b.attendanceRate - a.attendanceRate);

    const periodData = records.reduce((acc, record) => {
      const periodName = record.periodName;
      if (!acc[periodName]) {
        acc[periodName] = { periodName, present: 0, absent: 0, tardy: 0 };
      }
      acc[periodName][record.status]++;
      return acc;
    }, {} as Record<string, any>);

    const periodStats = Object.values(periodData)
      .map((period: any) => ({
        ...period,
        total: period.present + period.absent + period.tardy,
        attendanceRate: Math.round(
          (period.present / (period.present + period.absent + period.tardy)) *
            100
        ),
      }))
      .sort((a: any, b: any) => b.attendanceRate - a.attendanceRate);

    return { summary, dailyTrends, studentStats, periodStats };
  };

  const generateReport = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      const startDateStr = format(reportStartDate, "yyyy-MM-dd");
      const endDateStr = format(reportEndDate, "yyyy-MM-dd");

      const attendanceQuery = query(
        collection(db, "attendance"),
        where("teacherId", "==", currentUser.uid)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      let reportRecords: any[] = [];

      attendanceSnapshot.docs.forEach((snap) => {
        const data = snap.data() as AttendanceSession;

        // date range guard
        if (data.date < startDateStr || data.date > endDateStr) return;

        (data.records || []).forEach((record) => {
          // period on the record (fallback to session for legacy rows)
          const recPeriodId = record.periodId ?? data.periodId;

          // chosen period filter
          const periodOk =
            reportPeriodId === "all" || recPeriodId === reportPeriodId;

          // chosen student filter
          const studentOk =
            reportStudentId === "all" || record.studentId === reportStudentId;

          // find the student according to roster selection (active | archived)
          const studentObj =
            reportRoster === "active"
              ? students.find((s) => s.id === record.studentId)
              : archivedStudents.find((s) => s.id === record.studentId);

          // If the record’s student isn’t found in the selected roster, skip it.
          if (!studentObj) return;

          // If Period = All, verify the student is enrolled in *this record’s* period.
          // If a specific period is selected, verify against that specific period.
          const targetPeriodId =
            reportPeriodId === "all" ? recPeriodId : reportPeriodId;

          // If we have the profile (active or archived), use its enrollment;
          // if not (very old data), allow it.
          const enrolledInTarget = studentObj
            ? (studentObj.periods || []).some((p) => p.id === targetPeriodId)
            : true;

          if (!(periodOk && studentOk && enrolledInTarget)) return;

          const periodName =
            periods.find((p) => p.id === recPeriodId)?.name ?? data.periodName;

          const actualStudentId = studentObj?.studentId || record.studentId;

          reportRecords.push({
            date: data.date,
            periodName,
            studentName: record.studentName,
            studentId: actualStudentId,
            status: record.status,
          });
        });
      });

      reportRecords.sort((a, b) =>
        a.date === b.date
          ? a.studentName.localeCompare(b.studentName)
          : a.date.localeCompare(b.date)
      );

      setReportData(reportRecords);

      const analytics = generateAnalytics(reportRecords);
      setAnalyticsData(analytics);

      toast.success(`Found ${reportRecords.length} attendance records`);
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

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
          title="Attendance Management"
          description="Access to attendance management requires an active subscription."
        />
      </ProtectedRoute>
    );
  }

  // Key to force a clean remount when period/date changes (prevents stale closures)
  const viewKey = `${selectedPeriodId}::${format(selectedDate, "yyyy-MM-dd")}`;

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Attendance Management</h1>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 print:hidden">
            <TabsTrigger
              value="take-attendance"
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Take Attendance
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Take Attendance Tab */}
          <TabsContent
            value="take-attendance"
            className="space-y-6 print:hidden"
          >
            {/* Selection Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Select Period and Date</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* School Year Filter */}
                  <div className="space-y-2">
                    <Label>School Year</Label>
                    <Select
                      value={selectedSchoolYearId}
                      onValueChange={setSelectedSchoolYearId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select school year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All School Years</SelectItem>
                        {schoolYears.map((schoolYear) => (
                          <SelectItem key={schoolYear.id} value={schoolYear.id}>
                            {schoolYear.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Period Selection */}
                  <div className="space-y-2">
                    <Label>Class Period</Label>
                    <Select
                      value={selectedPeriodId}
                      onValueChange={setSelectedPeriodId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredPeriods = periods;
                          if (selectedSchoolYearId !== "all") {
                            const selectedSchoolYear = schoolYears.find(
                              (sy) => sy.id === selectedSchoolYearId
                            );
                            if (selectedSchoolYear) {
                              filteredPeriods = periods.filter(
                                (period) =>
                                  period.schoolYearName ===
                                  selectedSchoolYear.name
                              );
                            }
                          }

                          if (selectedSchoolYearId === "all") {
                            const groupedPeriods = filteredPeriods.reduce(
                              (acc, period) => {
                                const yearName =
                                  period.schoolYearName ||
                                  "Unknown School Year";
                                if (!acc[yearName]) {
                                  acc[yearName] = [];
                                }
                                acc[yearName].push(period);
                                return acc;
                              },
                              {} as Record<string, Period[]>
                            );

                            return Object.entries(groupedPeriods).map(
                              ([yearName, yearPeriods]) => (
                                <div key={yearName}>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50 rounded-sm mt-1 mb-1">
                                    {yearName}
                                  </div>
                                  {yearPeriods.map((period) => (
                                    <SelectItem
                                      key={period.id}
                                      value={period.id}
                                      className="pl-6"
                                    >
                                      {period.name}
                                    </SelectItem>
                                  ))}
                                </div>
                              )
                            );
                          } else {
                            return filteredPeriods.map((period) => (
                              <SelectItem key={period.id} value={period.id}>
                                {period.name}
                              </SelectItem>
                            ));
                          }
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Selection */}
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <CustomDatePicker
                      selected={selectedDate}
                      onChange={setSelectedDate}
                      placeholder="Select attendance date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Taking Interface */}
            {selectedPeriodId && filteredStudents.length > 0 && (
              <Card key={viewKey}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      Attendance for{" "}
                      {periods.find((p) => p.id === selectedPeriodId)?.name} -{" "}
                      {format(selectedDate, "PPP")}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={markAllAsPresent}
                        className="flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Mark All Present
                      </Button>
                      <Button
                        onClick={saveAttendance}
                        disabled={saving || !hasUnsavedChanges}
                        className="flex items-center gap-2"
                      >
                        {saving ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {saving ? "Saving..." : "Save Attendance"}
                      </Button>
                    </div>
                  </div>
                  {hasUnsavedChanges && (
                    <p className="text-sm text-amber-600">
                      You have unsaved changes
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sorting Controls (FIRST / LAST NAME ONLY) */}
                    <div className="flex gap-2">
                      <Button
                        variant={sortMode === "first" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSortMode("first")}
                        className="flex items-center gap-2"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        Sort by First Name
                      </Button>
                      <Button
                        variant={sortMode === "last" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSortMode("last")}
                        className="flex items-center gap-2"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        Sort by Last Name
                      </Button>
                    </div>

                    {/* Students Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Student ID</TableHead>
                            <TableHead className="text-center">
                              Attendance Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getSortedStudents().map((student) => {
                            const record = attendanceRecords.find(
                              (r) =>
                                r.studentId === student.id &&
                                r.periodId === selectedPeriodId
                            );
                            const status = record?.status || "present";

                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">
                                  {student.name}
                                </TableCell>
                                <TableCell>{student.studentId}</TableCell>
                                <TableCell>
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      variant={
                                        status === "present"
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() =>
                                        updateAttendanceStatus(
                                          student.id,
                                          "present"
                                        )
                                      }
                                      className={`${
                                        status === "present"
                                          ? "bg-green-600 hover:bg-green-700"
                                          : "hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                                      }`}
                                    >
                                      Present
                                    </Button>
                                    <Button
                                      variant={
                                        status === "tardy"
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() =>
                                        updateAttendanceStatus(
                                          student.id,
                                          "tardy"
                                        )
                                      }
                                      className={`${
                                        status === "tardy"
                                          ? "bg-yellow-600 hover:bg-yellow-700"
                                          : "hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700"
                                      }`}
                                    >
                                      Tardy
                                    </Button>
                                    <Button
                                      variant={
                                        status === "absent"
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() =>
                                        updateAttendanceStatus(
                                          student.id,
                                          "absent"
                                        )
                                      }
                                      className={`${
                                        status === "absent"
                                          ? "bg-red-600 hover:bg-red-700"
                                          : "hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                      }`}
                                    >
                                      Absent
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Summary (current period + visible roster only) */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {presentCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Present
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {tardyCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tardy
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {absentCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Absent
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedPeriodId && filteredStudents.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    No students found for the selected period.
                  </p>
                </CardContent>
              </Card>
            )}

            {!selectedPeriodId && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    Please select a period to begin taking attendance.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle>Attendance Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <CustomDatePicker
                      selected={reportStartDate}
                      onChange={setReportStartDate}
                      placeholder="Select start date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <CustomDatePicker
                      selected={reportEndDate}
                      onChange={setReportEndDate}
                      placeholder="Select end date"
                    />
                  </div>

                  {/* Period Filter */}
                  <div className="space-y-2">
                    <Label>Period</Label>
                    <Select
                      value={reportPeriodId}
                      onValueChange={setReportPeriodId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All periods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        {periods.map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {period.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Student Filter */}
                  <div className="space-y-2">
                    <Label>Student</Label>
                    <Select
                      value={reportStudentId}
                      onValueChange={setReportStudentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All students" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        {reportStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Roster Filter */}
                  <div className="space-y-2">
                    <Label>Roster</Label>
                    <Select
                      value={reportRoster}
                      onValueChange={(v) =>
                        setReportRoster(v as "active" | "archived")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Both" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active only</SelectItem>
                        <SelectItem value="archived">Archived only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={generateReport}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <FileBarChart className="h-4 w-4" />
                    )}
                    Generate Report
                  </Button>

                  {/* Print button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrint}
                    className="flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ✅ Printable content only (graphs + list) */}
            <PrintArea ref={containerRef} className="space-y-6">
              {/* Print-only heading */}
              {reportData.length > 0 && (
                <div className="hidden print:block">
                  <h2 className="text-xl font-bold">Attendance Report</h2>
                  <p className="text-sm text-muted-foreground">
                    Range: {fmt(reportStartDate)} – {fmt(reportEndDate)}
                    {reportPeriodId !== "all" && (
                      <>
                        {" "}
                        • Period:{" "}
                        {periods.find((p) => p.id === reportPeriodId)?.name ||
                          "Selected"}
                      </>
                    )}
                    {reportStudentId !== "all" && (
                      <>
                        {" "}
                        • Student:{" "}
                        {
                          (
                            reportStudents.find(
                              (s) => s.id === reportStudentId
                            ) || { name: "Selected" }
                          ).name
                        }
                      </>
                    )}
                  </p>
                  <div className="h-2" />
                </div>
              )}

              {/* Analytics Dashboard */}
              {reportData.length > 0 && (
                <>
                  {/* Summary Statistics */}
                  <Card className="avoid-break">
                    <CardHeader>
                      <CardTitle>Attendance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">
                            {analyticsData.summary.present}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Present
                          </div>
                          <div className="text-xs text-green-600">
                            {reportData.length > 0 &&
                              Math.round(
                                ((analyticsData.summary.present +
                                  analyticsData.summary.tardy) /
                                  reportData.length) *
                                  100
                              )}
                            %
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600">
                            {analyticsData.summary.tardy}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Tardy
                          </div>
                          <div className="text-xs text-yellow-600">
                            {reportData.length > 0 &&
                              Math.round(
                                (analyticsData.summary.tardy /
                                  reportData.length) *
                                  100
                              )}
                            %
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600">
                            {analyticsData.summary.absent}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Absent
                          </div>
                          <div className="text-xs text-red-600">
                            {reportData.length > 0 &&
                              Math.round(
                                (analyticsData.summary.absent /
                                  reportData.length) *
                                  100
                              )}
                            %
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ResponsiveContainer width={120} height={120}>
                            <PieChart>
                              <Pie
                                data={[
                                  {
                                    name: "Present",
                                    value: analyticsData.summary.present,
                                    color: "#16a34a",
                                  },
                                  {
                                    name: "Tardy",
                                    value: analyticsData.summary.tardy,
                                    color: "#ca8a04",
                                  },
                                  {
                                    name: "Absent",
                                    value: analyticsData.summary.absent,
                                    color: "#dc2626",
                                  },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={50}
                                dataKey="value"
                              >
                                {[
                                  {
                                    name: "Present",
                                    value: analyticsData.summary.present,
                                    color: "#16a34a",
                                  },
                                  {
                                    name: "Tardy",
                                    value: analyticsData.summary.tardy,
                                    color: "#ca8a04",
                                  },
                                  {
                                    name: "Absent",
                                    value: analyticsData.summary.absent,
                                    color: "#dc2626",
                                  },
                                ].map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Daily Trends Chart */}
                  {analyticsData.dailyTrends.length > 1 && (
                    <Card className="avoid-break">
                      <CardHeader>
                        <CardTitle>Daily Attendance Trends</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={analyticsData.dailyTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="present"
                              stackId="1"
                              stroke="#16a34a"
                              fill="#16a34a"
                              name="Present"
                            />
                            <Area
                              type="monotone"
                              dataKey="tardy"
                              stackId="1"
                              stroke="#ca8a04"
                              fill="#ca8a04"
                              name="Tardy"
                            />
                            <Area
                              type="monotone"
                              dataKey="absent"
                              stackId="1"
                              stroke="#dc2626"
                              fill="#dc2626"
                              name="Absent"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Student Performance Chart */}
                  {analyticsData.studentStats.length > 0 && (
                    <Card className="avoid-break">
                      <CardHeader>
                        <CardTitle>Student Attendance Rates</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analyticsData.studentStats}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="studentName"
                              angle={-45}
                              textAnchor="end"
                              height={100}
                              interval={0}
                            />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar
                              dataKey="attendanceRate"
                              fill="#3b82f6"
                              name="Attendance Rate %"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Period Performance Chart */}
                  {analyticsData.periodStats.length > 1 && (
                    <Card className="avoid-break">
                      <CardHeader>
                        <CardTitle>Period Attendance Comparison</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analyticsData.periodStats}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="periodName" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar
                              dataKey="present"
                              fill="#16a34a"
                              name="Present"
                            />
                            <Bar dataKey="tardy" fill="#ca8a04" name="Tardy" />
                            <Bar
                              dataKey="absent"
                              fill="#dc2626"
                              name="Absent"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* Report Results */}
              {reportData.length > 0 && (
                <Card className="avoid-break">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>
                        Detailed Attendance Records ({reportData.length}{" "}
                        records)
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map((record, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {format(new Date(record.date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>{record.periodName}</TableCell>
                              <TableCell className="font-medium">
                                {record.studentName}
                              </TableCell>
                              <TableCell>{record.studentId}</TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    record.status === "present"
                                      ? "bg-green-100 text-green-800"
                                      : record.status === "tardy"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {record.status.charAt(0).toUpperCase() +
                                    record.status.slice(1)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty-state: show on screen only, not on paper */}
              {reportData.length === 0 && reportStartDate && reportEndDate && (
                <Card className="print:hidden">
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      No attendance records found for the selected criteria.
                    </p>
                  </CardContent>
                </Card>
              )}
            </PrintArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Global print CSS once */}
      <PrintStyles />
    </ProtectedRoute>
  );
}
