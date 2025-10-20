// app/api/student/whoami/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // Return whatever your auth/session stores for students
  // For a simple mock:
  return NextResponse.json({
    studentId: null,
    teacherId: null,
    schoolYearId: null,
  });
}
