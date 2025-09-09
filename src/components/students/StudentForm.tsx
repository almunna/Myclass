"use client";

import { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Period {
  id: string;
  name: string;
  schoolYearId: string;
  schoolYearName?: string;
}

interface Student {
  id: string;
  name: string;
  studentId: string;
  grade: string;
  periodId?: string;
  periodName?: string;
  createdAt: any;
}

interface StudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  student?: Student;
}

export function StudentForm({ isOpen, onClose, mode, student }: StudentFormProps) {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    grade: "",
    periodId: "",
  });
  const [periods, setPeriods] = useState<Period[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form
      if (mode === "add") {
        setFormData({
          name: "",
          studentId: "",
          grade: "",
          periodId: "none",
        });
      } else if (mode === "edit" && student) {
        setFormData({
          name: student.name,
          studentId: student.studentId,
          grade: student.grade,
          periodId: student.periodId || "none",
        });
      }
      
      // Fetch periods and school years for dropdown
      fetchData();
    }
  }, [isOpen, mode, student]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch school years
      const schoolYearsQuery = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser?.uid)
      );
      const schoolYearsSnapshot = await getDocs(schoolYearsQuery);
      const schoolYearsList: any[] = schoolYearsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSchoolYears(schoolYearsList);

      // Fetch periods
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
          name: data.name as string,
          schoolYearId: data.schoolYearId as string,
          schoolYearName: schoolYear?.name || "Unknown School Year",
        };
      }) as Period[];
      
      setPeriods(periodsList.sort((a, b) => {
        // Sort by school year first, then by period name
        if (a.schoolYearName !== b.schoolYearName) {
          return a.schoolYearName!.localeCompare(b.schoolYearName!);
        }
        return a.name.localeCompare(b.name);
      }));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load class periods");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePeriodChange = (value: string) => {
    setFormData((prev) => ({ ...prev, periodId: value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.studentId.trim()) {
      newErrors.studentId = "Student ID is required";
    }
    
    if (!formData.grade.trim()) {
      newErrors.grade = "Grade is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Find period name from selected periodId
      let periodName = "";
      let finalPeriodId = null;
      
      if (formData.periodId && formData.periodId !== "none") {
        finalPeriodId = formData.periodId;
        const period = periods.find(p => p.id === formData.periodId);
        periodName = period?.name || "";
      }
      
      if (mode === "add") {
        // Add new student
        const studentRef = doc(collection(db, "students"));
        await setDoc(studentRef, {
          name: formData.name,
          studentId: formData.studentId,
          grade: formData.grade,
          periodId: finalPeriodId,
          periodName: periodName || null,
          teacherId: currentUser?.uid,
          createdAt: new Date(),
        });
        
        toast.success("Student added successfully");
      } else {
        // Update existing student
        if (!student) return;
        
        await updateDoc(doc(db, "students", student.id), {
          name: formData.name,
          studentId: formData.studentId,
          grade: formData.grade,
          periodId: finalPeriodId,
          periodName: periodName || null,
          teacherId: currentUser?.uid,
          updatedAt: new Date(),
        });
        
        toast.success("Student updated successfully");
      }
      
      onClose();
      
      // Reload the page to refresh the student list
      // In a production app, you might want to use a more efficient approach
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error(`Failed to ${mode === "add" ? "add" : "update"} student`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add Student" : "Edit Student"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Student Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter student name"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="studentId">Student ID *</Label>
            <Input
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="Enter student ID"
            />
            {errors.studentId && <p className="text-sm text-destructive">{errors.studentId}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="grade">Grade *</Label>
            <Input
              id="grade"
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              placeholder="Enter grade (e.g., 9, 10, 11, 12)"
            />
            {errors.grade && <p className="text-sm text-destructive">{errors.grade}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="periodId">Class Period</Label>
            <Select
              value={formData.periodId}
              onValueChange={handlePeriodChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {schoolYears.map((schoolYear) => {
                  const yearPeriods = periods.filter(p => p.schoolYearId === schoolYear.id);
                  if (yearPeriods.length === 0) return null;
                  
                  return (
                    <div key={schoolYear.id}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50 rounded-sm mt-1 mb-1">
                        {schoolYear.name}
                      </div>
                      {yearPeriods.map((period) => (
                        <SelectItem key={period.id} value={period.id} className="pl-6">
                    {period.name}
                  </SelectItem>
                ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "add" ? "Add Student" : "Update Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 