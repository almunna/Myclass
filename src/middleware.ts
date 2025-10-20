// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasAdminAccess } from "@/lib/admin";

// Public routes (allow subpaths too, e.g. /tutorials/lesson-1)
const publicRoutes = [
  "/login",
  "/signup",
  "/student-login", // 👈 added
  "/",
  "/about",
  "/forgot-password",
  "/pricing",
  "/faq",
  "/privacy-policy",
  "/terms-of-service",
  "/tutorials",
];

// Students may only view these app paths
const studentAllowed = ["/plans/readonly"];

// Static / public assets
const isAsset = (path: string) =>
  path.startsWith("/_next") ||
  path === "/favicon.ico" ||
  /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff2?)$/i.test(path);

// Safe JSON parse for the "user" cookie
function getUser(cookieVal?: string | null) {
  if (!cookieVal) return null;
  try {
    return JSON.parse(cookieVal);
  } catch {
    return null;
  }
}

function isPublic(path: string) {
  return publicRoutes.some((r) => path === r || path.startsWith(`${r}/`));
}

function isStudent(user: any) {
  return !!user && user.role === "student";
}

function isAllowedForStudent(path: string) {
  // allow /plans and its subpaths
  if (studentAllowed.some((p) => path === p || path.startsWith(`${p}/`))) {
    return true;
  }
  // allow assets (extra guard, though assets are allowed earlier)
  if (isAsset(path)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Always allow assets
  if (isAsset(path)) return NextResponse.next();

  const publicRoute = isPublic(path);
  const user = getUser(request.cookies.get("user")?.value);

  // If protected and not authed → login
  if (!publicRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  // Admin bypass
  if (user && hasAdminAccess(user)) {
    // If admin hits login/signup/student-login, send to dashboard
    if (path === "/login" || path === "/signup" || path === "/student-login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Student restriction: only /plans (+ assets/public already allowed)
  if (user && isStudent(user)) {
    // If student is on login/signup/student-login, send to /plans
    if (path === "/login" || path === "/signup" || path === "/student-login") {
      return NextResponse.redirect(new URL("/plans/readonly", request.url));
    }
    if (!isAllowedForStudent(path) && !publicRoute) {
      return NextResponse.redirect(new URL("/plans/readonly", request.url));
    }
    return NextResponse.next();
  }

  // Non-student, non-admin (e.g., teacher):
  // Block login/signup/student-login if already authed
  if (
    (path === "/login" || path === "/signup" || path === "/student-login") &&
    user
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // We rely on code-level asset bypass; exclude api/internal image/static paths here
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
