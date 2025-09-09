"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
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
import { 
  Save, 
  ArrowUpDown, 
  Check, 
  FileBarChart
} from "lucide-react";
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
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";

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
  status: 'present' | 'absent' | 'tardy';
  // NEW: track which period this record belongs to
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

type SortField = 'name' | 'studentId';
type SortDirection = 'asc' | 'desc';

export default function AttendancePage() {
  const { currentUser } = useAuth();
  // const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  
  // Data states
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [schoolYears, setSchoolYears] = useState<{id: string; name: string;}[]>([]);
  
  // UI states
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>("all");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Attendance states
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);
  
  // Sorting states
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Active tab
  const [activeTab, setActiveTab] = useState("take-attendance");
  
  // Reports states
  const [reportStartDate, setReportStartDate] = useState<Date>(new Date());
  const [reportEndDate, setReportEndDate] = useState<Date>(new Date());
  const [reportPeriodId, setReportPeriodId] = useState<string>("all");
  const [reportStudentId, setReportStudentId] = useState<string>("all");
  const [reportData, setReportData] = useState<any[]>([]);
  
  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<any>({
    summary: { present: 0, absent: 0, tardy: 0 },
    dailyTrends: [],
    studentStats: [],
    periodStats: []
  });

  // Initialize data
  useEffect(() => {
    if (currentUser) {
      fetchPeriods();
      fetchStudents();
    }
  }, [currentUser]);

  // Filter students when period selection changes
  useEffect(() => {
    if (selectedPeriodId && selectedPeriodId !== "all") {
      const filtered = students.filter(student => 
        student.periods.some(p => p.id === selectedPeriodId)
      );
      setFilteredStudents(filtered);
      initializeAttendanceRecords(filtered);
    } else {
      setFilteredStudents([]);
      setAttendanceRecords([]);
    }
  }, [selectedPeriodId, students]);

  // Load existing attendance when date or period changes
  useEffect(() => {
    if (selectedPeriodId && selectedDate) {
      loadExistingAttendance();
    }
  }, [selectedPeriodId, selectedDate]);

  const fetchPeriods = async () => {
    try {
      // Fetch school years first
      const schoolYearsQuery = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser?.uid)
      );
      const schoolYearsSnapshot = await getDocs(schoolYearsQuery);
      const schoolYearsList = schoolYearsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "Unnamed School Year",
        };
      });

      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser?.uid)
      );
      const periodsSnapshot = await getDocs(periodsQuery);
      
      const periodsList = periodsSnapshot.docs.map(doc => {
        const data = doc.data();
        const schoolYear = schoolYearsList.find((sy) => sy.id === data.schoolYearId);
        return {
          id: doc.id,
          name: data.name,
          schoolYearName: schoolYear?.name || "Unknown School Year",
        };
      });
      
      const sortedPeriods = periodsList.sort((a, b) => {
        if (a.schoolYearName !== b.schoolYearName) {
          return a.schoolYearName!.localeCompare(b.schoolYearName!);
        }
        return a.name.localeCompare(b.name);
      });
      
      setPeriods(sortedPeriods);
      setSchoolYears(schoolYearsList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching periods:", error);
      toast.error("Failed to load periods");
    }
  };

  const fetchStudents = async () => {
    try {
      const studentsQuery = query(
        collection(db, "students"), 
        where("teacherId", "==", currentUser?.uid)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      const studentsList = studentsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          studentId: data.studentId,
          periods: data.periods || [],
        };
      });
      
      setStudents(studentsList);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
      setLoading(false);
    }
  };

  const initializeAttendanceRecords = (studentList: Student[]) => {
    const records = studentList.map(student => ({
      studentId: student.id,            // keep studentId the same
      studentName: student.name,
      status: 'present' as const,
      periodId: selectedPeriodId        // NEW: tag record with current period
    }));
    setAttendanceRecords(records);
    setHasUnsavedChanges(false);
  };

  const loadExistingAttendance = async () => {
    if (!selectedPeriodId || !selectedDate || !currentUser) return;
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const sessionId = `${currentUser.uid}_${selectedPeriodId}_${dateStr}`;
      
      const sessionDoc = await getDoc(doc(db, "attendance", sessionId));
      
      if (sessionDoc.exists()) {
        const data = sessionDoc.data() as AttendanceSession;
        setAttendanceRecords(data.records);
        setExistingSessionId(sessionId);
        setHasUnsavedChanges(false);
        toast.success("Loaded existing attendance for this date");
      } else {
        setExistingSessionId(null);
        if (filteredStudents.length > 0) {
          initializeAttendanceRecords(filteredStudents);
        }
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast.error("Failed to load existing attendance");
    }
  };

  const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'tardy') => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        // match both student and current period so periods don’t clash
        (record.studentId === studentId && record.periodId === selectedPeriodId)
          ? { ...record, status }
          : record
      )
    );
    setHasUnsavedChanges(true);
  };

  const markAllAsPresent = () => {
    setAttendanceRecords(prev => 
      prev.map(record => ({ ...record, status: 'present' as const }))
    );
    setHasUnsavedChanges(true);
    toast.success("All students marked as present");
  };

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
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const sessionId = `${currentUser.uid}_${selectedPeriodId}_${dateStr}`;
      const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
      
      const attendanceSession: AttendanceSession = {
        id: sessionId,
        teacherId: currentUser.uid,
        periodId: selectedPeriodId,
        periodName: selectedPeriod?.name || 'Unknown Period',
        date: dateStr,
        records: attendanceRecords,
        lastModified: new Date()
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedStudents = () => {
    const studentsWithRecords = filteredStudents.map(student => {
      // find the record for this student in the CURRENT period only
      const record = attendanceRecords.find(
        r => r.studentId === student.id && r.periodId === selectedPeriodId
      );
      return {
        ...student,
        attendanceStatus: record?.status || 'present'
      };
    });

    return studentsWithRecords.sort((a, b) => {
      let valueA: string;
      let valueB: string;

      if (sortField === 'name') {
        valueA = a.name.toLowerCase();
        valueB = b.name.toLowerCase();
      } else {
        valueA = a.studentId.toLowerCase();
        valueB = b.studentId.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return valueA.localeCompare(valueB);
      } else {
        return valueB.localeCompare(valueA);
      }
    });
  };

  const generateAnalytics = (records: any[]) => {
    // Summary statistics
    const summary = {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      tardy: records.filter(r => r.status === 'tardy').length
    };
    
    // Daily trends - group by date
    const dailyData = records.reduce((acc, record) => {
      const date = record.date;
      if (!acc[date]) {
        acc[date] = { date, present: 0, absent: 0, tardy: 0 };
      }
      acc[date][record.status]++;
      return acc;
    }, {} as Record<string, any>);
    
    const dailyTrends = Object.values(dailyData).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    ).map((day: any) => ({
      ...day,
      date: format(new Date(day.date), "MMM d"),
      total: day.present + day.absent + day.tardy,
      attendanceRate: Math.round((day.present / (day.present + day.absent + day.tardy)) * 100)
    }));
    
    // Student statistics
    const studentData = records.reduce((acc, record) => {
      const studentId = record.studentId;
      if (!acc[studentId]) {
        acc[studentId] = { 
          studentName: record.studentName,
          present: 0, 
          absent: 0, 
          tardy: 0 
        };
      }
      acc[studentId][record.status]++;
      return acc;
    }, {} as Record<string, any>);
    
    const studentStats = Object.values(studentData).map((student: any) => ({
      ...student,
      total: student.present + student.absent + student.tardy,
      attendanceRate: Math.round((student.present / (student.present + student.absent + student.tardy)) * 100)
    })).sort((a: any, b: any) => b.attendanceRate - a.attendanceRate);
    
    // Period statistics
    const periodData = records.reduce((acc, record) => {
      const periodName = record.periodName;
      if (!acc[periodName]) {
        acc[periodName] = { periodName, present: 0, absent: 0, tardy: 0 };
      }
      acc[periodName][record.status]++;
      return acc;
    }, {} as Record<string, any>);
    
    const periodStats = Object.values(periodData).map((period: any) => ({
      ...period,
      total: period.present + period.absent + period.tardy,
      attendanceRate: Math.round((period.present / (period.present + period.absent + period.tardy)) * 100)
    })).sort((a: any, b: any) => b.attendanceRate - a.attendanceRate);
    
    return { summary, dailyTrends, studentStats, periodStats };
  };

  const generateReport = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      const startDateStr = format(reportStartDate, 'yyyy-MM-dd');
      const endDateStr = format(reportEndDate, 'yyyy-MM-dd');
      
      // Query attendance records
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("teacherId", "==", currentUser.uid)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      let reportRecords: any[] = [];
      
      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data() as AttendanceSession;
        
        // Filter by date range
        if (data.date >= startDateStr && data.date <= endDateStr) {
          // Filter by period if specified
          if (reportPeriodId === "all" || data.periodId === reportPeriodId) {
            data.records.forEach(record => {
              // Filter by student if specified
              if (reportStudentId === "all" || record.studentId === reportStudentId) {
                // Find the actual student ID from the students list
                const student = students.find(s => s.id === record.studentId);
                const actualStudentId = student?.studentId || record.studentId;
                
                reportRecords.push({
                  date: data.date,
                  periodName: data.periodName,
                  studentName: record.studentName,
                  studentId: actualStudentId,
                  status: record.status
                });
              }
            });
          }
        }
      });
      
      // Sort by date, then by student name
      reportRecords.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.studentName.localeCompare(b.studentName);
      });
      
      setReportData(reportRecords);
      
      // Generate analytics data
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

  // Show loading while checking subscription
  // if (subscriptionLoading) {
  //   return (
  //     <ProtectedRoute>
  //       <div className="flex justify-center items-center h-screen">
  //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  //       </div>
  //     </ProtectedRoute>
  //   );
  // }

  // // Show no access if user doesn't have subscription
  // if (!hasAccess) {
  //   return (
  //     <ProtectedRoute>
  //       <NoAccess 
  //         title="Attendance Management" 
  //         description="Access to attendance management requires an active subscription." 
  //       />
  //     </ProtectedRoute>
  //   );
  // }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Attendance Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="take-attendance" className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Take Attendance
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Take Attendance Tab */}
          <TabsContent value="take-attendance" className="space-y-6">
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
                    <Select value={selectedSchoolYearId} onValueChange={setSelectedSchoolYearId}>
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
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Filter periods by selected school year if any
                          let filteredPeriods = periods;
                          if (selectedSchoolYearId !== "all") {
                            const selectedSchoolYear = schoolYears.find(sy => sy.id === selectedSchoolYearId);
                            if (selectedSchoolYear) {
                              filteredPeriods = periods.filter(period => 
                                period.schoolYearName === selectedSchoolYear.name
                              );
                            }
                          }

                          // Group periods by school year (if showing all school years)
                          if (selectedSchoolYearId === "all") {
                            const groupedPeriods = filteredPeriods.reduce((acc, period) => {
                              const yearName = period.schoolYearName || "Unknown School Year";
                              if (!acc[yearName]) {
                                acc[yearName] = [];
                              }
                              acc[yearName].push(period);
                              return acc;
                            }, {} as Record<string, Period[]>);

                            return Object.entries(groupedPeriods).map(([yearName, yearPeriods]) => (
                              <div key={yearName}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50 rounded-sm mt-1 mb-1">
                                  {yearName}
                                </div>
                                {yearPeriods.map((period) => (
                                  <SelectItem key={period.id} value={period.id} className="pl-6">
                                    {period.name}
                                  </SelectItem>
                                ))}
                              </div>
                            ));
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
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      Attendance for {periods.find(p => p.id === selectedPeriodId)?.name} - {format(selectedDate, "PPP")}
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
                    <p className="text-sm text-amber-600">You have unsaved changes</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sorting Controls */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-2"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        Sort by Name
                        {sortField === 'name' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSort('studentId')}
                        className="flex items-center gap-2"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        Sort by ID
                        {sortField === 'studentId' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Students Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Student ID</TableHead>
                            <TableHead className="text-center">Attendance Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getSortedStudents().map((student) => {
                            const record = attendanceRecords.find(
                              r => r.studentId === student.id && r.periodId === selectedPeriodId
                            );
                            const status = record?.status || 'present';

                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.studentId}</TableCell>
                                <TableCell>
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      variant={status === 'present' ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => updateAttendanceStatus(student.id, 'present')}
                                      className={`${
                                        status === 'present' 
                                          ? 'bg-green-600 hover:bg-green-700' 
                                          : 'hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                                      }`}
                                    >
                                      Present
                                    </Button>
                                    <Button
                                      variant={status === 'tardy' ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => updateAttendanceStatus(student.id, 'tardy')}
                                      className={`${
                                        status === 'tardy' 
                                          ? 'bg-yellow-600 hover:bg-yellow-700' 
                                          : 'hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700'
                                      }`}
                                    >
                                      Tardy
                                    </Button>
                                    <Button
                                      variant={status === 'absent' ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => updateAttendanceStatus(student.id, 'absent')}
                                      className={`${
                                        status === 'absent' 
                                          ? 'bg-red-600 hover:bg-red-700' 
                                          : 'hover:bg-red-50 hover:border-red-300 hover:text-red-700'
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

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {attendanceRecords.filter(r => r.status === 'present').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Present</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {attendanceRecords.filter(r => r.status === 'tardy').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Tardy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {attendanceRecords.filter(r => r.status === 'absent').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Absent</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedPeriodId && filteredStudents.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No students found for the selected period.</p>
                </CardContent>
              </Card>
            )}

            {!selectedPeriodId && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Please select a period to begin taking attendance.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                    <Select value={reportPeriodId} onValueChange={setReportPeriodId}>
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
                    <Select value={reportStudentId} onValueChange={setReportStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All students" />
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

                <Button onClick={generateReport} disabled={loading} className="flex items-center gap-2">
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <FileBarChart className="h-4 w-4" />
                  )}
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            {/* Analytics Dashboard */}
            {reportData.length > 0 && (
              <>
                {/* Summary Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Summary Cards */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {analyticsData.summary.present}
                        </div>
                        <div className="text-sm text-muted-foreground">Present</div>
                        <div className="text-xs text-green-600">
                          {reportData.length > 0 && Math.round((analyticsData.summary.present / reportData.length) * 100)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600">
                          {analyticsData.summary.tardy}
                        </div>
                        <div className="text-sm text-muted-foreground">Tardy</div>
                        <div className="text-xs text-yellow-600">
                          {reportData.length > 0 && Math.round((analyticsData.summary.tardy / reportData.length) * 100)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-600">
                          {analyticsData.summary.absent}
                        </div>
                        <div className="text-sm text-muted-foreground">Absent</div>
                        <div className="text-xs text-red-600">
                          {reportData.length > 0 && Math.round((analyticsData.summary.absent / reportData.length) * 100)}%
                        </div>
                      </div>
                      
                      {/* Pie Chart */}
                      <div className="flex justify-center">
                        <ResponsiveContainer width={120} height={120}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Present', value: analyticsData.summary.present, color: '#16a34a' },
                                { name: 'Tardy', value: analyticsData.summary.tardy, color: '#ca8a04' },
                                { name: 'Absent', value: analyticsData.summary.absent, color: '#dc2626' }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={50}
                              dataKey="value"
                            >
                              {[
                                { name: 'Present', value: analyticsData.summary.present, color: '#16a34a' },
                                { name: 'Tardy', value: analyticsData.summary.tardy, color: '#ca8a04' },
                                { name: 'Absent', value: analyticsData.summary.absent, color: '#dc2626' }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
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
                  <Card>
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
                  <Card>
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
                          <Bar dataKey="attendanceRate" fill="#3b82f6" name="Attendance Rate %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Period Performance Chart */}
                {analyticsData.periodStats.length > 1 && (
                  <Card>
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
                          <Bar dataKey="present" fill="#16a34a" name="Present" />
                          <Bar dataKey="tardy" fill="#ca8a04" name="Tardy" />
                          <Bar dataKey="absent" fill="#dc2626" name="Absent" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Report Results */}
            {reportData.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Detailed Attendance Records ({reportData.length} records)</CardTitle>
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
                            <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                            <TableCell>{record.periodName}</TableCell>
                            <TableCell className="font-medium">{record.studentName}</TableCell>
                            <TableCell>{record.studentId}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                record.status === 'present' 
                                  ? 'bg-green-100 text-green-800'
                                  : record.status === 'tardy'
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
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

            {reportData.length === 0 && reportStartDate && reportEndDate && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No attendance records found for the selected criteria.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
