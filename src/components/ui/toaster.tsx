"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: "rounded-md border bg-background text-foreground",
        duration: 3000,
      }}
      richColors
    />
  );
} 