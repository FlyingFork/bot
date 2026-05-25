import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const params = request.nextUrl.searchParams;
    const page = Math.max(Number(params.get("page") ?? "1"), 1);
    const pageSize = Math.min(Math.max(Number(params.get("pageSize") ?? "25"), 1), 100);
    const actor = params.get("actor")?.trim();
    const action = params.get("action")?.trim();
    const entityType = params.get("entityType")?.trim();
    const from = params.get("from");
    const to = params.get("to");

    const where = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actor
        ? {
            actor: {
              OR: [
                { username: { contains: actor, mode: "insensitive" as const } },
                { name: { contains: actor, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, username: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json(jsonSafe({ entries, total, page, pageSize }));
  } catch (error) {
    return apiError(error);
  }
}

