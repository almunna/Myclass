"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// If you have a cn() util, you can import it; otherwise keep this tiny joiner.
function cn(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // minimal shadcn-style surface
        "z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        "data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade",
        "data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade",
        "data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade",
        "data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade",
        className
      )}
      {...props}
    />
  );
});
