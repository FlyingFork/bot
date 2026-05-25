import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

const NUMBER_FIELDS = [
  "staleThresholdSoloPower",
  "staleThresholdBattleVanguard",
  "staleThresholdHeadquarters",
  "staleThresholdHero",
  "staleThresholdHeroPower",
  "staleThresholdBehemoth",
  "staleThresholdExploration",
  "staleThresholdCollection",
  "staleThresholdAlliancePlayerList",
  "contributionWeightPowerGrowth",
  "contributionWeightDuelParticipation",
  "contributionWeightRaidParticipation",
] as const;

async function getSettings() {
  return prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: {},
    create: { id: "primary" },
  });
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getSettings();
    return NextResponse.json(jsonSafe({ settings }));
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as Record<string, unknown>;

    const data: Record<string, string | number> = {
      name: typeof body.name === "string" ? body.name.trim() : "",
      tag: typeof body.tag === "string" ? body.tag.trim() : "",
    };

    for (const field of NUMBER_FIELDS) {
      const value = Number(body[field]);
      if (!Number.isInteger(value) || value < 0) {
        return NextResponse.json({ error: `${field} must be a non-negative integer` }, { status: 400 });
      }
      data[field] = value;
    }

    const total =
      Number(data.contributionWeightPowerGrowth) +
      Number(data.contributionWeightDuelParticipation) +
      Number(data.contributionWeightRaidParticipation);

    if (total !== 100) {
      return NextResponse.json({ error: "Contribution weights must sum to 100" }, { status: 400 });
    }

    const before = await getSettings();
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.allianceSettings.update({
        where: { id: "primary" },
        data,
      });
      await createAuditLog(
        actor.id,
        "SETTINGS_UPDATED",
        "AllianceSettings",
        "primary",
        pickSnapshot(before),
        pickSnapshot(updated),
        tx,
      );
      return updated;
    });

    return NextResponse.json(jsonSafe({ ok: true, settings: after }));
  } catch (error) {
    return apiError(error);
  }
}

