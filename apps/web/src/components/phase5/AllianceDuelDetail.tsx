"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Edit, Upload, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type DuelScoreRow = {
  id: string;
  memberId: string | null;
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
  topContributors: { memberId: string; memberName: string; total: number; sharePct: number }[];
  topEnemies: { playerName: string; total: number; sharePct: number }[];
  noDataMembers: string[];
  zeroPointMembers: string[];
  perfectAttendanceMembers: string[];
  bestDay: { dayNumber: number; allyPoints: number } | null;
  worstDay: { dayNumber: number; allyPoints: number } | null;
  concentrationPct: number | null;
};

export type DuelOverview = {
  totalAllyPoints: number;
  totalEnemyPoints: number;
  dayWinStreak: number;
  dayLossStreak: number;
  mvp: { memberName: string; total: number; bestDayPts: number; bestDayNumber: number } | null;
  prevDuel: {
    id: string;
    startDate: string;
    opponentName: string | null;
    outcome: string | null;
    totalAllyPoints: number;
    daysWon: number;
    topScorer: { name: string; total: number } | null;
    avgParticipation: number | null;
  } | null;
  h2h: {
    opponentTag: string;
    wins: number;
    losses: number;
    draws: number;
    pastDuels: { id: string; startDate: string; outcome: string }[];
  } | null;
};

export type DuelDetailData = {
  id: string;
  startDate: string;
  endDate: string;
  opponentTag: string | null;
  opponentName: string | null;
  status: string;
  outcome: string | null;
  activeRosterCount: number;
  days: DuelDayRow[];
  summary: DuelSummary;
  overview: DuelOverview;
};

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary w-full";
}

// ── DayCard (unchanged) ───────────────────────────────────────────────────────

function DayCard({ day, duelId, userMemberId }: { day: DuelDayRow; duelId: string; userMemberId?: string | null }) {
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
                {visibleScores.map((score) => {
                  const isMe = userMemberId != null && score.memberId === userMemberId;
                  return (
                    <TableRow key={score.id} className={isMe ? "bg-gold/5" : undefined}>
                      <TableCell>{t(`sides.${score.side}`)}</TableCell>
                      <TableCell className={isMe ? "font-bold text-gold" : "font-medium text-text-primary"}>{score.memberName}</TableCell>
                      <TableCell className={isMe ? "font-bold text-gold" : undefined}>{score.points}</TableCell>
                    </TableRow>
                  );
                })}
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

// ── Shared small components ───────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function CompRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function LeaderboardCard({ title, items, max }: {
  title: string;
  items: { name: string; pts: number; pct: number }[];
  max: number;
}) {
  const t = useTranslations("phase5.allianceDuel");
  const rankColors = ["#f59e0b", "#9ca3af", "#92400e"];
  return (
    <div className="rounded-md border border-border-subtle bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold text-text-primary">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{t("emptySummary")}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.name}>
              <div className="mb-0.5 flex items-center gap-2">
                <span className="w-5 shrink-0 text-[10px] font-bold" style={{ color: rankColors[i] ?? "var(--color-text-muted)" }}>#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{item.name}</span>
                <span className="shrink-0 tabular-nums text-xs font-bold text-text-primary">{fmtPts(item.pts)}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-text-muted">{t("pointsShare", { pct: item.pct })}</span>
              </div>
              <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(item.pts / max) * 100}%`, backgroundColor: "var(--color-cn-cyan)" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberListCard({ title, items, empty, accentColor }: {
  title: string; items: string[]; empty: string; accentColor: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold" style={{ color: accentColor }}>{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5 text-sm text-text-secondary">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ duel }: { duel: DuelDetailData }) {
  const t = useTranslations("phase5.allianceDuel");
  const [memberQuery, setMemberQuery] = useState("");
  const [showAllH2H, setShowAllH2H] = useState(false);

  const { totalAllyPoints, totalEnemyPoints, dayWinStreak, dayLossStreak, mvp, prevDuel, h2h } = duel.overview;
  const delta = totalAllyPoints - totalEnemyPoints;
  const deltaPct = totalEnemyPoints > 0 ? Math.round(Math.abs(delta / totalEnemyPoints) * 100) : null;

  const dataDays = duel.days.filter((d) => d.hasData);

  // Chart data for points trend
  const trendData = duel.days.map((day) => ({
    name: t(`days.short${day.dayNumber}`),
    ally: day.allyTotalPoints,
    enemy: day.enemyTotalPoints,
  }));

  // Instance score: winning a day earns its pointValue toward the instance result
  const instanceAllyScore = duel.days.reduce((s, d) => (d.dayOutcome === "WIN" ? s + d.pointValue : s), 0);
  const instanceEnemyScore = duel.days.reduce((s, d) => (d.dayOutcome === "LOSS" ? s + d.pointValue : s), 0);

  // Member stats for lookup
  const memberStatsMap = useMemo(() => {
    const map = new Map<string, { memberName: string; total: number; dayPts: Map<number, number> }>();
    for (const day of duel.days) {
      if (!day.hasData) continue;
      for (const score of day.scores) {
        if (score.side !== "ALLY") continue;
        const key = score.memberId ?? score.memberName;
        const entry = map.get(key) ?? { memberName: score.memberName, total: 0, dayPts: new Map() };
        entry.total += score.points;
        entry.dayPts.set(day.dayNumber, (entry.dayPts.get(day.dayNumber) ?? 0) + score.points);
        map.set(key, entry);
      }
    }
    return map;
  }, [duel.days]);

  const allMembersSorted = useMemo(
    () => [...memberStatsMap.values()].sort((a, b) => b.total - a.total),
    [memberStatsMap]
  );
  const maxMemberPts = allMembersSorted[0]?.total ?? 0;
  const [ptLow, setPtLow] = useState(0);
  const [ptHighOverride, setPtHighOverride] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<"total" | "avg">("total");

  const memberAvg = useMemo(
    () => new Map(allMembersSorted.map((m) => [m.memberName, m.dayPts.size > 0 ? Math.round(m.total / m.dayPts.size) : 0])),
    [allMembersSorted]
  );
  const maxSliderValue = useMemo(
    () => filterMode === "total" ? maxMemberPts : Math.max(0, ...allMembersSorted.map((m) => memberAvg.get(m.memberName) ?? 0)),
    [filterMode, maxMemberPts, allMembersSorted, memberAvg]
  );

  const switchFilterMode = (mode: "total" | "avg") => {
    setFilterMode(mode);
    setPtLow(0);
    setPtHighOverride(null);
  };

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const high = ptHighOverride ?? maxSliderValue;
    return allMembersSorted.filter((m) => {
      const val = filterMode === "avg" ? (memberAvg.get(m.memberName) ?? 0) : m.total;
      if (val < ptLow || val > high) return false;
      if (q && !m.memberName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allMembersSorted, ptLow, ptHighOverride, maxSliderValue, filterMode, memberAvg, memberQuery]);

  // Days won count for comparison
  const thisDuelDaysWon = duel.summary.countsByDay.filter((d) => d.outcome === "WIN").length;
  const thisDuelAvgPart =
    dataDays.length > 0
      ? Math.round(duel.summary.countsByDay.filter((d) => d.hasData).reduce((s, d) => s + d.count, 0) / dataDays.length)
      : null;

  return (
    <section className="space-y-4">
      {/* 1 — Grand total stat cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("allyGrandTotal")} value={fmtPts(totalAllyPoints)} />
        <StatCard label={t("enemyGrandTotal")} value={fmtPts(totalEnemyPoints)} />
        <div
          className="rounded-md border p-4"
          style={{
            borderColor: delta >= 0 ? "rgba(52,199,123,0.3)" : "rgba(224,82,82,0.3)",
            backgroundColor: delta >= 0 ? "var(--color-success-bg)" : "var(--color-danger-bg)",
          }}
        >
          <p className="text-xs text-text-muted">
            {delta >= 0
              ? t("pointsLead", { pct: deltaPct ?? 0 })
              : t("pointsDeficit", { pct: deltaPct ?? 0 })}
          </p>
          <p
            className="mt-0.5 text-2xl font-bold tabular-nums"
            style={{ color: delta >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
          >
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}{fmtPts(Math.abs(delta))}
          </p>
        </div>
      </div>

      {/* 2 — Highlight cards: MVP · Streak · H2H */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {/* MVP */}
        <div className="rounded-md border border-border-subtle bg-surface p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t("mvp")}</p>
          {mvp ? (
            <>
              <p className="text-base font-bold text-text-primary">{mvp.memberName}</p>
              <p className="text-xs text-text-muted">{fmtPts(mvp.total)} {t("points")}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("bestSingleDay")}: <span className="font-medium text-text-primary">{fmtPts(mvp.bestDayPts)}</span>
                {" "}({t(`days.day${mvp.bestDayNumber}`)})
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("noData")}</p>
          )}
        </div>

        {/* Streak */}
        <div className="rounded-md border border-border-subtle bg-surface p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t("dayWinStreak")} / {t("dayLossStreak")}
          </p>
          {dayWinStreak > 0 && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-success)" }} />
              <span className="text-sm text-text-primary">{t("streakDays", { n: dayWinStreak })}</span>
              <Badge variant="success">{t("dayWinStreak")}</Badge>
            </div>
          )}
          {dayLossStreak > 0 && (
            <div className="flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-danger)" }} />
              <span className="text-sm text-text-primary">{t("streakDays", { n: dayLossStreak })}</span>
              <Badge variant="destructive">{t("dayLossStreak")}</Badge>
            </div>
          )}
          {dayWinStreak === 0 && dayLossStreak === 0 && (
            <p className="text-sm text-text-muted">{t("noStreak")}</p>
          )}
        </div>

        {/* H2H — only if opponent known */}
        {h2h && (
          <div className="rounded-md border border-border-subtle bg-surface p-4 md:col-span-2 lg:col-span-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t("h2hRecord")}</p>
            <p className="mb-2 text-xs text-text-muted">
              {t("opponent")}: <span className="font-medium text-text-primary">{h2h.opponentTag}</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="success">{h2h.wins}W</Badge>
              <Badge variant="destructive">{h2h.losses}L</Badge>
              <Badge variant="secondary">{h2h.draws}D</Badge>
            </div>
            {h2h.pastDuels.length > 0 ? (
              <div className="mt-2 space-y-0.5">
                {(showAllH2H ? h2h.pastDuels : h2h.pastDuels.slice(0, 3)).map((d) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <Link href={`/events/alliance-duel/${d.id}`} className="text-xs text-text-muted hover:text-text-primary">
                      {d.startDate.slice(0, 10)}
                    </Link>
                    <Badge variant={d.outcome === "WIN" ? "success" : d.outcome === "LOSS" ? "destructive" : "secondary"}>
                      {t(`outcomes.${d.outcome}`)}
                    </Badge>
                  </div>
                ))}
                {h2h.pastDuels.length > 3 && (
                  <button
                    className="mt-0.5 text-xs text-text-muted hover:text-text-primary"
                    onClick={() => setShowAllH2H((v) => !v)}
                  >
                    {showAllH2H ? "−" : `+${h2h.pastDuels.length - 3} more`}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">{t("noH2HHistory")}</p>
            )}
          </div>
        )}
      </div>

      {/* 3 — Points trend chart */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("pointsTrend")}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
            <YAxis
              tickFormatter={fmtPts}
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
              width={44}
            />
            <Tooltip
              formatter={(value, name) => [typeof value === "number" ? fmtPts(value) : value, name]}
              contentStyle={{
                background: "var(--color-raised)",
                border: "1px solid var(--color-border-dim)",
                borderRadius: 4,
                fontSize: 11,
              }}
            />
            <Bar dataKey="ally" name={t("allyLabel")} fill="var(--color-cn-cyan)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="enemy" name={t("enemyLabel")} fill="var(--color-danger)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex justify-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--color-cn-cyan)" }} />
            {t("allyLabel")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--color-danger)" }} />
            {t("enemyLabel")}
          </span>
        </div>
      </div>

      {/* 4 — Instance score */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("instanceScore")}</h2>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border-dim bg-raised p-3">
            <p className="text-xs text-text-muted">{t("allyLabel")}</p>
            <p className="text-2xl font-bold tabular-nums text-text-primary">{instanceAllyScore}</p>
            <p className="text-[10px] text-text-muted">{t("stakePoints")}</p>
          </div>
          <div className="rounded-md border border-border-dim bg-raised p-3">
            <p className="text-xs text-text-muted">{t("enemyLabel")}</p>
            <p className="text-2xl font-bold tabular-nums text-text-primary">{instanceEnemyScore}</p>
            <p className="text-[10px] text-text-muted">{t("stakePoints")}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {duel.days.map((day) => (
            <div
              key={day.dayNumber}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border-dim bg-raised px-3 py-2"
            >
              <span className="w-20 shrink-0 text-xs font-medium text-text-primary">
                {t(`days.day${day.dayNumber}`)}
              </span>
              <Badge variant="secondary">{day.pointValue} {t("stakePoints")}</Badge>
              <Badge
                variant={
                  day.dayOutcome === "WIN"
                    ? "success"
                    : day.dayOutcome === "LOSS"
                      ? "destructive"
                      : day.dayOutcome === "DRAW"
                        ? "warning"
                        : "secondary"
                }
              >
                {day.dayOutcome ? t(`outcomes.${day.dayOutcome}`) : t("none")}
              </Badge>
              {day.dayOutcome === "WIN" && (
                <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
                  +{day.pointValue}
                </span>
              )}
              {day.dayOutcome === "LOSS" && (
                <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: "var(--color-danger)" }}>
                  −{day.pointValue}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5 — Participation per day */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("participationByDay")}</h2>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
          {duel.summary.countsByDay.map((item) => {
            const pct = duel.activeRosterCount > 0 ? Math.round((item.count / duel.activeRosterCount) * 100) : 0;
            const barColor = !item.hasData
              ? "var(--color-border-dim)"
              : pct >= 80
                ? "var(--color-success)"
                : pct >= 50
                  ? "#e8a020"
                  : "var(--color-danger)";
            return (
              <div key={item.dayNumber} className="rounded-md border border-border-dim bg-raised p-3 text-center">
                <p className="text-[10px] font-semibold text-text-muted">{t(`days.short${item.dayNumber}`)}</p>
                {!item.hasData ? (
                  <p className="mt-1 text-xs text-text-muted">{t("noData")}</p>
                ) : (
                  <>
                    <p className="mt-1 text-base font-bold text-text-primary">{pct}%</p>
                    <p className="text-[10px] text-text-muted">
                      {t("participationFraction", { count: item.count, total: duel.activeRosterCount })}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-base">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6 — vs Previous duel */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("prevDuelComparison")}</h2>
        {!prevDuel ? (
          <p className="text-sm text-text-muted">{t("noPrevDuel")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-md border border-border-dim bg-raised p-3">
              <p className="text-xs font-semibold text-text-primary">{t("thisDuel")}</p>
              <CompRow label={t("allyGrandTotal")} value={fmtPts(totalAllyPoints)} />
              <CompRow label={t("daysWon")} value={String(thisDuelDaysWon)} />
              <CompRow label={t("topContributors")} value={duel.summary.topContributors[0]?.memberName ?? "—"} />
              <CompRow
                label={t("avgParticipation")}
                value={thisDuelAvgPart !== null ? String(thisDuelAvgPart) : "—"}
              />
            </div>
            <div className="space-y-1.5 rounded-md border border-border-dim bg-raised p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-primary">{t("previousDuel")}</p>
                <Link
                  href={`/events/alliance-duel/${prevDuel.id}`}
                  className="text-[10px] text-text-muted hover:text-text-primary"
                >
                  {prevDuel.startDate.slice(0, 10)} →
                </Link>
              </div>
              <CompRow label={t("allyGrandTotal")} value={fmtPts(prevDuel.totalAllyPoints)} />
              <CompRow label={t("daysWon")} value={String(prevDuel.daysWon)} />
              <CompRow label={t("topContributors")} value={prevDuel.topScorer?.name ?? "—"} />
              <CompRow
                label={t("avgParticipation")}
                value={prevDuel.avgParticipation !== null ? String(Math.round(prevDuel.avgParticipation)) : "—"}
              />
            </div>
          </div>
        )}
      </div>

      {/* 7 — Member lookup */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("memberLookup")}</h2>
        <div className="space-y-2">
          <input
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder={t("searchMember")}
            className={selectClass()}
          />
          {maxMemberPts > 0 && (
            <div className="rounded-md border border-border-dim bg-raised px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">{t("filterByPoints")}</span>
                  <div className="flex gap-px rounded-[4px] border border-border-default bg-base p-0.5">
                    {(["total", "avg"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => switchFilterMode(mode)}
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                          filterMode === mode
                            ? "bg-cn-cyan text-void"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {mode === "total" ? t("filterTotal") : t("filterAvg")}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-xs text-text-muted">
                  {fmtPts(ptLow)} – {fmtPts(ptHighOverride ?? maxSliderValue)}
                </span>
              </div>
              <DualRangeSlider
                max={maxSliderValue}
                low={ptLow}
                high={ptHighOverride ?? maxSliderValue}
                onLow={setPtLow}
                onHigh={setPtHighOverride}
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          {allMembersSorted.length === 0 ? (
            <p className="text-sm text-text-muted">{t("noData")}</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-text-muted">{t("memberNotFound")}</p>
          ) : filteredMembers.length === 1 ? (
            <div className="space-y-3 rounded-md border border-border-dim bg-raised p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text-primary">{filteredMembers[0].memberName}</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-text-muted">
                    {t("points")}: <span className="font-bold text-text-primary">{fmtPts(filteredMembers[0].total)}</span>
                  </span>
                  <span className="text-text-muted">
                    {t("daysParticipated")}: <span className="font-bold text-text-primary">{filteredMembers[0].dayPts.size}</span>
                  </span>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-text-muted">{t("perDayBreakdown")}</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {duel.days.map((day) => {
                    const pts = filteredMembers[0].dayPts.get(day.dayNumber);
                    return (
                      <div
                        key={day.dayNumber}
                        className={`rounded-sm border p-2 text-center ${pts !== undefined ? "border-border-dim bg-base" : "border-border-dim/50 bg-raised"}`}
                      >
                        <p className="text-[10px] text-text-muted">{t(`days.short${day.dayNumber}`)}</p>
                        <p className={`mt-0.5 text-xs font-bold ${pts !== undefined ? "text-text-primary" : "text-text-muted"}`}>
                          {pts !== undefined ? fmtPts(pts) : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-64 space-y-1 overflow-auto">
              {filteredMembers.map((member, i) => {
                const displayVal = filterMode === "avg"
                  ? memberAvg.get(member.memberName) ?? 0
                  : member.total;
                return (
                  <div
                    key={member.memberName}
                    className="flex items-center gap-2 rounded-sm border border-border-dim bg-raised px-3 py-2"
                  >
                    <span className="w-6 shrink-0 text-[10px] tabular-nums text-text-muted">#{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">
                      {member.memberName}
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-text-primary">
                      {fmtPts(displayVal)}
                      {filterMode === "avg" && (
                        <span className="ml-0.5 text-[10px] font-normal text-text-muted">{t("filterAvg")}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-text-muted">{member.dayPts.size}d</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 8 — Missing members alert */}
      {dataDays.length > 0 && duel.summary.noDataMembers.length === 0 ? (
        <div
          className="rounded-md border p-3 text-sm font-medium"
          style={{
            borderColor: "rgba(52,199,123,0.4)",
            backgroundColor: "var(--color-success-bg)",
            color: "var(--color-success)",
          }}
        >
          {t("allMembersPresent")}
        </div>
      ) : duel.summary.noDataMembers.length > 0 ? (
        <div className="rounded-md border border-border-subtle bg-surface p-4">
          <h2 className="mb-2 text-sm font-bold text-text-primary">{t("missingMembersAlert")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {duel.summary.noDataMembers.map((name) => (
              <Badge key={name} variant="warning">{name}</Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── Summary tab (redesigned) ──────────────────────────────────────────────────

function SummaryTab({ duel }: { duel: DuelDetailData }) {
  const t = useTranslations("phase5.allianceDuel");

  const countedDays = duel.summary.countsByDay.filter((d) => d.hasData);
  const wins = countedDays.filter((d) => d.outcome === "WIN").length;
  const losses = countedDays.filter((d) => d.outcome === "LOSS").length;
  const draws = countedDays.filter((d) => d.outcome === "DRAW").length;
  const totalWithOutcome = wins + losses + draws;

  const participationData = duel.summary.countsByDay.map((item) => ({
    name: t(`days.short${item.dayNumber}`),
    count: item.count,
    outcome: item.outcome,
    hasData: item.hasData,
  }));

  function getBarColor(outcome: string | null, hasData: boolean): string {
    if (!hasData) return "var(--color-border-dim)";
    if (outcome === "WIN") return "var(--color-success)";
    if (outcome === "LOSS") return "var(--color-danger)";
    if (outcome === "DRAW") return "#e8a020";
    return "var(--color-cn-cyan)";
  }

  const maxContribution = Math.max(1, ...duel.summary.topContributors.map((c) => c.total));
  const maxEnemyContribution = Math.max(1, ...duel.summary.topEnemies.map((e) => e.total));

  return (
    <section className="space-y-4">
      {/* Row 1 — Best day · Worst day · Record bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border border-border-subtle bg-surface p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t("bestDay")}</p>
          {duel.summary.bestDay ? (
            <>
              <p className="text-sm font-medium text-text-primary">{t(`days.day${duel.summary.bestDay.dayNumber}`)}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
                {fmtPts(duel.summary.bestDay.allyPoints)}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("noData")}</p>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t("worstDay")}</p>
          {duel.summary.worstDay ? (
            <>
              <p className="text-sm font-medium text-text-primary">{t(`days.day${duel.summary.worstDay.dayNumber}`)}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: "var(--color-danger)" }}>
                {fmtPts(duel.summary.worstDay.allyPoints)}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("noData")}</p>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface p-4 sm:col-span-2 lg:col-span-1">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t("daysRecord")}</p>
            <Badge variant={duel.outcome === "WIN" ? "success" : duel.outcome === "LOSS" ? "destructive" : "secondary"}>
              {duel.outcome ? t(`outcomes.${duel.outcome}`) : t("none")}
            </Badge>
          </div>
          <p className="mb-2 text-sm font-bold text-text-primary">{t("recordLabel", { wins, losses, draws })}</p>
          {totalWithOutcome > 0 && (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full gap-px">
                {wins > 0 && (
                  <div style={{ width: `${(wins / totalWithOutcome) * 100}%`, backgroundColor: "var(--color-success)" }} />
                )}
                {draws > 0 && (
                  <div style={{ width: `${(draws / totalWithOutcome) * 100}%`, backgroundColor: "#e8a020" }} />
                )}
                {losses > 0 && (
                  <div style={{ width: `${(losses / totalWithOutcome) * 100}%`, backgroundColor: "var(--color-danger)" }} />
                )}
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-text-muted">
                {wins > 0 && <span style={{ color: "var(--color-success)" }}>■ {t("outcomes.WIN")}</span>}
                {draws > 0 && <span style={{ color: "#e8a020" }}>■ {t("outcomes.DRAW")}</span>}
                {losses > 0 && <span style={{ color: "var(--color-danger)" }}>■ {t("outcomes.LOSS")}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Recharts participation chart */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("summary")}</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={participationData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, t("membersWithData")]}
              contentStyle={{
                background: "var(--color-raised)",
                border: "1px solid var(--color-border-dim)",
                borderRadius: 4,
                fontSize: 11,
              }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {participationData.map((entry, i) => (
                <Cell key={i} fill={getBarColor(entry.outcome, entry.hasData)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3 — Richer day timeline */}
      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("timeline")}</h2>
        <div className="space-y-1.5">
          {duel.days.map((day) => {
            const margin = day.hasData ? day.allyTotalPoints - day.enemyTotalPoints : null;
            return (
              <div
                key={day.dayNumber}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border-dim bg-raised px-3 py-2"
              >
                <span className="w-20 shrink-0 text-xs font-semibold text-text-primary">
                  {t(`days.day${day.dayNumber}`)}
                </span>
                <Badge
                  variant={
                    !day.hasData
                      ? "secondary"
                      : day.dayOutcome === "WIN"
                        ? "success"
                        : day.dayOutcome === "LOSS"
                          ? "destructive"
                          : "warning"
                  }
                >
                  {!day.hasData
                    ? t("noData")
                    : day.dayOutcome
                      ? t(`outcomes.${day.dayOutcome}`)
                      : t("none")}
                </Badge>
                {day.hasData && (
                  <>
                    <span className="text-xs tabular-nums text-text-muted">
                      {fmtPts(day.allyTotalPoints)}{" "}
                      <span className="text-text-dim">vs</span>{" "}
                      {fmtPts(day.enemyTotalPoints)}
                    </span>
                    {margin !== null && (
                      <span
                        className="ml-auto text-xs font-bold tabular-nums"
                        style={{ color: margin >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
                      >
                        {margin >= 0
                          ? t("winMargin", { n: fmtPts(margin) })
                          : t("lossMargin", { n: fmtPts(Math.abs(margin)) })}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4 — Points concentration */}
      {duel.summary.concentrationPct !== null && (
        <div className="rounded-md border border-border-subtle bg-surface px-4 py-3">
          <p className="text-sm text-text-secondary">
            {t("concentrationStat", { pct: duel.summary.concentrationPct })}
          </p>
        </div>
      )}

      {/* Row 5 — Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LeaderboardCard
          title={t("topContributors")}
          items={duel.summary.topContributors.map((c) => ({ name: c.memberName, pts: c.total, pct: c.sharePct }))}
          max={maxContribution}
        />
        <LeaderboardCard
          title={t("topEnemies")}
          items={duel.summary.topEnemies.map((e) => ({ name: e.playerName, pts: e.total, pct: e.sharePct }))}
          max={maxEnemyContribution}
        />
      </div>

      {/* Row 6 — Member lists */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MemberListCard
          title={t("perfectAttendance")}
          items={duel.summary.perfectAttendanceMembers}
          empty={t("emptySummary")}
          accentColor="var(--color-success)"
        />
        <MemberListCard
          title={t("membersNoData")}
          items={duel.summary.noDataMembers}
          empty={t("emptySummary")}
          accentColor="#e8a020"
        />
        <MemberListCard
          title={t("membersZeroPoints")}
          items={duel.summary.zeroPointMembers}
          empty={t("emptySummary")}
          accentColor="var(--color-text-muted)"
        />
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AllianceDuelDetail({ duel, isAdmin, userMemberId }: { duel: DuelDetailData; isAdmin: boolean; userMemberId?: string | null }) {
  const t = useTranslations("phase5.allianceDuel");
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => {
    const p = searchParams.get("tab");
    if (p === "overview") return "overview";
    if (p === "summary") return "summary";
    return "days";
  });

  return (
    <div className="space-y-5">
      {(duel.outcome || duel.status === "ENDED") && (
        <div
          className="rounded-md border px-4 py-3 flex flex-wrap items-center gap-3"
          style={{
            borderColor:
              duel.outcome === "WIN" ? "rgba(52,199,123,0.3)" :
              duel.outcome === "LOSS" ? "rgba(224,82,82,0.3)" :
              "var(--color-border-subtle)",
            backgroundColor:
              duel.outcome === "WIN" ? "var(--color-success-bg)" :
              duel.outcome === "LOSS" ? "var(--color-danger-bg)" :
              "var(--color-surface)",
          }}
        >
          <Badge variant="secondary">{t("statusValues.ENDED")}</Badge>
          {duel.outcome && (
            <span
              className="text-sm font-bold"
              style={{
                color:
                  duel.outcome === "WIN" ? "var(--color-success)" :
                  duel.outcome === "LOSS" ? "var(--color-danger)" :
                  "#e8a020",
              }}
            >
              {t("instanceOutcome")}: {t(`outcomes.${duel.outcome}`)}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "days" ? "default" : "tab"} onClick={() => setTab("days")}>
            {t("tabs.days")}
          </Button>
          <Button variant={tab === "overview" ? "default" : "tab"} onClick={() => setTab("overview")}>
            {t("tabs.overview")}
          </Button>
          <Button variant={tab === "summary" ? "default" : "tab"} onClick={() => setTab("summary")}>
            {t("tabs.summary")}
          </Button>
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

      {tab === "days" && (
        <section className="grid gap-4 lg:grid-cols-2">
          {duel.days.map((day) => (
            <DayCard key={day.id} day={day} duelId={duel.id} userMemberId={userMemberId} />
          ))}
        </section>
      )}
      {tab === "overview" && <OverviewTab duel={duel} />}
      {tab === "summary" && <SummaryTab duel={duel} />}
    </div>
  );
}
