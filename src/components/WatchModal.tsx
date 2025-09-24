"use client";

import * as React from "react";
import { X, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type WatchModalProps = {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  videoUrl: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  rounded?: "md" | "xl" | "2xl";
  blurBackdrop?: boolean;
  disableOutsideClose?: boolean;
  showFooter?: boolean;
};

const sizeToMaxWidth: Record<NonNullable<WatchModalProps["size"]>, string> = {
  sm: "md:max-w-md",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  xl: "md:max-w-5xl",
  fullscreen: "md:max-w-[90vw] md:h-[90vh]",
};

export default function WatchModal({
  trigger,
  title = "Watch",
  description,
  videoUrl,
  open,
  onOpenChange,
  size = "xl",
  rounded = "2xl",
  blurBackdrop = true,
  disableOutsideClose = false,
  showFooter = false,
}: WatchModalProps) {
  const radius =
    rounded === "2xl"
      ? "rounded-2xl"
      : rounded === "xl"
      ? "rounded-xl"
      : "rounded-md";

  // keep map (not used for width now, retained to avoid changing anything else)
  const _maxW = sizeToMaxWidth[size];

  const canPlay = !!open && !!videoUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent
        className={[
          "p-0 overflow-hidden",
          "w-[83vw] min-w-[83vw] h-[95vh]", // width 80vw, never exceed 90vh
          "flex flex-col", // let header take its space; video fills the rest
          radius,
          blurBackdrop ? "backdrop-blur-sm" : "",
          size === "fullscreen" ? "md:max-h-[90vh]" : "", // fixed typo
        ].join(" ")}
        onPointerDownOutside={
          disableOutsideClose ? (e) => e.preventDefault() : undefined
        }
        onInteractOutside={
          disableOutsideClose ? (e) => e.preventDefault() : undefined
        }
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-2 border-b bg-background/95">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate flex items-center gap-2">
                <Play className="h-4 w-4" />
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="truncate">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
            <button
              className="p-2 rounded-md hover:bg-muted transition"
              aria-label="Close"
              onClick={() => onOpenChange?.(false)}
            ></button>
          </div>
        </DialogHeader>

        {/* Body: fills remaining height */}
        <div className="flex-1 min-h-[80vh] bg-black">
          {/* The player fills the available area; no overflow */}
          {canPlay ? (
            videoUrl.includes("youtube.com") ||
            videoUrl.includes("youtu.be") ||
            videoUrl.includes("vimeo.com") ? (
              <iframe
                src={videoUrl}
                title="Video player"
                className="min-h-[80vh] min-w-[80vw]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                src={videoUrl}
                controls
                className="h-full w-full object-contain" // letterbox if needed
              />
            )
          ) : null}
        </div>

        {showFooter && (
          <DialogFooter className="p-4 border-t bg-background/95">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Close
            </Button>
            <Button>Mark as Watched</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
