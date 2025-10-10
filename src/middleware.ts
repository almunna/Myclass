import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// List of public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/signup",
  "/",
  "/about",
  "/pricing",
  "/faq",
  "/privacy-policy",
  "/terms-of-service",
  "/tutorials", // ✅ make Tutorials public
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes (allow subpaths too, e.g. /tutorials/lesson-1)
  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );

  // Your auth cookie
  const user = request.cookies.get("user")?.value;

  // If protected and not authed → send to login
  if (!isPublicRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    // keep original path in a redirect param
    loginUrl.searchParams.set("redirect", path); // ✅ your middleware expects `redirect`
    return NextResponse.redirect(loginUrl);
  }

  // If already authed, block login/signup
  if ((path === "/login" || path === "/signup") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // protect everything EXCEPT these system paths
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
