import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { UploadWorkspace } from "@/components/phase3/UploadWorkspace";
import { requireMinRole } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";

export default async function UploadPage() {
  const user = await requireMinRole("r4");
  const t = await getTranslations("phase3.upload");

  const [settings, tempAwayMembers, duels, raids, submissions, activeSeason] = await Promise.all([
    prisma.allianceSettings.findUnique({ where: { id: "primary" }, select: { tag: true } }),
    prisma.allianceMember.findMany({
      where: { isTempAway: true, tempAwayAllianceTag: { not: null } },
      select: { username: true, tempAwayAllianceTag: true },
    }),
    prisma.allianceDuelInstance.findMany({
      orderBy: { startDate: "desc" },
      take: 20,
      select: {
        id: true,
        startDate: true,
        opponentName: true,
        opponentTag: true,
        days: { orderBy: { dayNumber: "asc" }, select: { dayNumber: true, date: true } },
      },
    }),
    prisma.reservoirRaidPlan.findMany({
      orderBy: { startsAt: "desc" },
      take: 20,
      select: { id: true, startsAt: true, raidDate: true },
    }),
    prisma.pendingChange.findMany({
      where: { submitterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        leaderboardType: true,
        status: true,
        createdAt: true,
        rejectionNote: true,
        payload: true,
      },
    }),
    prisma.season.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <UploadWorkspace
        isAdmin={user.role === "admin"}
        allianceTag={settings?.tag ?? ""}
        tempAwayMembers={tempAwayMembers
          .filter((m) => m.tempAwayAllianceTag)
          .map((m) => ({ tag: m.tempAwayAllianceTag as string, playerName: m.username }))}
        duelOptions={duels.map((duel) => ({
          id: duel.id,
          label: `${duel.opponentName ?? duel.opponentTag ?? t("unknownOpponent")} - ${duel.startDate.toISOString().slice(0, 10)}`,
          days: duel.days.map((day) => ({
            dayNumber: day.dayNumber,
            label: `${t("duelDayLabel", { day: day.dayNumber })} - ${day.date.toISOString().slice(0, 10)}`,
          })),
        }))}
        raidOptions={raids.map((raid) => ({
          id: raid.id,
          label: raid.startsAt.toISOString().slice(0, 16).replace("T", " "),
        }))}
        submissions={jsonSafe(submissions)}
        hasActiveSeason={Boolean(activeSeason)}
      />
    </div>
  );
}
