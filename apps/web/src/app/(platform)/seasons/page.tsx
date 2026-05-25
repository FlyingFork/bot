import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { PageHeader } from "@/components/ui/page-header";
import { SeasonsManager, type SeasonRow } from "@/components/phase4/SeasonsManager";

export default async function SeasonsPage() {
  const t = await getTranslations("phase4.seasons");
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();

  const seasons = await prisma.season.findMany({
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    include: { leaderboardSnapshots: { where: { type: "BATTLE_VANGUARD" }, select: { id: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SeasonsManager
        seasons={seasons.map((season) => ({
          id: season.id,
          name: season.name,
          startDate: season.startDate.toISOString(),
          endDate: season.endDate?.toISOString() ?? null,
          isActive: season.isActive,
          closedAt: season.closedAt?.toISOString() ?? null,
          snapshotCount: season.leaderboardSnapshots.length,
        })) as SeasonRow[]}
      />
    </div>
  );
}
