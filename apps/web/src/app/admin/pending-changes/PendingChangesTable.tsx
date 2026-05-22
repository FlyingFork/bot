"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { approvePendingChange, rejectPendingChange } from "./actions";

type PendingChangeRow = {
  id: string;
  type: string;
  submitterUsername: string | null;
  createdAt: string;
};

export function PendingChangesTable({
  initialChanges,
}: {
  initialChanges: PendingChangeRow[];
}) {
  const t = useTranslations("admin.pendingChanges");
  const [changes, setChanges] = useState(initialChanges);
  const [, startTransition] = useTransition();

  function handleApprove(id: string) {
    setChanges((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      const result = await approvePendingChange(id);
      if (!result.success) {
        setChanges(initialChanges);
        toast.error(t("approveError"));
      } else {
        toast.success(t("approveSuccess"));
      }
    });
  }

  function handleReject(id: string) {
    setChanges((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      const result = await rejectPendingChange(id);
      if (!result.success) {
        setChanges(initialChanges);
        toast.error(t("rejectError"));
      } else {
        toast.info(t("rejectSuccess"));
      }
    });
  }

  if (changes.length === 0) {
    return <p className="text-text-muted text-xs">{t("noResults")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("submittedBy")}</TableHead>
            <TableHead>{t("submittedAt")}</TableHead>
            <TableHead className="w-36" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((change) => (
            <TableRow key={change.id}>
              <TableCell className="font-mono text-text-primary">
                {t(`types.${change.type}`)}
              </TableCell>
              <TableCell className="text-text-secondary">
                {change.submitterUsername ?? "—"}
              </TableCell>
              <TableCell className="text-text-muted">
                {new Date(change.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(change.id)}>
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(change.id)}
                  >
                    {t("reject")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
