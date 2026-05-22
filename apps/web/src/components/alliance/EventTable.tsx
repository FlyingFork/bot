"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ExportMenu } from "@/components/alliance/ExportMenu";
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

export type EventRow = {
  memberId: string;
  username: string;
  power: string;
  explorationLevel: number | null;
  importedAt: string;
};

export function EventTable({
  eventName,
  rows,
  showExplorationLevel,
}: {
  eventName: string;
  rows: EventRow[];
  showExplorationLevel: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("alliance.table");
  const commonT = useTranslations("common");
  const defaultSort = showExplorationLevel ? "level" : "power";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"power" | "level">(defaultSort);
  const visibleRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return [...rows]
      .filter((row) =>
        normalized ? row.username.toLowerCase().includes(normalized) : true,
      )
      .sort((left, right) => {
        if (sort === "level") {
          const levelDelta =
            (right.explorationLevel ?? -1) - (left.explorationLevel ?? -1);
          if (levelDelta) return levelDelta;
        }

        const a = BigInt(left.power);
        const b = BigInt(right.power);
        return a === b ? left.username.localeCompare(right.username) : a > b ? -1 : 1;
      });
  }, [rows, search, sort]);

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
          {showExplorationLevel && (
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as "power" | "level")}
              className="h-8 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary outline-none focus:border-border-active"
            >
              <option value="level">{t("explorationLevel")}</option>
              <option value="power">{t("power")}</option>
            </select>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setSort(defaultSort);
            }}
          >
            {t("reset")}
          </Button>
        </div>
        <ExportMenu
          fileName={eventName}
          rows={visibleRows}
          columns={[
            { key: "index", label: t("index"), value: (_row, index) => index + 1 },
            { key: "username", label: t("username"), value: (row) => row.username },
            { key: "power", label: t("power"), value: (row) => row.power },
            ...(showExplorationLevel
              ? [
                  {
                    key: "level",
                    label: t("explorationLevel"),
                    value: (row: EventRow) => row.explorationLevel ?? "",
                  },
                ]
              : []),
            { key: "importedAt", label: t("imported"), value: (row) => row.importedAt },
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t("index")}</TableHead>
              <TableHead>{t("username")}</TableHead>
              <TableHead className="text-right">{t("power")}</TableHead>
              {showExplorationLevel && (
                <TableHead className="text-right">{t("explorationLevel")}</TableHead>
              )}
              <TableHead>{t("imported")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row, index) => (
                <TableRow key={row.memberId}>
                  <TableCell className="font-mono text-text-muted">{index + 1}</TableCell>
                  <TableCell className="font-semibold text-text-primary">
                    <Link
                      href={`/dashboard/members/${row.memberId}`}
                      className="hover:text-cn-cyan"
                    >
                      {row.username}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-text-primary">
                    {formatPower(row.power, locale)}
                  </TableCell>
                  {showExplorationLevel && (
                    <TableCell className="text-right">
                      {row.explorationLevel ?? commonT("unknown")}
                    </TableCell>
                  )}
                  <TableCell>
                    {formatImportedAt(row.importedAt, locale, commonT("noData"))}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={showExplorationLevel ? 5 : 4}
                  className="text-center text-text-muted"
                >
                  {t("noEventRows")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
