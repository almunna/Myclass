import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// List of public routes that don't require authentication
const publicRoutes = ["/login", "/signup", "/", "/about", "/pricing", "/faq", "/privacy-policy", "/terms-of-service"];

export async function middleware(request: NextRequest) {
    // Get the path of the request
    const path = request.nextUrl.pathname;

    // Check if the path is a public route
    const isPublicRoute = publicRoutes.some(route => path === route || path.startsWith(`${route}/`));

    // Get user from cookie
    const user = request.cookies.get("user")?.value;

    // If the route is protected and user is not logged in, redirect to login
    if (!isPublicRoute && !user) {
        // Create a URL for the login page
        const loginUrl = new URL("/login", request.url);

        // Add the current URL as a redirect parameter
        loginUrl.searchParams.set("redirect", path);

        // Redirect to login
        return NextResponse.redirect(loginUrl);
    }

    // If the route is login or signup and user is logged in, redirect to dashboard
    if ((path === "/login" || path === "/signup") && user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Allow the request to continue
    return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
    ],
} 