// lib/student.ts
"use client";

import { db, auth } from "@/firebase/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import Cookies from "js-cookie";
import {
  setPersistence,
  browserLocalPersistence,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

/** Wait until Firebase attaches a currentUser (incl. anonymous). */
function waitForAuthReady(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        }
      },
      (err) => {
        try {
          unsub();
        } catch {}
        reject(err);
      }
    );
  });
}

export async function loginStudent(username: string, password: string) {
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (!u || !p) throw new Error("Enter your Student ID in both fields.");

  // Persist session in the browser
  await setPersistence(auth, browserLocalPersistence);

  // Ensure we are using an anonymous session for students
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    await signOut(auth);
  }
  if (!auth.currentUser || !auth.currentUser.isAnonymous) {
    await signInAnonymously(auth);
    // ✅ Make sure request.auth is non-null before any Firestore call
    await waitForAuthReady();
  }

  // ----- Read student login doc (allowed by rules for any signed-in user) -----
  const credSnap = await getDoc(doc(db, "studentLogins", u));
  if (!credSnap.exists()) throw new Error("Invalid Student ID or password.");

  const cred = credSnap.data() as {
    username: string;
    password: string;
    studentRef: string; // e.g. "students/{id}"
    teacherId?: string;
    name?: string;
    enabled?: boolean;
    periodIds?: string[]; // allowed periods for read-only plans
  };

  if (cred.enabled === false) {
    throw new Error("Your account is disabled. Please contact your teacher.");
  }
  if (cred.password !== p) {
    throw new Error("Invalid Student ID or password.");
  }

  // ✅ Prefer values from the login doc
  let teacherId = cred.teacherId || "";
  let periodIds = Array.isArray(cred.periodIds)
    ? cred.periodIds.slice(0, 10) // Firestore 'in' queries use chunks of <=10
    : [];

  // 🔁 Fallback for legacy/hand-made creds that missed teacherId/periodIds
  if ((!teacherId || periodIds.length === 0) && cred.studentRef) {
    // Robustly build a doc ref from cred.studentRef ("students/{id}" or just "{id}")
    const toStudentRef = (path: string) => {
      const segs = path.split("/").filter(Boolean);
      if (segs.length >= 2) return doc(db, segs[0], segs[1]);
      return doc(db, "students", path);
    };

    try {
      const sRef = toStudentRef(cred.studentRef);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        const s = sSnap.data() as any;
        teacherId = teacherId || s.teacherId || "";
        if (periodIds.length === 0) {
          if (Array.isArray(s.periods)) {
            periodIds = s.periods.map((p: any) => p.id).slice(0, 10);
          } else if (s.periodId) {
            periodIds = [s.periodId];
          }
        }
      }
    } catch {
      // ignore fallback errors; we'll proceed with whatever we have
    }
  }

  // Create/update student session under the current anonymous uid
  const anonUid = auth.currentUser!.uid;
  await setDoc(
    doc(db, "studentSessions", anonUid),
    {
      teacherId: teacherId || "",
      studentRef: cred.studentRef,
      periodIds,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  // Cookie for middleware/UI gating
  Cookies.set(
    "user",
    JSON.stringify({
      uid: `student:${cred.studentRef}`,
      role: "student",
      displayName: cred.name || cred.username || u,
      studentRef: cred.studentRef,
      teacherId: teacherId || "",
      hasActiveSubscription: true,
      subscriptionPlan: "student",
    }),
    { sameSite: "Lax", path: "/", expires: 7 }
  );

  // Go to read-only plans
  if (typeof window !== "undefined") {
    window.location.replace("/plans/readonly");
  }
}

export async function logoutStudent() {
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await deleteDoc(doc(db, "studentSessions", uid));
    }
  } catch {
    // ignore cleanup errors
  }

  Cookies.remove("user", { path: "/" });

  try {
    await signOut(auth);
  } catch {
    // ignore
  }

  if (typeof window !== "undefined") {
    window.location.replace("/student-login");
  }
}
