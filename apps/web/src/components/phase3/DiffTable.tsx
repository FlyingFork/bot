"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DiffEntry } from "@/lib/uploads";

function valueText(value: unknown) {
  if (value === undefined || value === null) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DiffTable({ diff }: { diff: DiffEntry[] }) {
  const t = useTranslations("phase3.diff");

  if (diff.length === 0) {
    return <p className="text-sm text-text-muted">{t("empty")}</p>;
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("member")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("field")}</TableHead>
            <TableHead>{t("oldValue")}</TableHead>
            <TableHead>{t("newValue")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diff.map((item, index) => (
            <TableRow
              key={`${item.playerName}-${item.status}-${item.field ?? "row"}-${index}`}
              className={
                item.status === "new"
                  ? "bg-cn-success/5"
                  : item.status === "removed"
                    ? "bg-cn-danger/5"
                    : item.status === "unmatched"
                      ? "bg-cn-warning/5"
                      : undefined
              }
            >
              <TableCell className="font-medium text-text-primary">{item.playerName}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    item.status === "new"
                      ? "success"
                      : item.status === "removed"
                        ? "destructive"
                        : item.status === "unmatched"
                          ? "warning"
                          : "secondary"
                  }
                >
                  {t(`statusValues.${item.status}`)}
                </Badge>
              </TableCell>
              <TableCell>{item.field ?? "-"}</TableCell>
              <TableCell className="max-w-72 truncate">{valueText(item.oldValue)}</TableCell>
              <TableCell className="max-w-72 truncate">{valueText(item.newValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
