"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeDisplay } from "@/components/TimeDisplay";

function selectClass() {
  return "h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

// Returns a translation key describing what's wrong, or null if valid.
function validateSquadPower(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Comma used as decimal separator: "28,88M", "28,88K", "28,88"
  if (/^\d+,\d+\s*[kKmM]?$/.test(trimmed)) {
    return "powerComma";
  }

  // Missing unit: pure number like "875" or "28.88"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return "powerMissingUnit";
  }

  // Has a number-like part followed by a single letter unit
  const unitMatch = trimmed.match(/^[\d.]+\s*([a-zA-Z])$/);
  if (unitMatch) {
    const unit = unitMatch[1];
    if (unit === "m" || unit === "k") {
      return "powerLowercaseUnit";
    }
  }

  // Valid: integer or decimal, optional whitespace, uppercase K or M
  if (/^\d+(\.\d+)?\s*[KM]$/.test(trimmed)) {
    return null;
  }

  return "powerInvalid";
}

function parseSquadPower(raw: string): number | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (s.endsWith("M")) {
    const n = parseFloat(s.slice(0, -1).trimEnd());
    return isNaN(n) || n <= 0 ? null : Math.round(n * 1_000_000);
  }
  if (s.endsWith("K")) {
    const n = parseFloat(s.slice(0, -1).trimEnd());
    return isNaN(n) || n <= 0 ? null : Math.round(n * 1_000);
  }
  return null;
}

export type PublicRaidInfo = {
  publicToken: string;
  raidDate: string;
  startsAt: string;
  registrationOpen: boolean;
};

export function PublicRegistrationForm({ plan }: { plan: PublicRaidInfo }) {
  const t = useTranslations("phase6.registration");
  const [ingameName, setIngameName] = useState("");
  const [squadPowers, setSquadPowers] = useState<string[]>(["", "", "", "", ""]);
  const [squadPowerErrors, setSquadPowerErrors] = useState<(string | null)[]>([
    null, null, null, null, null,
  ]);
  const [contactType, setContactType] = useState("");
  const [contact, setContact] = useState("");
  const [attendance, setAttendance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("raid-reg-notice") === "1";
  });

  function dismissNotice() {
    sessionStorage.setItem("raid-reg-notice", "1");
    setNoticeDismissed(true);
  }

  const shownSquads = squadPowers.filter(
    (_, i) => i === 0 || squadPowers[i - 1] !== "" || squadPowers[i] !== "",
  ).length;
  const visibleCount = Math.max(
    1,
    Math.min(5, shownSquads + (squadPowers[shownSquads - 1] !== "" ? 1 : 0)),
  );

  function updateSquad(index: number, value: string) {
    const next = [...squadPowers];
    next[index] = value;
    setSquadPowers(next);

    // Re-validate live once an error is already showing
    if (squadPowerErrors[index] !== null) {
      const nextErrors = [...squadPowerErrors];
      nextErrors[index] = value.trim() ? validateSquadPower(value) : null;
      setSquadPowerErrors(nextErrors);
    }
  }

  function handleSquadBlur(index: number, value: string) {
    if (!value.trim()) return;
    const err = validateSquadPower(value);
    if (err) {
      const next = [...squadPowerErrors];
      next[index] = err;
      setSquadPowerErrors(next);
    }
  }

  async function submit() {
    setError(null);

    if (!ingameName.trim()) {
      setError(t("errors.ingameNameRequired"));
      return;
    }
    if (ingameName.trim().length > 80) {
      setError(t("errors.ingameNameLength"));
      return;
    }

    if (!squadPowers[0].trim()) {
      setError(t("errors.squad1Required"));
      return;
    }

    // Validate all visible squad power fields
    const newErrors = [...squadPowerErrors];
    let hasPowerErrors = false;
    for (let i = 0; i < visibleCount; i++) {
      if (!squadPowers[i].trim()) continue;
      const err = validateSquadPower(squadPowers[i]);
      if (err) {
        newErrors[i] = err;
        hasPowerErrors = true;
      }
    }
    if (hasPowerErrors) {
      setSquadPowerErrors(newErrors);
      return;
    }

    if (contactType && !contact.trim()) {
      setError(t("errors.contactRequired"));
      return;
    }
    if (!attendance) {
      setError(t("errors.attendanceRequired"));
      return;
    }

    const powers = squadPowers
      .map((p, i) => ({ squadIndex: i + 1, power: p ? parseSquadPower(p) : null }))
      .filter((item): item is { squadIndex: number; power: number } => item.power !== null && item.power > 0);

    setBusy(true);
    try {
      const response = await fetch(`/api/raid-plans/${plan.publicToken}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ingameName: ingameName.trim(),
          squadPowers: powers,
          contactType: contactType || null,
          contact: contact.trim() || null,
        }),
      });
      const data = (await response.json()) as { errorCode?: string };
      if (!response.ok) {
        const key = `errors.${data.errorCode ?? "generic"}`;
        throw new Error(t(key as Parameters<typeof t>[0]));
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (!plan.registrationOpen) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface p-6 text-center">
        <p className="text-sm font-medium text-text-secondary">{t("closed")}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-md border border-cn-success/40 bg-cn-success/10 p-6 text-center">
        <p className="text-sm font-medium text-cn-success">{t("success")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!noticeDismissed && (
        <div className="rounded-md border border-cn-brand/30 bg-cn-brand/8 p-4 space-y-3">
          <p className="text-xs font-semibold text-text-primary">{t("notice.title")}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{t("notice.body")}</p>
          <button
            type="button"
            onClick={dismissNotice}
            className="text-xs font-semibold text-cn-brand hover:underline"
          >
            {t("notice.dismiss")}
          </button>
        </div>
      )}
      <div className="space-y-6 rounded-md border border-border-subtle bg-surface p-4">
        <div className="text-xs text-text-muted space-y-0.5">
          <p>{t("raidDate", { date: new Date(plan.raidDate).toLocaleDateString() })}</p>
          <p className="flex items-center gap-1">
            {t("startsAt")} <TimeDisplay date={new Date(plan.startsAt)} />
          </p>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1 text-xs font-medium text-text-secondary">
            {t("ingameName")} *
            <Input
              value={ingameName}
              onChange={(e) => setIngameName(e.target.value)}
              maxLength={80}
            />
          </label>

          {Array.from({ length: visibleCount > 5 ? 5 : visibleCount }).map((_, i) => (
            <div key={i} className="space-y-1">
              <label className="block text-xs font-medium text-text-secondary">
                {i === 0 ? `${t("squad1Power")} *` : t("squadNPower", { squad: i + 1 })}
              </label>
              <Input
                type="text"
                inputMode="text"
                placeholder={i === 0 ? "e.g. 28.88M" : "e.g. 875K"}
                value={squadPowers[i]}
                onChange={(e) => updateSquad(i, e.target.value)}
                onBlur={(e) => handleSquadBlur(i, e.target.value)}
              />
              {squadPowerErrors[i] && (
                <p className="text-[11px] text-cn-danger leading-tight">
                  {t(`errors.${squadPowerErrors[i]}` as Parameters<typeof t>[0])}
                </p>
              )}
            </div>
          ))}

          <p className="text-[11px] text-text-muted leading-relaxed">{t("powerHint")}</p>

          {visibleCount < 5 && (
            <Button variant="ghost" size="sm" onClick={() => updateSquad(visibleCount, "")}>
              <Plus />
              {t("addSquad", { squad: visibleCount + 1 })}
            </Button>
          )}

          <label className="block space-y-1 text-xs font-medium text-text-secondary">
            {t("contactPlatform")}
            <select
              className={selectClass()}
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
            >
              <option value="">{t("noContact")}</option>
              <option value="DISCORD">Discord</option>
              <option value="TELEGRAM">Telegram</option>
            </select>
          </label>

          {contactType && (
            <label className="block space-y-1 text-xs font-medium text-text-secondary">
              {t("contactUsername")}
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
          )}

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="attendance"
              checked={attendance}
              onChange={(e) => setAttendance(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-default"
            />
            <label htmlFor="attendance" className="text-xs text-text-secondary cursor-pointer">
              {t("attendanceCheck")}
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-cn-danger">{error}</p>}

        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? t("submitting") : t("submit")}
        </Button>
      </div>
    </div>
  );
}
