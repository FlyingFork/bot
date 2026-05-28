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

function localTimePreview(raidDate: string, utcTime: string) {
  if (!raidDate || !/^\d{2}:\d{2}$/.test(utcTime)) return "";
  const dt = new Date(`${raidDate}T${utcTime}:00.000Z`);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleString();
}

export function ReservoirRaidCreateForm() {
  const t = useTranslations("phase6.reservoirRaid");
  const router = useRouter();
  const [raidDate, setRaidDate] = useState("");
  const [utcTime, setUtcTime] = useState("12:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const localPreview = localTimePreview(raidDate, utcTime);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/raid-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raidDate, utcTime }),
      });
      const data = (await response.json()) as { plan?: { id: string; publicToken: string }; errorCode?: string };
      if (!response.ok) throw new Error(t(`errors.${data.errorCode ?? "generic"}`));
      setCreatedToken(data.plan?.publicToken ?? null);
      if (data.plan?.id) router.push(`/events/reservoir-raid/${data.plan.id}`);
      else router.refresh();
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
          {t("raidDate")}
          <Input type="date" value={raidDate} onChange={(e) => setRaidDate(e.target.value)} />
        </label>
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            {t("utcTime")}
          </label>
          <Input type="time" value={utcTime} onChange={(e) => setUtcTime(e.target.value)} />
          {localPreview && (
            <p className="text-xs text-text-muted">{t("localPreview", { time: localPreview })}</p>
          )}
        </div>
      </div>
      <Button onClick={submit} disabled={busy || !raidDate || !utcTime}>
        <CalendarPlus />
        {t("create")}
      </Button>
      {error && <p className="text-sm text-cn-danger">{error}</p>}
      {createdToken && (
        <p className="text-sm text-text-secondary">
          {t("registrationLink")}:{" "}
          <span className="font-mono text-cn-cyan">/events/reservoir-raid/{createdToken}/register</span>
        </p>
      )}
    </section>
  );
}

export type RaidEditInitial = {
  id: string;
  raidDate: string;
  startsAtDate: string;
  startsAtTime: string;
  status: string;
  registrationOpen: boolean;
  canDelete: boolean;
};

export function ReservoirRaidEditForm({ initial }: { initial: RaidEditInitial }) {
  const t = useTranslations("phase6.reservoirRaid");
  const router = useRouter();
  const [raidDate, setRaidDate] = useState(initial.raidDate);
  const [utcTime, setUtcTime] = useState(initial.startsAtTime);
  const [status, setStatus] = useState(initial.status);
  const [registrationOpen, setRegistrationOpen] = useState(initial.registrationOpen);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localPreview = localTimePreview(raidDate, utcTime);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/raid-plans/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raidDate, utcTime, status, registrationOpen }),
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

  async function deleteRaid() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/raid-plans/${initial.id}/delete`, { method: "POST" });
      const data = (await response.json()) as { errorCode?: string };
      if (!response.ok) throw new Error(t(`errors.${data.errorCode ?? "generic"}`));
      router.push("/events/reservoir-raid");
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
          {t("raidDate")}
          <Input type="date" value={raidDate} onChange={(e) => setRaidDate(e.target.value)} />
        </label>
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">{t("utcTime")}</label>
          <Input type="time" value={utcTime} onChange={(e) => setUtcTime(e.target.value)} />
          {localPreview && (
            <p className="text-xs text-text-muted">{t("localPreview", { time: localPreview })}</p>
          )}
        </div>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("status")}
          <select className={selectClass()} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">{t("statusValues.ACTIVE")}</option>
            <option value="ENDED">{t("statusValues.ENDED")}</option>
          </select>
        </label>
        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="registrationOpen"
            checked={registrationOpen}
            onChange={(e) => setRegistrationOpen(e.target.checked)}
            className="h-4 w-4 rounded border-border-default"
          />
          <label htmlFor="registrationOpen" className="text-xs font-medium text-text-secondary cursor-pointer">
            {t("registrationOpen")}
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy || !raidDate || !utcTime}>
          <Save />
          {t("save")}
        </Button>
        <Button variant="destructive" onClick={deleteRaid} disabled={busy || !initial.canDelete}>
          <Trash2 />
          {t("delete")}
        </Button>
      </div>
      {!initial.canDelete && (
        <p className="text-xs text-text-muted">{t("deleteDisabled")}</p>
      )}
      {message && <p className="text-sm text-cn-success">{message}</p>}
      {error && <p className="text-sm text-cn-danger">{error}</p>}
    </section>
  );
}
