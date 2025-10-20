import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  const schoolYearId = searchParams.get("schoolYearId");
  if (!teacherId || !schoolYearId) {
    return NextResponse.json(
      { error: "teacherId and schoolYearId are required" },
      { status: 400 }
    );
  }

  const snap = await adminDb
    .collection("periods")
    .where("teacherId", "==", teacherId)
    .where("schoolYearId", "==", schoolYearId)
    .get();

  const periods = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ periods });
}
