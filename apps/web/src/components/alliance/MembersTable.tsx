"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ExportMenu } from "@/components/alliance/ExportMenu";
import { RoleBadge } from "@/components/ui/role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatImportedAt, formatPower } from "@/lib/alliance-format";

export type MemberRow = {
  id: string;
  username: string;
  active: boolean;
  currentRank: string | null;
  currentPower: string | null;
  currentPowerPlantLevel: number | null;
  lastRosterImportedAt: string | null;
};

const ranks = ["R5", "R4", "R3", "R2", "R1", "Unknown"] as const;

function numericPower(member: MemberRow) {
  return member.currentPower ? BigInt(member.currentPower) : BigInt(-1);
}

function rankVariant(rank: string | null) {
  if (rank === "R5") return "r5";
  if (rank === "R4") return "r4";
  return "r3";
}

function MemberRows({ members }: { members: MemberRow[] }) {
  const locale = useLocale();
  const t = useTranslations("alliance.table");
  const commonT = useTranslations("common");

  if (!members.length) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="text-center text-text-muted">
          {t("noMembers")}
        </TableCell>
      </TableRow>
    );
  }

  return members.map((member) => (
    <TableRow key={member.id}>
      <TableCell className="font-semibold text-text-primary">
        <Link href={`/dashboard/members/${member.id}`} className="hover:text-cn-cyan">
          {member.username}
        </Link>
      </TableCell>
      <TableCell>
        <RoleBadge
          variant={rankVariant(member.currentRank)}
          label={member.currentRank ?? commonT("unknown")}
        />
      </TableCell>
      <TableCell className="text-right font-mono text-text-primary">
        {formatPower(member.currentPower, locale, commonT("unknown"))}
      </TableCell>
      <TableCell className="text-right">
        {member.currentPowerPlantLevel ?? commonT("unknown")}
      </TableCell>
      <TableCell>
        {formatImportedAt(member.lastRosterImportedAt, locale, commonT("noData"))}
      </TableCell>
    </TableRow>
  ));
}

export function MembersTable({
  members,
  exportName,
}: {
  members: MemberRow[];
  exportName: string;
}) {
  const t = useTranslations("alliance.table");
  const commonT = useTranslations("common");
  const [search, setSearch] = useState("");
  const [rank, setRank] = useState("all");
  const [view, setView] = useState<"power" | "ranks">("power");
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return [...members]
      .filter((member) =>
        normalized ? member.username.toLowerCase().includes(normalized) : true,
      )
      .filter((member) =>
        rank === "all"
          ? true
          : rank === "Unknown"
            ? !member.currentRank
            : member.currentRank === rank,
      )
      .sort((left, right) => {
        const a = numericPower(left);
        const b = numericPower(right);
        return a === b ? left.username.localeCompare(right.username) : a > b ? -1 : 1;
      });
  }, [members, rank, search]);
  const exportRows =
    view === "power"
      ? filtered
      : ranks.flatMap((value) =>
          filtered.filter((member) =>
            value === "Unknown"
              ? !member.currentRank
              : member.currentRank === value,
          ),
        );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="max-w-xs"
          />
          <select
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            className="h-8 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary outline-none focus:border-border-active"
          >
            <option value="all">{t("allRanks")}</option>
            {ranks.map((value) => (
              <option key={value} value={value}>
                {value === "Unknown" ? commonT("unknown") : value}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setRank("all");
              setView("power");
            }}
          >
            {t("reset")}
          </Button>
        </div>
        <ExportMenu
          fileName={exportName}
          rows={exportRows}
          columns={[
            { key: "username", label: t("username"), value: (row) => row.username },
            {
              key: "rank",
              label: t("rank"),
              value: (row) => row.currentRank ?? commonT("unknown"),
            },
            { key: "power", label: t("power"), value: (row) => row.currentPower ?? "" },
            {
              key: "powerPlantLevel",
              label: t("powerPlantLevel"),
              value: (row) => row.currentPowerPlantLevel ?? "",
            },
            {
              key: "rosterUpdated",
              label: t("rosterUpdated"),
              value: (row) => row.lastRosterImportedAt ?? "",
            },
          ]}
        />
      </div>
      <div className="inline-flex rounded-md border border-border-default bg-base p-1">
        <Button
          size="sm"
          variant={view === "power" ? "default" : "ghost"}
          onClick={() => setView("power")}
        >
          {t("powerView")}
        </Button>
        <Button
          size="sm"
          variant={view === "ranks" ? "default" : "ghost"}
          onClick={() => setView("ranks")}
        >
          {t("ranksView")}
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("username")}</TableHead>
              <TableHead>{t("rank")}</TableHead>
              <TableHead className="text-right">{t("power")}</TableHead>
              <TableHead className="text-right">{t("powerPlant")}</TableHead>
              <TableHead>{t("rosterUpdated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view === "power" ? (
              <MemberRows members={filtered} />
            ) : (
              ranks.map((value) => {
                const section = filtered.filter((member) =>
                  value === "Unknown"
                    ? !member.currentRank
                    : member.currentRank === value,
                );

                if (!section.length) {
                  return null;
                }

                return [
                  <TableRow key={`${value}-heading`} className="bg-base hover:bg-base">
                    <TableCell colSpan={5} className="py-2">
                      <div className="flex items-center justify-between border-l-2 border-cn-cyan pl-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary">
                          {value === "Unknown" ? commonT("unknown") : value}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {t("memberCount", { count: section.length })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  <MemberRows key={`${value}-rows`} members={section} />,
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
