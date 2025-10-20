// app/student-login/layout.tsx
import type { ReactNode } from "react";

export default function StudentLoginLayout({
  children,
}: {
  children: ReactNode;
}) {
  // no navbar, no footer for this route segment
  return <>{children}</>;
}
