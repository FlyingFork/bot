"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Edit, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MemberSummary } from "./types";
import { RANKS, toDateInput } from "./Phase2Utils";

type MemberForm = {
  username: string;
  currentRank: string;
  joinedAt: string;
  isTempAway: boolean;
  tempAwayAllianceTag: string;
};

export function MemberProfileActions({
  member,
  canTempAway,
  canEdit,
}: {
  member: MemberSummary;
  canTempAway: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("phase2.members");
  const common = useTranslations("phase2.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>({
    username: member.username,
    currentRank: member.currentRank ?? "R1",
    joinedAt: toDateInput(member.joinedAt),
    isTempAway: member.isTempAway,
    tempAwayAllianceTag: member.tempAwayAllianceTag ?? "",
  });

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: url.includes("/toggle-temp-away") ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(common("actionFailed"));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : common("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleTempAway() {
    if (member.isTempAway) {
      await post(`/api/admin/members/${member.id}/toggle-temp-away`, { enabled: false });
      return;
    }
    const tag = window.prompt(t("tempAwayPrompt"));
    if (tag === null) return;
    await post(`/api/admin/members/${member.id}/toggle-temp-away`, {
      enabled: true,
      tempAwayAllianceTag: tag,
    });
  }

  if (!canTempAway && !canEdit) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canTempAway && (
        <Button variant="ghost" onClick={toggleTempAway} disabled={busy}>
          <RotateCcw />
          {member.isTempAway ? t("endTempAway") : t("setTempAway")}
        </Button>
      )}
      {canEdit && (
        <Button onClick={() => setOpen(true)}>
          <Edit />
          {t("editTitle")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("updateProfileDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-2">
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("ingameName")}
              <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("rank")}
              <select value={form.currentRank} onChange={(event) => setForm({ ...form, currentRank: event.target.value })} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
                {RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("joinedAt")}
              <Input type="date" value={form.joinedAt} onChange={(event) => setForm({ ...form, joinedAt: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <input
                type="checkbox"
                checked={form.isTempAway}
                onChange={(event) => setForm({ ...form, isTempAway: event.target.checked })}
              />
              {t("tempAway")}
            </label>
            {form.isTempAway && (
              <label className="space-y-1 text-xs font-medium text-text-secondary">
                {t("tempAwayPrompt")}
                <Input value={form.tempAwayAllianceTag} onChange={(event) => setForm({ ...form, tempAwayAllianceTag: event.target.value })} />
              </label>
            )}
            {error && <p className="text-xs text-cn-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{common("cancel")}</Button>
            <Button onClick={() => post(`/api/admin/members/${member.id}`, form)} disabled={busy}>
              {busy ? common("saving") : common("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
