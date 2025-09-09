"use client";

import React from "react";
import DatePicker from "react-datepicker";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-datepicker/dist/react-datepicker.css";

interface DatePickerProps {
  selected: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomDatePicker({
  selected,
  onChange,
  placeholder = "Select date",
  className,
  disabled = false,
}: DatePickerProps) {
  return (
    <div className="relative">
      <DatePicker
        selected={selected}
        onChange={(date) => date && onChange(date)}
        disabled={disabled}
        placeholderText={placeholder}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        dateFormat="MMMM d, yyyy"
        showPopperArrow={false}
        popperClassName="react-datepicker-popper"
        calendarClassName="shadow-md border border-border rounded-lg"
      />
      <CalendarIcon className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
} 