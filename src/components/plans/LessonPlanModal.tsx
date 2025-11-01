"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Paperclip, Save, Palette, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* === Firebase imports for dynamic count === */
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "@/firebase/firebase";
import { ref as storageRef, getDownloadURL } from "firebase/storage";

/* ✅ NEW: standards actions */
import StandardsControls from "@/components/plans/standard";

/* ===========================
   Field key union (for per-field colors)
   =========================== */
type PlanField =
  | "topic"
  | "objective"
  | "resources"
  | "assignments"
  | "homework"
  | "notes"
  | "standards";

/* ===========================
   Shared components
   =========================== */

/** ⬇️ forwardRef so we can focus on Tab navigation */
const AutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  }
>(function AutoGrowTextarea(
  { value, onChange, placeholder, className = "", style, onKeyDown },
  ref
) {
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);

  const autosize = React.useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  }, []);

  React.useEffect(() => {
    autosize();
  }, [value, autosize]);

  // support external focus while keeping local autosize
  React.useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

  return (
    <textarea
      ref={localRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        "w-full resize-none overflow-hidden align-top rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onInput={autosize}
      onKeyDown={onKeyDown}
      style={style}
    />
  );
});

/** Imperative handle so parent can start editing the row */
type EditableRowHandle = { startEditing: () => void };

const EditableRow = React.forwardRef<
  EditableRowHandle,
  {
    label: string;
    value: string;
    setValue: (v: string) => void;
    color?: string;
    setColor: (c: string) => void;
    actions?: React.ReactNode;
    /** Callbacks for Tab/Shift+Tab */
    onTabNext?: () => void;
    onTabPrev?: () => void;
  }
>(function EditableRow(
  { label, value, setValue, color, setColor, actions, onTabNext, onTabPrev },
  ref
) {
  const [editing, setEditing] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useImperativeHandle(ref, () => ({
    startEditing: () => {
      setEditing(true);
      // focus after render
      setTimeout(() => {
        textareaRef.current?.focus();
        // move caret to end
        const el = textareaRef.current;
        if (el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }, 0);
    },
  }));

  return (
    <div className="leading-6 flex items-start gap-2">
      <span className="font-semibold shrink-0">{label}:</span>

      {actions && (
        <div className="ml-2 flex items-center gap-3 shrink-0">{actions}</div>
      )}

      {!editing ? (
        <button
          type="button"
          className="flex-1 text-left rounded hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[1.75rem] p-0.5"
          onClick={() => setEditing(true)}
          title={`Click to add/edit ${label.toLowerCase()}`}
        >
          {value?.trim() ? (
            <span
              className="whitespace-pre-wrap"
              style={{ color: color || undefined }}
            >
              {value}
            </span>
          ) : (
            <span className="block w-full border-b border-dotted border-muted-foreground/50 h-[1.25rem]" />
          )}
        </button>
      ) : (
        <div className="mt-1 w-full">
          <div className="flex items-center gap-2">
            <AutoGrowTextarea
              ref={textareaRef}
              value={value}
              onChange={(v) => setValue(v)}
              placeholder={`Enter ${label.toLowerCase()}…`}
              style={{ color: color || undefined }}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  setEditing(false);
                  if (e.shiftKey) {
                    onTabPrev?.();
                  } else {
                    onTabNext?.();
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

/* ===========================
   Types
   =========================== */

export type PeriodLite = {
  id: string;
  name: string;
  grade?: string;
  startTime?: string;
  endTime?: string;
  studentCount?: number;
  colorBg?: string;
  colorText?: string;
};

export type Attachment = {
  name: string;
  type: string;
  size: number;
  storagePath: string;
  url: string;
};

export type LessonPlan = {
  id?: string;
  teacherId: string;
  schoolYearId: string;
  periodId: string;
  date: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  topic?: string;
  objective?: string;
  resources?: string;
  assignments?: string;
  homework?: string;
  notes?: string;
  standards?: string;
  attachments?: Attachment[];
  colorBg?: string;
  colorText?: string;
  fieldColors?: Partial<Record<PlanField, string>>;
  meta?: {
    createdAt?: any;
    updatedAt?: any;
    shiftedFromDate?: string;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: LessonPlan | null;
  period: PeriodLite | null;
  onChangePlan: React.Dispatch<React.SetStateAction<LessonPlan | null>>;
  onSave: () => Promise<void> | void;
  onUploadAttachment: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void> | void;
  onDeleteAttachment: (att: Attachment) => Promise<void> | void;
  saving?: boolean;
};

/* ===========================
   Modal
   =========================== */

export function LessonPlanModal({
  open,
  onOpenChange,
  plan,
  period,
  onChangePlan,
  onSave,
  onUploadAttachment,
  onDeleteAttachment,
  saving,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!plan) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Plan</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Match Plans page card header colors
  const headerBg = plan.colorBg ?? period?.colorBg ?? "#e6f0ff";
  const headerText = plan.colorText ?? period?.colorText ?? "#1e3a8a";

  const safeSet = (patch: Partial<LessonPlan>) =>
    onChangePlan((prev) => (prev ? { ...prev, ...patch } : prev));

  const setFieldColor = (key: PlanField, color: string) =>
    safeSet({
      fieldColors: {
        ...(plan.fieldColors || {}),
        [key]: color,
      },
    });

  const [studentCount, setStudentCount] = React.useState<number | null>(null);

  // --- Resolve missing attachment URLs automatically ---
  React.useEffect(() => {
    if (!plan?.attachments?.length) return;

    let cancelled = false;

    (async () => {
      try {
        const updated = await Promise.all(
          (plan.attachments ?? []).map(async (a) => {
            if (a?.url) return a;
            if (!a?.storagePath) return a;
            try {
              const url = await getDownloadURL(
                storageRef(storage, a.storagePath)
              );
              return { ...a, url };
            } catch {
              return a;
            }
          })
        );

        const changed =
          JSON.stringify(updated) !== JSON.stringify(plan.attachments);
        if (!cancelled && changed) {
          onChangePlan((prev) =>
            prev ? { ...prev, attachments: updated } : prev
          );
        }
      } catch {
        /* no-op */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan?.attachments, onChangePlan]);

  // --- Robust student count (handles periods: [{id}] | ["id"] | periodId | periodIds) ---
  React.useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      setStudentCount(0);
      if (!period?.id || !plan?.teacherId) return;

      try {
        const q = query(
          collection(db, "students"),
          where("teacherId", "==", plan.teacherId)
        );
        const snap = await getDocs(q);

        let count = 0;
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;

          const ids: string[] = (() => {
            if (Array.isArray(data?.periods)) {
              if (data.periods.length && typeof data.periods[0] === "object") {
                return data.periods.map((p: any) => p?.id).filter(Boolean);
              }
              return data.periods.filter((x: any) => typeof x === "string");
            }
            if (Array.isArray(data?.periodIds)) {
              return data.periodIds.filter((x: any) => typeof x === "string");
            }
            if (typeof data?.periodId === "string") {
              return [data.periodId];
            }
            return [];
          })();

          if (ids.includes(period.id)) count++;
        });

        if (!cancelled) setStudentCount(count);
      } catch {
        if (!cancelled) setStudentCount(0);
      }
    }

    loadCount();
    return () => {
      cancelled = true;
    };
  }, [period?.id, plan?.teacherId]);

  const clearAllFields = React.useCallback(async () => {
    // 0) Resolve the plan doc ID (prefer existing id; fallback to deterministic key)
    const planId =
      plan?.id ??
      `${plan.teacherId}__${plan.schoolYearId}__${plan.periodId || "NA"}__${
        plan.date
      }`;
    const planRef = doc(db, "lessonPlans", planId);

    // 1) Delete any files in Storage via provided handler
    try {
      const atts = [...(plan?.attachments ?? [])];
      if (atts.length) {
        await Promise.all(
          atts.map((a) => Promise.resolve(onDeleteAttachment(a)))
        );
      }
    } catch {
      /* ignore individual delete errors */
    }

    // 2) Clear fields directly in Firestore (remove fields, empty attachments)
    await setDoc(
      planRef,
      {
        name: deleteField(),
        topic: deleteField(),
        objective: deleteField(),
        resources: deleteField(),
        assignments: deleteField(),
        homework: deleteField(),
        notes: deleteField(),
        standards: deleteField(),
        startTime: deleteField(),
        endTime: deleteField(),
        fieldColors: deleteField(),
        attachments: [], // keep an explicit empty array (easier for UI)
        meta: {
          // preserve createdAt if present; only bump updatedAt
          updatedAt: serverTimestamp(),
        },
        // do NOT touch colorBg/colorText so your header theme stays intact
      },
      { merge: true }
    );

    // 3) Reflect DB state locally so the modal shows the cleared values
    safeSet({
      id: planId, // ensure local has id we used
      name: "",
      topic: "",
      objective: "",
      resources: "",
      assignments: "",
      homework: "",
      notes: "",
      standards: "",
      startTime: undefined,
      endTime: undefined,
      fieldColors: {},
      attachments: [],
      meta: { ...(plan.meta || {}), updatedAt: new Date() },
    });
  }, [
    db,
    plan?.id,
    plan?.attachments,
    plan?.teacherId,
    plan?.schoolYearId,
    plan?.periodId,
    plan?.date,
    onDeleteAttachment,
  ]);

  /** ⬇️ Refs that define the tab order between rows */
  const topicRef = React.useRef<EditableRowHandle>(null);
  const objectiveRef = React.useRef<EditableRowHandle>(null);
  const resourcesRef = React.useRef<EditableRowHandle>(null);
  const assignmentsRef = React.useRef<EditableRowHandle>(null);
  const homeworkRef = React.useRef<EditableRowHandle>(null);
  const notesRef = React.useRef<EditableRowHandle>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 rounded border border-border bg-background text-foreground flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {period?.name
              ? `${period.name} – ${format(
                  parseISO(plan.date),
                  "EEE, MMM d, yyyy"
                )}`
              : "Lesson Plan"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div
            className="px-4 py-2"
            style={{ background: headerBg, color: headerText }}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex flex-col min-w-[160px]">
                <div className="text-[15px] font-semibold truncate">
                  {period?.name || "Class Period"}
                </div>
                <div className="text-sm opacity-90">{period?.grade || ""}</div>
              </div>
              <div className="flex-1 text-center text-[15px] font-medium">
                Total Students: {studentCount ?? period?.studentCount ?? 0}
              </div>
              <div className="text-[15px] font-medium min-w-[140px] text-right">
                {(() => {
                  const start = period?.startTime ?? plan.startTime;
                  const end = period?.endTime ?? plan.endTime;
                  return start || end
                    ? `${start ?? ""}${end ? ` – ${end}` : ""}`
                    : "";
                })()}
              </div>
            </div>
          </div>

          <div className="p-3 m-3 border rounded-sm bg-card text-card-foreground border-border">
            <div className="text-[15px] space-y-1">
              <EditableRow
                ref={topicRef}
                label="Topic"
                value={plan.topic ?? ""}
                setValue={(v) => safeSet({ topic: v })}
                color={plan.fieldColors?.topic}
                setColor={(c) => setFieldColor("topic", c)}
                onTabNext={() => objectiveRef.current?.startEditing()}
              />
              <EditableRow
                ref={objectiveRef}
                label="Objective"
                value={plan.objective ?? ""}
                setValue={(v) => safeSet({ objective: v })}
                color={plan.fieldColors?.objective}
                setColor={(c) => setFieldColor("objective", c)}
                onTabPrev={() => topicRef.current?.startEditing()}
                onTabNext={() => resourcesRef.current?.startEditing()}
              />
              <EditableRow
                ref={resourcesRef}
                label="Resources"
                value={plan.resources ?? ""}
                setValue={(v) => safeSet({ resources: v })}
                color={plan.fieldColors?.resources}
                setColor={(c) => setFieldColor("resources", c)}
                onTabPrev={() => objectiveRef.current?.startEditing()}
                onTabNext={() => assignmentsRef.current?.startEditing()}
              />
              <EditableRow
                ref={assignmentsRef}
                label="Assignments"
                value={plan.assignments ?? ""}
                setValue={(v) => safeSet({ assignments: v })}
                color={plan.fieldColors?.assignments}
                setColor={(c) => setFieldColor("assignments", c)}
                onTabPrev={() => resourcesRef.current?.startEditing()}
                onTabNext={() => homeworkRef.current?.startEditing()}
              />
              <EditableRow
                ref={homeworkRef}
                label="Homework"
                value={plan.homework ?? ""}
                setValue={(v) => safeSet({ homework: v })}
                color={plan.fieldColors?.homework}
                setColor={(c) => setFieldColor("homework", c)}
                onTabPrev={() => assignmentsRef.current?.startEditing()}
                onTabNext={() => notesRef.current?.startEditing()}
              />
              <EditableRow
                ref={notesRef}
                label="Notes"
                value={plan.notes ?? ""}
                setValue={(v) => safeSet({ notes: v })}
                color={plan.fieldColors?.notes}
                setColor={(c) => setFieldColor("notes", c)}
                onTabPrev={() => homeworkRef.current?.startEditing()}
                // Next after Notes goes to Standards selector naturally
              />

              {/* 🔽 Standards text field removed; only the selector remains */}
              <div className="mt-2">
                <div className="font-semibold mb-1">Standards</div>
                <StandardsControls
                  teacherId={plan.teacherId}
                  value={plan.standards ?? ""}
                  onChange={(next) => safeSet({ standards: next })}
                />
              </div>
            </div>
          </div>

          <div className="px-4 pb-3">
            <div className="mb-3">
              <Label className="mb-1 block">Add Attachment</Label>
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={async (e) => {
                  await onUploadAttachment(e);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              {!!plan.attachments?.length && (
                <div className="mt-2">
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    Attachments
                  </Label>
                  <ul className="divide-y rounded border">
                    {plan.attachments!.map((a) => (
                      <li
                        key={a.storagePath}
                        className="flex items-center justify-between gap-2 p-2"
                      >
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 truncate"
                          title={a.name}
                        >
                          <Paperclip className="h-4 w-4 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </a>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Delete attachment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Attachment?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove{" "}
                                <strong>{a.name}</strong> from the plan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteAttachment(a)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="px-4 pb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {format(parseISO(plan.date), "EEEE, MMM d, yyyy")}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={async () => {
                await clearAllFields();
              }}
            >
              Clear All
            </Button>

            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!!saving}>
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
