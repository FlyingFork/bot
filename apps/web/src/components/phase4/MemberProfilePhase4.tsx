"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DataCard } from "@/components/ui/data-card";
import { ExportButton } from "@/components/phase4/ExportButton";
import { formatPower, formatPowerFull } from "@/lib/power";
import type { Phase4LeaderboardType } from "@/lib/phase4-shared";

export type ProfileMember = {
  id: string;
  username: string;
  contribution: {
    score: number;
    powerGrowthScore: number;
    duelScore: number;
    raidScore: number;
    duelParticipated: number;
    duelTotal: number;
    raidParticipated: number;
    raidTotal: number;
    weights: { power: number; duel: number; raid: number };
  };
};

export type PowerPoint = { date: string; memberId: string; value: number };
export type RankPoint = { date: string; memberId: string; rank: number; figure?: number; type: Phase4LeaderboardType };
export type DuelHistoryRow = {
  instanceId: string;
  memberId: string;
  week: string;
  opponent: string;
  days: Array<number | null>;
  total: number;
  outcome: string | null;
};
export type RaidHistoryRow = {
  id: string;
  memberId: string;
  date: string;
  status: string;
  waterCollected: number | null;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString();
}

function chartRows<T extends { date: string; memberId: string; value?: number; rank?: number; figure?: number }>(
  points: T[],
  members: ProfileMember[],
  key: "value" | "rank" | "figure",
) {
  const byDate = new Map<string, Record<string, string | number>>();
  for (const point of points) {
    const row = byDate.get(point.date) ?? { date: dateLabel(point.date) };
    row[point.memberId] = point[key] ?? 0;
    byDate.set(point.date, row);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([, value]) => {
      for (const member of members) {
        if (value[member.id] === undefined) value[member.id] = null as unknown as number;
      }
      return value;
    });
}

const COLORS = ["#22d3ee", "#f59e0b"];

export function MemberProfilePhase4({
  members,
  powerPoints,
  rankPoints,
  duelRows,
  raidRows,
}: {
  members: ProfileMember[];
  powerPoints: PowerPoint[];
  rankPoints: RankPoint[];
  duelRows: DuelHistoryRow[];
  raidRows: RaidHistoryRow[];
}) {
  const t = useTranslations("phase4.memberProfile");
  const typeT = useTranslations("phase2.leaderboardTypes");
  const common = useTranslations("phase2.common");
  const powerRows = useMemo(() => chartRows(powerPoints, members, "value"), [members, powerPoints]);
  const rankTypes = Array.from(new Set(rankPoints.map((point) => point.type)));

  return (
    <div className="space-y-5">
      <DataCard
        title={t("powerHistory")}
        headerAction={members[0] ? <ExportButton baseUrl={`/api/export?type=member-power-history&memberId=${members[0].id}`} /> : null}
      >
        {powerRows.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => formatPower(Number(value))} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatPowerFull(Number(value))} />
                {members.map((member, index) => (
                  <Line key={member.id} type="monotone" dataKey={member.id} name={member.username} stroke={COLORS[index] ?? "#a78bfa"} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{common("noDataYet")}</p>
        )}
      </DataCard>

      <DataCard title={t("contribution")} description={t("formulaDescription")}>
        <div className="grid gap-3 md:grid-cols-2">
          {members.map((member) => (
            <div key={member.id} className="rounded-md border border-border-dim bg-raised p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{member.username}</p>
                  <p className="text-xs text-text-muted">
                    {t("weights", member.contribution.weights)}
                  </p>
                </div>
                <span className="text-2xl font-bold text-cn-cyan" title={t("formulaTooltip", {
                  power: member.contribution.powerGrowthScore,
                  duel: member.contribution.duelScore,
                  raid: member.contribution.raidScore,
                })}>
                  {member.contribution.score}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-text-secondary">
                <p>{t("powerComponent", { score: member.contribution.powerGrowthScore })}</p>
                <p>{t("duelRate", { x: member.contribution.duelParticipated, y: member.contribution.duelTotal })}</p>
                <p>{t("raidRate", { x: member.contribution.raidParticipated, y: member.contribution.raidTotal })}</p>
              </div>
            </div>
          ))}
        </div>
      </DataCard>

      <section className="grid gap-4 xl:grid-cols-2">
        {rankTypes.map((type) => {
          const isFigureType = type === "SOLO_POWER" || type === "BATTLE_VANGUARD";
          const filtered = rankPoints.filter((point) => point.type === type);
          const rows = isFigureType
            ? chartRows(filtered, members, "figure")
            : chartRows(filtered, members, "rank");
          return (
            <DataCard
              key={type}
              title={typeT(type)}
              headerAction={members[0] ? <ExportButton baseUrl={`/api/export?type=member-rank-history&memberId=${members[0].id}`} /> : null}
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    {isFigureType ? (
                      type === "SOLO_POWER"
                        ? <YAxis tickFormatter={(v) => formatPower(Number(v))} tick={{ fontSize: 11 }} />
                        : <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    ) : (
                      <YAxis reversed tick={{ fontSize: 11 }} allowDecimals={false} />
                    )}
                    <Tooltip formatter={type === "SOLO_POWER" ? (v) => formatPowerFull(Number(v)) : undefined} />
                    {members.map((member, index) => (
                      <Line key={member.id} type="monotone" dataKey={member.id} name={member.username} stroke={COLORS[index] ?? "#a78bfa"} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DataCard>
          );
        })}
        {rankTypes.length === 0 && (
          <DataCard title={t("rankHistory")}>
            <p className="text-sm text-text-muted">{common("noDataYet")}</p>
          </DataCard>
        )}
      </section>

      <DataCard
        title={t("duelHistory")}
        headerAction={members[0] ? <ExportButton baseUrl={`/api/export?type=member-duel-history&memberId=${members[0].id}`} /> : null}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("week")}</TableHead>
                <TableHead>{t("opponent")}</TableHead>
                {[1, 2, 3, 4, 5, 6].map((day) => <TableHead key={day}>{t("day", { day })}</TableHead>)}
                <TableHead>{t("total")}</TableHead>
                <TableHead>{t("outcome")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duelRows.map((row) => (
                <TableRow key={`${row.memberId}-${row.instanceId}`}>
                  <TableCell>{members.find((member) => member.id === row.memberId)?.username}</TableCell>
                  <TableCell>{dateLabel(row.week)}</TableCell>
                  <TableCell>{row.opponent || common("unknown")}</TableCell>
                  {row.days.map((points, index) => <TableCell key={index}>{points ?? common("none")}</TableCell>)}
                  <TableCell>{row.total}</TableCell>
                  <TableCell>{row.outcome ?? common("none")}</TableCell>
                </TableRow>
              ))}
              {duelRows.length === 0 && <TableRow><TableCell colSpan={11} className="py-8 text-center text-text-muted">{common("noDataYet")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </DataCard>

      <DataCard
        title={t("raidHistory")}
        headerAction={members[0] ? <ExportButton baseUrl={`/api/export?type=member-raid-history&memberId=${members[0].id}`} /> : null}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("member")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("water")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {raidRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{members.find((member) => member.id === row.memberId)?.username}</TableCell>
                <TableCell>{dateLabel(row.date)}</TableCell>
                <TableCell>{t(`raidStatus.${row.status}`)}</TableCell>
                <TableCell>{row.waterCollected ?? common("none")}</TableCell>
              </TableRow>
            ))}
            {raidRows.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-text-muted">{common("noDataYet")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </DataCard>
    </div>
  );
}
