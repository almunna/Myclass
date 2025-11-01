import { Suspense } from "react";
import ShareClient from "./ShareClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SharePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading share…</div>}>
      <ShareClient />
    </Suspense>
  );
}
