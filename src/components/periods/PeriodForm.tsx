"use client";

import { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
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
import { useAuth } from "@/hooks/useAuth";

interface Period {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  dayOfWeek?: string;
  createdAt: any;
}

interface PeriodFormProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  period?: Period;
}

const dayOptions = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "all", label: "All Days" },
];

export function PeriodForm({ isOpen, onClose, mode, period }: PeriodFormProps) {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    dayOfWeek: "all",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form
      if (mode === "add") {
        setFormData({
          name: "",
          startTime: "08:00",
          endTime: "09:00",
          dayOfWeek: "all",
        });
      } else if (mode === "edit" && period) {
        setFormData({
          name: period.name,
          startTime: period.startTime,
          endTime: period.endTime,
          dayOfWeek: period.dayOfWeek || "all",
        });
      }
    }
  }, [isOpen, mode, period]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleDayChange = (value: string) => {
    setFormData((prev) => ({ ...prev, dayOfWeek: value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Period name is required";
    }
    
    if (!formData.startTime) {
      newErrors.startTime = "Start time is required";
    }
    
    if (!formData.endTime) {
      newErrors.endTime = "End time is required";
    }
    
    // Check if end time is after start time
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = "End time must be after start time";
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
      // Format the data for Firestore
      const periodData = {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        dayOfWeek: formData.dayOfWeek === "all" ? null : formData.dayOfWeek,
        teacherId: currentUser?.uid,
      };
      
      if (mode === "add") {
        // Add new period
        const periodRef = doc(collection(db, "periods"));
        await setDoc(periodRef, {
          ...periodData,
          createdAt: new Date(),
        });
        
        toast.success("Period added successfully");
      } else {
        // Update existing period
        if (!period) return;
        
        await updateDoc(doc(db, "periods", period.id), {
          ...periodData,
          updatedAt: new Date(),
        });
        
        toast.success("Period updated successfully");
      }
      
      onClose();
      
      // Reload the page to refresh the period list
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error("Error saving period:", error);
      toast.error(`Failed to ${mode === "add" ? "add" : "update"} period`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add Period" : "Edit Period"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Period Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="E.g., Period 1, Math Class"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
              />
              {errors.startTime && <p className="text-sm text-destructive">{errors.startTime}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleChange}
              />
              {errors.endTime && <p className="text-sm text-destructive">{errors.endTime}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day of Week</Label>
            <Select
              value={formData.dayOfWeek}
              onValueChange={handleDayChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select day of week" />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "add" ? "Add Period" : "Update Period"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 