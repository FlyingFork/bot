import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { AllianceDuelList, type DuelListRow, type OpponentAggregate } from "@/components/phase5/AllianceDuelList";
import { requireUser } from "@/lib/server-auth";

export default async function AllianceDuelPage() {
  const user = await requireUser();
  const t = await getTranslations("phase5.allianceDuel");
  const instances = await prisma.allianceDuelInstance.findMany({
    orderBy: { startDate: "desc" },
    include: { days: { select: { hasData: true, dayOutcome: true, dayNumber: true } } },
  });

  const rows: DuelListRow[] = instances.map((instance) => ({
    id: instance.id,
    startDate: instance.startDate.toISOString(),
    endDate: instance.endDate.toISOString(),
    opponentTag: instance.opponentTag,
    opponentName: instance.opponentName,
    status: instance.status,
    outcome: instance.outcome,
    daysWithData: instance.days.filter((day) => day.hasData).length,
    daysWon: instance.days.filter((day) => day.dayOutcome === "WIN").length,
  }));

  const aggregateMap = new Map<string, OpponentAggregate>();
  for (const instance of instances) {
    if (!instance.opponentTag || !instance.outcome) continue;
    const current = aggregateMap.get(instance.opponentTag) ?? { opponentTag: instance.opponentTag, wins: 0, losses: 0, draws: 0 };
    if (instance.outcome === "WIN") current.wins += 1;
    else if (instance.outcome === "LOSS") current.losses += 1;
    else if (instance.outcome === "DRAW") current.draws += 1;
    aggregateMap.set(instance.opponentTag, current);
  }

  const endedInstances = instances.filter((inst) => inst.status === "ENDED");
  const dayPatterns = [1, 2, 3, 4, 5, 6].map((dayNum) => {
    const outcomes = endedInstances
      .flatMap((inst) => inst.days)
      .filter((day) => day.dayNumber === dayNum && day.dayOutcome !== null)
      .map((day) => day.dayOutcome!);
    return {
      dayNumber: dayNum,
      wins: outcomes.filter((o) => o === "WIN").length,
      total: outcomes.length,
    };
  });

  const dayShortLabels = [
    t("days.short1"),
    t("days.short2"),
    t("days.short3"),
    t("days.short4"),
    t("days.short5"),
    t("days.short6"),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {endedInstances.length >= 3 && (
        <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-text-primary">{t("dayPatternTitle")}</h2>
            <p className="text-xs text-text-muted mt-0.5">{t("dayPatternSubtitle")}</p>
          </div>
          <div className="flex items-end gap-2" style={{ height: "96px" }}>
            {dayPatterns.map((pattern, i) => {
              const winRate = pattern.total > 0 ? (pattern.wins / pattern.total) * 100 : null;
              const barColor =
                winRate === null
                  ? "var(--color-border-dim)"
                  : winRate >= 60
                    ? "var(--color-success)"
                    : winRate >= 35
                      ? "#e8a020"
                      : "var(--color-danger)";
              return (
                <div key={pattern.dayNumber} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-text-muted">
                    {winRate !== null ? `${Math.round(winRate)}%` : "—"}
                  </span>
                  <div className="relative w-full flex-1 rounded-t-sm" style={{ backgroundColor: "var(--color-border-dim)" }}>
                    {winRate !== null && (
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all"
                        style={{ height: `${winRate}%`, backgroundColor: barColor }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted">{dayShortLabels[i]}</span>
                  {pattern.total > 0 && (
                    <span className="text-[10px] text-text-dim">({pattern.total})</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <AllianceDuelList rows={rows} aggregates={[...aggregateMap.values()]} isAdmin={user.role === "admin"} />
    </div>
  );
}
