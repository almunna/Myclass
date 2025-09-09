"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";

type Props = {
  open: boolean;
  onClose: () => void;
  studentId: string;   // this is the *studentId* string saved in behaviors docs
  studentName: string;
};

// Firestore document shape (optional fields for resilience)
type BehaviorRow = {
  id: string;
  date?: string;          // "yyyy-mm-dd"
  time?: string;          // "HH:mm"
  isPositive?: boolean;
  behaviors?: string[];
  notes?: string;
  actions?: string[];
  createdAt?: any;        // Firestore Timestamp | undefined
};

function toSortableDate(r: BehaviorRow): Date {
  if (r?.date) {
    const t = r.time ?? "00:00";
    const d = new Date(`${r.date}T${t}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  const ts = r?.createdAt as any;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return new Date(0);
}

function displayDate(r: BehaviorRow): { dateText: string; timeText?: string } {
  if (r.date) return { dateText: r.date, timeText: r.time };
  const ts = r.createdAt as any;
  if (ts && typeof ts.toDate === "function") {
    const d: Date = ts.toDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return { dateText: `${yyyy}-${mm}-${dd}`, timeText: `${hh}:${mi}` };
  }
  return { dateText: "-" };
}

export function BehaviorHistoryModal({ open, onClose, studentId, studentName }: Props) {
  const [rows, setRows] = useState<BehaviorRow[]>([]);

  useEffect(() => {
    if (!open || !studentId) return;
    (async () => {
      const qRef = query(collection(db, "behaviors"), where("studentId", "==", studentId));
      const snap = await getDocs(qRef);

      const list: BehaviorRow[] = snap.docs.map((d) => {
        const data = d.data() as Omit<BehaviorRow, "id">;
        return { id: d.id, ...data };
      });

      list.sort((a, b) => toSortableDate(b).getTime() - toSortableDate(a).getTime());
      setRows(list);
    })();
  }, [open, studentId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="min-w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Behavior History — {studentName}</DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12%]">Date</TableHead>
                <TableHead className="w-[10%]">Type</TableHead>
                <TableHead className="w-[22%]">Behavior</TableHead>
                <TableHead className="w-[36%]">Notes</TableHead>
                <TableHead className="w-[20%]">Action taken</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No behavior records yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const { dateText, timeText } = displayDate(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="leading-tight">
                          <div>{dateText}</div>
                          {timeText && <div className="text-xs text-muted-foreground">{timeText}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                            r.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {r.isPositive ? "Positive" : "Negative"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-pre-line">
                        {Array.isArray(r.behaviors) && r.behaviors.length ? r.behaviors.join(", ") : "-"}
                      </TableCell>
                      <TableCell className="whitespace-pre-line">{r.notes || "-"}</TableCell>
                      <TableCell className="whitespace-pre-line">
                        {Array.isArray(r.actions) && r.actions.length ? r.actions.join("\n") : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
