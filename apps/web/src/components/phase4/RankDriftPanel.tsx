"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

export type RankMover = {
  playerName: string;
  currentRank: number;
  previousRank: number;
  delta: number; // positive = improved (lower rank number = better position)
};

export function RankDriftPanel({ movers }: { movers: RankMover[] }) {
  const t = useTranslations("phase4.leaderboards");

  const risers = movers.filter((m) => m.delta > 0).slice(0, 5);
  const fallers = movers.filter((m) => m.delta < 0).slice(0, 5);

  if (risers.length === 0 && fallers.length === 0) return null;

  return (
    <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
      <h2 className="text-sm font-bold text-text-primary">{t("rankMovers")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {risers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-success mb-2">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("biggestRisers")}
            </div>
            {risers.map((mover) => (
              <div
                key={mover.playerName}
                className="flex items-center justify-between rounded-md border border-border-dim bg-raised px-3 py-1.5"
              >
                <span className="truncate text-sm text-text-primary max-w-[140px]">
                  {mover.playerName}
                </span>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className="text-xs text-text-muted">
                    #{mover.previousRank} → #{mover.currentRank}
                  </span>
                  <span className="text-xs font-bold text-success">+{mover.delta}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {fallers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-danger mb-2">
              <TrendingDown className="h-3.5 w-3.5" />
              {t("biggestFallers")}
            </div>
            {fallers.map((mover) => (
              <div
                key={mover.playerName}
                className="flex items-center justify-between rounded-md border border-border-dim bg-raised px-3 py-1.5"
              >
                <span className="truncate text-sm text-text-primary max-w-[140px]">
                  {mover.playerName}
                </span>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className="text-xs text-text-muted">
                    #{mover.previousRank} → #{mover.currentRank}
                  </span>
                  <span className="text-xs font-bold text-danger">{mover.delta}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
