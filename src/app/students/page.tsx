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
import {
  PlusCircle,
  Pencil,
  Trash2,
  Search,
  ArchiveRestore,
  Archive,
  RotateCcw,
} from "lucide-react";
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
  hasPlanAccess?: boolean;
  teacherId?: string;
  updatedAt?: any;
}

interface Period {
  id: string;
  name: string;
  schoolYearName?: string;
}

type SortBy = "first" | "last";
type Folder = "active" | "archived";

export default function StudentsPage() {
  const { currentUser } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [archivedStudents, setArchivedStudents] = useState<Student[]>([]);
  const [filteredArchivedStudents, setFilteredArchivedStudents] = useState<
    Student[]
  >([]);
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

  // NEW: folder (Active / Archived)
  const [folder, setFolder] = useState<Folder>("active");

  // Form state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  // Delete/Archive confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  // NEW: plan access + previous ID tracker
  const [hasPlanAccess, setHasPlanAccess] = useState(false);
  const [prevStudentId, setPrevStudentId] = useState<string | null>(null);

  // Fetch students and periods on mount
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStudents(), fetchArchived(), fetchPeriods()]);
    } finally {
      setLoading(false);
    }
  };

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
    // Active
    {
      let filtered = [...students];

      if (searchQuery.trim()) {
        const queryText = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (student) =>
            student.name.toLowerCase().includes(queryText) ||
            student.studentId.toLowerCase().includes(queryText)
        );
      }

      if (selectedSchoolYearId !== "all") {
        const selectedSchoolYear = schoolYears.find(
          (sy) => sy.id === selectedSchoolYearId
        );
        if (selectedSchoolYear) {
          filtered = filtered.filter((student) => {
            return student.periods.some((studentPeriod) => {
              const period = periods.find((p) => p.id === studentPeriod.id);
              return (
                period && period.schoolYearName === selectedSchoolYear.name
              );
            });
          });
        }
      }

      if (selectedPeriodId !== "all") {
        filtered = filtered.filter((student) =>
          student.periods.some((p) => p.id === selectedPeriodId)
        );
      }

      filtered.sort(sortComparator);
      setFilteredStudents(filtered);
    }

    // Archived (same filters)
    {
      let filteredA = [...archivedStudents];

      if (searchQuery.trim()) {
        const queryText = searchQuery.toLowerCase();
        filteredA = filteredA.filter(
          (student) =>
            student.name.toLowerCase().includes(queryText) ||
            student.studentId.toLowerCase().includes(queryText)
        );
      }

      if (selectedSchoolYearId !== "all") {
        const selectedSchoolYear = schoolYears.find(
          (sy) => sy.id === selectedSchoolYearId
        );
        if (selectedSchoolYear) {
          filteredA = filteredA.filter((student) => {
            return student.periods.some((studentPeriod) => {
              const period = periods.find((p) => p.id === studentPeriod.id);
              return (
                period && period.schoolYearName === selectedSchoolYear.name
              );
            });
          });
        }
      }

      if (selectedPeriodId !== "all") {
        filteredA = filteredA.filter((student) =>
          student.periods.some((p) => p.id === selectedPeriodId)
        );
      }

      filteredA.sort(sortComparator);
      setFilteredArchivedStudents(filteredA);
    }

    // prune selection by current folder’s filtered list
    setSelectedIds((prev) => {
      const visible = (
        folder === "active" ? filteredStudents : filteredArchivedStudents
      ).map((s) => s.id);
      return prev.filter((id) => visible.includes(id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    students,
    archivedStudents,
    searchQuery,
    selectedSchoolYearId,
    selectedPeriodId,
    schoolYears,
    periods,
    sortBy,
    folder,
  ]);

  const fetchStudents = async () => {
    try {
      const studentsQuery = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser?.uid)
      );
      const querySnapshot = await getDocs(studentsQuery);

      const studentsList: Student[] = [];

      for (const docSnapshot of querySnapshot.docs) {
        const studentData = docSnapshot.data() as any;

        // Handle both old (single period) and new (multiple periods) formats
        let studentPeriods = [];
        if (Array.isArray(studentData.periods)) {
          studentPeriods = studentData.periods;
        } else if (studentData.periodId) {
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
          hasPlanAccess: studentData.hasPlanAccess,
          teacherId: studentData.teacherId,
          updatedAt: studentData.updatedAt,
        });
      }

      setStudents(studentsList);
      // filtered handled by effect
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    }
  };

  const fetchArchived = async () => {
    try {
      const archivedQuery = query(
        collection(db, "archivedStudents"),
        where("teacherId", "==", currentUser?.uid)
      );
      const snap = await getDocs(archivedQuery);

      const list: Student[] = snap.docs.map((d) => {
        const data = d.data() as any;
        let studentPeriods = [];
        if (Array.isArray(data.periods)) {
          studentPeriods = data.periods;
        } else if (data.periodId) {
          studentPeriods = [
            {
              id: data.periodId,
              name: data.periodName || "Unknown Period",
            },
          ];
        }
        return {
          id: d.id,
          name: data.name,
          studentId: data.studentId,
          periods: studentPeriods,
          hasPlanAccess: data.hasPlanAccess,
          teacherId: data.teacherId,
          updatedAt: data.updatedAt,
        };
      });

      setArchivedStudents(list);
    } catch (e) {
      console.error("Error fetching archived students:", e);
      toast.error("Failed to load archived students");
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
        const data = doc.data() as any;
        const schoolYear = schoolYearsList.find(
          (sy) => sy.id === data.schoolYearId
        );
        return {
          id: doc.id,
          name: data.name,
          schoolYearName: schoolYear?.name || "Unknown School Year",
        } as Period;
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
      const baseColl = folder === "archived" ? "archivedStudents" : "students";
      const studentDoc = await getDoc(doc(db, baseColl, studentId));
      if (studentDoc.exists()) {
        const data = studentDoc.data() as any;
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
        studentRef: studentRefId,
        teacherId: currentUser?.uid,
        name: displayName,
        periodIds,
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

  // ======== BULK PLAN ACCESS (Active only) ========
  const loadStudentsByIds = async (
    ids: string[],
    base: "students" | "archivedStudents"
  ) => {
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, base, id))));
    return snaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as any) }));
  };

  const handleBulkGrantAccess = async () => {
    if (folder !== "active" || selectedIds.length === 0) return;
    try {
      const studentsToUpdate = await loadStudentsByIds(selectedIds, "students");

      const batch = writeBatch(db);
      let granted = 0;
      const errors: string[] = [];

      for (const s of studentsToUpdate) {
        const sid: string | undefined = s.studentId;
        if (!sid) {
          errors.push(`${s.name || s.id}: missing Student ID`);
          continue;
        }

        // Ensure username (sid) is not already taken by a *different* student
        const credRef = doc(db, STUDENT_CREDS_COLL, sid);
        const credSnap = await getDoc(credRef);
        const takenByOther =
          credSnap.exists() &&
          credSnap.data()?.studentRef &&
          credSnap.data().studentRef !== s.id;

        if (takenByOther) {
          errors.push(
            `${s.name || s.id} (${sid}): ID already used by another login`
          );
          continue;
        }

        // Update student flag
        batch.set(
          doc(db, "students", s.id),
          { hasPlanAccess: true, updatedAt: new Date() },
          { merge: true }
        );

        // Upsert login (periodIds from student's current periods)
        const periodIds: string[] = Array.isArray(s.periods)
          ? s.periods.map((p: any) => p.id)
          : s.periodId
          ? [s.periodId]
          : [];

        await setDoc(
          credRef,
          {
            username: sid,
            password: sid,
            studentRef: s.id,
            teacherId: currentUser?.uid,
            name: s.name,
            periodIds,
            updatedAt: new Date(),
            enabled: true,
          },
          { merge: true }
        );

        granted += 1;
      }

      await batch.commit();
      await fetchStudents();

      if (granted)
        toast.success(`Granted plan access to ${granted} student(s)`);
      if (errors.length) toast.error(errors.join(" • "));
    } catch (err) {
      console.error("Bulk grant access error:", err);
      toast.error("Failed to grant plan access");
    }
  };

  const handleBulkRevokeAccess = async () => {
    if (folder !== "active" || selectedIds.length === 0) return;
    try {
      const studentsToUpdate = await loadStudentsByIds(selectedIds, "students");

      const batch = writeBatch(db);
      let revoked = 0;

      for (const s of studentsToUpdate) {
        const sid: string | undefined = s.studentId;

        // Update student flag
        batch.set(
          doc(db, "students", s.id),
          { hasPlanAccess: false, updatedAt: new Date() },
          { merge: true }
        );

        // Remove creds if present
        if (sid) {
          try {
            await deleteStudentCreds(sid);
            revoked += 1;
          } catch {
            /* ignore */
          }
        }
      }

      await batch.commit();
      await fetchStudents();

      toast.success(`Revoked plan access for ${revoked} student(s)`);
    } catch (err) {
      console.error("Bulk revoke access error:", err);
      toast.error("Failed to revoke plan access");
    }
  };
  // ==================================

  // ======== SAVE (Active or Archived edit) ========
  const handleSaveStudent = async () => {
    if (!name || !studentId) {
      toast.error("Name and Student ID are required");
      return;
    }

    try {
      const baseColl = folder === "archived" ? "archivedStudents" : "students";

      // Ensure studentId is unique among students for this teacher (active collection only)
      if (baseColl === "students") {
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
      }

      // If enabling plan access (only meaningful for active), ensure unique login ID
      if (hasPlanAccess && baseColl === "students") {
        await assertLoginUniqueOrThrow(studentId);
      }

      const studentRef =
        isEditMode && currentStudentId
          ? doc(db, baseColl, currentStudentId)
          : doc(collection(db, baseColl));

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
          hasPlanAccess: baseColl === "students" ? hasPlanAccess : false,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Manage credentials only for ACTIVE collection
      if (baseColl === "students") {
        if (hasPlanAccess) {
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
          await deleteStudentCreds(
            isEditMode ? prevStudentId || studentId : studentId
          );
        }
      }

      setIsOpen(false);
      await (baseColl === "students" ? fetchStudents() : fetchArchived());
      toast.success(isEditMode ? "Student updated" : "Student added");
    } catch (error: any) {
      console.error("Error saving student:", error);
      toast.error(error?.message || "Failed to save student");
    }
  };

  // ======== ARCHIVE / RESTORE / PERMANENT DELETE ========
  const moveToArchive = async (id: string) => {
    try {
      const snap = await getDoc(doc(db, "students", id));
      if (!snap.exists()) throw new Error("Student not found");
      const data = snap.data() as any;

      // write into archivedStudents with same id
      await setDoc(doc(db, "archivedStudents", id), {
        ...data,
        hasPlanAccess: false,
        archivedAt: new Date(),
        updatedAt: new Date(),
      });

      // delete original
      await deleteDoc(doc(db, "students", id));

      // remove creds
      if (data.studentId) {
        await deleteStudentCreds(data.studentId);
      }

      await Promise.all([fetchStudents(), fetchArchived()]);
      toast.success("Student archived");
    } catch (e: any) {
      console.error("Archive error:", e);
      toast.error(e?.message || "Failed to archive student");
    }
  };

  const restoreFromArchive = async (id: string) => {
    try {
      const snap = await getDoc(doc(db, "archivedStudents", id));
      if (!snap.exists()) throw new Error("Archived student not found");
      const data = snap.data() as any;

      // ensure no duplicate studentId in active
      if (data.studentId) {
        const dupQuery = query(
          collection(db, "students"),
          where("teacherId", "==", currentUser?.uid),
          where("studentId", "==", data.studentId)
        );
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
          toast.error(
            `Cannot restore. Student ID "${data.studentId}" already exists.`
          );
          return;
        }
      }

      await setDoc(
        doc(db, "students", id),
        {
          ...data,
          hasPlanAccess: false, // restored without creds by default
          archivedAt: null,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      await deleteDoc(doc(db, "archivedStudents", id));
      await Promise.all([fetchStudents(), fetchArchived()]);
      toast.success("Student restored");
    } catch (e: any) {
      console.error("Restore error:", e);
      toast.error(e?.message || "Failed to restore student");
    }
  };

  const permanentlyDeleteArchived = async (id: string) => {
    try {
      // fetch to get studentId for creds defense (should be none, but safe)
      const snap = await getDoc(doc(db, "archivedStudents", id));
      const sId = snap.exists() ? (snap.data().studentId as string) : null;

      await deleteDoc(doc(db, "archivedStudents", id));
      if (sId) await deleteStudentCreds(sId);

      await fetchArchived();
      toast.success("Student permanently deleted");
    } catch (e) {
      console.error("Permanent delete error:", e);
      toast.error("Failed to delete student");
    }
  };

  const openDeleteDialog = (studentId: string) => {
    setStudentToDelete(studentId);
    setDeleteDialogOpen(true);
  };

  // In Active: confirm means Archive; In Archived: confirm means Permanent Delete
  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    try {
      if (folder === "active") {
        await moveToArchive(studentToDelete);
      } else {
        await permanentlyDeleteArchived(studentToDelete);
      }
    } finally {
      setStudentToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // NEW: Bulk Archive (when Active) / Bulk Permanent Delete (when Archived)
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      if (folder === "active") {
        // bulk archive
        const snaps = await Promise.all(
          selectedIds.map((id) => getDoc(doc(db, "students", id)))
        );
        for (const snap of snaps) {
          if (snap.exists()) {
            const id = snap.id;
            const data = snap.data() as any;
            await setDoc(doc(db, "archivedStudents", id), {
              ...data,
              hasPlanAccess: false,
              archivedAt: new Date(),
              updatedAt: new Date(),
            });
            await deleteDoc(doc(db, "students", id));
            if (data.studentId) await deleteStudentCreds(data.studentId);
          }
        }
        setSelectedIds([]);
        await Promise.all([fetchStudents(), fetchArchived()]);
        toast.success("Selected students archived");
      } else {
        // bulk permanent delete from archived
        const snaps = await Promise.all(
          selectedIds.map((id) => getDoc(doc(db, "archivedStudents", id)))
        );
        const toDeleteCreds: string[] = [];
        for (const snap of snaps) {
          if (snap.exists()) {
            const sId = (snap.data() as any).studentId as string | undefined;
            if (sId) toDeleteCreds.push(sId);
            await deleteDoc(doc(db, "archivedStudents", snap.id));
          }
        }
        await Promise.all(toDeleteCreds.map(deleteStudentCreds));
        setSelectedIds([]);
        await fetchArchived();
        toast.success("Selected archived students permanently deleted");
      }
    } catch (error) {
      console.error("Bulk action error:", error);
      toast.error("Failed to process selected students");
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

  // Selection helpers for the table depend on folder
  const visibleList =
    folder === "active" ? filteredStudents : filteredArchivedStudents;

  const allVisibleSelected =
    visibleList.length > 0 &&
    visibleList.every((s) => selectedIds.includes(s.id));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleList.some((s) => s.id === id))
      );
    } else {
      const toAdd = visibleList.map((s) => s.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...toAdd])));
    }
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 mt-3">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Students</h1>
          <div className="flex items-center gap-3">
            {/* Folder switch */}
            <Select
              value={folder}
              onValueChange={(v: Folder) => {
                setFolder(v);
                setSelectedIds([]);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Import only for Active */}
            {folder === "active" && (
              <ImportStudents
                periods={periods}
                onImportComplete={fetchStudents}
              />
            )}

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
                className="flex items-center gap-2"
              >
                {folder === "active" ? (
                  <>
                    <Archive className="h-4 w-4" />
                    Archive Selected ({selectedIds.length})
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Permanently ({selectedIds.length})
                  </>
                )}
              </Button>
            )}

            {folder === "active" && (
              <>
                <Button
                  onClick={openAddDialog}
                  className="flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Student
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkGrantAccess}
                  className="flex items-center gap-2"
                >
                  Grant Plan Access
                </Button>

                <Button
                  variant="outline"
                  onClick={handleBulkRevokeAccess}
                  className="flex items-center gap-2"
                >
                  Revoke Plan Access
                </Button>
              </>
            )}

            {folder === "archived" && selectedIds.length > 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const snaps = await Promise.all(
                      selectedIds.map((id) =>
                        getDoc(doc(db, "archivedStudents", id))
                      )
                    );
                    for (const s of snaps) {
                      if (s.exists()) await restoreFromArchive(s.id);
                    }
                    setSelectedIds([]);
                  } catch (e) {
                    toast.error("Failed to restore selected");
                  }
                }}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restore Selected
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filter Section (works for both folders) */}
        <div className="mb-6 bg-white border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${
                  folder === "active" ? "students" : "archived"
                }...`}
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

            {/* Sort By */}
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
              Showing{" "}
              {folder === "active"
                ? filteredStudents.length
                : filteredArchivedStudents.length}{" "}
              of{" "}
              {folder === "active" ? students.length : archivedStudents.length}{" "}
              {folder === "active" ? "students" : "archived"}
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
              <span className="ml-2 text-purple-600">• Folder: {folder}</span>
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
        ) : visibleList.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground">
              {folder === "active"
                ? students.length === 0
                  ? "No students found"
                  : "No students match your search criteria"
                : archivedStudents.length === 0
                ? "No archived students"
                : "No archived students match your search criteria"}
            </p>
            {folder === "active" && students.length === 0 && (
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
                  {/* header checkbox for select-all visible */}
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
                {visibleList.map((student) => {
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

                          {folder === "active" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-amber-600 border-amber-200 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-300"
                              onClick={() => moveToArchive(student.id)}
                              title="Archive"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-green-600 border-green-200 hover:text-green-700 hover:bg-green-50 hover:border-green-300"
                                onClick={() => restoreFromArchive(student.id)}
                                title="Restore"
                              >
                                <ArchiveRestore className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 border-red-200 hover:text-red-500 hover:bg-red-50 hover:border-red-300"
                                onClick={() => openDeleteDialog(student.id)}
                                title="Delete Permanently"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
                {isEditMode
                  ? folder === "archived"
                    ? "Edit Archived Student"
                    : "Edit Student"
                  : folder === "archived"
                  ? "Add Archived Student"
                  : "Add Student"}
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

              {/* Has Plan Access only relevant for Active */}
              {folder === "active" && (
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
              )}

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

        {/* Archive / Permanent Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {folder === "active"
                  ? "Archive student?"
                  : "Delete permanently?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {folder === "active"
                  ? "This will move the student to the Archived folder. You can restore them later."
                  : "This action cannot be undone. This will permanently delete the archived student and all associated data."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={handleDeleteStudent}
                className={
                  folder === "active"
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }
              >
                {folder === "active" ? "Archive" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Confirm (Archive vs Permanent Delete) */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {folder === "active"
                  ? "Archive selected students?"
                  : "Permanently delete selected archived students?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {folder === "active"
                  ? `This will move ${selectedIds.length} selected student(s) to Archived. You can restore them later.`
                  : `This will permanently delete ${selectedIds.length} selected archived student(s). This cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={handleBulkDelete}
                className={
                  folder === "active"
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }
                autoFocus
              >
                {folder === "active" ? "Archive Selected" : "Delete Selected"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
