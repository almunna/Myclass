"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eraser, Pointer, PaintBucket } from "lucide-react";

export type CellType = "seat" | "removed" | "teacher" | "door";

export interface SeatCell {
  id: string;
  row: number;
  col: number;
  type: CellType;
  color?: string; // seat color
  studentId?: string; // optional assignment
}

export interface RoomLayoutData {
  name?: string;
  rows: number;
  cols: number;
  cells: SeatCell[];
  defaultSeatColor: string;
}

// TOOLBAR: only select/remove/paint now
type Tool = "select" | "remove" | "paint";

export interface RoomLayoutProps {
  value: RoomLayoutData;
  onChange: (next: RoomLayoutData) => void;
  onSaveAs?: (name: string, data: RoomLayoutData) => void;
  allowSaveAs?: boolean;
  /** Show the title input at the top (default true) */
  showTitle?: boolean;
}

function makeGrid(
  rows: number,
  cols: number,
  base?: Partial<SeatCell>
): SeatCell[] {
  const out: SeatCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        type: "seat",
        color: base?.color ?? "#e5e7eb",
      });
    }
  }
  return out;
}

export const RoomLayout: React.FC<RoomLayoutProps> = ({
  value,
  onChange,
  onSaveAs,
  allowSaveAs = true,
  showTitle = true,
}) => {
  const [rows, setRows] = useState<number>(value.rows);
  const [cols, setCols] = useState<number>(value.cols);
  const [tool, setTool] = useState<Tool>("select");
  const [seatColor, setSeatColor] = useState<string>(
    value.defaultSeatColor || "#e5e7eb"
  );
  const [saveName, setSaveName] = useState<string>(value.name ?? "");

  // Standalone draggable overlays (always outside seats)
  const [teacherOverlay, setTeacherOverlay] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [doorOverlay, setDoorOverlay] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // NEW: rotation angles (degrees) for overlays
  const [teacherRotation, setTeacherRotation] = useState<number>(0);
  const [doorRotation, setDoorRotation] = useState<number>(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const OVERLAY_OFFSET = 10; // distance outside the grid edge
  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));

  // Dragging state
  const [dragKind, setDragKind] = useState<null | "teacher" | "door">(null);

  // Legend toggles
  const [showActiveSeats, setShowActiveSeats] = useState(true);
  const [showRemovedSeats, setShowRemovedSeats] = useState(true);

  // Inline title validation
  const [titleTouched, setTitleTouched] = useState(false);
  const titleError =
    (titleTouched || (allowSaveAs && saveName.trim().length === 0)) &&
    saveName.trim().length === 0;

  // Ensure cells fit rows/cols if changed
  useEffect(() => {
    if (rows === value.rows && cols === value.cols) return;
    const newCells = makeGrid(rows, cols, { color: value.defaultSeatColor });
    // Preserve removed seats where possible
    value.cells.forEach((old) => {
      if (old.row < rows && old.col < cols) {
        const idx = newCells.findIndex(
          (c) => c.row === old.row && c.col === old.col
        );
        if (idx >= 0)
          newCells[idx] = {
            ...newCells[idx],
            type: old.type,
            color: old.color,
          };
      }
    });
    onChange({ ...value, rows, cols, cells: newCells });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols]);

  // Keep external defaultSeatColor aligned with local color
  useEffect(() => {
    if (seatColor !== value.defaultSeatColor) {
      onChange({ ...value, defaultSeatColor: seatColor });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatColor]);

  // Keep name in value synced when editing title
  useEffect(() => {
    if (saveName !== (value.name ?? "")) {
      onChange({ ...value, name: saveName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveName]);

  const teacherCell = useMemo(
    () => value.cells.find((c) => c.type === "teacher"),
    [value.cells]
  );
  const doorCell = useMemo(
    () => value.cells.find((c) => c.type === "door"),
    [value.cells]
  );

  const applyTool = (cell: SeatCell) => {
    const idx = value.cells.findIndex((c) => c.id === cell.id);
    if (idx < 0) return;

    const next = structuredClone(value) as RoomLayoutData;

    switch (tool) {
      case "select": {
        return; // no-op
      }
      case "remove": {
        next.cells[idx].type =
          next.cells[idx].type === "removed" ? "seat" : "removed";
        if (next.cells[idx].type === "removed") {
          delete next.cells[idx].studentId;
        }
        break;
      }
      case "paint": {
        if (next.cells[idx].type === "seat") {
          next.cells[idx].color = seatColor;
        }
        break;
      }
    }

    onChange(next);
  };

  /** Helpers for perimeter snapping */
  const getRects = () => {
    const wrapperEl = wrapperRef.current;
    const gridEl = gridRef.current;
    if (!wrapperEl || !gridEl) return null;
    const wrapperRect = wrapperEl.getBoundingClientRect();
    const gridRectAbs = gridEl.getBoundingClientRect();

    const gridLeft = gridRectAbs.left - wrapperRect.left;
    const gridTop = gridRectAbs.top - wrapperRect.top;
    const gridRight = gridLeft + gridRectAbs.width;
    const gridBottom = gridTop + gridRectAbs.height;

    return { wrapperRect, gridLeft, gridTop, gridRight, gridBottom };
  };

  const snapToPerimeter = (xRelWrapper: number, yRelWrapper: number) => {
    const rects = getRects();
    if (!rects) return { x: xRelWrapper, y: yRelWrapper };

    const { gridLeft, gridTop, gridRight, gridBottom } = rects;

    const dLeft = Math.abs(xRelWrapper - gridLeft);
    const dRight = Math.abs(xRelWrapper - gridRight);
    const dTop = Math.abs(yRelWrapper - gridTop);
    const dBottom = Math.abs(yRelWrapper - gridBottom);

    const nearest = Math.min(dLeft, dRight, dTop, dBottom);
    let x = xRelWrapper;
    let y = yRelWrapper;

    if (nearest === dLeft) {
      x = gridLeft - OVERLAY_OFFSET;
      y = clamp(yRelWrapper, gridTop, gridBottom);
    } else if (nearest === dRight) {
      x = gridRight + OVERLAY_OFFSET;
      y = clamp(yRelWrapper, gridTop, gridBottom);
    } else if (nearest === dTop) {
      y = gridTop - OVERLAY_OFFSET;
      x = clamp(xRelWrapper, gridLeft, gridRight);
    } else {
      y = gridBottom + OVERLAY_OFFSET;
      x = clamp(xRelWrapper, gridLeft, gridRight);
    }
    return { x, y };
  };

  /** Initialize default positions (once grid is measured) */
  useEffect(() => {
    if (teacherOverlay && doorOverlay) return;
    const rects = getRects();
    if (!rects) return;

    const { gridLeft, gridTop, gridRight, gridBottom } = rects;

    // Default: TEACHER at top-center, DOOR at left-center (both outside)
    const teacherPos = {
      x: (gridLeft + gridRight) / 2,
      y: gridTop - OVERLAY_OFFSET,
    };
    const doorPos = {
      x: gridLeft - OVERLAY_OFFSET,
      y: (gridTop + gridBottom) / 2,
    };

    if (!teacherOverlay) setTeacherOverlay(teacherPos);
    if (!doorOverlay) setDoorOverlay(doorPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRef.current, wrapperRef.current, rows, cols]);

  /** Dragging – mouse events on window to track movement while dragging */
  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!dragKind) return;
      const rects = getRects();
      if (!rects) return;

      const { wrapperRect } = rects;
      const x = ev.clientX - wrapperRect.left;
      const y = ev.clientY - wrapperRect.top;
      const pos = snapToPerimeter(x, y);

      if (dragKind === "teacher") setTeacherOverlay(pos);
      else setDoorOverlay(pos);
    };

    const onUp = () => setDragKind(null);

    if (dragKind) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragKind]);

  const gridTemplate = {
    gridTemplateColumns: `repeat(${value.cols}, minmax(28px, 1fr))`,
    gridTemplateRows: `repeat(${value.rows}, 36px)`,
  } as React.CSSProperties;

  const badge = (text: string, className = "") => (
    <span className={`px-2 py-0.5 text-xs rounded border ${className}`}>
      {text}
    </span>
  );

  const teacherPlaced = !!teacherCell || !!teacherOverlay;
  const doorPlaced = !!doorCell || !!doorOverlay;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Title */}
        {showTitle && (
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Enter Room Layout title here...{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              placeholder="e.g., Room Layout A"
            />
            {titleError && (
              <p className="text-xs text-red-500">
                Please enter a title for the seating chart
              </p>
            )}
          </div>
        )}

        {/* Controls row */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          {/* Rows / Cols */}
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs font-medium">Number of Rows*</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) =>
                  setRows(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  )
                }
                className="w-28"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Number of Columns*</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) =>
                  setCols(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  )
                }
                className="w-28"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Seat Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={seatColor}
                  onChange={(e) => setSeatColor(e.target.value)}
                  className="h-9 w-16 rounded border"
                />
                {badge("default", "bg-muted")}
              </div>
            </div>
          </div>

          {/* Tools (teacher/door removed) */}
          <div className="flex gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={tool === "select" ? "default" : "outline"}
                    onClick={() => setTool("select")}
                    className="gap-1"
                  >
                    <Pointer className="w-4 h-4" />
                    Select
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Do nothing (use for inspection).
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={tool === "remove" ? "default" : "outline"}
                    onClick={() => setTool("remove")}
                    className="gap-1"
                  >
                    <Eraser className="w-4 h-4" />
                    Remove/Restore Seat
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle seat ⇄ removed.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={tool === "paint" ? "default" : "outline"}
                    onClick={() => setTool("paint")}
                    className="gap-1"
                  >
                    <PaintBucket className="w-4 h-4" />
                    Paint Seat
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Paint a seat with the selected color.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Legend toggles */}
          <div className="flex items-center gap-6 ml-auto">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showActiveSeats}
                onChange={(e) => setShowActiveSeats(e.target.checked)}
              />
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border bg-slate-500/70" />
                Active Seats
              </span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showRemovedSeats}
                onChange={(e) => setShowRemovedSeats(e.target.checked)}
              />
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border bg-white" />
                Removed Seats
              </span>
            </label>
          </div>
        </div>

        {/* Grid */}
        <div className="border rounded-md p-3 w-[75vw] bg-muted/40 ml-auto mr-auto mt-10 ">
          <div className="relative" ref={wrapperRef} style={{ minHeight: 24 }}>
            {/* DRAGGABLE perimeter rectangles */}
            {teacherOverlay && (
              <span
                className="absolute inline-flex items-center justify-center text-[11px] font-semibold bg-amber-50 border rounded shadow-sm select-none cursor-move w-[120px] h-[40px] text-center"
                style={{
                  left: teacherOverlay.x,
                  top: teacherOverlay.y,
                  transform: `translate(-50%, -50%) rotate(${teacherRotation}deg)`,
                  zIndex: 5,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (e.altKey) {
                    setTeacherRotation((r) => (r + 15) % 360);
                  } else {
                    setDragKind("teacher");
                  }
                }}
                title="TEACHER DESK (Alt+Click to rotate 15°)"
              >
                TEACHER DESK
              </span>
            )}
            {doorOverlay && (
              <span
                className="absolute inline-flex items-center justify-center text-[11px] font-semibold bg-amber-50 border rounded shadow-sm select-none cursor-move w-[120px] h-[40px] text-center"
                style={{
                  left: doorOverlay.x,
                  top: doorOverlay.y,
                  transform: `translate(-50%, -50%) rotate(${doorRotation}deg)`,
                  zIndex: 5,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (e.altKey) {
                    setDoorRotation((r) => (r + 15) % 360);
                  } else {
                    setDragKind("door");
                  }
                }}
                title="DOOR (Alt+Click to rotate 15°)"
              >
                DOOR
              </span>
            )}

            {/* Seat grid */}
            <div className="grid gap-1 p-10" style={gridTemplate} ref={gridRef}>
              {value.cells.map((cell) => {
                const hideSeat =
                  (cell.type === "seat" && !showActiveSeats) ||
                  (cell.type === "removed" && !showRemovedSeats);

                const base =
                  cell.type === "removed"
                    ? "bg-white border"
                    : "border bg-white";
                const isSeat = cell.type === "seat";
                const seatBg = isSeat
                  ? cell.color ?? value.defaultSeatColor
                  : undefined;

                const commonStyle: React.CSSProperties = {
                  backgroundColor: isSeat ? seatBg : undefined,
                  opacity: hideSeat ? 0.15 : 1,
                };

                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() => applyTool(cell)}
                    className={`relative rounded-sm flex items-center justify-center text-[10px] ${base} hover:ring-2 hover:ring-primary/30 transition`}
                    style={commonStyle}
                    title={`(${cell.row + 1}, ${cell.col + 1}) ${cell.type}`}
                  >
                    {isSeat && <span className="opacity-60">Seat</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-2 flex gap-3">
            {badge(`Rows: ${value.rows}`)}
            {badge(`Cols: ${value.cols}`)}
            {teacherPlaced
              ? badge("Teacher placed", "border-green-300 bg-green-50")
              : badge("No teacher", "border-amber-300 bg-amber-50")}
            {doorPlaced
              ? badge("Door placed", "border-green-300 bg-green-50")
              : badge("No door", "border-amber-300 bg-amber-50")}
          </div>
        </div>

        {/* Save-as row (still available; title doubles as name) */}
        {allowSaveAs && onSaveAs && (
          <div className="flex items-end gap-2">
            <div className="hidden">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
