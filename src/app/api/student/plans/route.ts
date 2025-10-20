export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  if (!teacherId)
    return NextResponse.json(
      { error: "teacherId is required" },
      { status: 400 }
    );

  const snap = await adminDb
    .collection("schoolYears")
    .where("teacherId", "==", teacherId)
    .get();

  const years = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ years });
}
