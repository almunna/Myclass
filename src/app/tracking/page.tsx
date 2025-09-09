"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp, orderBy, addDoc, getDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn, Clock, Search, Edit, Plus, Minus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";

/* NEW: Behavior modal import */
import { BehaviorModal } from "@/components/behavior/BehaviorModal";

interface Student {
  id: string;
  name: string;
  studentId: string;
  // Support both old (single period) and new (multiple periods) formats
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

type Destination =
  | "restroom"
  | "deans"
  | "frontOffice"
  | "guidance"
  | "library";

const DESTINATIONS: { value: Destination; label: string }[] = [
  { value: "restroom", label: "Restroom" },
  { value: "deans", label: "Dean’s" },
  { value: "frontOffice", label: "Front office" },
  { value: "guidance", label: "Guidance" },
  { value: "library", label: "Library" },
  
];

const destinationLabel = (d?: Destination | null) =>
  DESTINATIONS.find((x) => x.value === d)?.label ?? "-";

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
  destination?: Destination; // NEW
}

export default function TrackingPage() {
  // Add useClient flag to avoid hydration mismatch
  const { currentUser } = useAuth();
  // const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [isClient, setIsClient] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>("all");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");

  // NEW: destination state per-student (default restroom)
  const [destinationByStudent, setDestinationByStudent] = useState<
    Record<string, Destination>
  >({});

  // Separate filters for each table
  const [activeExitsStudentFilter, setActiveExitsStudentFilter] = useState<string>("all");
  const [completedExitsStudentFilter, setCompletedExitsStudentFilter] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeExits, setActiveExits] = useState<RoomExit[]>([]);
  const [completedExits, setCompletedExits] = useState<RoomExit[]>([]);
  const [filteredActiveExits, setFilteredActiveExits] = useState<RoomExit[]>([]);
  const [filteredCompletedExits, setFilteredCompletedExits] = useState<RoomExit[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit time dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExit, setEditingExit] = useState<RoomExit | null>(null);
  const [editExitTime, setEditExitTime] = useState("");
  const [editReturnTime, setEditReturnTime] = useState("");
  const [editDestination, setEditDestination] = useState<Destination>("restroom"); // <-- NEW

  /* NEW: Behavior modal state */
  const [behaviorOpen, setBehaviorOpen] = useState(false);
  const [behaviorStudent, setBehaviorStudent] = useState<{ id: string; name: string; studentId: string; periodsLabel: string } | null>(null);

  // Initialize client-side rendering flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPeriods(),
        fetchStudents()
      ]);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Fetch periods
  const fetchPeriods = async () => {
    try {
      // Fetch school years first
      const schoolYearsQuery = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser?.uid)
      );
      const schoolYearsSnapshot = await getDocs(schoolYearsQuery);
      const schoolYearsList: any[] = schoolYearsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Create a query to filter periods by teacherId
      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser?.uid)
      );
      const periodsSnapshot = await getDocs(periodsQuery);
      const periodsList = periodsSnapshot.docs.map((doc) => {
        const data = doc.data();
        const schoolYear = schoolYearsList.find((sy) => sy.id === data.schoolYearId);
        return {
          id: doc.id,
          name: data.name,
          schoolYearName: schoolYear?.name || "Unknown School Year",
        };
      }) as Period[];

      // Sort by school year first, then by period name
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

  // Fetch students
  const fetchStudents = async () => {
    try {
      // Create a query to filter students by teacherId
      const studentsQuery = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser?.uid)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentsList = studentsSnapshot.docs.map((doc) => {
        const data = doc.data();
        const student: Student = {
          id: doc.id,
          name: data.name,
          studentId: data.studentId,
        };

        // Handle both old (single period) and new (multiple periods) formats
        if (Array.isArray(data.periods) && data.periods.length > 0) {
          // Use the first period as default for new exits
          student.periodId = data.periods[0].id;
          student.periodName = data.periods[0].name;
          student.periods = data.periods;
        } else if (data.periodId) {
          student.periodId = data.periodId;
          student.periodName = data.periodName;
        }

        return student;
      }) as Student[];

      setStudents(studentsList.sort((a, b) => a.name.localeCompare(b.name)));
      setFilteredStudents(studentsList);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    }
  };

  // Fetch room exits
  const fetchRoomExits = async () => {
    try {
      // Check if collection exists by trying to get one document
      const testQuery = await getDocs(
        query(collection(db, "roomExits"), where("teacherId", "==", currentUser?.uid))
      );

      // If collection doesn't exist or is empty, return empty arrays
      if (testQuery.empty) {
        setActiveExits([]);
        setCompletedExits([]);
        return;
      }

      // Collection exists, proceed with queries
      try {
        // Get active exits (students out of the room)
        const activeExitsSnapshot = await getDocs(
          query(
            collection(db, "roomExits"),
            where("status", "==", "out"),
            where("teacherId", "==", currentUser?.uid)
          )
        );

        const activeExitsList = activeExitsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RoomExit[];

        setActiveExits(activeExitsList);

        // Get completed exits (students who returned)
        const completedExitsSnapshot = await getDocs(
          query(
            collection(db, "roomExits"),
            where("status", "==", "returned"),
            where("teacherId", "==", currentUser?.uid)
          )
        );

        const completedExitsList = completedExitsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RoomExit[];

        // Sort manually since we removed orderBy (which requires indexes)
        completedExitsList.sort((a, b) => {
          const dateA = a.returnTime?.toDate?.() || new Date(0);
          const dateB = b.returnTime?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime(); // descending (newest first)
        });

        setCompletedExits(completedExitsList.slice(0, 20));
      } catch (indexError) {
        console.error("Index error in room exits query:", indexError);
        // Fallback to simpler queries without ordering
        const allExitsSnapshot = await getDocs(
          query(
            collection(db, "roomExits"),
            where("teacherId", "==", currentUser?.uid)
          )
        );

        const allExits = allExitsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RoomExit[];

        const activeExitsList = allExits.filter(exit => exit.status === "out");
        const completedExitsList = allExits.filter(exit => exit.status === "returned");

        setActiveExits(activeExitsList);
        setCompletedExits(completedExitsList.slice(0, 20));
      }
    } catch (error) {
      console.error("Error fetching room exits:", error);
      // Don't show error toast for missing collection
      // Just set empty arrays
      setActiveExits([]);
      setCompletedExits([]);
    }
  };

  // Update filtered students when period selection or search changes
  useEffect(() => {
    // Filter logic
    let filtered = students;

    // First filter by school year
    if (selectedSchoolYearId !== "all") {
      filtered = filtered.filter((student) => {
        // If student has multiple periods, check if any period belongs to the selected school year
        if (student.periods && student.periods.length > 0) {
          return student.periods.some(p => {
            const period = periods.find(period => period.id === p.id);
            return period && period.schoolYearName === schoolYears.find(sy => sy.id === selectedSchoolYearId)?.name;
          });
        }
        // Otherwise, check the single periodId
        if (student.periodId) {
          const period = periods.find(period => period.id === student.periodId);
          return period && period.schoolYearName === schoolYears.find(sy => sy.id === selectedSchoolYearId)?.name;
        }
        return false;
      });
    }

    // Filter by selected period
    if (selectedPeriodId !== "all") {
      filtered = filtered.filter((student) => {
        // If student has multiple periods, check if the selected period is in the array
        if (student.periods && student.periods.length > 0) {
          return student.periods.some(p => p.id === selectedPeriodId);
        }
        // Otherwise, check the single periodId
        return student.periodId === selectedPeriodId;
      });
    }

    // Filter by selected student
    if (selectedStudentId !== "all") {
      filtered = filtered.filter((student) => student.id === selectedStudentId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(query) ||
          student.studentId.toLowerCase().includes(query)
      );
    }

    setFilteredStudents(filtered);
  }, [selectedSchoolYearId, selectedPeriodId, selectedStudentId, searchQuery, students, periods, schoolYears]);

  // Filter activeExits based on selected filter
  useEffect(() => {
    let filtered = activeExits;

    // Apply student filter
    if (activeExitsStudentFilter !== "all") {
      filtered = filtered.filter(exit => exit.studentId === activeExitsStudentFilter);
    }

    setFilteredActiveExits(filtered);
  }, [activeExitsStudentFilter, activeExits]);

  // Filter completedExits based on selected filter
  useEffect(() => {
    let filtered = completedExits;

    // Apply student filter
    if (completedExitsStudentFilter !== "all") {
      filtered = filtered.filter(exit => exit.studentId === completedExitsStudentFilter);
    }

    setFilteredCompletedExits(filtered);
  }, [completedExitsStudentFilter, completedExits]);

  // Fetch room exits on period change or initial load
  useEffect(() => {
    if (!loading) {
      fetchRoomExits();
    }
  }, [loading]);

  // Initialize filtered exits when original exits change
  useEffect(() => {
    setFilteredActiveExits(activeExits);
    setFilteredCompletedExits(completedExits);
  }, [activeExits, completedExits]);

  // Format time from Firestore timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration in minutes
  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    return `${minutes} min`;
  };

  // Record the student leaving the room
  const handleRoomExit = async (studentId: string, chosenDestination?: Destination) => {
    if (!studentId) return;

    try {
      const studentDoc = await getDoc(doc(db, "students", studentId));
      if (!studentDoc.exists()) {
        console.error("Student not found:", studentId);
        return;
      }

      const studentData = studentDoc.data();
      const studentName = studentData.name;

      // Get period information
      let periodId = null;
      let periodName = null;

      if (selectedPeriodId && selectedPeriodId !== "all") {
        // Use the selected period
        const periodDoc = await getDoc(doc(db, "periods", selectedPeriodId));
        if (periodDoc.exists()) {
          periodId = selectedPeriodId;
          periodName = periodDoc.data().name;
        }
      } else if (studentData.periods && studentData.periods.length > 0) {
        // Use the first period from student
        periodId = studentData.periods[0].id;
        periodName = studentData.periods[0].name;
      } else if (studentData.periodId) {
        // Fall back to old format
        periodId = studentData.periodId;
        periodName = studentData.periodName;
      }

      // Destination (default restroom)
      const destination: Destination =
        chosenDestination ??
        destinationByStudent[studentId] ??
        "restroom";

      // Create the exit record
      const exitTime = new Date();
      const exitData = {
        studentId,
        studentName,
        periodId,
        periodName,
        exitTime,
        status: "out",
        teacherId: currentUser?.uid, // Associate with current teacher
        destination, // NEW
      };

      const docRef = await addDoc(collection(db, "roomExits"), exitData);

      setActiveExits(prev => [{
        id: docRef.id,
        ...exitData,
        returnTime: null,
        duration: null
      } as RoomExit, ...prev]);

      toast.success(`${studentName} has left the room (${destinationLabel(destination)})`);
    } catch (error) {
      console.error("Error recording room exit:", error);
      toast.error("Failed to record room exit");
    }
  };

  // Student returning to the room
  const handleStudentReturn = async (roomExit: RoomExit) => {
    try {
      // Get the current time
      const returnTime = new Date();

      // Calculate duration in minutes
      const exitTime = roomExit.exitTime.toDate ? roomExit.exitTime.toDate() : new Date(roomExit.exitTime);
      const durationMs = returnTime.getTime() - exitTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      // Update UI immediately
      setActiveExits(prev => prev.filter(exit => exit.id !== roomExit.id));

      // Add to completed exits for UI
      const updatedExit: RoomExit = {
        ...roomExit,
        returnTime: returnTime,
        duration: durationMinutes,
        status: "returned" as const
      };

      setCompletedExits(prev => [updatedExit, ...prev.slice(0, 19)]);

      // Update the room exit record in database
      await updateDoc(doc(db, "roomExits", roomExit.id), {
        returnTime: returnTime,
        duration: durationMinutes,
        status: "returned"
      });

      toast.success(`${roomExit.studentName} returned to the room`);
    } catch (error) {
      console.error("Error recording student return:", error);
      toast.error("Failed to record student return");

      // Refresh to get accurate data
      fetchRoomExits();
    }
  };

  const handleSchoolYearChange = (value: string) => {
    setSelectedSchoolYearId(value);
    // Reset period selection when school year changes
    setSelectedPeriodId("all");
  };

  const handlePeriodChange = (value: string) => {
    setSelectedPeriodId(value);
  };

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
  };

  const handleActiveExitsStudentFilter = (value: string) => {
    setActiveExitsStudentFilter(value);
  };

  const handleCompletedExitsStudentFilter = (value: string) => {
    setCompletedExitsStudentFilter(value);
  };

  // Handle opening edit dialog
  const handleEditTimes = (roomExit: RoomExit) => {
    setEditingExit(roomExit);

    // Format dates for datetime-local input
    const exitDate = roomExit.exitTime.toDate ? roomExit.exitTime.toDate() : new Date(roomExit.exitTime);
    setEditExitTime(formatDateTimeForInput(exitDate));

    if (roomExit.returnTime) {
      const returnDate = roomExit.returnTime.toDate ? roomExit.returnTime.toDate() : new Date(roomExit.returnTime);
      setEditReturnTime(formatDateTimeForInput(returnDate));
    } else {
      setEditReturnTime("");
    }

    // NEW: initialize destination in dialog (default restroom)
    setEditDestination((roomExit.destination as Destination) || "restroom");

    setEditDialogOpen(true);
  };

  // Format date for datetime-local input
  const formatDateTimeForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Adjust time by minutes
  const adjustTime = (timeString: string, minutesToAdd: number) => {
    if (!timeString) return "";
    const date = new Date(timeString);
    date.setMinutes(date.getMinutes() + minutesToAdd);
    return formatDateTimeForInput(date);
  };

  // Set time to current time
  const setToCurrentTime = () => {
    return formatDateTimeForInput(new Date());
  };

  // Calculate and format duration in real-time
  const calculateDuration = () => {
    if (!editExitTime) return "Exit time required";
    if (!editReturnTime) return "Return time not set";

    const exitDate = new Date(editExitTime);
    const returnDate = new Date(editReturnTime);

    if (exitDate >= returnDate) return "Return must be after exit";

    const durationMs = returnDate.getTime() - exitDate.getTime();
    const minutes = Math.round(durationMs / 60000);

    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  // Handle saving edited times
  const handleSaveEditedTimes = async () => {
    if (!editingExit || !editExitTime) {
      toast.error("Exit time is required");
      return;
    }

    try {
      const newExitTime = new Date(editExitTime);
      const newReturnTime = editReturnTime ? new Date(editReturnTime) : null;

      // Validate times
      if (newReturnTime && newExitTime >= newReturnTime) {
        toast.error("Return time must be after exit time");
        return;
      }

      // Calculate new duration
      let newDuration = null;
      if (newReturnTime) {
        const durationMs = newReturnTime.getTime() - newExitTime.getTime();
        newDuration = Math.round(durationMs / 60000);
      }

      // Determine new status
      const newStatus = newReturnTime ? "returned" : "out";

      // Update database
      await updateDoc(doc(db, "roomExits", editingExit.id), {
        exitTime: newExitTime,
        returnTime: newReturnTime,
        duration: newDuration,
        status: newStatus,
        destination: editDestination, // <-- NEW
      });

      // Update local state
      const updatedExit = {
        ...editingExit,
        exitTime: newExitTime,
        returnTime: newReturnTime,
        duration: newDuration,
        status: newStatus as "out" | "returned",
        destination: editDestination, // <-- NEW
      };

      if (newStatus === "out") {
        // Move to active exits if it's now "out"
        setActiveExits(prev => {
          const filtered = prev.filter(exit => exit.id !== editingExit.id);
          return [updatedExit, ...filtered];
        });
        setCompletedExits(prev => prev.filter(exit => exit.id !== editingExit.id));
      } else {
        // Move to completed exits if it's now "returned"
        setCompletedExits(prev => {
          const filtered = prev.filter(exit => exit.id !== editingExit.id);
          return [updatedExit, ...filtered];
        });
        setActiveExits(prev => prev.filter(exit => exit.id !== editingExit.id));
      }

      toast.success("Times updated successfully");
      setEditDialogOpen(false);
      setEditingExit(null);
    } catch (error) {
      console.error("Error updating times:", error);
      toast.error("Failed to update times");
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
  //         title="Student Tracking"
  //         description="Access to student tracking requires an active subscription."
  //       />
  //     </ProtectedRoute>
  //   );
  // }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Student Tracking</h1>

        {isClient && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Students Out</CardTitle>
                </CardHeader>
                <hr className="border-t border-gray-200" />
                <CardContent>
                  {filteredActiveExits.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No students currently out of the room
                    </p>
                  ) : (
                    <div className="max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Exit Date/Time</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Destination</TableHead>{/* NEW */}
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredActiveExits.map((exit) => (
                            <TableRow key={exit.id}>
                              <TableCell className="font-medium">{exit.studentName}</TableCell>
                              <TableCell>{formatTime(exit.exitTime)}</TableCell>
                              <TableCell>{exit.periodName || "-"}</TableCell>
                              <TableCell>{destinationLabel(exit.destination)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1"
                                    onClick={() => handleStudentReturn(exit)}
                                  >
                                    <LogIn className="h-4 w-4" />
                                    Return
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1"
                                    onClick={() => handleEditTimes(exit)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </Button>

                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    Recent Returns
                    <span className="text-xs text-muted-foreground font-normal">
                      (Times still editable)
                    </span>
                  </CardTitle>
                  <div className="w-40">
                    <Select
                      value={completedExitsStudentFilter}
                      onValueChange={handleCompletedExitsStudentFilter}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Filter Student" />
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
                </CardHeader>
                <hr className="border-t border-gray-200" />
                <CardContent>
                  {filteredCompletedExits.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 border blue-200 rounded-lg text-sm text-blue-700 border-blue-200">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Pro Tip:</span>
                        Click on any time or use "Edit Times" to modify exit/return times even after completion!
                      </div>
                    </div>
                  )}
                  {filteredCompletedExits.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No recent returns recorded
                    </p>
                  ) : (
                    <div className="max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Exit Date/Time</TableHead>
                            <TableHead>Return Date/Time</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Destination</TableHead>{/* NEW */}
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCompletedExits.map((exit) => (
                            <TableRow key={exit.id} className="hover:bg-blue-50/50">
                              <TableCell className="font-medium">{exit.studentName}</TableCell>
                              <TableCell className="hover:text-blue-600 cursor-pointer" onClick={() => handleEditTimes(exit)} title="Click to edit time">
                                {formatTime(exit.exitTime)} <Edit className="h-3 w-3 inline ml-1 opacity-50" />
                              </TableCell>
                              <TableCell className="hover:text-blue-600 cursor-pointer" onClick={() => handleEditTimes(exit)} title="Click to edit time">
                                {formatTime(exit.returnTime)} <Edit className="h-3 w-3 inline ml-1 opacity-50" />
                              </TableCell>
                              <TableCell>{formatDuration(exit.duration)}</TableCell>
                              <TableCell>{destinationLabel(exit.destination)}</TableCell>
                              <TableCell>{exit.periodName || "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"
                                    onClick={() => handleEditTimes(exit)}
                                    title="Edit exit/return times"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit Times
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="bg-white shadow rounded-lg mb-6">
              <div className="p-4 border-b  flex flex-col md:flex-row  gap-4 justify-between items-center">
                <div className="flex flex-col md:flex-row w-full md:w-auto gap-2">

                  <div className="w-full md:w-64">
                    <Label htmlFor="school-year-filter" className="sr-only">Filter by School Year</Label>
                    <Select value={selectedSchoolYearId} onValueChange={handleSchoolYearChange}>
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

                  <div className="w-full md:w-64">
                    <Label htmlFor="period-filter" className="sr-only">Filter by Period</Label>
                    <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Periods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        {(() => {
                          // Filter periods by selected school year
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
                            // Just show periods without grouping when a school year is selected
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

                  <div className="relative w-full md:w-64">
                    <Label htmlFor="student-search" className="sr-only">Search Students</Label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="student-search"
                      placeholder="Search students..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4">
                <h2 className="text-lg font-semibold mb-4">Students</h2>

                {filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No students found matching your criteria
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map((student) => {
                      // Check if student is currently out
                      const isOut = activeExits.some((exit) => exit.studentId === student.id);

                      const currentDestination =
                        destinationByStudent[student.id] ?? "restroom";

                      // derive periods label for modal header
                      const periodsLabel =
                        selectedPeriodId !== "all"
                          ? periods.find(p => p.id === selectedPeriodId)?.name || "All Periods"
                          : (student.periods && student.periods.length > 0
                              ? student.periods.map(p => p.name).join(", ")
                              : (student.periodName || "All Periods"));

                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${isOut ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}
                        >
                          <div className="flex-1">
                            <h3 className="font-medium">{student.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {student.periods && student.periods.length > 0
                                ? student.periods.map(p => p.name).join(", ")
                                : student.periodName || "No period assigned"}
                              • ID: {student.studentId}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 items-end">
                            {/* NEW: row of action icons (Behavior icon first) */}
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full border hover:bg-amber-50"
                                title="Behavior"
                                onClick={() => {
                                  setBehaviorStudent({
                                    id: student.id,
                                    name: student.name,
                                    studentId: student.studentId,
                                    periodsLabel,
                                  });
                                  setBehaviorOpen(true);
                                }}
                              >
                                <span className="text-lg leading-none">🐵</span>
                              </Button>
                            </div>

                            {/* NEW: Destination selector */}
                            <Select
                              value={currentDestination}
                              onValueChange={(val: Destination) =>
                                setDestinationByStudent((prev) => ({
                                  ...prev,
                                  [student.id]: val,
                                }))
                              }
                            >
                              <SelectTrigger className="w-[150px] h-8 text-xs">
                                <SelectValue placeholder="Destination" />
                              </SelectTrigger>
                              <SelectContent>
                                {DESTINATIONS.map((d) => (
                                  <SelectItem key={d.value} value={d.value}>
                                    {d.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {isOut ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled
                                className="flex items-center gap-1 cursor-pointer"
                              >
                                <LogOut className="h-4 w-4" />
                                Exit
                              </Button>
                            ) : student.periods && student.periods.length > 1 && selectedPeriodId === "all" ? (
                              <Select
                                onValueChange={(periodId) => {
                                  const period = student.periods?.find(p => p.id === periodId);
                                  if (period) {
                                    const updatedStudent = {
                                      ...student,
                                      periodId: period.id,
                                      periodName: period.name
                                    };
                                    handleRoomExit(student.id, currentDestination);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[150px] h-8 text-xs cursor-pointer">
                                  <SelectValue placeholder="Exit (choose period)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {student.periods.map(period => (
                                    <SelectItem key={period.id} value={period.id}>
                                      Exit: {period.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1 cursor-pointer"
                                onClick={() => {
                                  // If specific period is selected, use that period for exit
                                  if (selectedPeriodId !== "all" && student.periods) {
                                    const selectedPeriod = student.periods.find(p => p.id === selectedPeriodId);
                                    if (selectedPeriod) {
                                      const updatedStudent = {
                                        ...student,
                                        periodId: selectedPeriod.id,
                                        periodName: selectedPeriod.name
                                      };
                                      handleRoomExit(student.id, currentDestination);
                                      return;
                                    }
                                  }
                                  // Otherwise use default (first period or whatever is set)
                                  handleRoomExit(student.id, currentDestination);
                                }}
                              >
                                <LogOut className="h-4 w-4" />
                                Exit
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Time Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="h-[90vh] sm:max-w-[600px] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Edit Times for {editingExit?.studentName}
                  </DialogTitle>
                  <DialogDescription>
                    Adjust the exit and return times with quick buttons or manual input.
                    {editingExit?.status === "returned" && (
                      <span className="block mt-1 text-blue-600 font-medium">
                        ✨ You can modify times even after the student has returned!
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Exit Time Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Exit Time</Label>
                      <span className="text-sm text-muted-foreground">Required</span>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={editExitTime}
                        onChange={(e) => setEditExitTime(e.target.value)}
                        className="flex-1"
                        required
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditExitTime(adjustTime(editExitTime, -30))}
                        disabled={!editExitTime}
                      >
                        <Minus className="h-3 w-3 mr-1" />
                        30m
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditExitTime(adjustTime(editExitTime, -15))}
                        disabled={!editExitTime}
                      >
                        <Minus className="h-3 w-3 mr-1" />
                        15m
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditExitTime(adjustTime(editExitTime, -5))}
                        disabled={!editExitTime}
                      >
                        <Minus className="h-3 w-3 mr-1" />
                        5m
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditExitTime(adjustTime(editExitTime, 5))}
                        disabled={!editExitTime}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        5m
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditExitTime(adjustTime(editExitTime, 15))}
                        disabled={!editExitTime}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        15m
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditExitTime(adjustTime(editExitTime, 30))}
                        disabled={!editExitTime}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        30m
                      </Button>
                    </div>
                  </div>

                  {/* Return Time Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Return Time</Label>
                      <span className="text-sm text-muted-foreground">Optional</span>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={editReturnTime}
                        onChange={(e) => setEditReturnTime(e.target.value)}
                        className="flex-1"
                        placeholder="Leave empty if not returned"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditReturnTime(setToCurrentTime())}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Now
                      </Button>
                    </div>

                    {editReturnTime && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime(adjustTime(editReturnTime, -30))}
                        >
                          <Minus className="h-3 w-3 mr-1" />
                          30m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime(adjustTime(editReturnTime, -15))}
                        >
                          <Minus className="h-3 w-3 mr-1" />
                          15m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime(adjustTime(editReturnTime, -5))}
                        >
                          <Minus className="h-3 w-3 mr-1" />
                          5m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime(adjustTime(editReturnTime, 5))}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          5m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime(adjustTime(editReturnTime, 15))}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          15m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime(adjustTime(editReturnTime, 30))}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          30m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReturnTime("")}
                          className="text-red-600 hover:text-red-700"
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* NEW: Destination Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Destination</Label>
                      <span className="text-sm text-muted-foreground">Default: Restroom</span>
                    </div>
                    <div className="w-full sm:w-64">
                      <Select
                        value={editDestination}
                        onValueChange={(v: Destination) => setEditDestination(v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Choose destination" />
                        </SelectTrigger>
                        <SelectContent>
                          {DESTINATIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Duration Display */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Duration:</span>
                      <span className="text-lg font-mono">{calculateDuration()}</span>
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <p className="font-medium mb-1">💡 Quick Tips:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Use <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded text-xs">+/-</kbd> buttons for quick time adjustments</li>
                      <li>• Click <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded text-xs">Now</kbd> to set return time to current time</li>
                      <li>• Leave return time empty if student hasn't returned yet</li>
                      <li>• Duration updates automatically as you change times</li>
                      {editingExit?.status === "returned" && (
                        <>
                          <li>• <strong>Clear return time</strong> to move student back to "Students Out"</li>
                          <li>• <strong>Adjust any time</strong> to correct mistakes or update records</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEditedTimes}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* NEW: Behavior Modal Mount */}
            {behaviorStudent && (
              <BehaviorModal
  open={behaviorOpen}
  onClose={() => setBehaviorOpen(false)}
  studentId={behaviorStudent.studentId}
  studentName={behaviorStudent.name}
  periodsLabel={behaviorStudent.periodsLabel}
  onViewHistory={() => {}}
/>

            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
