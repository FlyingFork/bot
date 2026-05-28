import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/pending", "/suspended", "/"];
const PUBLIC_RAID_RE = /^\/events\/reservoir-raid\/[^/]+\/register/;
const PUBLIC_RAID_API_RE = /^\/api\/raid-plans\/[^/]+\/register$/;
const AUTH_API_RE = /^\/api\/auth\//;

function isPublic(pathname: string): boolean {
  if (AUTH_API_RE.test(pathname)) return true;
  if (PUBLIC_RAID_RE.test(pathname)) return true;
  if (PUBLIC_RAID_API_RE.test(pathname)) return true;
  return PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/"),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isPublic(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
