"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

export type DuelFormInitial = {
  id?: string;
  startDate: string;
  endDate?: string;
  opponentTag: string;
  opponentName: string;
  status?: string;
  outcome?: string;
  canDelete?: boolean;
};

export function AllianceDuelCreateForm() {
  const t = useTranslations("phase5.allianceDuel");
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [opponentTag, setOpponentTag] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/alliance-duel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startDate, opponentTag, opponentName }),
      });
      const data = (await response.json()) as { instance?: { id: string }; errorCode?: string };
      if (!response.ok) throw new Error(t(`errors.${data.errorCode ?? "generic"}`));
      setMessage(t("created"));
      if (data.instance?.id) router.push(`/events/alliance-duel/${data.instance.id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-border-subtle bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("startDate")}
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("opponentTag")}
          <Input value={opponentTag} onChange={(event) => setOpponentTag(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("opponentName")}
          <Input value={opponentName} onChange={(event) => setOpponentName(event.target.value)} />
        </label>
      </div>
      <Button onClick={submit} disabled={busy || !startDate}>
        <CalendarPlus />
        {t("create")}
      </Button>
      {message && <p className="text-sm text-cn-success">{message}</p>}
      {error && <p className="text-sm text-cn-danger">{error}</p>}
    </section>
  );
}

export function AllianceDuelEditForm({ initial }: { initial: DuelFormInitial }) {
  const t = useTranslations("phase5.allianceDuel");
  const router = useRouter();
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [opponentTag, setOpponentTag] = useState(initial.opponentTag);
  const [opponentName, setOpponentName] = useState(initial.opponentName);
  const [status, setStatus] = useState(initial.status ?? "ACTIVE");
  const [outcome, setOutcome] = useState(initial.outcome ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/alliance-duel/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startDate, endDate, opponentTag, opponentName, status, outcome: outcome || null }),
      });
      const data = (await response.json()) as { errorCode?: string };
      if (!response.ok) throw new Error(t(`errors.${data.errorCode ?? "generic"}`));
      setMessage(t("saved"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteInstance() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/alliance-duel/${initial.id}/delete`, { method: "POST" });
      const data = (await response.json()) as { errorCode?: string };
      if (!response.ok) throw new Error(t(`errors.${data.errorCode ?? "generic"}`));
      router.push("/events/alliance-duel");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-border-subtle bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("startDate")}
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("endDate")}
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("opponentTag")}
          <Input value={opponentTag} onChange={(event) => setOpponentTag(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("opponentName")}
          <Input value={opponentName} onChange={(event) => setOpponentName(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("status")}
          <select className={selectClass()} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">{t("statusValues.ACTIVE")}</option>
            <option value="ENDED">{t("statusValues.ENDED")}</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("outcome")}
          <select className={selectClass()} value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            <option value="">{t("none")}</option>
            <option value="WIN">{t("outcomes.WIN")}</option>
            <option value="LOSS">{t("outcomes.LOSS")}</option>
            <option value="DRAW">{t("outcomes.DRAW")}</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy || !startDate || !endDate}>
          <Save />
          {t("save")}
        </Button>
        <Button variant="destructive" onClick={deleteInstance} disabled={busy || !initial.canDelete}>
          <Trash2 />
          {t("delete")}
        </Button>
      </div>
      {!initial.canDelete && <p className="text-xs text-text-muted">{t("deleteDisabled")}</p>}
      {message && <p className="text-sm text-cn-success">{message}</p>}
      {error && <p className="text-sm text-cn-danger">{error}</p>}
    </section>
  );
}
