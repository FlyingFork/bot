import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/roles";

export type SessionUser = Record<string, unknown> & {
  id: string;
  role?: string | null;
  username?: string | null;
  name?: string | null;
  platformStatus?: string | null;
  allianceMemberId?: string | null;
  banned?: boolean | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return (session?.user as SessionUser | undefined) ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Unauthorized");
  if (user.platformStatus === "SUSPENDED" || user.banned) {
    throw new ApiError(403, "Account suspended");
  }
  if (user.platformStatus === "PENDING") {
    throw new ApiError(403, "Account pending verification");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError(403, "Admin access required");
  return user;
}

export async function requireMinRole(role: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, role)) throw new ApiError(403, "Insufficient role");
  return user;
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

