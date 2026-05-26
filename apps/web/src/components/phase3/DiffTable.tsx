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

function badgeVariant(status: DiffEntry["status"]) {
  if (status === "new" || status === "resolved") return "success";
  if (status === "removed") return "destructive";
  if (status === "unmatched" || status === "duplicate") return "warning";
  return "secondary";
}

function rowClass(status: DiffEntry["status"]) {
  if (status === "new" || status === "resolved") return "bg-cn-success/5";
  if (status === "removed") return "bg-cn-danger/5";
  if (status === "unmatched" || status === "duplicate") return "bg-cn-warning/5";
  return undefined;
}

export function DiffTable({ diff }: { diff: DiffEntry[] }) {
  const t = useTranslations("phase3.diff");

  if (diff.length === 0) {
    return <p className="text-sm text-text-muted">{t("empty")}</p>;
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface overflow-hidden">
      <div className="grid gap-2 p-2 md:hidden">
        {diff.map((item, index) => (
          <article
            key={`${item.playerName}-${item.status}-${item.field ?? "row"}-${index}-mobile`}
            className={`min-w-0 rounded-md border border-border-dim bg-raised p-3 ${rowClass(item.status) ?? ""}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-semibold text-text-primary">{item.playerName}</p>
              <Badge variant={badgeVariant(item.status)} className="shrink-0">
                {t(`statusValues.${item.status}`)}
              </Badge>
            </div>
            <dl className="mt-2 grid gap-2 text-xs">
              <div>
                <dt className="text-text-muted">{t("field")}</dt>
                <dd className="break-words text-text-secondary">{item.field ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t("oldValue")}</dt>
                <dd className="max-h-28 overflow-auto break-words rounded bg-base p-2 text-text-secondary">{valueText(item.oldValue)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t("newValue")}</dt>
                <dd className="max-h-28 overflow-auto break-words rounded bg-base p-2 text-text-secondary">{valueText(item.newValue)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
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
              className={rowClass(item.status)}
            >
              <TableCell className="font-medium text-text-primary">{item.playerName}</TableCell>
              <TableCell>
                <Badge variant={badgeVariant(item.status)}>
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
    </div>
  );
}
