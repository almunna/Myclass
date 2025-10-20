import { NextResponse } from "next/server";
import { admin } from "@/lib/firebaseAdmin";

// Ensure this route runs on Node.js, not Edge
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json(
        { ok: false, error: "missing_email" },
        { status: 400 }
      );
    }

    try {
      const user = await admin.auth().getUserByEmail(normalized);
      const providers = (user.providerData || []).map((p) => p.providerId);
      return NextResponse.json({ ok: true, exists: true, providers });
    } catch (e: any) {
      if (e?.code === "auth/user-not-found") {
        return NextResponse.json({ ok: true, exists: false });
      }
      console.error("check-email error:", e);
      return NextResponse.json(
        { ok: false, error: "server_error" },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 }
    );
  }
}
