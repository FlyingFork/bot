import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireUser } from "@/lib/server-auth";
import { locales, type Locale } from "@/i18n/config";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { language?: string };
    const language = body.language as Locale | undefined;

    if (!language || !locales.includes(language)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { language },
    });

    const response = NextResponse.json({ ok: true, language });
    response.cookies.set("NEXT_LOCALE", language, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}

