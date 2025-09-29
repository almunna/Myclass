"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Download } from "lucide-react";
import { Label } from "@/components/ui/label";
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
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";

interface Student {
  id: string;
  name: string;
  studentId: string;
  periodId?: string;
  periodName?: string;
  periods?: {
    id: string;
    name: string;
  }[];
}

interface Period {
  id: string;
  name: string;
  schoolYearName?: string;
}

interface RoomExit {
  id: string;
  studentId: string;
  studentName: string;
  periodId: string | null;
  periodName: string | null;
  exitTime: any;
  returnTime: any | null;
  duration: number | null;
  status: "out" | "returned";
  destination?: string | null;
}

interface SummaryData {
  studentId: string;
  studentName: string;
  periodName: string | null;
  totalExits: number;
  totalDuration: number;
  averageDuration: number;
  topDestination?: string | null;
}

/** NEW: behavior counts per student (within selected date range) */
type BehaviorCount = { pos: number; neg: number; total: number };

interface ChartData {
  name: string;
  value: number;
}

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [isClient, setIsClient] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [roomExits, setRoomExits] = useState<RoomExit[]>([]);
  const [filteredExits, setFilteredExits] = useState<RoomExit[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);

  /** NEW: behavior counts map keyed by studentId */
  const [behaviorCounts, setBehaviorCounts] = useState<
    Record<string, { pos: number; neg: number; total: number }>
  >({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // Chart data states
  const [studentExitsChartData, setStudentExitsChartData] = useState<
    ChartData[]
  >([]);
  const [periodExitsChartData, setPeriodExitsChartData] = useState<ChartData[]>(
    []
  );
  const [timeDistributionData, setTimeDistributionData] = useState<any[]>([]);
  const [dayDistributionData, setDayDistributionData] = useState<any[]>([]);
  const [studentDurationChartData, setStudentDurationChartData] = useState<
    ChartData[]
  >([]);
  const [destinationChartData, setDestinationChartData] = useState<ChartData[]>(
    []
  );

  // ---- behavior chart datasets (top 8) ----
  const positiveBehaviorChartData = summaryData
    .map((row) => {
      const bc = behaviorCounts[row.studentId] || { pos: 0, neg: 0, total: 0 };
      return { name: row.studentName, value: bc.pos };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const negativeBehaviorChartData = summaryData
    .map((row) => {
      const bc = behaviorCounts[row.studentId] || { pos: 0, neg: 0, total: 0 };
      return { name: row.studentName, value: bc.neg };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // UI states
  const [showCharts, setShowCharts] = useState(true);

  // Filter states
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const [selectedSchoolYearId, setSelectedSchoolYearId] =
    useState<string>("all");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("summary");

  // Chart colors
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#A28BFF",
    "#FF6B6B",
    "#4ECDC4",
    "#FD7272",
  ];

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchPeriods(), fetchStudents(), fetchRoomExits()]);
    };
    if (isClient) fetchData();
  }, [isClient]);

  const fetchPeriods = async () => {
    if (!currentUser?.uid) return;
    try {
      const schoolYearsQuery = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser.uid)
      );
      const schoolYearsSnapshot = await getDocs(schoolYearsQuery);
      const schoolYearsList: any[] = schoolYearsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser.uid)
      );
      const periodsSnapshot = await getDocs(periodsQuery);

      const periodsList = periodsSnapshot.docs.map((doc) => {
        const data: any = doc.data();
        const schoolYear = schoolYearsList.find(
          (sy) => sy.id === data.schoolYearId
        );
        return {
          id: doc.id,
          name: data.name,
          schoolYearName: schoolYear?.name || "Unknown School Year",
        };
      }) as Period[];

      const sortedPeriods = periodsList.sort((a, b) => {
        if (a.schoolYearName !== b.schoolYearName) {
          return a.schoolYearName!.localeCompare(b.schoolYearName!);
        }
        return a.name.localeCompare(b.name);
      });

      setPeriods(sortedPeriods);
      setSchoolYears(
        schoolYearsList.sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error("Error fetching periods:", error);
    }
  };

  const fetchStudents = async () => {
    if (!currentUser?.uid) return;
    try {
      const studentsQuery = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser.uid)
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      const studentsList = studentsSnapshot.docs.map((doc) => {
        const data: any = doc.data();
        const student: Student = {
          id: doc.id,
          name: data.name,
          studentId: data.studentId,
        };
        if (Array.isArray(data.periods)) {
          student.periods = data.periods;
        } else if (data.periodId) {
          student.periodId = data.periodId;
          student.periodName = data.periodName;
        }
        return student;
      });

      setStudents(studentsList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchRoomExits = async () => {
    if (!currentUser?.uid) return;
    try {
      const exitsQuery = query(
        collection(db, "roomExits"),
        where("teacherId", "==", currentUser.uid)
      );
      const exitsSnapshot = await getDocs(exitsQuery);

      if (exitsSnapshot.empty) {
        setRoomExits([]);
        return;
      }

      const exitsList = exitsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RoomExit[];

      exitsList.sort((a, b) => {
        const dateA = a.exitTime?.toDate
          ? a.exitTime.toDate()
          : new Date(a.exitTime);
        const dateB = b.exitTime?.toDate
          ? b.exitTime.toDate()
          : new Date(b.exitTime);
        return dateB.getTime() - dateA.getTime();
      });

      setRoomExits(exitsList);
    } catch (error) {
      console.error("Error fetching room exits:", error);
      setRoomExits([]);
    }
  };

  // Build behavior counts for the students shown in Summary (date range aware)
  // Build behavior counts for the students shown in Summary (date range aware)
  // Also supports behavior docs that use either `studentId` or `studentDocId`
  useEffect(() => {
    const fetchBehaviorCounts = async () => {
      // who do we need counts for?
      const idsFromSummary = summaryData
        .map((s) => s.studentId)
        .filter(Boolean);

      if (idsFromSummary.length === 0) {
        setBehaviorCounts({});
        return;
      }

      // some projects store custom student codes; map both possibilities
      const studentById = new Map(students.map((s) => [s.id, s]));
      const candidateIds = new Set<string>(idsFromSummary);
      for (const sid of idsFromSummary) {
        const st = studentById.get(sid);
        if (st?.studentId) candidateIds.add(st.studentId); // add custom ID too
      }

      // helper to chunk 'in' queries (max 10)
      const chunk = <T,>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );

      const idBatches = chunk(Array.from(candidateIds), 10);

      // only apply date filtering when BOTH dates are selected
      const hasDateFilter = !!(startDate && endDate);
      const start =
        hasDateFilter && new Date(new Date(startDate!).setHours(0, 0, 0, 0));
      const end =
        hasDateFilter && new Date(new Date(endDate!).setHours(23, 59, 59, 999));

      const counts: Record<
        string,
        { pos: number; neg: number; total: number }
      > = {};

      // We’ll try both possible field names used in behavior docs
      const possibleKeys: Array<"studentId" | "studentDocId"> = [
        "studentId",
        "studentDocId",
      ];

      for (const key of possibleKeys) {
        for (const batch of idBatches) {
          try {
            const qRef = query(
              collection(db, "behaviors"),
              where(key, "in", batch)
            );
            const snap = await getDocs(qRef);

            snap.docs.forEach((d) => {
              const data: any = d.data();
              const sidFromDoc: string | undefined =
                data.studentId || data.studentDocId;
              if (!sidFromDoc) return;

              // normalize to whatever IDs are in candidateIds
              if (!candidateIds.has(sidFromDoc)) return;

              // build timestamp
              let when: Date | null = null;
              if (data.date) {
                const t = data.time ? `${data.time}:00` : "00:00:00";
                const dd = new Date(`${data.date}T${t}`);
                when = isNaN(dd.getTime()) ? null : dd;
              } else if (data.createdAt?.toDate) {
                when = data.createdAt.toDate();
              }

              // apply date filter only if both dates are selected and we have a time
              if (hasDateFilter && when) {
                if (when < (start as Date) || when > (end as Date)) return;
              }

              const isPos = !!data.isPositive;
              if (!counts[sidFromDoc])
                counts[sidFromDoc] = { pos: 0, neg: 0, total: 0 };
              if (isPos) counts[sidFromDoc].pos += 1;
              else counts[sidFromDoc].neg += 1;
              counts[sidFromDoc].total =
                counts[sidFromDoc].pos + counts[sidFromDoc].neg;
            });
          } catch (e) {
            // ignore if this field name doesn't exist in your schema; we'll try the other one
            // console.warn(`Behavior query failed on key ${key}:`, e);
          }
        }
      }

      // If we counted against custom IDs, also mirror to the doc IDs used in summary rows
      for (const row of summaryData) {
        const st = studentById.get(row.studentId);
        if (st?.studentId && counts[st.studentId] && !counts[row.studentId]) {
          counts[row.studentId] = counts[st.studentId];
        }
      }

      setBehaviorCounts(counts);
    };

    fetchBehaviorCounts();
    // rerun when the visible students change, date filter changes, or students list changes
  }, [summaryData, startDate, endDate, students, db]);

  // Apply filters and update data
  useEffect(() => {
    if (!roomExits.length) return;

    // Apply filters
    let filtered = [...roomExits];

    // Date range filter
    if (startDate && endDate) {
      const startTimestamp = new Date(startDate);
      startTimestamp.setHours(0, 0, 0, 0);

      const endTimestamp = new Date(endDate);
      endTimestamp.setHours(23, 59, 59, 999);

      filtered = filtered.filter((exit) => {
        const exitDate = exit.exitTime?.toDate
          ? exit.exitTime.toDate()
          : new Date(exit.exitTime);
        return exitDate >= startTimestamp && exitDate <= endTimestamp;
      });
    }

    // School year filter
    if (selectedSchoolYearId !== "all") {
      const selectedSchoolYear = schoolYears.find(
        (sy) => sy.id === selectedSchoolYearId
      );
      if (selectedSchoolYear) {
        filtered = filtered.filter((exit) => {
          if (!exit.periodId) return false;
          const period = periods.find((p) => p.id === exit.periodId);
          return period && period.schoolYearName === selectedSchoolYear.name;
        });
      }
    }

    // Period filter
    if (selectedPeriodId !== "all") {
      filtered = filtered.filter((exit) => exit.periodId === selectedPeriodId);
    }

    // Student filter
    if (selectedStudentId !== "all") {
      filtered = filtered.filter(
        (exit) => exit.studentId === selectedStudentId
      );
    }

    setFilteredExits(filtered);
    setCurrentPage(1);

    generateSummaryData(filtered);
    generateChartData(filtered);
  }, [
    roomExits,
    startDate,
    endDate,
    selectedSchoolYearId,
    selectedPeriodId,
    selectedStudentId,
    periods,
    schoolYears,
  ]);

  // Generate summary data from filtered exits
  const generateSummaryData = (filteredExits: RoomExit[]) => {
    const studentMap = new Map<string, SummaryData>();
    const destMap = new Map<string, Map<string, number>>();

    filteredExits.forEach((exit) => {
      const key = exit.studentId;

      if (!studentMap.has(key)) {
        studentMap.set(key, {
          studentId: exit.studentId,
          studentName: exit.studentName,
          periodName: exit.periodName,
          totalExits: 0,
          totalDuration: 0,
          averageDuration: 0,
          topDestination: null,
        });
      }
      const record = studentMap.get(key)!;
      record.totalExits++;

      if (exit.status === "returned" && exit.duration !== null) {
        record.totalDuration += exit.duration;
      }

      const dest = (exit.destination || "Unknown") as string;
      if (!destMap.has(key)) destMap.set(key, new Map());
      const m = destMap.get(key)!;
      m.set(dest, (m.get(dest) || 0) + 1);
    });

    const summaryArray = Array.from(studentMap.values()).map((record) => {
      if (record.totalExits > 0 && record.totalDuration > 0) {
        record.averageDuration = Math.round(
          record.totalDuration / record.totalExits
        );
      }

      const m = destMap.get(record.studentId);
      if (m && m.size > 0) {
        let top: string | null = null;
        let topCount = -1;
        m.forEach((count, name) => {
          if (count > topCount) {
            topCount = count;
            top = name;
          }
        });
        record.topDestination = top;
      } else {
        record.topDestination = null;
      }

      return record;
    });

    summaryArray.sort((a, b) => a.studentName.localeCompare(b.studentName));
    setSummaryData(summaryArray);
  };

  // Generate chart data
  const generateChartData = (filteredExits: RoomExit[]) => {
    const studentExitsMap = new Map<string, number>();
    filteredExits.forEach((exit) => {
      const count = studentExitsMap.get(exit.studentName) || 0;
      studentExitsMap.set(exit.studentName, count + 1);
    });

    let studentChartData = Array.from(studentExitsMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    setStudentExitsChartData(studentChartData);

    const periodExitsMap = new Map<string, number>();
    filteredExits.forEach((exit) => {
      const periodName = exit.periodName || "No Period";
      const count = periodExitsMap.get(periodName) || 0;
      periodExitsMap.set(periodName, count + 1);
    });
    let periodChartData = Array.from(periodExitsMap.entries()).map(
      ([name, value]) => ({ name, value })
    );
    setPeriodExitsChartData(periodChartData);

    const timeMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) timeMap.set(i, 0);
    filteredExits.forEach((exit) => {
      const date = exit.exitTime?.toDate
        ? exit.exitTime.toDate()
        : new Date(exit.exitTime);
      const hour = date.getHours();
      timeMap.set(hour, (timeMap.get(hour) || 0) + 1);
    });
    const timeData = Array.from(timeMap.entries())
      .map(([hour, count]) => ({
        hour,
        name: `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`,
        exits: count,
      }))
      .filter((item) => item.exits > 0);
    setTimeDistributionData(timeData);

    const dayMap = new Map<number, number>();
    for (let i = 0; i < 7; i++) dayMap.set(i, 0);
    filteredExits.forEach((exit) => {
      const date = exit.exitTime?.toDate
        ? exit.exitTime.toDate()
        : new Date(exit.exitTime);
      const day = date.getDay();
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayData = Array.from(dayMap.entries())
      .map(([day, count]) => ({
        day,
        name: dayNames[day],
        exits: count,
      }))
      .filter((item) => item.exits > 0);
    setDayDistributionData(dayData);

    const studentDurationMap = new Map<string, number>();
    filteredExits.forEach((exit) => {
      if (exit.status === "returned" && exit.duration !== null) {
        studentDurationMap.set(
          exit.studentName,
          (studentDurationMap.get(exit.studentName) || 0) + exit.duration
        );
      }
    });
    let studentDurationData = Array.from(studentDurationMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    setStudentDurationChartData(studentDurationData);

    const destMap = new Map<string, number>();
    filteredExits.forEach((exit) => {
      let dest = (exit.destination ?? "Unknown").toString().trim();
      if (!dest) dest = "Unknown";

      // Normalize special cases
      if (dest.toLowerCase() === "dean's" || dest.toLowerCase() === "deans") {
        dest = "Dean's"; // ✅ force correct spelling
      } else if (
        dest.toLowerCase() === "frontoffice" ||
        dest === "frontOffice"
      ) {
        dest = "Front Office"; // ✅ add space + capitalization
      } else {
        // Generic: lowercase then capitalize first letter
        dest = dest.toLowerCase();
        dest = dest.charAt(0).toUpperCase() + dest.slice(1);
      }

      destMap.set(dest, (destMap.get(dest) || 0) + 1);
    });

    const destData = Array.from(destMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    setDestinationChartData(destData);
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString([], {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes && minutes !== 0) return "-";
    return `${minutes} min`;
  };

  const exportToCsv = () => {
    const escapeCSV = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return "";
      return typeof value === "string"
        ? `"${value.replace(/"/g, '""')}"`
        : value;
    };

    try {
      let csvContent = "";
      let filename = "";

      if (activeTab === "summary") {
        // NOTE: CSV columns unchanged per your request.
        csvContent =
          "Student Name,Period,Total Exits,Total Duration (min),Average Duration (min),Top Destination\n";
        summaryData.forEach((row) => {
          csvContent +=
            [
              escapeCSV(row.studentName),
              escapeCSV(row.periodName || "No Period"),
              escapeCSV(row.totalExits),
              escapeCSV(row.totalDuration),
              escapeCSV(row.averageDuration),
              escapeCSV(row.topDestination || "-"),
            ].join(",") + "\n";
        });
        filename = "summary-report.csv";
      } else {
        csvContent =
          "Student Name,Period,Destination,Exit Date/Time,Return Date/Time,Duration (min),Status\n";
        filteredExits.forEach((exit) => {
          csvContent +=
            [
              escapeCSV(exit.studentName),
              escapeCSV(exit.periodName || "No Period"),
              escapeCSV(exit.destination || "-"),
              escapeCSV(formatDateTime(exit.exitTime)),
              escapeCSV(formatDateTime(exit.returnTime)),
              escapeCSV(exit.duration),
              escapeCSV(exit.status),
            ].join(",") + "\n";
        });
        filename = "detailed-report.csv";
      }

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  const handleSchoolYearChange = (value: string) => {
    setSelectedSchoolYearId(value);
    setSelectedPeriodId("all");
  };
  const handlePeriodChange = (value: string) => setSelectedPeriodId(value);
  const handleStudentChange = (value: string) => setSelectedStudentId(value);
  const toggleCharts = () => setShowCharts(!showCharts);

  const indexOfLastExit = currentPage * itemsPerPage;
  const indexOfFirstExit = indexOfLastExit - itemsPerPage;
  const currentExits = filteredExits.slice(indexOfFirstExit, indexOfLastExit);
  const totalPages = Math.ceil(filteredExits.length / itemsPerPage);
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

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

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Student Reports</h1>

        {isClient && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Report Filters</CardTitle>
                <CardDescription>
                  Select filters to generate reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* School Year Filter */}
                  <div>
                    <Label htmlFor="school-year-filter" className="mb-2 block">
                      School Year
                    </Label>
                    <Select
                      value={selectedSchoolYearId}
                      onValueChange={handleSchoolYearChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All School Years" />
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

                  {/* Date Range - Start Date */}
                  <div>
                    <Label htmlFor="start-date" className="mb-2 block">
                      Start Date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date Range - End Date */}
                  <div>
                    <Label htmlFor="end-date" className="mb-2 block">
                      End Date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Period Filter */}
                  <div>
                    <Label htmlFor="period-filter" className="mb-2 block">
                      Filter by Period
                    </Label>
                    <Select
                      value={selectedPeriodId}
                      onValueChange={handlePeriodChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Periods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
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
                                if (!acc[yearName]) acc[yearName] = [];
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

                  {/* Student Filter Dropdown */}
                  <div>
                    <Label htmlFor="student-filter" className="mb-2 block">
                      Filter by Student
                    </Label>
                    <Select
                      value={selectedStudentId}
                      onValueChange={handleStudentChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Students" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Export Button */}
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={exportToCsv}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs
              defaultValue="summary"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="summary">Summary Report</TabsTrigger>
                <TabsTrigger value="detailed">Detailed Report</TabsTrigger>
                <TabsTrigger value="charts">Visualizations</TabsTrigger>
              </TabsList>

              {/* ------------------ SUMMARY ------------------ */}
              <TabsContent value="summary">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary Report</CardTitle>
                    <CardDescription>
                      Summary of student room exits during the selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {summaryData.length === 0 ? (
                      <p className="text-muted-foreground text-center py-6">
                        No data available for the selected filters
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Period</TableHead>
                              <TableHead>Total Exits</TableHead>
                              {/* NEW: Total Behavior column (Pos + Neg) */}
                              <TableHead>Total Behavior</TableHead>
                              <TableHead>Total Duration</TableHead>
                              <TableHead>Avg. Duration</TableHead>
                              <TableHead>Destination</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {summaryData.map((row) => {
                              const bc = behaviorCounts[row.studentId];
                              const totalBehavior = bc ? bc.total : 0;
                              return (
                                <TableRow key={row.studentId}>
                                  <TableCell className="font-medium">
                                    {row.studentName}
                                  </TableCell>
                                  <TableCell>
                                    {row.periodName || "No Period"}
                                  </TableCell>
                                  <TableCell>{row.totalExits}</TableCell>
                                  {/* NEW: show total behavior */}
                                  <TableCell>{totalBehavior}</TableCell>
                                  <TableCell>
                                    {formatDuration(row.totalDuration)}
                                  </TableCell>
                                  <TableCell>
                                    {formatDuration(row.averageDuration)}
                                  </TableCell>
                                  <TableCell>
                                    {row.topDestination || "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ------------------ DETAILED ------------------ */}
              <TabsContent value="detailed">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Report</CardTitle>
                    <CardDescription>
                      Detailed record of student exits and returns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredExits.length === 0 ? (
                      <p className="text-muted-foreground text-center py-6">
                        No data available for the selected filters
                      </p>
                    ) : (
                      <>
                        <div className="rounded-md border">
                          <Table className="table-fixed w-full">
                            <TableHeader>
                              <TableRow>
                                <TableHead rowSpan={2} className="w-[12%]">
                                  Student
                                </TableHead>
                                <TableHead rowSpan={2} className="w-[12%]">
                                  Period
                                </TableHead>

                                {/* Grouped header */}
                                <TableHead
                                  colSpan={2}
                                  className="w-[16%] text-center"
                                >
                                  Behavior
                                </TableHead>

                                <TableHead rowSpan={2} className="w-[14%]">
                                  Destination
                                </TableHead>
                                <TableHead rowSpan={2} className="w-[14%]">
                                  Exit Date/Time
                                </TableHead>
                                <TableHead rowSpan={2} className="w-[14%]">
                                  Return Date/Time
                                </TableHead>
                                <TableHead rowSpan={2} className="w-[10%]">
                                  Duration
                                </TableHead>
                                <TableHead rowSpan={2} className="w-[8%]">
                                  Status
                                </TableHead>
                              </TableRow>

                              {/* Sub-headers for Behavior */}
                              <TableRow>
                                <TableHead className="w-[8%] text-red-600">
                                  Neg
                                </TableHead>
                                <TableHead className="w-[8%] text-green-600">
                                  Pos
                                </TableHead>
                              </TableRow>
                            </TableHeader>

                            <TableBody>
                              {currentExits.map((exit) => {
                                const bc = behaviorCounts[exit.studentId] || {
                                  pos: 0,
                                  neg: 0,
                                  total: 0,
                                };
                                return (
                                  <TableRow key={exit.id}>
                                    <TableCell className="font-medium">
                                      {exit.studentName}
                                    </TableCell>
                                    <TableCell>
                                      {exit.periodName || "No Period"}
                                    </TableCell>
                                    {/* NEW: Neg / Pos cells */}
                                    <TableCell className="text-red-600">
                                      {bc.neg}
                                    </TableCell>
                                    <TableCell className="text-green-600">
                                      {bc.pos}
                                    </TableCell>
                                    <TableCell>
                                      {exit.destination || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {formatDateTime(exit.exitTime)}
                                    </TableCell>
                                    <TableCell>
                                      {formatDateTime(exit.returnTime)}
                                    </TableCell>
                                    <TableCell>
                                      {formatDuration(exit.duration)}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={cn(
                                          "px-2 py-1 rounded-full text-xs font-medium",
                                          exit.status === "out"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-green-100 text-green-800"
                                        )}
                                      >
                                        {exit.status === "out"
                                          ? "Out"
                                          : "Returned"}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between space-x-2 py-4">
                          <div className="text-sm text-muted-foreground">
                            Showing{" "}
                            <span className="font-medium">
                              {indexOfFirstExit + 1}
                            </span>{" "}
                            to{" "}
                            <span className="font-medium">
                              {Math.min(indexOfLastExit, filteredExits.length)}
                            </span>{" "}
                            of{" "}
                            <span className="font-medium">
                              {filteredExits.length}
                            </span>{" "}
                            entries
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={prevPage}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            {Array.from({
                              length: Math.min(5, totalPages),
                            }).map((_, index) => {
                              let pageToShow = currentPage - 2 + index;
                              if (currentPage < 3) {
                                pageToShow = index + 1;
                              } else if (currentPage > totalPages - 2) {
                                pageToShow = totalPages - 4 + index;
                              }
                              if (pageToShow > 0 && pageToShow <= totalPages) {
                                return (
                                  <Button
                                    key={pageToShow}
                                    variant={
                                      currentPage === pageToShow
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => paginate(pageToShow)}
                                  >
                                    {pageToShow}
                                  </Button>
                                );
                              }
                              return null;
                            })}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={nextPage}
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ------------------ CHARTS (unchanged) ------------------ */}
              <TabsContent value="charts">
                {filteredExits.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-center py-6">
                        No data available for the selected filters
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Top Students by Exit Count */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Students by Exit Count</CardTitle>
                        <CardDescription>
                          Students with the most room exits during the selected
                          period
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={studentExitsChartData}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Legend />
                              <Bar
                                dataKey="value"
                                name="Number of Exits"
                                fill="#8884d8"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Student Time Out of Class */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Student Time Out of Class</CardTitle>
                        <CardDescription>
                          Total duration (minutes) students spent out of class
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={studentDurationChartData}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis
                                allowDecimals={false}
                                label={{
                                  value: "Minutes",
                                  angle: -90,
                                  position: "insideLeft",
                                }}
                              />
                              <Tooltip
                                formatter={(value) => [
                                  `${value} minutes`,
                                  "Duration",
                                ]}
                              />
                              <Legend />
                              <Bar
                                dataKey="value"
                                name="Minutes Out of Class"
                                fill="#FF8042"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Exits by Period */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Exits by Period</CardTitle>
                        <CardDescription>
                          Distribution of room exits across class periods
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
                          {/* Pie Chart */}
                          <div className="h-[300px] w-full lg:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={periodExitsChartData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={100}
                                  fill="#8884d8"
                                  label={({ name, percent }) =>
                                    `${name}: ${(percent * 100).toFixed(0)}%`
                                  }
                                >
                                  {periodExitsChartData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => [
                                    `${value} exits`,
                                    "Count",
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Bar Chart */}
                          <div className="h-[300px] w-full lg:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={periodExitsChartData}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                                layout="vertical"
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis
                                  dataKey="name"
                                  type="category"
                                  width={100}
                                />
                                <Tooltip />
                                <Bar
                                  dataKey="value"
                                  name="Number of Exits"
                                  fill="#82ca9d"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Exits by Destination */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Exits by Destination</CardTitle>
                        <CardDescription>
                          Where students are going during the selected period
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
                          {/* Pie Chart */}
                          <div className="h-[300px] w-full lg:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={destinationChartData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={100}
                                  fill="#8884d8"
                                  label={({ name, percent }) =>
                                    `${name}: ${(percent * 100).toFixed(0)}%`
                                  }
                                >
                                  {destinationChartData.map((entry, index) => (
                                    <Cell
                                      key={`dest-cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => [
                                    `${value} exits`,
                                    "Count",
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Horizontal Bar Chart */}
                          <div className="h-[300px] w-full lg:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={destinationChartData}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                                layout="vertical"
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis
                                  dataKey="name"
                                  type="category"
                                  width={120}
                                />
                                <Tooltip />
                                <Bar
                                  dataKey="value"
                                  name="Number of Exits"
                                  fill="#00C49F"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Students by Positive Behavior */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Students — Positive Behavior</CardTitle>
                        <CardDescription>
                          Positive behavior during the selected period
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={positiveBehaviorChartData}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Legend />
                              <Bar
                                dataKey="value"
                                name="Number of positive behavior"
                                fill="#22c55e" // green
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Students by Negative Behavior */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Students — Negative Behavior</CardTitle>
                        <CardDescription>
                          Negative behavior during the selected period
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={negativeBehaviorChartData}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Legend />
                              <Bar
                                dataKey="value"
                                name="Number of negative behavior"
                                fill="#ef4444" // red
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Time Patterns */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Exit Time Patterns</CardTitle>
                        <CardDescription>
                          Analysis of when students tend to leave the classroom
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Time of Day Distribution */}
                          <div>
                            <h3 className="text-sm font-semibold mb-4">
                              Time of Day Distribution
                            </h3>
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={timeDistributionData}
                                  margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                  }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar
                                    dataKey="exits"
                                    name="Room Exits"
                                    fill="#8884d8"
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Day of Week Distribution */}
                          <div>
                            <h3 className="text-sm font-semibold mb-4">
                              Day of Week Distribution
                            </h3>
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={dayDistributionData.sort(
                                    (a, b) => a.day - b.day
                                  )}
                                  margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                  }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar
                                    dataKey="exits"
                                    name="Room Exits"
                                    fill="#82ca9d"
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
