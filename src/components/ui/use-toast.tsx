"use client";

import * as React from "react";
import { ToastProvider, ToastViewport } from "@radix-ui/react-toast";

export function useToast() {
  // This is just a stub hook to prevent errors
  // Replace with the real shadcn use-toast implementation if you need full features
  return {
    toast: (opts: {
      title?: string;
      description?: string;
      variant?: "default" | "destructive";
    }) => {
      console.log("Toast:", opts);
    },
  };
}
