import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { requireMinRole } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import { RRS_STALE_THRESHOLD_MS } from "@/lib/phase6-constants";
import { PageHeader } from "@/components/ui/page-header";
import { RrsLeaderboard, type RrsMember } from "@/components/phase6/RrsLeaderboard";

export default async function RrsScoresPage() {
  await requireMinRole("r4");
  const t = await getTranslations("phase6.rrsLeaderboard");

  const members = await prisma.allianceMember.findMany({
    where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
    select: {
      id: true,
      username: true,
      currentRank: true,
      memberStatus: true,
      reservoirRaidScore: true,
      reservoirRaidScoreUpdatedAt: true,
    },
    orderBy: { username: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <RrsLeaderboard
        members={jsonSafe(members) as RrsMember[]}
        staleThresholdMs={RRS_STALE_THRESHOLD_MS}
      />
    </div>
  );
}
