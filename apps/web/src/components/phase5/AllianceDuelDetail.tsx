"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Edit, Upload } from "lucide-react";
import { TimeDisplay } from "@/components/TimeDisplay";
import { ExportButton } from "@/components/phase4/ExportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function fmtPts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function DualRangeSlider({ max, low, high, onLow, onHigh }: {
  max: number; low: number; high: number;
  onLow: (v: number) => void; onHigh: (v: number) => void;
}) {
  const pctLow = max > 0 ? (low / max) * 100 : 0;
  const pctHigh = max > 0 ? (high / max) * 100 : 100;
  const thumbCls = "pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:h-0 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cn-cyan [&::-webkit-slider-thumb]:bg-surface [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-cn-cyan [&::-moz-range-thumb]:bg-surface";
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border-default" />
      <div
        className="bg-cn-cyan absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
        style={{ left: `${pctLow}%`, right: `${100 - pctHigh}%` }}
      />
      <input
        type="range" min={0} max={max} value={low}
        onChange={(e) => onLow(Math.min(+e.target.value, high))}
        className={`${thumbCls} ${low === max ? "z-10" : ""}`}
      />
      <input
        type="range" min={0} max={max} value={high}
        onChange={(e) => onHigh(Math.max(+e.target.value, low))}
        className={thumbCls}
      />
    </div>
  );
}

export type DuelScoreRow = {
  id: string;
  memberName: string;
  playerName: string;
  side: string;
  points: number;
};

export type DuelDayRow = {
  id: string;
  dayNumber: number;
  date: string;
  pointValue: number;
  hasData: boolean;
  dayOutcome: string | null;
  allyTotalPoints: number;
  enemyTotalPoints: number;
  uploadEnabled: boolean;
  pendingUpload: boolean;
  scores: DuelScoreRow[];
};

export type DuelSummary = {
  countsByDay: { dayNumber: number; count: number; outcome: string | null; hasData: boolean }[];
  topContributors: { memberId: string; memberName: string; total: number }[];
  topEnemies: { playerName: string; total: number }[];
  noDataMembers: string[];
  zeroPointMembers: string[];
};

export type DuelDetailData = {
  id: string;
  startDate: string;
  endDate: string;
  opponentTag: string | null;
  opponentName: string | null;
  status: string;
  outcome: string | null;
  days: DuelDayRow[];
  summary: DuelSummary;
};

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

function DayCard({ day, duelId }: { day: DuelDayRow; duelId: string }) {
  const t = useTranslations("phase5.allianceDuel");
  const maxPts = day.hasData && day.scores.length > 0 ? Math.max(...day.scores.map((s) => s.points)) : 0;
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(maxPts);
  const [side, setSide] = useState("all");
  const [query, setQuery] = useState("");
  const visibleScores = day.scores.filter((s) => {
    if (s.points < low || s.points > high) return false;
    if (side !== "all" && s.side !== side) return false;
    if (query && !`${s.memberName} ${s.playerName}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <article className="space-y-3 rounded-md border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">{t(`days.day${day.dayNumber}`)}</h2>
          <p className="text-xs text-text-muted"><TimeDisplay date={new Date(day.date)} /></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t("pointValue", { value: day.pointValue })}</Badge>
          <Badge variant={day.dayOutcome === "WIN" ? "success" : day.dayOutcome === "LOSS" ? "destructive" : "secondary"}>
            {day.dayOutcome ? t(`outcomes.${day.dayOutcome}`) : t("none")}
          </Badge>
        </div>
      </div>

      {!day.hasData ? (
        <p className="rounded-md border border-border-dim bg-raised p-3 text-sm text-text-muted">{t("noDataUploaded")}</p>
      ) : (
        <>
          <div className="grid gap-2 rounded-md border border-border-dim bg-raised p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-muted">{t("allyPoints")}</p>
              <p className="text-lg font-bold text-text-primary">{fmtPts(day.allyTotalPoints)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">{t("enemyPoints")}</p>
              <p className="text-lg font-bold text-text-primary">{fmtPts(day.enemyTotalPoints)}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlayers")}
              className={selectClass()}
            />
            <select className={selectClass()} value={side} onChange={(event) => setSide(event.target.value)}>
              <option value="all">{t("allSides")}</option>
              <option value="ALLY">{t("sides.ALLY")}</option>
              <option value="ENEMY">{t("sides.ENEMY")}</option>
            </select>
          </div>
          {maxPts > 0 && (
            <div className="space-y-1 rounded-md border border-border-dim bg-raised px-3 py-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{t("pointsFilter")}</span>
                <span className="tabular-nums">{fmtPts(low)} – {fmtPts(high)}</span>
              </div>
              <DualRangeSlider max={maxPts} low={low} high={high} onLow={setLow} onHigh={setHigh} />
            </div>
          )}
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("side")}</TableHead>
                  <TableHead>{t("memberName")}</TableHead>
                  <TableHead>{t("points")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleScores.map((score) => (
                  <TableRow key={score.id}>
                    <TableCell>{t(`sides.${score.side}`)}</TableCell>
                    <TableCell className="font-medium text-text-primary">{score.memberName}</TableCell>
                    <TableCell>{score.points}</TableCell>
                  </TableRow>
                ))}
                {visibleScores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-4 text-center text-text-muted">{t("noScoresInRange")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Button
        variant={day.pendingUpload ? "ghost" : "secondary"}
        disabled={!day.uploadEnabled || day.pendingUpload}
        render={day.uploadEnabled && !day.pendingUpload ? <Link href={`/upload?kind=ALLIANCE_DUEL_DAY&eventInstanceId=${duelId}&eventDay=${day.dayNumber}`} /> : undefined}
      >
        <Upload />
        {day.pendingUpload ? t("pendingApproval") : t("uploadDay")}
      </Button>
    </article>
  );
}

export function AllianceDuelDetail({ duel, isAdmin }: { duel: DuelDetailData; isAdmin: boolean }) {
  const t = useTranslations("phase5.allianceDuel");
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "summary" ? "summary" : "days");
  const maxCount = Math.max(1, ...duel.summary.countsByDay.map((item) => item.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "days" ? "default" : "tab"} onClick={() => setTab("days")}>{t("tabs.days")}</Button>
          <Button variant={tab === "summary" ? "default" : "tab"} onClick={() => setTab("summary")}>{t("tabs.summary")}</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton baseUrl={`/api/export?type=alliance-duel-summary&instanceId=${duel.id}`} />
          {isAdmin && (
            <Button variant="ghost" render={<Link href={`/events/alliance-duel/${duel.id}/edit`} />}>
              <Edit />
              {t("edit")}
            </Button>
          )}
        </div>
      </div>

      {tab === "days" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {duel.days.map((day) => (
            <DayCard key={day.id} day={day} duelId={duel.id} />
          ))}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-md border border-border-subtle bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-text-primary">{t("summary")}</h2>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                {t("instanceOutcome")}
                <Badge variant={duel.outcome === "WIN" ? "success" : duel.outcome === "LOSS" ? "destructive" : "secondary"}>
                  {duel.outcome ? t(`outcomes.${duel.outcome}`) : t("none")}
                </Badge>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-6">
              {duel.summary.countsByDay.map((item) => (
                <div key={item.dayNumber} className="rounded-md border border-border-dim bg-raised p-3">
                  <p className="text-xs font-semibold text-text-primary">{t(`days.day${item.dayNumber}`)}</p>
                  <div className="mt-2 h-20 rounded bg-base">
                    <div className="bg-cn-cyan h-full rounded" style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: item.count > 0 ? 8 : 0 }} />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">{item.count} {t("membersWithData")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryList title={t("topContributors")} items={duel.summary.topContributors.map((item) => `${item.memberName}: ${item.total}`)} empty={t("emptySummary")} />
            <SummaryList title={t("topEnemies")} items={duel.summary.topEnemies.map((item) => `${item.playerName}: ${item.total}`)} empty={t("emptySummary")} />
            <SummaryList title={t("membersNoData")} items={duel.summary.noDataMembers} empty={t("emptySummary")} />
            <SummaryList title={t("membersZeroPoints")} items={duel.summary.zeroPointMembers} empty={t("emptySummary")} />
            <div className="rounded-md border border-border-subtle bg-surface p-4">
              <h2 className="mb-3 text-sm font-bold text-text-primary">{t("timeline")}</h2>

              {/* Mobile: vertical list */}
              <div className="md:hidden space-y-1.5">
                {duel.summary.countsByDay.map((item) => (
                  <div key={item.dayNumber} className="flex items-center justify-between rounded-md border border-border-dim bg-raised px-3 py-2">
                    <p className="text-xs font-semibold text-text-primary">{t(`days.day${item.dayNumber}`)}</p>
                    <Badge variant={!item.hasData ? "secondary" : item.outcome === "WIN" ? "success" : item.outcome === "LOSS" ? "destructive" : "warning"}>
                      {!item.hasData ? t("noData") : item.outcome ? t(`outcomes.${item.outcome}`) : t("none")}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Desktop: 6-col grid */}
              <div className="hidden md:grid grid-cols-6 gap-2">
                {duel.summary.countsByDay.map((item) => (
                  <div key={item.dayNumber} className="rounded-md border border-border-dim bg-raised p-2 text-center">
                    <p className="text-[10px] font-bold text-text-muted">{t(`days.short${item.dayNumber}`)}</p>
                    <Badge variant={!item.hasData ? "secondary" : item.outcome === "WIN" ? "success" : item.outcome === "LOSS" ? "destructive" : "warning"}>
                      {!item.hasData ? t("noData") : item.outcome ? t(`outcomes.${item.outcome}`) : t("none")}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold text-text-primary">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm text-text-secondary">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
