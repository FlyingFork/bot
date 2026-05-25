"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeDisplay } from "@/components/TimeDisplay";

export type RaidListRow = {
  id: string;
  raidDate: string;
  startsAt: string;
  status: string;
  registrationOpen: boolean;
  participantCount: number;
};

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

export function ReservoirRaidList({
  rows,
  isAdmin,
}: {
  rows: RaidListRow[];
  isAdmin: boolean;
}) {
  const t = useTranslations("phase6.reservoirRaid");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      return true;
    });
  }, [rows, status]);

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("status")}
          <select className={selectClass()} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t("allStatuses")}</option>
            <option value="ACTIVE">{t("statusValues.ACTIVE")}</option>
            <option value="ENDED">{t("statusValues.ENDED")}</option>
          </select>
        </label>
        {isAdmin && (
          <Button className="w-full sm:w-auto" nativeButton={false} render={<Link href="/events/reservoir-raid/new" />}>
            <Plus />
            {t("newInstance")}
          </Button>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{t("empty")}</p>
        ) : (
          filtered.map((row) => (
            <Link
              key={row.id}
              href={`/events/reservoir-raid/${row.id}`}
              className="block rounded-md border border-border-dim bg-raised p-3 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-sm text-text-primary">
                  {new Date(row.raidDate).toLocaleDateString()}
                </span>
                <Badge variant={row.status === "ACTIVE" ? "success" : "secondary"} className="shrink-0">
                  {t(`statusValues.${row.status}`)}
                </Badge>
              </div>
              <p className="text-xs text-text-muted mb-2">
                <TimeDisplay date={new Date(row.startsAt)} /> · {row.participantCount} {t("participantsLabel")}
              </p>
              <Badge variant={row.registrationOpen ? "success" : "outline"}>
                {row.registrationOpen ? t("registrationOpen") : t("registrationClosed")}
              </Badge>
            </Link>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("raidDate")}</TableHead>
              <TableHead>{t("startsAt")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("registrationLabel")}</TableHead>
              <TableHead>{t("participantsLabel")}</TableHead>
              <TableHead>{t("action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-text-primary">
                  {new Date(row.raidDate).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs text-text-muted">
                  <TimeDisplay date={new Date(row.startsAt)} />
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "ACTIVE" ? "success" : "secondary"}>
                    {t(`statusValues.${row.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.registrationOpen ? "success" : "outline"}>
                    {row.registrationOpen ? t("registrationOpen") : t("registrationClosed")}
                  </Badge>
                </TableCell>
                <TableCell>{row.participantCount}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/events/reservoir-raid/${row.id}`} />}>
                    {t("open")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
