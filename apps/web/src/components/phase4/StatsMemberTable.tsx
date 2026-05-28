"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/phase4/ExportButton";
import { formatPower, formatPowerFull } from "@/lib/power";

export type StatsMemberRow = {
  id: string;
  username: string;
  rank: string | null;
  status: string;
  power: string | null;
  contributionScore: number;
  lastDuelActivity: string | null;
  lastRaidParticipation: string | null;
};

type SortKey = "username" | "rank" | "status" | "power" | "contributionScore" | "lastDuelActivity" | "lastRaidParticipation";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function powerSort(value: string | null) {
  return value ? Number(value) : 0;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />;
}

export function StatsMemberTable({ members }: { members: StatsMemberRow[] }) {
  const t = useTranslations("phase4.stats");
  const common = useTranslations("phase2.common");
  const statusT = useTranslations("phase2.status");
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("contributionScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ranks = Array.from(new Set(members.map((member) => member.rank).filter(Boolean))) as string[];
  const statuses = Array.from(new Set(members.map((member) => member.status)));

  const rows = useMemo(() => {
    const filtered = members.filter((member) => {
      if (query && !member.username.toLowerCase().includes(query.toLowerCase())) return false;
      if (rank !== "ALL" && member.rank !== rank) return false;
      if (status !== "ALL" && member.status !== status) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const value = (member: StatsMemberRow) => {
        if (sortKey === "power") return powerSort(member.power);
        if (sortKey === "contributionScore") return member.contributionScore;
        if (sortKey === "lastDuelActivity") return member.lastDuelActivity ? new Date(member.lastDuelActivity).getTime() : 0;
        if (sortKey === "lastRaidParticipation") return member.lastRaidParticipation ? new Date(member.lastRaidParticipation).getTime() : 0;
        return String(member[sortKey] ?? "").toLowerCase();
      };
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return filtered;
  }, [members, query, rank, sortDir, sortKey, status]);

  function sort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  return (
    <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-text-secondary">
          {common("search")}
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchMembers")} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("rank")}
          <select value={rank} onChange={(event) => setRank(event.target.value)} className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="ALL">{t("allRanks")}</option>
            {ranks.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("status")}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="ALL">{t("allStatuses")}</option>
            {statuses.map((item) => <option key={item} value={item}>{statusT(item)}</option>)}
          </select>
        </label>
        <ExportButton baseUrl="/api/export?type=stats-members" />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{t("noMembers")}</p>
        ) : rows.map((member) => (
          <div key={member.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/members/${member.id}`} className="font-medium text-sm text-cn-cyan hover:underline">{member.username}</Link>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {member.rank && <span className="text-xs text-text-muted">{member.rank}</span>}
                  <Badge variant="secondary">{statusT(member.status)}</Badge>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className="text-sm font-medium text-text-primary"
                  title={member.power ? formatPowerFull(BigInt(member.power)) : undefined}
                >
                  {member.power ? formatPower(BigInt(member.power)) : common("none")}
                </div>
                <div className="text-xs text-text-muted">{t("contributionScore")}: {member.contributionScore}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
              <span>{t("lastDuelActivity")}: {dateLabel(member.lastDuelActivity) || common("none")}</span>
              <span>{t("lastRaidParticipation")}: {dateLabel(member.lastRaidParticipation) || common("none")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><button onClick={() => sort("username")} className="flex items-center gap-1">{t("member")}<SortIcon active={sortKey === "username"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("rank")} className="flex items-center gap-1">{t("rank")}<SortIcon active={sortKey === "rank"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("status")} className="flex items-center gap-1">{t("status")}<SortIcon active={sortKey === "status"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("power")} className="flex items-center gap-1">{t("power")}<SortIcon active={sortKey === "power"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("contributionScore")} className="flex items-center gap-1">{t("contributionScore")}<SortIcon active={sortKey === "contributionScore"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("lastDuelActivity")} className="flex items-center gap-1">{t("lastDuelActivity")}<SortIcon active={sortKey === "lastDuelActivity"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("lastRaidParticipation")} className="flex items-center gap-1">{t("lastRaidParticipation")}<SortIcon active={sortKey === "lastRaidParticipation"} dir={sortDir} /></button></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Link href={`/members/${member.id}`} className="font-medium text-cn-cyan hover:underline">{member.username}</Link>
                </TableCell>
                <TableCell>{member.rank ?? common("none")}</TableCell>
                <TableCell><Badge variant="secondary">{statusT(member.status)}</Badge></TableCell>
                <TableCell title={member.power ? formatPowerFull(BigInt(member.power)) : undefined}>
                  {member.power ? formatPower(BigInt(member.power)) : common("none")}
                </TableCell>
                <TableCell>{member.contributionScore}</TableCell>
                <TableCell>{dateLabel(member.lastDuelActivity) || common("none")}</TableCell>
                <TableCell>{dateLabel(member.lastRaidParticipation) || common("none")}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-text-muted">{t("noMembers")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
