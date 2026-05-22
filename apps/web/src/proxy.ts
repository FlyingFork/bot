import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fetch session via better-auth
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch {
    // If session fetch fails, treat as unauthenticated
  }

  const isAuthed = !!session;
  const isVerified = isAuthed && session?.user.emailVerified === true;
  const isAdmin = isVerified && session?.user.role === "admin";

  // Auth pages: sign-in and sign-up
  if (pathname === "/sign-in" || pathname === "/sign-up") {
    if (isAuthed && !isVerified) return NextResponse.redirect(new URL("/sign-up/pending", request.url));
    if (isVerified) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  // Pending page: verified users redirect to dashboard
  if (pathname === "/sign-up/pending") {
    if (isVerified) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  // Dashboard: requires verified session
  if (pathname.startsWith("/dashboard")) {
    if (!isAuthed) return NextResponse.redirect(new URL("/sign-in", request.url));
    if (!isVerified) return NextResponse.redirect(new URL("/sign-up/pending", request.url));
    return NextResponse.next();
  }

  // Admin: requires admin role
  if (pathname.startsWith("/admin")) {
    if (!isAuthed) return NextResponse.redirect(new URL("/sign-in", request.url));
    if (!isVerified) return NextResponse.redirect(new URL("/sign-up/pending", request.url));
    if (!isAdmin) return NextResponse.rewrite(new URL("/forbidden", request.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/bot|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
