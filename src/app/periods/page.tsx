"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { format, parse } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  PlusIcon,
  Edit,
  Trash2,
  GraduationCap,
  Calendar,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";
import { toast } from "sonner";
import { CustomDatePicker } from "@/components/ui/date-picker";

interface SchoolYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  teacherId: string;
  createdAt: any;
}

interface Period {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  dayOfWeek?: string | string[] | null; // CSV like "mon,wed,fri", legacy array, or null for Mon–Fri (every weekday)
  schoolYearId: string;
  teacherId: string;
  createdAt: any;

  // NEW: optional early-release schedule
  earlyRelease?: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  } | null;
}

export default function PeriodsPage() {
  const { currentUser } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();

  // Data states
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  // UI states
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [isEditYearModalOpen, setIsEditYearModalOpen] = useState(false);
  const [isAddPeriodModalOpen, setIsAddPeriodModalOpen] = useState(false);
  const [isEditPeriodModalOpen, setIsEditPeriodModalOpen] = useState(false);

  // Form states
  const [selectedSchoolYear, setSelectedSchoolYear] =
    useState<SchoolYear | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [yearFormData, setYearFormData] = useState({
    name: "",
    startDate: new Date(),
    endDate: new Date(),
    isActive: false,
  });

  // Helper for weekday CSV <-> UI (defensive against legacy array values)
  const weekdayLabels: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
  };
  const allWeekdays = ["mon", "tue", "wed", "thu", "fri"] as const;

  function parseDaysCSV(csv?: string | string[] | null): string[] {
    if (csv == null) return [...allWeekdays];

    let tokens: string[];
    if (Array.isArray(csv)) {
      tokens = csv;
    } else if (typeof csv === "string") {
      const s = csv.trim();
      if (!s) return [...allWeekdays];
      tokens = s.split(",");
    } else {
      return [...allWeekdays];
    }

    return tokens
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(
        (t): t is string =>
          t.length > 0 && (allWeekdays as readonly string[]).includes(t)
      );
  }

  function formatDaysForTable(csv?: string | string[] | null): string {
    const days = parseDaysCSV(csv);
    if (days.length === 5) return "All weekdays";
    return days.map((d) => weekdayLabels[d] ?? d).join(", ");
  }

  const [periodFormData, setPeriodFormData] = useState({
    name: "",
    startTime: "08:00",
    endTime: "09:00",
    // replaced dayOfWeek single-select with explicit controls:
    meetsEveryWeekday: true,
    selectedDays: [] as string[], // subset of ["mon","tue","wed","thu","fri"] when not every weekday
    schoolYearId: "",
    // NEW: early-release form fields
    earlyReleaseEnabled: false,
    earlyReleaseDayOfWeek: "wed",
    earlyReleaseStartTime: "00:00",
    earlyReleaseEndTime: "00:00",
  });

  // Delete confirmation states
  const [deleteYearDialog, setDeleteYearDialog] = useState(false);
  const [deletePeriodDialog, setDeletePeriodDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SchoolYear | Period | null>(
    null
  );
  function to12Hour(time?: string) {
    if (!time) return "";
    try {
      return format(parse(time, "HH:mm", new Date()), "h:mm a");
    } catch {
      return time;
    }
  }
  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSchoolYears(), fetchPeriods()]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolYears = async () => {
    const yearsQuery = query(
      collection(db, "schoolYears"),
      where("teacherId", "==", currentUser?.uid)
    );
    const snapshot = await getDocs(yearsQuery);
    const yearsList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SchoolYear[];
    setSchoolYears(yearsList.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const fetchPeriods = async () => {
    const periodsQuery = query(
      collection(db, "periods"),
      where("teacherId", "==", currentUser?.uid)
    );
    const snapshot = await getDocs(periodsQuery);
    const periodsList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Period[];

    const timeVal = (t?: string) => {
      if (!t) return Number.POSITIVE_INFINITY; // push missing times to the end
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    periodsList.sort(
      (a, b) =>
        timeVal(a.startTime) - timeVal(b.startTime) ||
        a.name.localeCompare(b.name)
    );

    setPeriods(periodsList);
  };

  const toggleYearExpansion = (yearId: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(yearId)) {
      newExpanded.delete(yearId);
    } else {
      newExpanded.add(yearId);
    }
    setExpandedYears(newExpanded);
  };

  const handleAddSchoolYear = () => {
    setYearFormData({
      name: "",
      startDate: new Date(),
      endDate: new Date(),
      isActive: false,
    });
    setIsAddYearModalOpen(true);
  };

  const handleEditSchoolYear = (year: SchoolYear) => {
    setSelectedSchoolYear(year);
    setYearFormData({
      name: year.name,
      startDate: year.startDate ? new Date(year.startDate) : new Date(),
      endDate: year.endDate ? new Date(year.endDate) : new Date(),
      isActive: year.isActive,
    });
    setIsEditYearModalOpen(true);
  };

  const handleAddPeriod = (schoolYearId: string) => {
    setPeriodFormData({
      name: "",
      startTime: "08:00",
      endTime: "09:00",
      meetsEveryWeekday: true,
      selectedDays: [], // ignored when meetsEveryWeekday = true
      schoolYearId,
      earlyReleaseEnabled: false,
      earlyReleaseDayOfWeek: "wed",
      earlyReleaseStartTime: "00:00",
      earlyReleaseEndTime: "00:00",
    });
    setIsAddPeriodModalOpen(true);
  };

  const handleEditPeriod = (period: Period) => {
    setSelectedPeriod(period);
    const parsed = parseDaysCSV(period.dayOfWeek ?? null);
    const meetsEveryWeekday = parsed.length === 5; // null or all 5 means every weekday
    setPeriodFormData({
      name: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      meetsEveryWeekday,
      selectedDays: meetsEveryWeekday ? [] : parsed,
      schoolYearId: period.schoolYearId,
      // NEW: hydrate early-release fields
      earlyReleaseEnabled: !!period.earlyRelease,
      earlyReleaseDayOfWeek: period.earlyRelease?.dayOfWeek || "wed",
      earlyReleaseStartTime: period.earlyRelease?.startTime || "00:00",
      earlyReleaseEndTime: period.earlyRelease?.endTime || "00:00",
    });
    setIsEditPeriodModalOpen(true);
  };

  const saveSchoolYear = async (isEdit: boolean = false) => {
    if (!yearFormData.name.trim()) {
      toast.error("School year name is required");
      return;
    }

    try {
      const yearData = {
        name: yearFormData.name,
        startDate: yearFormData.startDate.toISOString().split("T")[0],
        endDate: yearFormData.endDate.toISOString().split("T")[0],
        isActive: yearFormData.isActive,
        teacherId: currentUser?.uid,
      };

      if (isEdit && selectedSchoolYear) {
        await updateDoc(doc(db, "schoolYears", selectedSchoolYear.id), {
          ...yearData,
          updatedAt: new Date(),
        });
        toast.success("School year updated successfully");
      } else {
        const yearRef = doc(collection(db, "schoolYears"));
        await setDoc(yearRef, {
          ...yearData,
          createdAt: new Date(),
        });
        toast.success("School year added successfully");
      }

      setIsAddYearModalOpen(false);
      setIsEditYearModalOpen(false);
      fetchSchoolYears();
    } catch (error) {
      console.error("Error saving school year:", error);
      toast.error("Failed to save school year");
    }
  };

  const savePeriod = async (isEdit: boolean = false) => {
    if (!periodFormData.name.trim()) {
      toast.error("Period name is required");
      return;
    }

    // Validate weekday selection if not meeting every weekday
    if (
      !periodFormData.meetsEveryWeekday &&
      periodFormData.selectedDays.length === 0
    ) {
      toast.error("Select at least one weekday for this period.");
      return;
    }

    try {
      const earlyRelease = periodFormData.earlyReleaseEnabled
        ? {
            dayOfWeek: periodFormData.earlyReleaseDayOfWeek,
            startTime: periodFormData.earlyReleaseStartTime,
            endTime: periodFormData.earlyReleaseEndTime,
          }
        : null;

      // Persist as:
      // - null => meets every weekday (Mon–Fri)
      // - "mon,wed,fri" => selected subset
      const dayOfWeekValue: string | null = periodFormData.meetsEveryWeekday
        ? null
        : periodFormData.selectedDays.join(",");

      const periodData = {
        name: periodFormData.name,
        startTime: periodFormData.startTime,
        endTime: periodFormData.endTime,
        dayOfWeek: dayOfWeekValue,
        schoolYearId: periodFormData.schoolYearId,
        teacherId: currentUser?.uid,
        // NEW
        earlyRelease,
      };

      if (isEdit && selectedPeriod) {
        await updateDoc(doc(db, "periods", selectedPeriod.id), {
          ...periodData,
          updatedAt: new Date(),
        });
        toast.success("Period updated successfully");
      } else {
        const periodRef = doc(collection(db, "periods"));
        await setDoc(periodRef, {
          ...periodData,
          createdAt: new Date(),
        });
        toast.success("Period added successfully");
      }

      setIsAddPeriodModalOpen(false);
      setIsEditPeriodModalOpen(false);
      fetchPeriods();
    } catch (error) {
      console.error("Error saving period:", error);
      toast.error("Failed to save period");
    }
  };

  const deleteSchoolYear = async () => {
    if (!itemToDelete) return;

    try {
      // Check if there are periods under this school year
      const relatedPeriods = periods.filter(
        (p) => p.schoolYearId === itemToDelete.id
      );
      if (relatedPeriods.length > 0) {
        toast.error(
          "Cannot delete school year with existing periods. Delete periods first."
        );
        return;
      }

      await deleteDoc(doc(db, "schoolYears", itemToDelete.id));
      toast.success("School year deleted successfully");
      setDeleteYearDialog(false);
      setItemToDelete(null);
      fetchSchoolYears();
    } catch (error) {
      console.error("Error deleting school year:", error);
      toast.error("Failed to delete school year");
    }
  };

  const deletePeriod = async () => {
    if (!itemToDelete) return;

    try {
      await deleteDoc(doc(db, "periods", itemToDelete.id));
      toast.success("Period deleted successfully");
      setDeletePeriodDialog(false);
      setItemToDelete(null);
      fetchPeriods();
    } catch (error) {
      console.error("Error deleting period:", error);
      toast.error("Failed to delete period");
    }
  };

  const getPeriodsForYear = (schoolYearId: string) => {
    return periods.filter((period) => period.schoolYearId === schoolYearId);
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
          title="School Years & Class Periods"
          description="Access to school years and class periods management requires an active subscription."
        />
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              Loading school years and periods...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">School Years & Class Periods</h1>
            <p className="text-muted-foreground">
              Organize your classes by school year
            </p>
          </div>
          <Button
            onClick={handleAddSchoolYear}
            className="flex items-center gap-2"
          >
            <PlusIcon size={16} />
            Add School Year
          </Button>
        </div>

        {schoolYears.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No School Years Yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Create your first school year to start organizing your class
                periods
              </p>
              <Button onClick={handleAddSchoolYear}>
                <PlusIcon size={16} className="mr-2" />
                Add School Year
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {schoolYears.map((schoolYear) => {
              const yearPeriods = getPeriodsForYear(schoolYear.id);
              const isExpanded = expandedYears.has(schoolYear.id);

              return (
                <Card key={schoolYear.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleYearExpansion(schoolYear.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            {schoolYear.name}
                            {schoolYear.isActive && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                Active
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {schoolYear.startDate && schoolYear.endDate && (
                              <>
                                From {schoolYear.startDate} to{" "}
                                {schoolYear.endDate}
                              </>
                            )}
                            • {yearPeriods.length} period
                            {yearPeriods.length !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddPeriod(schoolYear.id)}
                        >
                          <PlusIcon size={14} className="mr-1" />
                          Add Period
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSchoolYear(schoolYear)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setItemToDelete(schoolYear);
                            setDeleteYearDialog(true);
                          }}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent>
                      {yearPeriods.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                          <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground mb-3">
                            No periods in this school year
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddPeriod(schoolYear.id)}
                          >
                            <PlusIcon size={14} className="mr-1" />
                            Add First Period
                          </Button>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Period Name</TableHead>
                              <TableHead>Start Time</TableHead>
                              <TableHead>End Time</TableHead>
                              <TableHead>Day</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {yearPeriods.map((period) => (
                              <TableRow key={period.id}>
                                <TableCell className="font-medium">
                                  {period.name}
                                </TableCell>
                                <TableCell>
                                  {to12Hour(period.startTime)}
                                </TableCell>
                                <TableCell>
                                  {to12Hour(period.endTime)}
                                </TableCell>

                                <TableCell>
                                  {formatDaysForTable(period.dayOfWeek)}
                                  {period.earlyRelease && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Early:{" "}
                                      {to12Hour(period.earlyRelease.startTime)}–
                                      {to12Hour(period.earlyRelease.endTime)} (
                                      {weekdayLabels[
                                        period.earlyRelease.dayOfWeek
                                      ] || period.earlyRelease.dayOfWeek}
                                      )
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleEditPeriod(period)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                      onClick={() => {
                                        setItemToDelete(period);
                                        setDeletePeriodDialog(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Add School Year Dialog */}
        <Dialog open={isAddYearModalOpen} onOpenChange={setIsAddYearModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add School Year</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>School Year Name *</Label>
                <Input
                  value={yearFormData.name}
                  onChange={(e) =>
                    setYearFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., 2024-2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <CustomDatePicker
                    selected={yearFormData.startDate}
                    onChange={(date) =>
                      setYearFormData((prev) => ({ ...prev, startDate: date }))
                    }
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <CustomDatePicker
                    selected={yearFormData.endDate}
                    onChange={(date) =>
                      setYearFormData((prev) => ({ ...prev, endDate: date }))
                    }
                    placeholder="Select end date"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={yearFormData.isActive}
                  onChange={(e) =>
                    setYearFormData((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                />
                <Label htmlFor="isActive">Mark as active school year</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddYearModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => saveSchoolYear(false)}>
                  Add School Year
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit School Year Dialog */}
        <Dialog
          open={isEditYearModalOpen}
          onOpenChange={setIsEditYearModalOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit School Year</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>School Year Name *</Label>
                <Input
                  value={yearFormData.name}
                  onChange={(e) =>
                    setYearFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., 2024-2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <CustomDatePicker
                    selected={yearFormData.startDate}
                    onChange={(date) =>
                      setYearFormData((prev) => ({ ...prev, startDate: date }))
                    }
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <CustomDatePicker
                    selected={yearFormData.endDate}
                    onChange={(date) =>
                      setYearFormData((prev) => ({ ...prev, endDate: date }))
                    }
                    placeholder="Select end date"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={yearFormData.isActive}
                  onChange={(e) =>
                    setYearFormData((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                />
                <Label htmlFor="isActiveEdit">Mark as active school year</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditYearModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => saveSchoolYear(true)}>
                  Update School Year
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Period Dialog */}
        <Dialog
          open={isAddPeriodModalOpen}
          onOpenChange={setIsAddPeriodModalOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Class Period</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Period Name *</Label>
                <Input
                  value={periodFormData.name}
                  onChange={(e) =>
                    setPeriodFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Period 1, Math Class"
                />
              </div>

              {/* Weekday meeting pattern */}
              <div className="space-y-2">
                <Label>Meets On</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="meetsEveryWeekday"
                    type="checkbox"
                    checked={periodFormData.meetsEveryWeekday}
                    onChange={(e) =>
                      setPeriodFormData((p) => ({
                        ...p,
                        meetsEveryWeekday: e.target.checked,
                        // clear custom days when toggled on
                        selectedDays: e.target.checked ? [] : p.selectedDays,
                      }))
                    }
                  />
                  <Label htmlFor="meetsEveryWeekday">
                    Meets every weekday (Mon–Fri)
                  </Label>
                </div>

                {!periodFormData.meetsEveryWeekday && (
                  <div className="flex flex-wrap gap-4 mt-2">
                    {allWeekdays.map((d) => (
                      <label key={d} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={periodFormData.selectedDays.includes(d)}
                          onChange={(e) =>
                            setPeriodFormData((p) => {
                              const set = new Set(p.selectedDays);
                              if (e.target.checked) set.add(d);
                              else set.delete(d);
                              return { ...p, selectedDays: Array.from(set) };
                            })
                          }
                        />
                        <span>{weekdayLabels[d]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={periodFormData.startTime}
                    onChange={(e) =>
                      setPeriodFormData((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={periodFormData.endTime}
                    onChange={(e) =>
                      setPeriodFormData((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* NEW: Early Release Section */}
              <div className="mt-2 border-t pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="earlyReleaseEnabled"
                    type="checkbox"
                    checked={periodFormData.earlyReleaseEnabled}
                    onChange={(e) =>
                      setPeriodFormData((p) => ({
                        ...p,
                        earlyReleaseEnabled: e.target.checked,
                      }))
                    }
                  />
                  <Label htmlFor="earlyReleaseEnabled">
                    Has early release schedule
                  </Label>
                </div>

                {periodFormData.earlyReleaseEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Early Release Day</Label>
                      <select
                        className="w-full border rounded-md h-9 px-3"
                        value={periodFormData.earlyReleaseDayOfWeek}
                        onChange={(e) =>
                          setPeriodFormData((p) => ({
                            ...p,
                            earlyReleaseDayOfWeek: e.target.value,
                          }))
                        }
                      >
                        <option value="mon">Monday</option>
                        <option value="tue">Tuesday</option>
                        <option value="wed">Wednesday</option>
                        <option value="thu">Thursday</option>
                        <option value="fri">Friday</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Early Start</Label>
                      <Input
                        type="time"
                        value={periodFormData.earlyReleaseStartTime}
                        onChange={(e) =>
                          setPeriodFormData((p) => ({
                            ...p,
                            earlyReleaseStartTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Early End</Label>
                      <Input
                        type="time"
                        value={periodFormData.earlyReleaseEndTime}
                        onChange={(e) =>
                          setPeriodFormData((p) => ({
                            ...p,
                            earlyReleaseEndTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddPeriodModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => savePeriod(false)}>Add Period</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Period Dialog */}
        <Dialog
          open={isEditPeriodModalOpen}
          onOpenChange={setIsEditPeriodModalOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Class Period</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Period Name *</Label>
                <Input
                  value={periodFormData.name}
                  onChange={(e) =>
                    setPeriodFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Period 1, Math Class"
                />
              </div>

              {/* Weekday meeting pattern (Edit) */}
              <div className="space-y-2">
                <Label>Meets On</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="meetsEveryWeekdayEdit"
                    type="checkbox"
                    checked={periodFormData.meetsEveryWeekday}
                    onChange={(e) =>
                      setPeriodFormData((p) => ({
                        ...p,
                        meetsEveryWeekday: e.target.checked,
                        selectedDays: e.target.checked ? [] : p.selectedDays,
                      }))
                    }
                  />
                  <Label htmlFor="meetsEveryWeekdayEdit">
                    Meets every weekday (Mon–Fri)
                  </Label>
                </div>

                {!periodFormData.meetsEveryWeekday && (
                  <div className="flex flex-wrap gap-4 mt-2">
                    {allWeekdays.map((d) => (
                      <label key={d} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={periodFormData.selectedDays.includes(d)}
                          onChange={(e) =>
                            setPeriodFormData((p) => {
                              const set = new Set(p.selectedDays);
                              if (e.target.checked) set.add(d);
                              else set.delete(d);
                              return { ...p, selectedDays: Array.from(set) };
                            })
                          }
                        />
                        <span>{weekdayLabels[d]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={periodFormData.startTime}
                    onChange={(e) =>
                      setPeriodFormData((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={periodFormData.endTime}
                    onChange={(e) =>
                      setPeriodFormData((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* NEW: Early Release Section (same as Add) */}
              <div className="mt-2 border-t pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="earlyReleaseEnabledEdit"
                    type="checkbox"
                    checked={periodFormData.earlyReleaseEnabled}
                    onChange={(e) =>
                      setPeriodFormData((p) => ({
                        ...p,
                        earlyReleaseEnabled: e.target.checked,
                      }))
                    }
                  />
                  <Label htmlFor="earlyReleaseEnabledEdit">
                    Has early release schedule
                  </Label>
                </div>

                {periodFormData.earlyReleaseEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Early Release Day</Label>
                      <select
                        className="w-full border rounded-md h-9 px-3"
                        value={periodFormData.earlyReleaseDayOfWeek}
                        onChange={(e) =>
                          setPeriodFormData((p) => ({
                            ...p,
                            earlyReleaseDayOfWeek: e.target.value,
                          }))
                        }
                      >
                        <option value="mon">Monday</option>
                        <option value="tue">Tuesday</option>
                        <option value="wed">Wednesday</option>
                        <option value="thu">Thursday</option>
                        <option value="fri">Friday</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Early Start</Label>
                      <Input
                        type="time"
                        value={periodFormData.earlyReleaseStartTime}
                        onChange={(e) =>
                          setPeriodFormData((p) => ({
                            ...p,
                            earlyReleaseStartTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Early End</Label>
                      <Input
                        type="time"
                        value={periodFormData.earlyReleaseEndTime}
                        onChange={(e) =>
                          setPeriodFormData((p) => ({
                            ...p,
                            earlyReleaseEndTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditPeriodModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => savePeriod(true)}>Update Period</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete School Year Dialog */}
        <AlertDialog open={deleteYearDialog} onOpenChange={setDeleteYearDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete School Year</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this school year? This will also
                affect any students assigned to periods within this year.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteSchoolYear}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Period Dialog */}
        <AlertDialog
          open={deletePeriodDialog}
          onOpenChange={setDeletePeriodDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Period</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this period? This may affect
                students assigned to it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deletePeriod}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
