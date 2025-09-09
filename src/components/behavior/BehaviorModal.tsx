"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

type BehaviorModalProps = {
  open: boolean;
  onClose: () => void;
  studentName: string;
  studentId: string;
  periodsLabel?: string;
  /** Optional; ignored now since we open a page instead */
  onViewHistory?: () => void;
};

const DEFAULT_BEHAVIORS = [
  "Caring",
  "Disrespectful",
  "Disrupting others",
  "Excessive talking",
  "Helpful",
  "Not staying on task",
  "Showed kindness",
  "Showed leadership",
  "Other",
];

const DEFAULT_ACTIONS = [
  "Emailed dean/admin",
  "Emailed parent(s)",
  "Requested parent meeting",
  "Gave warning",
  "Other",
];

export function BehaviorModal({
  open,
  onClose,
  studentName,
  studentId,
  periodsLabel = "All Periods",
}: BehaviorModalProps) {
  const now = useMemo(() => new Date(), []);
  const [showForm] = useState(true);

  // Dynamic counts
  const [positiveCount, setPositiveCount] = useState<number>(0);
  const [negativeCount, setNegativeCount] = useState<number>(0);

  // Form state
  const [date, setDate] = useState<string>(now.toISOString().slice(0, 10));
  const [time, setTime] = useState<string>(now.toTimeString().slice(0, 5));
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [isPositive, setIsPositive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  const formRef = useRef<HTMLDivElement | null>(null);

  // Load counts whenever the modal opens
  useEffect(() => {
    if (!open || !studentId) return;

    (async () => {
      try {
        const qRef = query(collection(db, "behaviors"), where("studentId", "==", studentId));
        const snapshot = await getDocs(qRef);

        let pos = 0;
        let neg = 0;

        snapshot.forEach((d) => {
          const data = d.data() as any;
          if (data.isPositive) pos++;
          else neg++;
        });

        setPositiveCount(pos);
        setNegativeCount(neg);
      } catch (err) {
        console.error("Error fetching behavior counts:", err);
        setPositiveCount(0);
        setNegativeCount(0);
      }
    })();
  }, [open, studentId]);

  const toggle = (arr: string[], value: string, set: (v: string[]) => void) => {
    set(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  // Save behavior to Firestore and update counts locally
  const handleSave = async () => {
    try {
      await addDoc(collection(db, "behaviors"), {
        studentId,
        studentName,
        date,
        time,
        behaviors: selectedBehaviors,
        isPositive,
        notes,
        actions: selectedActions,
        createdAt: serverTimestamp(),
      });

      // Optimistic chip update
      if (isPositive) setPositiveCount((c) => c + 1);
      else setNegativeCount((c) => c + 1);

      // Reset form for next entry
      setSelectedBehaviors([]);
      setNotes("");
      setSelectedActions([]);
    } catch (err) {
      console.error("Error saving behavior:", err);
    }
  };

  // Open a new page (new tab by default) with student history
  const handleView = () => {
    const OPEN_IN_NEW_TAB = true; // set to false to navigate in the same tab
    const url = `/behavior-history?studentId=${encodeURIComponent(
      studentId
    )}&studentName=${encodeURIComponent(studentName)}`;

    try {
      if (OPEN_IN_NEW_TAB) {
        window.open(url, "_blank");
      } else {
        window.location.href = url; // same-tab navigation without parent change
      }
    } finally {
      onClose(); // close this modal after triggering navigation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="min-w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Behavior</DialogTitle>
        </DialogHeader>

        {/* Header toolbar with counts */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Name</TableHead>
                <TableHead className="w-[18%]">Student ID</TableHead>
                <TableHead className="w-[14%]">Positive</TableHead>
                <TableHead className="w-[14%]">Negative</TableHead>
                <TableHead className="w-[16%]">Periods</TableHead>
                <TableHead className="w-[8%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{studentName}</TableCell>
                <TableCell className="text-muted-foreground">{studentId}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-semibold bg-green-100 text-green-700">
                    {positiveCount}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-semibold bg-red-100 text-red-700">
                    {negativeCount}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{periodsLabel}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={handleView}>View</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Form */}
        {showForm && (
          <div ref={formRef} className="mt-6 space-y-6">
            {/* Date / Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            {/* Select behavior(s) */}
            <div>
              <Label className="mb-2 block">Select behavior (select all that apply)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {DEFAULT_BEHAVIORS.map((b) => (
                  <Button
                    key={b}
                    type="button"
                    variant={selectedBehaviors.includes(b) ? "default" : "outline"}
                    onClick={() => toggle(selectedBehaviors, b, setSelectedBehaviors)}
                  >
                    {b}
                  </Button>
                ))}
              </div>
            </div>

            {/* Positive / Negative */}
            <div>
              <Label className="mb-2 block">This behavior is:</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={isPositive ? "default" : "outline"}
                  className={isPositive ? "bg-green-500 text-white hover:bg-green-500/90" : ""}
                  onClick={() => setIsPositive(true)}
                >
                  Positive
                </Button>
                <Button
                  type="button"
                  variant={!isPositive ? "default" : "outline"}
                  className={!isPositive ? "bg-red-500 text-white hover:bg-red-500/90" : ""}
                  onClick={() => setIsPositive(false)}
                >
                  Negative
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="mb-2 block">Notes</Label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[110px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes here..."
              />
            </div>

            {/* Actions taken */}
            <div>
              <Label className="mb-2 block">Action taken (select all that apply)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {DEFAULT_ACTIONS.map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={selectedActions.includes(a) ? "default" : "outline"}
                    onClick={() => toggle(selectedActions, a, setSelectedActions)}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>

            {/* Save / Close */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
