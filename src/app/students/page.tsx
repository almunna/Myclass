"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Search } from "lucide-react";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ImportStudents } from "@/components/students/ImportStudents";

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

type SortBy = "first" | "last";

export default function StudentsPage() {
  const { currentUser } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] =
    useState<string>("all");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // NEW: sorting + selection state
  const [sortBy, setSortBy] = useState<SortBy>("first");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Form state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  // NEW: plan access + previous ID tracker
  const [hasPlanAccess, setHasPlanAccess] = useState(false);
  const [prevStudentId, setPrevStudentId] = useState<string | null>(null);

  // Fetch students and periods on mount
  useEffect(() => {
    fetchStudents();
    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers for sorting
  const firstToken = (n: string) =>
    (n?.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const lastToken = (n: string) => {
    const parts = n?.trim().split(/\s+/) ?? [];
    return (parts[parts.length - 1] || "").toLowerCase();
  };
  const sortComparator = (a: Student, b: Student) => {
    if (sortBy === "first") {
      const fa = firstToken(a.name);
      const fb = firstToken(b.name);
      if (fa !== fb) return fa.localeCompare(fb);
      // tiebreaker by last
      return lastToken(a.name).localeCompare(lastToken(b.name));
    } else {
      const la = lastToken(a.name);
      const lb = lastToken(b.name);
      if (la !== lb) return la.localeCompare(lb);
      // tiebreaker by first
      return firstToken(a.name).localeCompare(firstToken(b.name));
    }
  };

  // Filter students based on search and filters (+ apply sorting)
  useEffect(() => {
    let filtered = [...students];

    // Search filter
    if (searchQuery.trim()) {
      const queryText = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(queryText) ||
          student.studentId.toLowerCase().includes(queryText)
      );
    }

    // School year filter
    if (selectedSchoolYearId !== "all") {
      const selectedSchoolYear = schoolYears.find(
        (sy) => sy.id === selectedSchoolYearId
      );
      if (selectedSchoolYear) {
        filtered = filtered.filter((student) => {
          return student.periods.some((studentPeriod) => {
            const period = periods.find((p) => p.id === studentPeriod.id);
            return period && period.schoolYearName === selectedSchoolYear.name;
          });
        });
      }
    }

    // Period filter
    if (selectedPeriodId !== "all") {
      filtered = filtered.filter((student) =>
        student.periods.some((p) => p.id === selectedPeriodId)
      );
    }

    // Apply sorting
    filtered.sort(sortComparator);

    setFilteredStudents(filtered);

    // If selection exists, remove any IDs that are no longer visible in the filtered list
    setSelectedIds((prev) =>
      prev.filter((id) => filtered.some((s) => s.id === id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    students,
    searchQuery,
    selectedSchoolYearId,
    selectedPeriodId,
    schoolYears,
    periods,
    sortBy,
  ]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const studentsQuery = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser?.uid)
      );
      const querySnapshot = await getDocs(studentsQuery);

      const studentsList: Student[] = [];

      for (const docSnapshot of querySnapshot.docs) {
        const studentData = docSnapshot.data();

        // Handle both old (single period) and new (multiple periods) formats
        let studentPeriods = [];
        if (Array.isArray(studentData.periods)) {
          studentPeriods = studentData.periods;
        } else if (studentData.periodId) {
          // Convert old format to new format
          studentPeriods = [
            {
              id: studentData.periodId,
              name: studentData.periodName || "Unknown Period",
            },
          ];
        }

        studentsList.push({
          id: docSnapshot.id,
          name: studentData.name,
          studentId: studentData.studentId,
          periods: studentPeriods,
        });
      }

      // Keep original list; sorting is handled in the filter effect
      setStudents(studentsList);
      setFilteredStudents(studentsList.slice().sort(sortComparator));
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

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

      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser?.uid)
      );
      const querySnapshot = await getDocs(periodsQuery);

      const periodsList = querySnapshot.docs.map((doc) => {
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

      // Sort by school year first, then by period name
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
      toast.error("Failed to load periods");
    }
  };

  const openAddDialog = () => {
    setIsEditMode(false);
    setCurrentStudentId(null);
    setName("");
    setStudentId("");
    setSelectedPeriods([]);
    setHasPlanAccess(false);
    setPrevStudentId(null);
    setIsOpen(true);
  };

  const openEditDialog = async (studentId: string) => {
    try {
      const studentDoc = await getDoc(doc(db, "students", studentId));
      if (studentDoc.exists()) {
        const data = studentDoc.data();
        setIsEditMode(true);
        setCurrentStudentId(studentId);
        setName(data.name);
        setStudentId(data.studentId);
        setHasPlanAccess(!!data.hasPlanAccess);
        setPrevStudentId(data.studentId || null);

        // Handle both old (single period) and new (multiple periods) formats
        if (Array.isArray(data.periods)) {
          setSelectedPeriods(data.periods.map((p: any) => p.id));
        } else if (data.periodId) {
          setSelectedPeriods([data.periodId]);
        } else {
          setSelectedPeriods([]);
        }

        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error fetching student:", error);
      toast.error("Failed to load student data");
    }
  };

  // ======== Student Login Creds Helpers ========
  const STUDENT_CREDS_COLL = "studentLogins";

  const assertLoginUniqueOrThrow = async (candidateId: string) => {
    const credSnap = await getDoc(doc(db, STUDENT_CREDS_COLL, candidateId));
    const isSameAsBefore = isEditMode && prevStudentId === candidateId;
    if (credSnap.exists() && !isSameAsBefore) {
      throw new Error("Student ID is already used for login credentials");
    }
  };

  const upsertStudentCreds = async (
    studentRefId: string,
    sid: string,
    displayName: string,
    periodIds: string[]
  ) => {
    const ref = doc(db, "studentLogins", sid);
    await setDoc(
      ref,
      {
        username: sid,
        password: sid,
        studentRef: studentRefId, // "students/{id}"
        teacherId: currentUser?.uid,
        name: displayName,
        periodIds, // ✅ store allowed periods here
        updatedAt: new Date(),
        enabled: true,
      },
      { merge: true }
    );
  };

  const deleteStudentCreds = async (sid: string | null | undefined) => {
    if (!sid) return;
    try {
      await deleteDoc(doc(db, STUDENT_CREDS_COLL, sid));
    } catch {
      // ignore
    }
  };
  // =============================================

  const handleSaveStudent = async () => {
    if (!name || !studentId) {
      toast.error("Name and Student ID are required");
      return;
    }

    try {
      // NEW: Ensure studentId is unique among students for this teacher
      const dupQuery = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser?.uid),
        where("studentId", "==", studentId)
      );
      const dupSnap = await getDocs(dupQuery);
      const duplicate = dupSnap.docs.find((d) => d.id !== currentStudentId);
      if (duplicate) {
        toast.error("Student ID already exists. Choose a different one.");
        return;
      }

      // If enabling plan access, ensure unique login ID in creds
      if (hasPlanAccess) {
        await assertLoginUniqueOrThrow(studentId);
      }

      const studentRef =
        isEditMode && currentStudentId
          ? doc(db, "students", currentStudentId)
          : doc(collection(db, "students"));

      // Convert selected period IDs to period objects with name
      const periodsWithNames = selectedPeriods.map((periodId) => {
        const period = periods.find((p) => p.id === periodId);
        return {
          id: periodId,
          name: period ? period.name : "Unknown Period",
        };
      });

      await setDoc(
        studentRef,
        {
          name,
          studentId,
          periods: periodsWithNames,
          teacherId: currentUser?.uid,
          hasPlanAccess,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Manage credentials
      if (hasPlanAccess) {
        // If ID changed during edit, remove old login doc
        if (isEditMode && prevStudentId && prevStudentId !== studentId) {
          await deleteStudentCreds(prevStudentId);
        }
        await upsertStudentCreds(
          studentRef.id,
          studentId,
          name,
          selectedPeriods
        );
      } else {
        // Access disabled => delete creds (old or current id)
        await deleteStudentCreds(
          isEditMode ? prevStudentId || studentId : studentId
        );
      }

      setIsOpen(false);
      await fetchStudents();
      toast.success(isEditMode ? "Student updated" : "Student added");
    } catch (error: any) {
      console.error("Error saving student:", error);
      toast.error(error?.message || "Failed to save student");
    }
  };

  const openDeleteDialog = (studentId: string) => {
    setStudentToDelete(studentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    try {
      // fetch to get studentId for creds deletion
      const snap = await getDoc(doc(db, "students", studentToDelete));
      const sId = snap.exists() ? (snap.data().studentId as string) : null;

      const batch = writeBatch(db);
      batch.delete(doc(db, "students", studentToDelete));
      await batch.commit();

      // delete creds outside batch (different collection/doc id)
      if (sId) await deleteStudentCreds(sId);

      await fetchStudents();
      toast.success("Student deleted");
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("Failed to delete student");
    } finally {
      setStudentToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // NEW: Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      // Load student docs to know their studentIds
      const snaps = await Promise.all(
        selectedIds.map((id) => getDoc(doc(db, "students", id)))
      );

      const batch = writeBatch(db);
      const toDeleteCreds: string[] = [];
      snaps.forEach((snap) => {
        if (snap.exists()) {
          batch.delete(doc(db, "students", snap.id));
          const sid = snap.data().studentId as string | undefined;
          if (sid) toDeleteCreds.push(sid);
        }
      });
      await batch.commit();

      // remove creds (not in batch)
      await Promise.all(toDeleteCreds.map(deleteStudentCreds));

      setSelectedIds([]);
      await fetchStudents();
      toast.success("Selected students deleted");
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete selected students");
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriods((current) =>
      current.includes(periodId)
        ? current.filter((id) => id !== periodId)
        : [...current, periodId]
    );
  };

  const handleSchoolYearFilterChange = (value: string) => {
    setSelectedSchoolYearId(value);
    // Reset period filter when school year changes
    setSelectedPeriodId("all");
  };

  const handlePeriodFilterChange = (value: string) => {
    setSelectedPeriodId(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Show loading while checking subscription
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

  // Selection helpers for the table
  const allVisibleSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.includes(s.id));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredStudents.some((s) => s.id === id))
      );
    } else {
      const toAdd = filteredStudents.map((s) => s.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...toAdd])));
    }
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 mt-3">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Students</h1>
          <div className="flex items-center gap-3">
            <ImportStudents
              periods={periods}
              onImportComplete={fetchStudents}
            />
            {/* NEW: Bulk delete action appears when selection exists */}
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
            <Button onClick={openAddDialog} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Student
            </Button>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 bg-white border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* School Year Filter */}
            <div>
              <Select
                value={selectedSchoolYearId}
                onValueChange={handleSchoolYearFilterChange}
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

            {/* Period Filter */}
            <div>
              <Select
                value={selectedPeriodId}
                onValueChange={handlePeriodFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {(() => {
                    // Filter periods by selected school year if any
                    let filteredPeriods = periods;
                    if (selectedSchoolYearId !== "all") {
                      const selectedSchoolYear = schoolYears.find(
                        (sy) => sy.id === selectedSchoolYearId
                      );
                      if (selectedSchoolYear) {
                        filteredPeriods = periods.filter(
                          (period) =>
                            period.schoolYearName === selectedSchoolYear.name
                        );
                      }
                    }

                    // Group periods by school year (if showing all school years)
                    if (selectedSchoolYearId === "all") {
                      const groupedPeriods = filteredPeriods.reduce(
                        (acc, period) => {
                          const yearName =
                            period.schoolYearName || "Unknown School Year";
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

            {/* NEW: Sort By */}
            <div>
              <Select
                value={sortBy}
                onValueChange={(v: SortBy) => setSortBy(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">Sort by First Name</SelectItem>
                  <SelectItem value="last">Sort by Last Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Summary */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {students.length} students
              {searchQuery && (
                <span className="ml-2 text-blue-600">
                  • Filtered by: "{searchQuery}"
                </span>
              )}
              {selectedSchoolYearId !== "all" && (
                <span className="ml-2 text-blue-600">
                  • School Year:{" "}
                  {
                    schoolYears.find((sy) => sy.id === selectedSchoolYearId)
                      ?.name
                  }
                </span>
              )}
              {selectedPeriodId !== "all" && (
                <span className="ml-2 text-blue-600">
                  • Period:{" "}
                  {periods.find((p) => p.id === selectedPeriodId)?.name}
                </span>
              )}
              <span className="ml-2 text-blue-600">
                • Sorted by: {sortBy === "first" ? "First Name" : "Last Name"}
              </span>
            </div>
            {(searchQuery ||
              selectedSchoolYearId !== "all" ||
              selectedPeriodId !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSchoolYearId("all");
                  setSelectedPeriodId("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground">
              {students.length === 0
                ? "No students found"
                : "No students match your search criteria"}
            </p>
            {students.length === 0 && (
              <Button
                onClick={openAddDialog}
                variant="outline"
                className="mt-4"
              >
                Add your first student
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* NEW: header checkbox for select-all visible */}
                  <TableHead className="w-[48px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all"
                      />
                    </div>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Periods</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const checked = selectedIds.includes(student.id);
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleRow(student.id)}
                            aria-label={`Select ${student.name}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.name}
                      </TableCell>
                      <TableCell>{student.studentId}</TableCell>
                      <TableCell>
                        {student.periods && student.periods.length > 0
                          ? student.periods.map((p) => p.name).join(", ")
                          : "No periods assigned"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditDialog(student.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 border-red-200 hover:text-red-500 hover:bg-red-50 hover:border-red-300"
                            onClick={() => openDeleteDialog(student.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Student" : "Add Student"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update student information"
                  : "Enter the details for the new student"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="studentId" className="text-right">
                  Student ID
                </Label>
                <Input
                  id="studentId"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="col-span-3"
                />
              </div>

              {/* NEW: Has Plan Access */}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Plan Access</Label>
                <div className="col-span-3 flex items-start space-x-2">
                  <Checkbox
                    id="hasPlanAccess"
                    checked={hasPlanAccess}
                    onCheckedChange={(v) => setHasPlanAccess(!!v)}
                  />
                  <div>
                    <Label htmlFor="hasPlanAccess" className="font-medium">
                      Has Plan Access
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, a student login is created.
                      <br />
                      <span className="font-medium">Username</span> = Student
                      ID, <span className="font-medium">Password</span> =
                      Student ID. Ensure it’s unique.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Periods</Label>
                <div className="col-span-3 grid gap-2">
                  {periods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No periods available
                    </p>
                  ) : (
                    (() => {
                      // Group periods by school year
                      const groupedPeriods = periods.reduce((acc, period) => {
                        const yearName =
                          period.schoolYearName || "Unknown School Year";
                        if (!acc[yearName]) {
                          acc[yearName] = [];
                        }
                        acc[yearName].push(period);
                        return acc;
                      }, {} as Record<string, Period[]>);

                      return Object.entries(groupedPeriods).map(
                        ([yearName, yearPeriods]) => (
                          <div key={yearName} className="space-y-2">
                            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                              {yearName}
                            </h4>
                            <div className="pl-4 space-y-2">
                              {yearPeriods.map((period) => (
                                <div
                                  key={period.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`period-${period.id}`}
                                    checked={selectedPeriods.includes(
                                      period.id
                                    )}
                                    onCheckedChange={() =>
                                      handlePeriodChange(period.id)
                                    }
                                  />
                                  <Label htmlFor={`period-${period.id}`}>
                                    {period.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveStudent}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                student and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={handleDeleteStudent}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* NEW: Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected students?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {selectedIds.length} selected
                student(s) and their associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={handleBulkDelete}
                className="bg-red-500 hover:bg-red-600 text-white"
                autoFocus
              >
                Delete Selected
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
