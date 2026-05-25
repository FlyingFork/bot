"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExportButton } from "@/components/phase4/ExportButton";
import {
  LEADERBOARD_EXPORT_FIELDS,
  PHASE4_LEADERBOARD_TYPES,
  displayEntryValue,
  type Phase4LeaderboardType,
} from "@/lib/phase4-shared";

export type LeaderboardSnapshotRow = {
  id: string;
  type: Phase4LeaderboardType;
  capturedAt: string;
  entryCount: number;
  submitter: string | null;
  seasonId: string | null;
  seasonName: string | null;
};

export type LeaderboardEntryRow = {
  id: string;
  rank: number | null;
  playerName: string;
  memberName: string | null;
  data: Record<string, unknown>;
};

export type SeasonOption = { id: string; name: string; active: boolean };

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />;
}

export function LeaderboardBrowser({
  selectedType,
  selectedSnapshotId,
  selectedSeasonId,
  snapshots,
  entries,
  seasons,
}: {
  selectedType: Phase4LeaderboardType;
  selectedSnapshotId: string | null;
  selectedSeasonId: string | null;
  snapshots: LeaderboardSnapshotRow[];
  entries: LeaderboardEntryRow[];
  seasons: SeasonOption[];
}) {
  const t = useTranslations("phase4.leaderboards");
  const typeT = useTranslations("phase2.leaderboardTypes");
  const fieldT = useTranslations("phase4.fields");
  const common = useTranslations("phase2.common");
  const [snapshotQuery, setSnapshotQuery] = useState("");
  const [entryQuery, setEntryQuery] = useState("");
  const [entrySort, setEntrySort] = useState<string>("rank");
  const [entryDir, setEntryDir] = useState<"asc" | "desc">("asc");

  const snapshotRows = useMemo(() => {
    const query = snapshotQuery.toLowerCase();
    return snapshots.filter((row) => {
      if (!query) return true;
      return `${row.submitter ?? ""} ${row.seasonName ?? ""} ${dateLabel(row.capturedAt)}`.toLowerCase().includes(query);
    });
  }, [snapshotQuery, snapshots]);

  const fields = LEADERBOARD_EXPORT_FIELDS[selectedType];
  const entryRows = useMemo(() => {
    const query = entryQuery.toLowerCase();
    const rows = entries.filter((entry) =>
      `${entry.playerName} ${entry.memberName ?? ""} ${JSON.stringify(entry.data)}`.toLowerCase().includes(query),
    );
    rows.sort((a, b) => {
      const dir = entryDir === "asc" ? 1 : -1;
      const value = (entry: LeaderboardEntryRow) => {
        if (entrySort === "rank") return entry.rank ?? Number.MAX_SAFE_INTEGER;
        if (entrySort === "playerName") return entry.playerName.toLowerCase();
        const dataValue = entry.data[entrySort];
        return typeof dataValue === "number" ? dataValue : displayEntryValue(dataValue).toLowerCase();
      };
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [entries, entryDir, entryQuery, entrySort]);

  function sortEntries(field: string) {
    if (entrySort === field) {
      setEntryDir((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setEntrySort(field);
    setEntryDir("asc");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PHASE4_LEADERBOARD_TYPES.map((type) => (
          <Link
            key={type}
            href={`/leaderboards?type=${type}`}
            className={selectedType === type ? "rounded-[4px] bg-cn-cyan px-3 py-1.5 text-xs font-semibold text-void" : "rounded-[4px] border border-border-default bg-raised px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"}
          >
            {typeT(type)}
          </Link>
        ))}
      </div>

      {selectedType === "BATTLE_VANGUARD" && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/leaderboards?type=${selectedType}`} className={!selectedSeasonId ? "text-cn-cyan text-sm" : "text-text-secondary text-sm hover:text-text-primary"}>
            {t("allSeasons")}
          </Link>
          {seasons.map((season) => (
            <Link
              key={season.id}
              href={`/leaderboards?type=${selectedType}&season=${season.id}`}
              className={selectedSeasonId === season.id ? "text-cn-cyan text-sm" : "text-text-secondary text-sm hover:text-text-primary"}
            >
              {season.name}{season.active ? ` ${t("activeSeason")}` : ""}
            </Link>
          ))}
        </div>
      )}

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-text-primary">{t("snapshots")}</h2>
          <Input value={snapshotQuery} onChange={(event) => setSnapshotQuery(event.target.value)} placeholder={t("searchSnapshots")} className="sm:w-72" />
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {snapshotRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">{t("noSnapshots")}</p>
          ) : (
            snapshotRows.map((snapshot) => (
              <Link
                key={snapshot.id}
                href={`/leaderboards?type=${selectedType}${selectedSeasonId ? `&season=${selectedSeasonId}` : ""}&snapshot=${snapshot.id}`}
                className="block rounded-md border border-border-dim bg-raised p-3 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-text-primary">{dateLabel(snapshot.capturedAt)}</span>
                  <span className="text-xs text-cn-cyan shrink-0">{t("open")} →</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                  <span>{t("submitter")}: {snapshot.submitter ?? common("unknown")}</span>
                  <span>{snapshot.entryCount} {t("entries")}</span>
                  {snapshot.seasonName && <span>{snapshot.seasonName}</span>}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("capturedAt")}</TableHead>
                <TableHead>{t("submitter")}</TableHead>
                <TableHead>{t("entries")}</TableHead>
                <TableHead>{t("season")}</TableHead>
                <TableHead>{t("action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshotRows.map((snapshot) => (
                <TableRow key={snapshot.id}>
                  <TableCell>{dateLabel(snapshot.capturedAt)}</TableCell>
                  <TableCell>{snapshot.submitter ?? common("unknown")}</TableCell>
                  <TableCell>{snapshot.entryCount}</TableCell>
                  <TableCell>{snapshot.seasonName ?? common("none")}</TableCell>
                  <TableCell>
                    <Link href={`/leaderboards?type=${selectedType}${selectedSeasonId ? `&season=${selectedSeasonId}` : ""}&snapshot=${snapshot.id}`} className="text-cn-cyan hover:underline">
                      {t("open")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {snapshotRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-text-muted">{t("noSnapshots")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-primary">{t("entriesTitle")}</h2>
            {selectedSnapshotId && (
              <p className="mt-0.5 truncate text-[10px] text-text-muted">{selectedSnapshotId}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={entryQuery} onChange={(event) => setEntryQuery(event.target.value)} placeholder={t("searchEntries")} className="sm:w-72" />
            {selectedSnapshotId && <ExportButton baseUrl={`/api/export?type=leaderboard-snapshot&snapshotId=${selectedSnapshotId}`} />}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {entryRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {selectedSnapshotId ? t("noEntries") : t("selectSnapshot")}
            </p>
          ) : (
            entryRows.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm text-text-primary">{entry.playerName}</span>
                  <span className="text-xs text-text-muted shrink-0">#{entry.rank ?? "—"}</span>
                </div>
                {fields.filter((f) => f !== "rank" && f !== "playerName").map((field) => (
                  <div key={field} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{fieldT(field)}</span>
                    <span className="font-medium text-text-primary">{displayEntryValue(entry.data[field])}</span>
                  </div>
                ))}
                {entry.memberName && (
                  <p className="text-xs text-cn-cyan pt-0.5">{entry.memberName}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((field) => (
                  <TableHead key={field}>
                    <button onClick={() => sortEntries(field)} className="flex items-center gap-1">
                      {fieldT(field)}
                      <SortIcon active={entrySort === field} dir={entryDir} />
                    </button>
                  </TableHead>
                ))}
                <TableHead>{t("matchedMember")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entryRows.map((entry) => (
                <TableRow key={entry.id}>
                  {fields.map((field) => (
                    <TableCell key={field}>
                      {field === "rank" ? entry.rank ?? "" : field === "playerName" ? entry.playerName : displayEntryValue(entry.data[field])}
                    </TableCell>
                  ))}
                  <TableCell>{entry.memberName ?? common("none")}</TableCell>
                </TableRow>
              ))}
              {entryRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={fields.length + 1} className="py-8 text-center text-text-muted">
                    {selectedSnapshotId ? t("noEntries") : t("selectSnapshot")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
