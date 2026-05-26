"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type DuelListRow = {
  id: string;
  startDate: string;
  endDate: string;
  opponentTag: string | null;
  opponentName: string | null;
  status: string;
  outcome: string | null;
  daysWithData: number;
  daysWon: number;
};

export type OpponentAggregate = {
  opponentTag: string;
  wins: number;
  losses: number;
  draws: number;
};

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString();
}

export function AllianceDuelList({
  rows,
  aggregates,
  isAdmin,
}: {
  rows: DuelListRow[];
  aggregates: OpponentAggregate[];
  isAdmin: boolean;
}) {
  const t = useTranslations("phase5.allianceDuel");
  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (outcome !== "all" && row.outcome !== outcome) return false;
      if (query && !`${row.opponentName ?? ""} ${row.opponentTag ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (from && row.startDate.slice(0, 10) < from) return false;
      if (to && row.startDate.slice(0, 10) > to) return false;
      return true;
    });
  }, [from, outcome, query, rows, status, to]);

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-md border border-border-subtle bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-text-secondary sm:col-span-1">
              {t("search")}
              <input className={selectClass()} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchOpponent")} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              {t("status")}
              <select className={selectClass()} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">{t("allStatuses")}</option>
                <option value="ACTIVE">{t("statusValues.ACTIVE")}</option>
                <option value="ENDED">{t("statusValues.ENDED")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              {t("outcome")}
              <select className={selectClass()} value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                <option value="all">{t("allOutcomes")}</option>
                <option value="WIN">{t("outcomes.WIN")}</option>
                <option value="LOSS">{t("outcomes.LOSS")}</option>
                <option value="DRAW">{t("outcomes.DRAW")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              {t("from")}
              <input className={selectClass()} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              {t("to")}
              <input className={selectClass()} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
          {isAdmin && (
            <Button className="w-full sm:w-auto" render={<Link href="/events/alliance-duel/new" />}>
              <Plus />
              {t("newInstance")}
            </Button>
          )}
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">{t("empty")}</p>
          ) : (
            filtered.map((row) => (
              <Link key={row.id} href={`/events/alliance-duel/${row.id}`} className="block rounded-md border border-border-dim bg-raised p-3 hover:bg-surface-2 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-text-primary leading-snug">
                    {row.opponentName ?? row.opponentTag ?? t("opponentPending")}
                  </span>
                  <Badge variant={row.status === "ACTIVE" ? "success" : "secondary"} className="shrink-0">
                    {t(`statusValues.${row.status}`)}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted mb-2">
                  {dateLabel(row.startDate)} – {dateLabel(row.endDate)}
                </p>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span>{t("outcome")}: <span className="font-medium text-text-primary">{row.outcome ? t(`outcomes.${row.outcome}`) : t("none")}</span></span>
                  <span className="text-border-dim">|</span>
                  <span>{t("daysWithData")}: <span className="font-medium text-text-primary">{row.daysWithData}/6</span></span>
                  <span className="text-border-dim">|</span>
                  <span>{t("daysWon")}: <span className="font-medium text-text-primary">{row.daysWon}</span></span>
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
                <TableHead>{t("dateRange")}</TableHead>
                <TableHead>{t("opponent")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("outcome")}</TableHead>
                <TableHead>{t("daysWithData")}</TableHead>
                <TableHead>{t("daysWon")}</TableHead>
                <TableHead>{t("action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{dateLabel(row.startDate)} - {dateLabel(row.endDate)}</TableCell>
                  <TableCell className="font-medium text-text-primary">{row.opponentName ?? row.opponentTag ?? t("opponentPending")}</TableCell>
                  <TableCell><Badge variant={row.status === "ACTIVE" ? "success" : "secondary"}>{t(`statusValues.${row.status}`)}</Badge></TableCell>
                  <TableCell>{row.outcome ? t(`outcomes.${row.outcome}`) : t("none")}</TableCell>
                  <TableCell>{row.daysWithData}/6</TableCell>
                  <TableCell>{row.daysWon}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" render={<Link href={`/events/alliance-duel/${row.id}`} />}>{t("open")}</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-text-muted">{t("empty")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-text-primary">{t("matchHistory")}</h2>
        {aggregates.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noMatchHistory")}</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {aggregates.map((item) => (
              <div key={item.opponentTag} className="rounded-md border border-border-dim bg-raised p-3">
                <p className="text-sm font-semibold text-text-primary">{item.opponentTag}</p>
                <p className="text-xs text-text-muted">{item.wins}/{item.losses}/{item.draws} {t("recordSuffix")}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
