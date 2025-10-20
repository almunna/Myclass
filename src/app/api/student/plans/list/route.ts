import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  const schoolYearId = searchParams.get("schoolYearId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!teacherId || !schoolYearId || !start || !end) {
    return NextResponse.json(
      { error: "teacherId, schoolYearId, start, end are required" },
      { status: 400 }
    );
  }

  // Try range query first (fast path)
  try {
    const q = adminDb
      .collection("lessonPlans")
      .where("teacherId", "==", teacherId)
      .where("schoolYearId", "==", schoolYearId)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .orderBy("date", "asc");

    const snap = await q.get();
    const plans = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ plans });
  } catch {
    // Fallback: broad read + filter (works without composite index)
    const broad = await adminDb
      .collection("lessonPlans")
      .where("teacherId", "==", teacherId)
      .where("schoolYearId", "==", schoolYearId)
      .get();

    const plans = broad.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((p) => p.date >= start && p.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ plans });
  }
}
