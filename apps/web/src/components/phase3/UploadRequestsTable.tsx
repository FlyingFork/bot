"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

function uploadTypeLabel(
  leaderboardType: string | null,
  type: string,
  typeT: ReturnType<typeof useTranslations>,
  uploadT: ReturnType<typeof useTranslations>,
): string {
  if (leaderboardType === "ALLIANCE_PLAYER_LIST") return uploadT("rosterUpdate");
  if (leaderboardType) return typeT(leaderboardType);
  return type;
}
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RequestRow = {
  id: string;
  type: string;
  leaderboardType: string | null;
  createdAt: string;
  submitter: { username: string | null; name: string | null };
  diffData: { summary?: Record<string, number> } | null;
};

function summaryText(summary?: Record<string, number>) {
  if (!summary) return "-";
  return Object.entries(summary)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ") || "-";
}

export function UploadRequestsTable({ requests }: { requests: RequestRow[] }) {
  const t = useTranslations("phase3.adminQueue");
  const typeT = useTranslations("phase2.leaderboardTypes");
  const uploadT = useTranslations("phase3.upload");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  async function bulk(path: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selected, note }),
      });
      const data = (await response.json()) as { results?: { ok: boolean; errorCode?: string }[]; errorCode?: string };
      if (!response.ok) {
        setMessage(t(`errors.${data.errorCode ?? "generic"}`));
        return;
      }
      const blocked = data.results?.filter((result) => !result.ok).length ?? 0;
      setMessage(blocked ? t("bulkPartial", { count: blocked }) : t("bulkDone"));
      setSelected([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (requests.length === 0) {
    return <div className="rounded-md border border-border-dim bg-raised/40 p-4 text-sm text-text-muted">{t("empty")}</div>;
  }

  return (
    <div className="space-y-3">
      {message && <p className="text-sm text-text-secondary">{message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={busy || selected.length === 0} onClick={() => bulk("/api/admin/upload-requests/bulk-approve")}>
          <Check />
          {t("approveSelected")}
        </Button>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("rejectionNote")}
          className="h-8 min-w-64 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary"
        />
        <Button variant="destructive" disabled={busy || selected.length === 0 || !note.trim()} onClick={() => bulk("/api/admin/upload-requests/bulk-reject")}>
          <X />
          {t("rejectSelected")}
        </Button>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>{t("submitter")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("submittedAt")}</TableHead>
              <TableHead>{t("diffSummary")}</TableHead>
              <TableHead>{t("action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <Checkbox checked={selected.includes(request.id)} onCheckedChange={(checked) => toggle(request.id, Boolean(checked))} />
                </TableCell>
                <TableCell>{request.submitter.username ?? request.submitter.name ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{uploadTypeLabel(request.leaderboardType, request.type, typeT, uploadT)}</Badge>
                </TableCell>
                <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                <TableCell className="max-w-96 truncate">{summaryText(request.diffData?.summary)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" render={<Link href={`/admin/upload-requests/${request.id}`} />}>
                    {t("review")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
