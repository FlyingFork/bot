"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEntry } from "./types";
import { formatDate } from "./Phase2Utils";

function JsonBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone: "red" | "green";
}) {
  if (value === null || value === undefined) return null;
  return (
    <div
      className={
        tone === "red" ? "border-cn-danger/30" : "border-cn-success/30"
      }
    >
      <p
        className={
          tone === "red"
            ? "text-cn-danger text-xs font-bold"
            : "text-cn-success text-xs font-bold"
        }
      >
        {label}
      </p>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border-dim bg-void p-3 text-[11px] text-text-secondary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditLogTable({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations("phase2.audit");
  const common = useTranslations("phase2.common");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded-md border border-border-subtle bg-surface">
      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border-line">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{t("empty")}</p>
        ) : (
          entries.map((entry) => {
            const hasDiff = entry.before !== null || entry.after !== null;
            const isExpanded = expanded[entry.id];
            return (
              <div key={entry.id} className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-text-primary">{entry.action}</span>
                  <span className="text-[10px] text-text-muted shrink-0">{formatDate(entry.createdAt)}</span>
                </div>
                <p className="text-xs text-text-muted">
                  {entry.actor.username ?? entry.actor.name}
                  {entry.entityType && <> · {entry.entityType}</>}
                </p>
                {entry.targetId && (
                  <p className="font-mono text-[10px] text-text-muted truncate">{entry.targetId}</p>
                )}
                {hasDiff && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setExpanded((current) => ({ ...current, [entry.id]: !isExpanded }))}
                  >
                    {isExpanded ? <ChevronDown /> : <ChevronRight />}
                    {common("view")}
                  </Button>
                )}
                {isExpanded && (
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <JsonBlock label={t("before")} value={entry.before} tone="red" />
                    <JsonBlock label={t("after")} value={entry.after} tone="green" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("timestamp")}</TableHead>
              <TableHead>{t("actor")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("entity")}</TableHead>
              <TableHead>{t("entityId")}</TableHead>
              <TableHead>{t("diff")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const hasDiff = entry.before !== null || entry.after !== null;
              const isExpanded = expanded[entry.id];
              return (
                <Fragment key={entry.id}>
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>{entry.actor.username ?? entry.actor.name}</TableCell>
                    <TableCell className="font-medium text-text-primary">{entry.action}</TableCell>
                    <TableCell>{entry.entityType ?? common("none")}</TableCell>
                    <TableCell className="font-mono text-[11px]">{entry.targetId}</TableCell>
                    <TableCell>
                      {hasDiff ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setExpanded((current) => ({ ...current, [entry.id]: !isExpanded }))}
                        >
                          {isExpanded ? <ChevronDown /> : <ChevronRight />}
                          {common("view")}
                        </Button>
                      ) : (
                        common("none")
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${entry.id}-diff`}>
                      <TableCell colSpan={6}>
                        <div className="grid gap-3 md:grid-cols-2">
                          <JsonBlock label={t("before")} value={entry.before} tone="red" />
                          <JsonBlock label={t("after")} value={entry.after} tone="green" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-text-muted">{t("empty")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
