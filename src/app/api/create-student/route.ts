// app/(admin)/api/create-student/route.ts (example server route)
// — or call this from your AdminPage action.

import { db } from "@/firebase/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // if using admin SDK, use it server-side instead

type CreateStudentInput = {
  uid: string; // from Firebase Auth (created by admin/invite flow)
  email: string;
  displayName?: string;
  teacherId: string; // whose plans they can view
  periodIds?: string[]; // optional: restrict further
};

export async function createStudentDoc(input: CreateStudentInput) {
  const ref = doc(db, "users", input.uid);
  await setDoc(
    ref,
    {
      email: input.email,
      displayName: input.displayName ?? "",
      role: "student",
      teacherId: input.teacherId,
      periodIds: input.periodIds ?? [],
      createdAt: serverTimestamp(),
      // Any subscription fields you use; students don't bypass by default:
      subscriptionStatus: "active", // if you want students to pass your subscription check
      subscriptionPlan: "free", // or "free" with hasAccess elsewhere
    },
    { merge: true }
  );
}
