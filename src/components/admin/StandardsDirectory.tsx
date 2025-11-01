"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SavedStandard = {
  id: string;
  teacherId: string;
  isPublic?: boolean;
  grade: string;
  subject: string;
  code: string;
  description: string;
  createdAt?: Timestamp | { toDate?: () => Date } | any;
};

type Props = { pageSize?: number };

type SortKey =
  | "grade"
  | "subject"
  | "code"
  | "description"
  | "teacherId"
  | "createdAt";
type SortDir = "asc" | "desc";

export default function StandardsDirectory({ pageSize = 100 }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SavedStandard[]>([]);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<any>(null);

  // Default: Created (latest first)
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editRow, setEditRow] = useState<SavedStandard | null>(null);
  const [eGrade, setEGrade] = useState("");
  const [eSubject, setESubject] = useState("");
  const [eCode, setECode] = useState("");
  const [eDesc, setEDesc] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<SavedStandard | null>(null);

  // Build a server-side ordered query (optional: add a tie-breaker if needed)
  function makeQuery(after?: any) {
    const base = collection(db, "standards");
    const parts = [orderBy(sortKey as string, sortDir as any)];
    // Optional tie-breaker for stable ordering; uncomment if you add index:
    // if (sortKey !== "createdAt") parts.push(orderBy("createdAt", "desc"));
    const qBase = query(
      base,
      ...parts,
      ...(after ? [startAfter(after)] : []),
      limit(pageSize)
    );
    return qBase;
  }

  async function loadFirstPage() {
    setLoading(true);
    try {
      const q = makeQuery();
      const snap = await getDocs(q);
      const items: SavedStandard[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
      setRows(items);
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(Boolean(lastDocRef.current));
    } catch (err: any) {
      console.error("Failed to load standards:", err);
      toast.error(`Failed to load standards: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!lastDocRef.current) return;
    setLoading(true);
    try {
      const q = makeQuery(lastDocRef.current);
      const snap = await getDocs(q);
      const items: SavedStandard[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
      // Append at bottom; do not re-sort on client
      setRows((prev) => [...prev, ...items]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(Boolean(lastDocRef.current));
    } catch (err: any) {
      console.error("Failed to load more standards:", err);
      toast.error(`Failed to load more: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(val: SavedStandard["createdAt"]) {
    try {
      if (!val) return "—";
      if (val?.toDate) return val.toDate().toLocaleDateString();
      if (val instanceof Date) return val.toLocaleDateString();
      return "—";
    } catch {
      return "—";
    }
  }

  // Initial load + reload whenever sort changes (reset pagination)
  useEffect(() => {
    lastDocRef.current = null;
    setRows([]);
    setHasMore(false);
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, sortKey, sortDir]);

  // Filter only (no client-side sort)
  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const g = r.grade?.toLowerCase() ?? "";
      const s = r.subject?.toLowerCase() ?? "";
      const c = r.code?.toLowerCase() ?? "";
      const d = r.description?.toLowerCase() ?? "";
      const owner = r.teacherId?.toLowerCase() ?? "";
      return (
        g.includes(t) ||
        s.includes(t) ||
        c.includes(t) ||
        d.includes(t) ||
        owner.includes(t)
      );
    });
  }, [rows, search]);

  // ✅ simpler & reliable toggler
  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir("asc");
      } else {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      }
    },
    [sortKey]
  );

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  function openEdit(row: SavedStandard) {
    setEditRow(row);
    setEGrade(row.grade ?? "");
    setESubject(row.subject ?? "");
    setECode(row.code ?? "");
    setEDesc(row.description ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!eCode.trim() || !eDesc.trim()) {
      toast.error("Code and description are required.");
      return;
    }
    setEditSaving(true);
    try {
      const ref = doc(db, "standards", editRow.id);
      await updateDoc(ref, {
        teacherId: "global",
        isPublic: true,
        grade: eGrade.trim(),
        subject: eSubject.trim(),
        code: eCode.trim(),
        description: eDesc.trim(),
      });

      // EITHER optimistic patch or force a fresh fetch (keeps server order correct)
      // Here we patch then refresh the first page to respect current server sort.
      setRows((prev) =>
        prev.map((r) =>
          r.id === editRow.id
            ? {
                ...r,
                teacherId: "global",
                isPublic: true,
                grade: eGrade.trim(),
                subject: eSubject.trim(),
                code: eCode.trim(),
                description: eDesc.trim(),
              }
            : r
        )
      );
      toast.success("Standard updated");
      setEditOpen(false);
      setEditRow(null);

      // Refresh from start to keep list correctly ordered under current sort
      lastDocRef.current = null;
      await loadFirstPage();
    } catch (err: any) {
      console.error("Failed to update standard:", err);
      toast.error(`Update failed: ${err?.message ?? String(err)}`);
    } finally {
      setEditSaving(false);
    }
  }

  function openDelete(row: SavedStandard) {
    setDeleteRow(row);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    try {
      await deleteDoc(doc(db, "standards", deleteRow.id));
      setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      toast.success("Standard deleted");
    } catch (err: any) {
      console.error("Failed to delete standard:", err);
      toast.error(`Delete failed: ${err?.message ?? String(err)}`);
    } finally {
      setDeleteOpen(false);
      setDeleteRow(null);
    }
  }

  function TCell({ value, className }: { value: string; className?: string }) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`block truncate ${className ?? ""}`}>{value}</span>
        </TooltipTrigger>
        {value && (
          <TooltipContent className="max-w-[60ch] whitespace-pre-wrap">
            {value}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

  // Small header component to ensure click area + a11y
  function SortHeader({
    label,
    sortKeyForCol,
    className,
  }: {
    label: string;
    sortKeyForCol: SortKey;
    className?: string;
  }) {
    const isActive = sortKey === sortKeyForCol;
    const ariaSort = isActive
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    return (
      <div
        role="button"
        aria-sort={ariaSort}
        tabIndex={0}
        onClick={() => toggleSort(sortKeyForCol)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSort(sortKeyForCol);
          }
        }}
        className={`w-full text-left cursor-pointer select-none hover:text-foreground/90 ${
          className || ""
        }`}
      >
        {label}
        {sortIndicator(sortKeyForCol)}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Standards Directory</CardTitle>
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search (grade, subject, code, description, owner)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" onClick={loadFirstPage} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={150}>
          <div className="w-full max-w-[100vw] overflow-x-auto rounded-md border">
            <Table className="min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  {/* Created first */}
                  <TableHead className="w-36">
                    <SortHeader label="Created" sortKeyForCol="createdAt" />
                  </TableHead>
                  <TableHead className="w-24">
                    <SortHeader label="Grade" sortKeyForCol="grade" />
                  </TableHead>
                  <TableHead className="w-28">
                    <SortHeader label="Subject" sortKeyForCol="subject" />
                  </TableHead>
                  <TableHead className="w-40">
                    <SortHeader
                      label="Code"
                      sortKeyForCol="code"
                      className="font-mono"
                    />
                  </TableHead>
                  <TableHead className="w-[520px]">
                    <SortHeader
                      label="Description"
                      sortKeyForCol="description"
                    />
                  </TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    {/* Created first */}
                    <TableCell className="whitespace-nowrap">
                      <TCell value={formatDate(r.createdAt)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <TCell value={r.grade} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <TCell value={r.subject} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      <TCell value={r.code} />
                    </TableCell>
                    <TableCell className="max-w-[520px]">
                      <TCell
                        value={r.description}
                        className="break-words whitespace-nowrap"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(r)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-500"
                          onClick={() => openDelete(r)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && visible.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-6 text-muted-foreground"
                    >
                      No standards found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {visible.length} of {rows.length}
            {hasMore ? " (more available…)" : ""}
          </div>
          {hasMore && (
            <Button onClick={loadMore} disabled={loading}>
              {loading ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Standard</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Grade</Label>
              <Input
                value={eGrade}
                onChange={(e) => setEGrade(e.target.value)}
                placeholder="6th"
              />
            </div>
            <div>
              <Label className="text-sm">Subject</Label>
              <Input
                value={eSubject}
                onChange={(e) => setESubject(e.target.value)}
                placeholder="ELA"
              />
            </div>
            <div>
              <Label className="text-sm">Code</Label>
              <Input
                value={eCode}
                onChange={(e) => setECode(e.target.value)}
                placeholder="ELA.1.3.a"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm">Description</Label>
              <Input
                value={eDesc}
                onChange={(e) => setEDesc(e.target.value)}
                placeholder="Identify security safeguards..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={editSaving || !eCode.trim() || !eDesc.trim()}
            >
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete standard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete “{deleteRow?.code}” — this cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
