import { prisma } from "@tiles-survive/database";
import { getTranslations } from "next-intl/server";
import { EventImportPanel } from "@/components/alliance/ImportPanels";
import { EventTable } from "@/components/alliance/EventTable";
import { PageHeader } from "@/components/ui/page-header";
import { renderAlliancePrompt } from "@/lib/alliance-prompts";

export const dynamic = "force-dynamic";

export default async function AllianceSiegePage() {
  const t = await getTranslations("alliance.events");
  const [snapshots, settings] = await Promise.all([
    prisma.allianceEventSnapshot.findMany({
      where: { eventType: "ALLIANCE_SIEGE" },
      orderBy: { importedAt: "desc" },
      include: {
        member: { select: { id: true, username: true } },
      },
    }),
    prisma.allianceSettings.findUnique({ where: { id: "primary" } }),
  ]);
  const latest = new Map<string, (typeof snapshots)[number]>();
  snapshots.forEach((snapshot) => {
    if (!latest.has(snapshot.memberId)) {
      latest.set(snapshot.memberId, snapshot);
    }
  });
  const rows = Array.from(latest.values()).map((snapshot) => ({
    memberId: snapshot.memberId,
    username: snapshot.member.username,
    power: snapshot.power.toString(),
    explorationLevel: null,
    importedAt: snapshot.importedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={t("allianceSiege")}
        subtitle={t("allianceSiegeSubtitle")}
      />
      <EventImportPanel
        eventType="ALLIANCE_SIEGE"
        prompt={renderAlliancePrompt("allianceSiege", settings?.tag)}
      />
      <EventTable eventName="alliance-siege" rows={rows} showExplorationLevel={false} />
    </div>
  );
}
