"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Clipboard, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiffTable } from "@/components/phase3/DiffTable";
import {
  LEADERBOARD_TYPES,
  LEADERBOARD_TYPES_FOR_DISPLAY,
  buildUploadPrompt,
  schemaKeyForUpload,
  type LeaderboardTypeName,
  type UploadKind,
} from "@/lib/upload-schemas";

type UIKind = UploadKind | "ROSTER_UPDATE";
import type { DiffEntry, ValidationError } from "@/lib/uploads";

type DuelOption = {
  id: string;
  label: string;
  days: { dayNumber: number; label: string }[];
};

type RaidOption = { id: string; label: string };

type Submission = {
  id: string;
  type: string;
  leaderboardType: string | null;
  status: string;
  createdAt: string;
  rejectionNote: string | null;
  payload: string;
};

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

function errorText(t: ReturnType<typeof useTranslations>, error: ValidationError) {
  if (error.code === "json") return t("errors.json");
  if (error.code === "type") return t("errors.type");
  if (error.code === "rowObject") return t("errors.rowObject", { row: error.row ?? 0 });
  if (error.code === "missing") return t("errors.missing", { row: error.row ?? 0, field: error.field ?? "" });
  if (error.code === "string") return t("errors.string", { row: error.row ?? 0, field: error.field ?? "" });
  return t("errors.number", { row: error.row ?? 0, field: error.field ?? "" });
}

export function UploadWorkspace({
  isAdmin,
  allianceTag,
  tempAwayMembers,
  duelOptions,
  raidOptions,
  submissions,
  hasActiveSeason = true,
}: {
  isAdmin: boolean;
  allianceTag: string;
  tempAwayMembers: { tag: string; playerName: string }[];
  duelOptions: DuelOption[];
  raidOptions: RaidOption[];
  submissions: Submission[];
  hasActiveSeason?: boolean;
}) {
  const t = useTranslations("phase3.upload");
  const typeT = useTranslations("phase2.leaderboardTypes");
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialKind = searchParams.get("kind") as UploadKind | null;
  const initialDuelId = searchParams.get("eventInstanceId") ?? "";
  const initialDuelDay = Number(searchParams.get("eventDay") ?? "");
  const [tab, setTab] = useState<"submit" | "mine" | "direct">("submit");
  const [kind, setKind] = useState<UIKind>(
    initialKind === "ALLIANCE_DUEL_DAY" || initialKind === "RESERVOIR_RAID_RESULTS" || initialKind === "RESERVOIR_RAID_SCORES" || initialKind === "LEADERBOARD_SNAPSHOT" || initialKind === "ROSTER_UPDATE"
      ? initialKind
      : "LEADERBOARD_SNAPSHOT",
  );
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardTypeName>("SOLO_POWER");
  const [duelId, setDuelId] = useState(initialDuelId || duelOptions[0]?.id || "");
  const [duelDay, setDuelDay] = useState(initialDuelDay || duelOptions.find((option) => option.id === initialDuelId)?.days[0]?.dayNumber || duelOptions[0]?.days[0]?.dayNumber || 1);
  const [raidId, setRaidId] = useState(raidOptions[0]?.id ?? "");
  const [json, setJson] = useState("");
  const [directJson, setDirectJson] = useState("");
  const [diff, setDiff] = useState<DiffEntry[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  const schemaKey = kind === "ROSTER_UPDATE"
    ? "ALLIANCE_PLAYER_LIST"
    : schemaKeyForUpload(kind, leaderboardType);
  const prompt = buildUploadPrompt({ schemaKey, allianceTag, tempAwayMembers });
  const selectedDuel = duelOptions.find((option) => option.id === duelId);

  const target = useMemo(() => {
    if (kind === "ROSTER_UPDATE") {
      return { kind: "LEADERBOARD_SNAPSHOT" as UploadKind, leaderboardType: "ALLIANCE_PLAYER_LIST" as LeaderboardTypeName, label: t("rosterUpdate") };
    }
    if (kind === "LEADERBOARD_SNAPSHOT") {
      return { kind, leaderboardType, label: typeT(leaderboardType) };
    }
    if (kind === "ALLIANCE_DUEL_DAY") {
      return {
        kind,
        eventInstanceId: duelId,
        eventInstanceType: "ALLIANCE_DUEL",
        eventDay: duelDay,
        label: t("duelDayLabel", { day: duelDay }),
      };
    }
    if (kind === "RESERVOIR_RAID_SCORES") {
      return { kind, label: t("raidScores") };
    }
    return {
      kind,
      eventInstanceId: raidId,
      eventInstanceType: "RESERVOIR_RAID",
      label: t("raidResults"),
    };
  }, [duelDay, duelId, kind, leaderboardType, raidId, t, typeT]);

  async function checkLock() {
    const params = new URLSearchParams();
    params.set("kind", target.kind);
    if ("leaderboardType" in target && target.leaderboardType) params.set("leaderboardType", target.leaderboardType);
    if ("eventInstanceId" in target && target.eventInstanceId) params.set("eventInstanceId", target.eventInstanceId);
    if ("eventInstanceType" in target && target.eventInstanceType) params.set("eventInstanceType", target.eventInstanceType);
    if ("eventDay" in target && target.eventDay) params.set("eventDay", String(target.eventDay));
    const response = await fetch(`/api/upload/lock?${params.toString()}`);
    const data = (await response.json()) as { locked?: boolean };
    setLocked(Boolean(data.locked));
    return Boolean(data.locked);
  }

  async function validate() {
    setBusy(true);
    setMessage(null);
    setErrors([]);
    setDiff([]);
    try {
      const response = await fetch("/api/upload/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...target, json }),
      });
      const data = (await response.json()) as { errors?: ValidationError[]; diff?: DiffEntry[] };
      if (!response.ok) {
        setErrors(data.errors ?? [{ code: "json" }]);
        return false;
      }
      setDiff(data.diff ?? []);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      if (await checkLock()) {
        setMessage(t("locked"));
        return;
      }
      const response = await fetch("/api/upload/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...target, json }),
      });
      const data = (await response.json()) as { errors?: ValidationError[]; errorCode?: string };
      if (!response.ok) {
        if (data.errors) setErrors(data.errors);
        else setMessage(t(`serverErrors.${data.errorCode ?? "generic"}`));
        return;
      }
      setMessage(data && "applied" in data ? t("directApplied") : t("submitted"));
      setJson("");
      setDiff([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function directEntry() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/upload/direct-entry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leaderboardType, json: directJson }),
      });
      const data = (await response.json()) as { errors?: ValidationError[]; errorCode?: string };
      if (!response.ok) {
        setErrors(data.errors ?? [{ code: "json" }]);
        if (data.errorCode) setMessage(t(`serverErrors.${data.errorCode}`));
        return;
      }
      setMessage(t("directApplied"));
      setDirectJson("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "submit" ? "default" : "tab"} onClick={() => setTab("submit")}>{t("tabs.submit")}</Button>
        <Button variant={tab === "mine" ? "default" : "tab"} onClick={() => setTab("mine")}>{t("tabs.mine")}</Button>
        {isAdmin && <Button variant={tab === "direct" ? "default" : "tab"} onClick={() => setTab("direct")}>{t("tabs.direct")}</Button>}
      </div>

      {message && <p className="rounded-md border border-border-subtle bg-raised p-3 text-sm text-text-secondary">{message}</p>}
      {errors.length > 0 && (
        <div className="rounded-md border border-cn-danger/30 bg-cn-danger/5 p-3 text-sm text-cn-danger">
          {errors.map((error, index) => <p key={`${error.code}-${index}`}>{errorText(t, error)}</p>)}
        </div>
      )}

      {tab === "submit" && (
        <section className="space-y-4 rounded-md border border-border-subtle bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t("type")}
              <select className={selectClass()} value={kind} onChange={(event) => setKind(event.target.value as UIKind)}>
                <option value="LEADERBOARD_SNAPSHOT">{t("leaderboardSnapshot")}</option>
                <option value="ROSTER_UPDATE">{t("rosterUpdate")}</option>
                <option value="ALLIANCE_DUEL_DAY">{t("allianceDuelDay")}</option>
                <option value="RESERVOIR_RAID_RESULTS">{t("raidResults")}</option>
                <option value="RESERVOIR_RAID_SCORES">{t("raidScores")}</option>
              </select>
            </label>

            {kind === "LEADERBOARD_SNAPSHOT" && (
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t("leaderboardType")}
                <select className={selectClass()} value={leaderboardType} onChange={(event) => setLeaderboardType(event.target.value as LeaderboardTypeName)}>
                  {LEADERBOARD_TYPES_FOR_DISPLAY.map((type) => <option key={type} value={type}>{typeT(type)}</option>)}
                </select>
              </label>
            )}

            {kind === "ALLIANCE_DUEL_DAY" && (
              <>
                <label className="flex flex-col gap-1 text-xs text-text-muted">
                  {t("duelInstance")}
                  <select className={selectClass()} value={duelId} onChange={(event) => setDuelId(event.target.value)}>
                    {duelOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-muted">
                  {t("duelDay")}
                  <select className={selectClass()} value={duelDay} onChange={(event) => setDuelDay(Number(event.target.value))}>
                    {(selectedDuel?.days ?? []).map((day) => <option key={day.dayNumber} value={day.dayNumber}>{day.label}</option>)}
                  </select>
                </label>
              </>
            )}

            {kind === "RESERVOIR_RAID_RESULTS" && (
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t("raidPlan")}
                <select className={selectClass()} value={raidId} onChange={(event) => setRaidId(event.target.value)}>
                  {raidOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
          </div>

          {kind === "LEADERBOARD_SNAPSHOT" && leaderboardType === "BATTLE_VANGUARD" && !hasActiveSeason && (
            <p className="rounded-md border border-cn-warning/30 bg-cn-warning/5 p-3 text-sm text-cn-warning">
              {t("noActiveSeasonWarning")}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">{t("prompt")}</h2>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(prompt)}>
                <Clipboard />
                {t("copy")}
              </Button>
            </div>
            <textarea readOnly value={prompt} className="min-h-32 w-full rounded-md border border-border-default bg-raised p-3 font-mono text-xs text-text-secondary" />
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-text-primary">
            {t("jsonInput")}
            <textarea value={json} onChange={(event) => setJson(event.target.value)} className="min-h-48 w-full rounded-md border border-border-default bg-raised p-3 font-mono text-xs text-text-primary" />
          </label>

          {locked && <p className="text-sm text-cn-warning">{t("locked")}</p>}

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={checkLock} disabled={busy}>{t("checkLock")}</Button>
            <Button variant="secondary" onClick={validate} disabled={busy || !json.trim()}>{t("preview")}</Button>
            <Button onClick={submit} disabled={busy || !json.trim() || locked}>
              <Send />
              {t("submit")}
            </Button>
          </div>

          <DiffTable diff={diff} />
        </section>
      )}

      {tab === "mine" && (
        <section className="w-full min-w-0 max-w-full space-y-3 overflow-hidden rounded-md border border-border-subtle bg-surface p-3 sm:p-4">
          {submissions.length === 0 ? (
            <p className="text-sm text-text-muted">{t("noSubmissions")}</p>
          ) : submissions.map((item) => (
            <div key={item.id} className="w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border-dim bg-raised p-3">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <p className="min-w-0 overflow-hidden break-all font-medium text-text-primary">{item.leaderboardType ? typeT(item.leaderboardType) : item.type}</p>
                <Badge variant={item.status === "REJECTED" ? "destructive" : item.status === "APPROVED" ? "success" : "secondary"} className="max-w-28 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.status}</Badge>
              </div>
              <p className="min-w-0 break-words text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
              {item.rejectionNote && <p className="mt-2 min-w-0 break-all text-sm text-cn-danger">{item.rejectionNote}</p>}
              {item.status === "REJECTED" && (
                <pre className="block w-full min-w-0 max-w-full overflow-auto whitespace-pre-wrap break-all rounded bg-base p-2 text-xs text-text-secondary [overflow-wrap:anywhere]">
                  {item.payload}
                </pre>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "direct" && isAdmin && (
        <section className="space-y-4 rounded-md border border-border-subtle bg-surface p-4">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t("leaderboardType")}
            <select className={selectClass()} value={leaderboardType} onChange={(event) => setLeaderboardType(event.target.value as LeaderboardTypeName)}>
              {LEADERBOARD_TYPES.map((type) => <option key={type} value={type}>{typeT(type)}</option>)}
            </select>
          </label>
          <textarea value={directJson} onChange={(event) => setDirectJson(event.target.value)} className="min-h-48 w-full rounded-md border border-border-default bg-raised p-3 font-mono text-xs text-text-primary" />
          <Button onClick={directEntry} disabled={busy || !directJson.trim()}>
            <Check />
            {t("applyDirect")}
          </Button>
        </section>
      )}
    </div>
  );
}
