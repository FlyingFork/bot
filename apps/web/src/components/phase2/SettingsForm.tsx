"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AllianceSettingsData } from "./types";

const STALE_FIELDS: Array<[keyof AllianceSettingsData, string]> = [
  ["staleThresholdSoloPower", "soloPower"],
  ["staleThresholdBattleVanguard", "battleVanguard"],
  ["staleThresholdHeadquarters", "headquarters"],
  ["staleThresholdHero", "hero"],
  ["staleThresholdHeroPower", "heroPower"],
  ["staleThresholdBehemoth", "behemoth"],
  ["staleThresholdExploration", "exploration"],
  ["staleThresholdCollection", "collection"],
  ["staleThresholdAlliancePlayerList", "alliancePlayerList"],
];

const WEIGHT_FIELDS: Array<[keyof AllianceSettingsData, string]> = [
  ["contributionWeightPowerGrowth", "powerGrowth"],
  ["contributionWeightDuelParticipation", "duel"],
  ["contributionWeightRaidParticipation", "raid"],
];

export function SettingsForm({ settings }: { settings: AllianceSettingsData }) {
  const t = useTranslations("phase2.settings");
  const common = useTranslations("phase2.common");
  const router = useRouter();
  const [form, setForm] = useState<AllianceSettingsData>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weightTotal = WEIGHT_FIELDS.reduce((sum, [field]) => sum + Number(form[field] ?? 0), 0);

  function update(field: keyof AllianceSettingsData, value: string) {
    setForm((current) => ({
      ...current,
      [field]: typeof current[field] === "number" ? Number(value) : value,
    }));
  }

  async function save() {
    setMessage(null);
    setError(null);
    if (weightTotal !== 100) {
      setError(t("weightsError"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(t("saveError"));
      setMessage(t("saved"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">{t("identity")}</h2>
          <p className="text-xs text-text-muted">{t("identityDescription")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-text-secondary">
            {t("name")}
            <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-text-secondary">
            {t("tag")}
            <Input value={form.tag} onChange={(event) => update("tag", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">{t("staleness")}</h2>
          <p className="text-xs text-text-muted">{t("stalenessDescription")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STALE_FIELDS.map(([field, label]) => (
            <label key={field} className="space-y-1.5 text-xs font-medium text-text-secondary">
              {t(`fields.${label}`)}
              <Input
                type="number"
                min={0}
                value={String(form[field])}
                onChange={(event) => update(field, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">{t("weights")}</h2>
            <p className="text-xs text-text-muted">{t("weightsDescription")}</p>
          </div>
          <span className={weightTotal === 100 ? "text-cn-success text-sm" : "text-cn-danger text-sm"}>
            {weightTotal}%
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {WEIGHT_FIELDS.map(([field, label]) => (
            <label key={field} className="space-y-1.5 text-xs font-medium text-text-secondary">
              {t(`fields.${label}`)}
              <Input
                type="number"
                min={0}
                max={100}
                value={String(form[field])}
                onChange={(event) => update(field, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-cn-danger">{error}</p>}
      {message && <p className="text-sm text-cn-success">{message}</p>}

      <Button onClick={save} disabled={saving || weightTotal !== 100}>
        <Save />
        {saving ? common("saving") : t("saveSettings")}
      </Button>
    </div>
  );
}
