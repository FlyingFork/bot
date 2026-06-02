"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExportButton } from "@/components/phase4/ExportButton";
import { statusBadge, formatDate } from "@/components/phase2/Phase2Utils";
import { formatCompactNumber, formatNumberFull } from "@/lib/power";

export type RrsMember = {
  id: string;
  username: string;
  currentRank: string | null;
  memberStatus: string;
  reservoirRaidScore: number | null;
  reservoirRaidScoreUpdatedAt: string | null;
};

type SortKey = "rank" | "username" | "allianceRank" | "score" | "lastUpdated";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 shrink-0" />
    : <ArrowDown className="h-3 w-3 shrink-0" />;
}

export function RrsLeaderboard({
  members,
  staleThresholdMs,
}: {
  members: RrsMember[];
  staleThresholdMs: number;
}) {
  const t = useTranslations("phase6.rrsLeaderboard");
  const statusT = useTranslations("phase2.status");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [now] = useState(() => new Date().getTime());

  function isStale(updatedAt: string | null) {
    if (!updatedAt) return false;
    return now - new Date(updatedAt).getTime() > staleThresholdMs;
  }

  const ranked = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      if (a.reservoirRaidScore !== null && b.reservoirRaidScore !== null) {
        return b.reservoirRaidScore - a.reservoirRaidScore;
      }
      if (a.reservoirRaidScore !== null) return -1;
      if (b.reservoirRaidScore !== null) return 1;
      return a.username.localeCompare(b.username);
    });
    return sorted.map((m, i) => ({
      ...m,
      displayRank: m.reservoirRaidScore !== null ? i + 1 : null,
    }));
  }, [members]);

  const filtered = useMemo(() => {
    const rows = ranked.filter((m) => {
      if (query && !m.username.toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter !== "ALL" && m.memberStatus !== statusFilter) return false;
      return true;
    });

    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "rank") {
        if (a.displayRank !== null && b.displayRank !== null) return (a.displayRank - b.displayRank) * dir;
        if (a.displayRank !== null) return -1;
        if (b.displayRank !== null) return 1;
        return a.username.localeCompare(b.username);
      }
      if (sortKey === "username") return a.username.localeCompare(b.username) * dir;
      if (sortKey === "allianceRank") return (a.currentRank ?? "").localeCompare(b.currentRank ?? "") * dir;
      if (sortKey === "score") {
        if (a.reservoirRaidScore !== null && b.reservoirRaidScore !== null) {
          return (a.reservoirRaidScore - b.reservoirRaidScore) * dir;
        }
        if (a.reservoirRaidScore !== null) return -1;
        if (b.reservoirRaidScore !== null) return 1;
        return 0;
      }
      if (sortKey === "lastUpdated") {
        const at = a.reservoirRaidScoreUpdatedAt ? new Date(a.reservoirRaidScoreUpdatedAt).getTime() : 0;
        const bt = b.reservoirRaidScoreUpdatedAt ? new Date(b.reservoirRaidScoreUpdatedAt).getTime() : 0;
        return (at - bt) * dir;
      }
      return 0;
    });

    return rows;
  }, [ranked, query, statusFilter, sortKey, sortDir]);

  function sort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface p-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-text-secondary">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("status")}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary"
          >
            <option value="ALL">{t("allStatuses")}</option>
            <option value="ACTIVE">{statusT("ACTIVE")}</option>
            <option value="TEMP_AWAY">{statusT("TEMP_AWAY")}</option>
          </select>
        </label>
        <ExportButton baseUrl="/api/export?type=rrs-leaderboard" />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{t("noResults")}</p>
        ) : (
          filtered.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`}>
              <div className="rounded-md border border-border-dim bg-raised p-3 hover:border-border-default transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-bold text-text-muted w-7 shrink-0 text-right">
                      {member.displayRank !== null ? `#${member.displayRank}` : "—"}
                    </span>
                    <span className="font-semibold text-sm text-text-primary truncate">{member.username}</span>
                    {member.currentRank && (
                      <span className="text-xs text-text-muted shrink-0">{member.currentRank}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {member.reservoirRaidScore !== null ? (
                      <>
                        <span className="text-sm font-bold text-text-primary">
                          <span title={formatNumberFull(member.reservoirRaidScore)}>{formatCompactNumber(member.reservoirRaidScore)}</span>
                        </span>
                        {isStale(member.reservoirRaidScoreUpdatedAt) && (
                          <span title={t("staleHint")}>
                            <Clock className="h-3.5 w-3.5 text-cn-warning" />
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-text-muted">{t("noScore")}</span>
                    )}
                  </div>
                </div>
                <div className="mt-1 pl-9 flex items-center gap-2 flex-wrap">
                  {statusBadge(member.memberStatus, undefined, statusT(member.memberStatus))}
                  {member.reservoirRaidScoreUpdatedAt && (
                    <span className="text-[10px] text-text-muted">
                      {formatDate(member.reservoirRaidScoreUpdatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border border-border-subtle bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">
                <button onClick={() => sort("rank")} className="flex items-center gap-1">
                  {t("rank")} <SortIcon active={sortKey === "rank"} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => sort("username")} className="flex items-center gap-1">
                  {t("member")} <SortIcon active={sortKey === "username"} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => sort("allianceRank")} className="flex items-center gap-1">
                  {t("allianceRank")} <SortIcon active={sortKey === "allianceRank"} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => sort("score")} className="flex items-center gap-1">
                  {t("score")} <SortIcon active={sortKey === "score"} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => sort("lastUpdated")} className="flex items-center gap-1">
                  {t("lastUpdated")} <SortIcon active={sortKey === "lastUpdated"} dir={sortDir} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="text-text-muted font-medium">
                  {member.displayRank !== null ? `#${member.displayRank}` : "—"}
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/members/${member.id}`} className="text-cn-cyan hover:underline">
                    {member.username}
                  </Link>
                </TableCell>
                <TableCell>{member.currentRank ?? "—"}</TableCell>
                <TableCell>
                  {member.reservoirRaidScore !== null ? (
                    <span className="font-semibold">
                      <span title={formatNumberFull(member.reservoirRaidScore)}>{formatCompactNumber(member.reservoirRaidScore)}</span>
                    </span>
                  ) : (
                    <span className="text-text-muted">{t("noScore")}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-secondary text-sm">
                      {member.reservoirRaidScoreUpdatedAt
                        ? formatDate(member.reservoirRaidScoreUpdatedAt)
                        : "—"}
                    </span>
                    {isStale(member.reservoirRaidScoreUpdatedAt) && (
                      <span title={t("staleHint")}>
                        <Clock className="h-3.5 w-3.5 text-cn-warning shrink-0" />
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-text-muted">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
