// components/attendance/print.tsx
"use client";

import React, { useCallback, useRef, forwardRef } from "react";

/** Hook: returns a ref for the printable container + a stable handlePrint() */
export function useAttendancePrint() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = useCallback(() => {
    // Small delay helps Recharts settle layouts before print
    setTimeout(() => {
      window.print();
    }, 50);
  }, []);

  return { containerRef, handlePrint };
}

/** Global print styles, include once in the page/component tree */
export function PrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: A4;
          margin: 12mm;
        }
        /* Ensure elements with this class won't split across pages */
        .avoid-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        /* Tailwind's print:hidden works already; this is just a safety net */
        .print\\:hidden {
          display: none !important;
        }
      }
    `}</style>
  );
}

/** Wrapper for the printable area (graphs + list) */
export const PrintArea = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function PrintArea({ className, ...props }, ref) {
  return <div ref={ref as any} className={className} {...props} />;
});
