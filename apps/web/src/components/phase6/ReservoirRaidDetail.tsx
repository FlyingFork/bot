"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Clock, Copy, Droplet, Droplets, Edit, FileUp, Info, Pencil, Plus, Search, Trash2, Trophy, Upload, UserCheck, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { RAID_REGISTRATION_PROMPT } from "@/lib/upload-prompts";
import { TimeDisplay } from "@/components/TimeDisplay";
import { ExportButton } from "@/components/phase4/ExportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PARTICIPANT_LIMIT, RESERVIST_LIMIT } from "@/lib/phase6-constants";
import { ObjectivesTab as ObjectivesTabImpl } from "@/components/phase6/objectives/ObjectivesTab";
import { MemberObjectivesMap } from "@/components/phase6/objectives/MemberObjectivesMap";
import { getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SquadPower = { squadIndex: number; power: number };

export type RaidParticipantRow = {
  id: string;
  username: string;
  memberId: string | null;
  memberName: string | null;
  contactType: string | null;
  contact: string | null;
  registrationStatus: string;
  waterCollected: number | null;
  squad1Power: number;
  totalSquadPower: number;
  squadPowers: SquadPower[];
  raidReliability: { score: number; participated: number; total: number } | null;
  lastWaterCollected: number | null;
  totalWaterCollected: number | null;
  reservoirRaidScore: number | null;
  reservoirRaidScoreUpdatedAt: string | null;
  compositeScore: number;
  compositeScoreTier: "high" | "mid" | "low" | "none";
  isScoreStale: boolean;
};

export type RaidObjectiveRow = {
  id: string;
  key: string;
  tier: number;
  waterRate: number;
  isAssignable: boolean;
  mapX: number;
  mapY: number;
  assignments: Array<{
    participantId: string;
    playerName: string;
    squad1Power: number;
    totalSquadPower: number;
    registrationStatus: string;
    contactType: string | null;
    contact: string | null;
  }>;
};

export type MemberOption = {
  id: string;
  username: string;
};

export type RaidDetailData = {
  id: string;
  publicToken: string;
  raidDate: string;
  startsAt: string;
  status: string;
  registrationOpen: boolean;
  participants: RaidParticipantRow[];
  objectives: RaidObjectiveRow[];
  pendingResults: boolean;
  showUnmatchedWarning: boolean;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPower(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function formatWater(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function contactLabel(type: string | null, handle: string | null) {
  if (!type || !handle) return null;
  return `${type}: ${handle}`;
}

function selectClass() {
  return "h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
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

function powerToInput(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${value}K`;
}

function statusBadgeVariant(status: string) {
  if (status === "SELECTED_PARTICIPANT") return "success" as const;
  if (status === "SELECTED_RESERVIST") return "warning" as const;
  return "secondary" as const;
}

function tierColorClass(tier: "high" | "mid" | "low" | "none") {
  if (tier === "high") return "text-emerald-400";
  if (tier === "mid") return "text-amber-400";
  if (tier === "low") return "text-red-400";
  return "text-text-muted";
}

function formatScore(value: number | null) {
  if (value === null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// ─────────────────────────────────────────────
// Input style helpers
// ─────────────────────────────────────────────

const inputCls = "h-8 w-full min-w-0 rounded-md border border-border-line bg-surface-2 px-3 py-1 text-sm text-text font-sans placeholder:text-dim transition-colors outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold-bg disabled:opacity-40";
const textareaCls = "w-full min-w-0 rounded-md border border-border-line bg-surface-2 px-3 py-2 text-sm text-text font-sans placeholder:text-dim transition-colors outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold-bg disabled:opacity-40 resize-none";
const nativeSelectCls = "h-8 w-full rounded-md border border-border-line bg-surface-2 px-2 text-sm text-text font-sans transition-colors outline-none focus-visible:border-gold disabled:opacity-40";

// ─────────────────────────────────────────────
// AddPlayerModal
// ─────────────────────────────────────────────

function AddPlayerModal({ planId, open, onClose }: { planId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations("phase6");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [squads, setSquads] = useState<string[]>(["", "", "", "", ""]);
  const [squadErrors, setSquadErrors] = useState<boolean[]>([false, false, false, false, false]);
  const [visibleCount, setVisibleCount] = useState(1);
  const [contactType, setContactType] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setUsername("");
    setSquads(["", "", "", "", ""]);
    setSquadErrors([false, false, false, false, false]);
    setVisibleCount(1);
    setContactType("");
    setContact("");
  }

  function updateSquad(index: number, value: string) {
    setSquads((prev) => { const next = [...prev]; next[index] = value; return next; });
    if (squadErrors[index]) setSquadErrors((prev) => { const next = [...prev]; next[index] = false; return next; });
  }

  function handleSquadBlur(index: number, value: string) {
    if (!value.trim()) return;
    if (parseSquadPower(value) === null) {
      setSquadErrors((prev) => { const next = [...prev]; next[index] = true; return next; });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;

    const errors = [false, false, false, false, false];
    const squadPowers: { squadIndex: number; power: number }[] = [];
    let hasError = false;
    for (let i = 0; i < 5; i++) {
      if (!squads[i].trim()) continue;
      const parsed = parseSquadPower(squads[i]);
      if (parsed === null) { errors[i] = true; hasError = true; }
      else squadPowers.push({ squadIndex: i + 1, power: parsed });
    }
    if (hasError) { setSquadErrors(errors); return; }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/raid-plans/${planId}/registrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          squadPowers: squadPowers.length > 0 ? squadPowers : undefined,
          contactType: contactType || null,
          contact: contact.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { errorCode?: string };
        toast.error(
          data.errorCode === "alreadyExists"
            ? "A player with this name is already registered."
            : "Failed to add player. Please try again.",
        );
        return;
      }
      toast.success(t("reservoirRaid.registrations.playerAdded"));
      reset();
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservoirRaid.registrations.addPlayerTitle")}</DialogTitle>
          <DialogDescription>{t("reservoirRaid.registrations.addPlayerDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-4 space-y-3 pb-2">
            <label className="block space-y-1 text-xs font-medium text-text-secondary">
              {t("reservoirRaid.registrations.ingameName")} *
              <Input maxLength={80} required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="PlayerName" />
            </label>

            {Array.from({ length: visibleCount }).map((_, i) => (
              <div key={i} className="space-y-1">
                <label className="block text-xs font-medium text-text-secondary">
                  {t("reservoirRaid.registrations.squadPowerLabel", { squad: i + 1 })}
                </label>
                <Input
                  value={squads[i]}
                  onChange={(e) => updateSquad(i, e.target.value)}
                  onBlur={(e) => handleSquadBlur(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. 28.88M" : "e.g. 875K"}
                />
                {squadErrors[i] && (
                  <p className="text-[11px] text-cn-danger leading-tight">{t("reservoirRaid.registrations.powerFormatError")}</p>
                )}
              </div>
            ))}
            <p className="text-[11px] text-text-muted leading-relaxed">{t("registration.powerHint")}</p>
            {visibleCount < 5 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleCount((n) => n + 1)}>
                <Plus />
                {t("registration.addSquad", { squad: visibleCount + 1 })}
              </Button>
            )}

            <label className="block space-y-1 text-xs font-medium text-text-secondary">
              {t("registration.contactPlatform")}
              <select className={selectClass()} value={contactType} onChange={(e) => { setContactType(e.target.value); if (!e.target.value) setContact(""); }}>
                <option value="">{t("registration.noContact")}</option>
                <option value="DISCORD">Discord</option>
                <option value="TELEGRAM">Telegram</option>
              </select>
            </label>
            {contactType && (
              <label className="block space-y-1 text-xs font-medium text-text-secondary">
                {t("registration.contactUsername")}
                <Input maxLength={80} value={contact} onChange={(e) => setContact(e.target.value)} />
              </label>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }} className="w-full sm:w-auto">
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy || !username.trim()} className="w-full sm:w-auto">
              {busy ? t("reservoirRaid.registrations.saving") : t("reservoirRaid.registrations.savePlayer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// EditPlayerModal
// ─────────────────────────────────────────────

function EditPlayerModal({
  planId,
  participant,
  members,
  open,
  onClose,
}: {
  planId: string;
  participant: RaidParticipantRow;
  members: MemberOption[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("phase6");
  const router = useRouter();

  const initialSquads = (() => {
    const arr = ["", "", "", "", ""];
    for (const sq of participant.squadPowers) {
      if (sq.squadIndex >= 1 && sq.squadIndex <= 5) arr[sq.squadIndex - 1] = powerToInput(sq.power);
    }
    return arr;
  })();
  const initialVisibleCount = (() => {
    const lastFilled = participant.squadPowers.length > 0
      ? Math.max(...participant.squadPowers.map((sq) => sq.squadIndex))
      : 0;
    return Math.min(5, Math.max(1, lastFilled + (lastFilled < 5 ? 1 : 0)));
  })();

  const [username, setUsername] = useState(participant.username);
  const [squads, setSquads] = useState<string[]>(initialSquads);
  const [squadErrors, setSquadErrors] = useState<boolean[]>([false, false, false, false, false]);
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const [contactType, setContactType] = useState(participant.contactType ?? "");
  const [contact, setContact] = useState(participant.contact ?? "");
  const [registrationStatus, setRegistrationStatus] = useState(participant.registrationStatus);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(participant.memberId ?? "");
  const [busy, setBusy] = useState(false);

  const filteredMembers = useMemo(
    () => members.filter((m) => m.username.toLowerCase().includes(memberSearch.toLowerCase())),
    [members, memberSearch],
  );

  function updateSquad(index: number, value: string) {
    setSquads((prev) => { const next = [...prev]; next[index] = value; return next; });
    if (squadErrors[index]) setSquadErrors((prev) => { const next = [...prev]; next[index] = false; return next; });
  }

  function handleSquadBlur(index: number, value: string) {
    if (!value.trim()) return;
    if (parseSquadPower(value) === null) {
      setSquadErrors((prev) => { const next = [...prev]; next[index] = true; return next; });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;

    const errors = [false, false, false, false, false];
    const squadPowers: { squadIndex: number; power: number }[] = [];
    let hasError = false;
    for (let i = 0; i < 5; i++) {
      if (!squads[i].trim()) continue;
      const parsed = parseSquadPower(squads[i]);
      if (parsed === null) { errors[i] = true; hasError = true; }
      else squadPowers.push({ squadIndex: i + 1, power: parsed });
    }
    if (hasError) { setSquadErrors(errors); return; }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        username: username.trim(),
        squadPowers,
        contactType: contactType || null,
        contact: contact.trim() || null,
        registrationStatus,
      };
      if (selectedMemberId !== (participant.memberId ?? "")) {
        payload.memberId = selectedMemberId || null;
      }

      const res = await fetch(`/api/admin/raid-plans/${planId}/registrations/${participant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { errorCode?: string };
        toast.error(
          data.errorCode === "usernameTaken"
            ? "A player with this name is already registered."
            : "Failed to update. Please try again.",
        );
        return;
      }
      toast.success(t("reservoirRaid.registrations.playerUpdated"));
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const showMemberAssign =
    participant.registrationStatus === "UNMATCHED" ||
    username.trim() !== participant.username;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("reservoirRaid.registrations.editPlayerTitle")}</DialogTitle>
          <DialogDescription>{t("reservoirRaid.registrations.editPlayerDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-4 space-y-3 pb-2">
            <label className="block space-y-1 text-xs font-medium text-text-secondary">
              {t("reservoirRaid.registrations.ingameName")} *
              <Input maxLength={80} required value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>

            {Array.from({ length: visibleCount }).map((_, i) => (
              <div key={i} className="space-y-1">
                <label className="block text-xs font-medium text-text-secondary">
                  {t("reservoirRaid.registrations.squadPowerLabel", { squad: i + 1 })}
                </label>
                <Input
                  value={squads[i]}
                  onChange={(e) => updateSquad(i, e.target.value)}
                  onBlur={(e) => handleSquadBlur(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. 28.88M" : "e.g. 875K"}
                />
                {squadErrors[i] && (
                  <p className="text-[11px] text-cn-danger leading-tight">{t("reservoirRaid.registrations.powerFormatError")}</p>
                )}
              </div>
            ))}
            <p className="text-[11px] text-text-muted leading-relaxed">{t("registration.powerHint")}</p>
            {visibleCount < 5 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleCount((n) => n + 1)}>
                <Plus />
                {t("registration.addSquad", { squad: visibleCount + 1 })}
              </Button>
            )}

            <label className="block space-y-1 text-xs font-medium text-text-secondary">
              {t("registration.contactPlatform")}
              <select className={selectClass()} value={contactType} onChange={(e) => { setContactType(e.target.value); if (!e.target.value) setContact(""); }}>
                <option value="">{t("registration.noContact")}</option>
                <option value="DISCORD">Discord</option>
                <option value="TELEGRAM">Telegram</option>
              </select>
            </label>
            {contactType && (
              <label className="block space-y-1 text-xs font-medium text-text-secondary">
                {t("registration.contactUsername")}
                <Input maxLength={80} value={contact} onChange={(e) => setContact(e.target.value)} />
              </label>
            )}

            <div className="border-t border-border-subtle pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {t("reservoirRaid.registrations.status")}
              </p>
              <label className="block space-y-1 text-xs font-medium text-text-secondary">
                {t("reservoirRaid.participants.status")}
                <select className={selectClass()} value={registrationStatus} onChange={(e) => setRegistrationStatus(e.target.value)}>
                  <option value="UNMATCHED">{t("reservoirRaid.registrations.statusValues.UNMATCHED")}</option>
                  <option value="MATCHED">{t("reservoirRaid.registrations.statusValues.MATCHED")}</option>
                  <option value="SELECTED_PARTICIPANT">{t("reservoirRaid.registrations.statusValues.SELECTED_PARTICIPANT")}</option>
                  <option value="SELECTED_RESERVIST">{t("reservoirRaid.registrations.statusValues.SELECTED_RESERVIST")}</option>
                  <option value="NOT_SELECTED">{t("reservoirRaid.registrations.statusValues.NOT_SELECTED")}</option>
                </select>
              </label>
              {showMemberAssign && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-text-secondary">
                    {t("reservoirRaid.registrations.assignMember")}
                  </label>
                  <Input
                    placeholder={t("reservoirRaid.registrations.searching")}
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                  <div className="max-h-36 overflow-auto rounded border border-border-dim bg-raised">
                    <button
                      type="button"
                      className={`w-full px-3 py-1.5 text-left text-xs text-text-muted hover:bg-surface ${selectedMemberId === "" ? "font-semibold" : ""}`}
                      onClick={() => setSelectedMemberId("")}
                    >
                      — {t("reservoirRaid.registrations.statusValues.UNMATCHED")}
                    </button>
                    {filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface ${selectedMemberId === m.id ? "font-semibold" : ""}`}
                        onClick={() => setSelectedMemberId(m.id)}
                      >
                        {m.username}
                        {selectedMemberId === m.id && " ✓"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy || !username.trim()} className="w-full sm:w-auto">
              {busy ? t("reservoirRaid.registrations.saving") : t("reservoirRaid.registrations.saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// ImportParticipantsModal
// ─────────────────────────────────────────────

type ImportEntry = { name: string; participant: boolean; reservist: boolean };

function ImportParticipantsModal({ planId, open, onClose }: { planId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations("phase6");
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; matched: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const parsed = useMemo<ImportEntry[] | null>(() => {
    if (!raw.trim()) return null;
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      return (arr as ImportEntry[]).filter((e) => typeof e.name === "string" && e.name.trim());
    } catch {
      return null;
    }
  }, [raw]);

  const parseError = raw.trim() && parsed === null;

  function reset() {
    setRaw("");
    setResult(null);
    setImportError(null);
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setBusy(true);
    setImportError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/raid-plans/${planId}/import-participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ players: parsed }),
      });
      if (!res.ok) {
        setImportError(t("reservoirRaid.registrations.importJsonError"));
        return;
      }
      const data = (await res.json()) as { created: number; updated: number; matched: number };
      setResult(data);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function copyPrompt() {
    navigator.clipboard.writeText(RAID_REGISTRATION_PROMPT).catch(() => {});
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("reservoirRaid.registrations.importTitle")}</DialogTitle>
          <DialogDescription>{t("reservoirRaid.registrations.importDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-text-muted">{t("reservoirRaid.registrations.aiPromptTitle")}</p>
              <Button size="sm" variant="ghost" onClick={copyPrompt}>
                {promptCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {promptCopied ? t("reservoirRaid.registrations.aiPromptCopied") : t("reservoirRaid.registrations.aiPromptCopy")}
              </Button>
            </div>
            <pre className="text-[10px] text-text-muted whitespace-pre-wrap break-words leading-relaxed">{RAID_REGISTRATION_PROMPT}</pre>
          </div>

          <div className="space-y-1">
            <textarea
              className={textareaCls}
              rows={5}
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setResult(null); setImportError(null); }}
              placeholder={t("reservoirRaid.registrations.jsonPlaceholder")}
            />
            {parseError && <p className="text-xs text-cn-danger">{t("reservoirRaid.registrations.importJsonError")}</p>}
            {parsed && parsed.length > 0 && (
              <p className="text-xs text-text-muted">{t("reservoirRaid.registrations.importPreview", { count: parsed.length })}</p>
            )}
          </div>

          {parsed && parsed.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border border-border-dim bg-raised">
              {parsed.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 text-xs text-text-primary border-b border-border-dim last:border-0">
                  <span>{entry.name}</span>
                  <div className="flex gap-1">
                    {entry.participant && <Badge variant="success">{t("reservoirRaid.registrations.statusValues.SELECTED_PARTICIPANT")}</Badge>}
                    {entry.reservist && <Badge variant="warning">{t("reservoirRaid.registrations.statusValues.SELECTED_RESERVIST")}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {importError && <p className="text-xs text-cn-danger">{importError}</p>}
          {result && (
            <p className="text-xs text-cn-success">
              {t("reservoirRaid.registrations.importSuccess", { created: result.created, updated: result.updated, matched: result.matched })}
            </p>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="w-full sm:w-auto">
            {t("common.cancel")}
          </Button>
          <Button disabled={busy || !parsed || parsed.length === 0} onClick={handleImport} className="w-full sm:w-auto">
            {busy ? t("reservoirRaid.registrations.importing") : t("reservoirRaid.registrations.importSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Tab 1: Registrations
// ─────────────────────────────────────────────

type ParticipantCardProps = {
  participant: RaidParticipantRow;
  showAssign: boolean;
  isAdmin: boolean;
  assigningId: string | null;
  assignMemberId: string;
  search: string;
  filteredMembers: MemberOption[];
  busy: boolean;
  onSetAssigningId: (id: string | null) => void;
  onSetSearch: (s: string) => void;
  onSetAssignMemberId: (id: string) => void;
  onAssignMember: (participantId: string) => void;
  onDeleteRegistration: (participantId: string) => void;
  onEditParticipant: (participant: RaidParticipantRow) => void;
};

function ParticipantCard({
  participant,
  showAssign,
  isAdmin,
  assigningId,
  assignMemberId,
  search,
  filteredMembers,
  busy,
  onSetAssigningId,
  onSetSearch,
  onSetAssignMemberId,
  onAssignMember,
  onDeleteRegistration,
  onEditParticipant,
}: ParticipantCardProps) {
  const t = useTranslations("phase6");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const contact = contactLabel(participant.contactType, participant.contact);
  const selectedMemberName = filteredMembers.find((m) => m.id === assignMemberId)?.username ?? assignMemberId;
  return (
    <>
    <div className={`rounded-md border p-3 space-y-2 ${showAssign ? "border-cn-warning/40 bg-cn-warning/5" : "border-border-subtle bg-surface"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{participant.username}</p>
          {participant.memberName && participant.memberName !== participant.username && (
            <p className="text-xs text-text-muted">{participant.memberName}</p>
          )}
          {contact && <p className="text-xs text-text-muted">{contact}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {participant.totalSquadPower > 0 && (
            <Badge variant="secondary">{formatPower(participant.totalSquadPower)}</Badge>
          )}
          {participant.raidReliability && (
            <Badge
              variant={
                participant.raidReliability.score >= 75
                  ? "success"
                  : participant.raidReliability.score >= 45
                    ? "warning"
                    : "destructive"
              }
              title={`${participant.raidReliability.participated}/${participant.raidReliability.total} raids`}
            >
              {participant.raidReliability.score}%
            </Badge>
          )}
          <Badge variant={statusBadgeVariant(participant.registrationStatus)}>
            {t(`reservoirRaid.registrations.statusValues.${participant.registrationStatus}`)}
          </Badge>
        </div>
      </div>

      {participant.squadPowers.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <Zap className="h-3 w-3 text-text-muted shrink-0" />
          {participant.squadPowers.map((sq) => (
            <span key={sq.squadIndex} className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">
              S{sq.squadIndex}: {formatPower(sq.power)}
            </span>
          ))}
        </div>
      )}

      {participant.memberId && (
        <div className="flex flex-wrap gap-1">
          <span className="flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">
            <Droplet className="h-2.5 w-2.5 text-sky-400 shrink-0" />
            {t("reservoirRaid.lastWater")}:{" "}
            {participant.lastWaterCollected !== null
              ? participant.lastWaterCollected.toLocaleString()
              : t("common.unknown")}
          </span>
          <span className="flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">
            <Droplets className="h-2.5 w-2.5 text-sky-400 shrink-0" />
            {t("reservoirRaid.totalWater")}:{" "}
            {participant.totalWaterCollected !== null
              ? formatWater(participant.totalWaterCollected)
              : t("common.unknown")}
          </span>
        </div>
      )}

      {isAdmin && showAssign && (
        <div>
          {assigningId === participant.id ? (
            <div className="space-y-2">
              <Input
                placeholder={t("reservoirRaid.registrations.searching")}
                value={search}
                onChange={(e) => onSetSearch(e.target.value)}
                className="text-xs"
              />
              <div className="max-h-40 overflow-auto rounded border border-border-dim bg-raised">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-xs text-text-primary hover:bg-surface"
                    onClick={() => onSetAssignMemberId(m.id)}
                  >
                    {m.username}
                    {assignMemberId === m.id && " ✓"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={!assignMemberId || busy} onClick={() => setPendingConfirm(true)}>
                  {t("reservoirRaid.registrations.assign")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { onSetAssigningId(null); onSetSearch(""); onSetAssignMemberId(""); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onSetAssigningId(participant.id)}>
                <UserCheck />
                {t("reservoirRaid.registrations.assignMember")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEditParticipant(participant)} disabled={busy}>
                <Pencil />
                {t("reservoirRaid.registrations.editPlayerTitle")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDeleteRegistration(participant.id)} disabled={busy}>
                <Trash2 />
                {t("reservoirRaid.registrations.delete")}
              </Button>
            </div>
          )}
        </div>
      )}

      {isAdmin && !showAssign && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEditParticipant(participant)} disabled={busy}>
            <Pencil />
            {t("reservoirRaid.registrations.editPlayerTitle")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDeleteRegistration(participant.id)} disabled={busy}>
            <Trash2 />
            {t("reservoirRaid.registrations.delete")}
          </Button>
        </div>
      )}
    </div>

    <Dialog open={pendingConfirm} onOpenChange={(next) => !next && setPendingConfirm(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservoirRaid.registrations.assignConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("reservoirRaid.registrations.assignConfirmDescription", {
              member: selectedMemberName,
              username: participant.username,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button variant="ghost" onClick={() => setPendingConfirm(false)} className="w-full sm:w-auto">
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setPendingConfirm(false);
              onAssignMember(participant.id);
            }}
            className="w-full sm:w-auto"
          >
            {t("reservoirRaid.registrations.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function RegistrationsTab({
  planId,
  participants,
  members,
  isAdmin,
  showUnmatchedWarning,
}: {
  planId: string;
  participants: RaidParticipantRow[];
  members: MemberOption[];
  isAdmin: boolean;
  showUnmatchedWarning: boolean;
}) {
  const t = useTranslations("phase6");
  const router = useRouter();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<RaidParticipantRow | null>(null);

  const nameFilterLower = nameFilter.toLowerCase();
  const allUnmatched = participants.filter((p) => p.registrationStatus === "UNMATCHED");
  const matched = participants.filter((p) => p.registrationStatus !== "UNMATCHED" && (
    !nameFilterLower || p.username.toLowerCase().includes(nameFilterLower) || (p.memberName ?? "").toLowerCase().includes(nameFilterLower)
  ));
  const unmatched = allUnmatched.filter((p) =>
    !nameFilterLower || p.username.toLowerCase().includes(nameFilterLower) || (p.memberName ?? "").toLowerCase().includes(nameFilterLower)
  );
  const showWarning = showUnmatchedWarning && allUnmatched.length > 0;

  async function assignMember(participantId: string) {
    if (!assignMemberId) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/raid-plans/${planId}/registrations/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: assignMemberId }),
      });
      setAssigningId(null);
      setAssignMemberId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteRegistration(participantId: string) {
    if (!window.confirm(t("reservoirRaid.registrations.deleteConfirm"))) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/raid-plans/${planId}/registrations/${participantId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const filteredMembers = useMemo(
    () => members.filter((m) => m.username.toLowerCase().includes(search.toLowerCase())),
    [members, search],
  );

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
            <UserPlus />
            {t("reservoirRaid.registrations.addPlayer")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowImportModal(true)}>
            <FileUp />
            {t("reservoirRaid.registrations.importJson")}
          </Button>
        </div>
      )}

      {participants.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <Input
            className="pl-8"
            placeholder={t("reservoirRaid.registrations.searchByName")}
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
        </div>
      )}

      {showWarning && (
        <div className="rounded-md border border-cn-warning/40 bg-cn-warning/10 px-4 py-3 text-sm text-cn-warning">
          {t("reservoirRaid.registrations.unmatchedWarning", { count: allUnmatched.length })}
        </div>
      )}

      {matched.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("reservoirRaid.registrations.matched")} ({matched.length})
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {matched.map((p) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                showAssign={false}
                isAdmin={isAdmin}
                assigningId={assigningId}
                assignMemberId={assignMemberId}
                search={search}
                filteredMembers={filteredMembers}
                busy={busy}
                onSetAssigningId={setAssigningId}
                onSetSearch={setSearch}
                onSetAssignMemberId={setAssignMemberId}
                onAssignMember={assignMember}
                onDeleteRegistration={deleteRegistration}
                onEditParticipant={setEditingParticipant}
              />
            ))}
          </div>
        </section>
      )}

      {unmatched.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-cn-warning">
            {t("reservoirRaid.registrations.unmatched")} ({unmatched.length})
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {unmatched.map((p) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                showAssign={true}
                isAdmin={isAdmin}
                assigningId={assigningId}
                assignMemberId={assignMemberId}
                search={search}
                filteredMembers={filteredMembers}
                busy={busy}
                onSetAssigningId={setAssigningId}
                onSetSearch={setSearch}
                onSetAssignMemberId={setAssignMemberId}
                onAssignMember={assignMember}
                onDeleteRegistration={deleteRegistration}
                onEditParticipant={setEditingParticipant}
              />
            ))}
          </div>
        </section>
      )}

      {participants.length === 0 && (
        <p className="text-sm text-text-muted">{t("reservoirRaid.registrations.empty")}</p>
      )}

      <AddPlayerModal planId={planId} open={showAddModal} onClose={() => setShowAddModal(false)} />
      <ImportParticipantsModal planId={planId} open={showImportModal} onClose={() => setShowImportModal(false)} />
      {editingParticipant && (
        <EditPlayerModal
          planId={planId}
          participant={editingParticipant}
          members={members}
          open={true}
          onClose={() => setEditingParticipant(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab 2: Participants
// ─────────────────────────────────────────────

type ParticipantSortOption = "composite" | "squad1" | "rrs";

function sortParticipants(arr: RaidParticipantRow[], by: ParticipantSortOption) {
  return [...arr].sort((a, b) => {
    if (by === "rrs") return (b.reservoirRaidScore ?? 0) - (a.reservoirRaidScore ?? 0) || b.compositeScore - a.compositeScore;
    if (by === "squad1") return b.squad1Power - a.squad1Power || b.totalSquadPower - a.totalSquadPower;
    return b.compositeScore - a.compositeScore || b.squad1Power - a.squad1Power;
  });
}

function ParticipantsTab({
  planId,
  participants,
}: {
  planId: string;
  participants: RaidParticipantRow[];
}) {
  const t = useTranslations("phase6");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sortBy, setSortBy] = useState<ParticipantSortOption>("composite");

  const matched = participants.filter((p) => p.registrationStatus !== "UNMATCHED");

  const selectedParticipants = matched.filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT");
  const selectedReservists = matched.filter((p) => p.registrationStatus === "SELECTED_RESERVIST");
  const notSelected = matched.filter((p) => p.registrationStatus === "NOT_SELECTED" || p.registrationStatus === "MATCHED");

  const allSorted = [
    ...sortParticipants(selectedParticipants, sortBy),
    ...sortParticipants(selectedReservists, sortBy),
    ...sortParticipants(notSelected, sortBy),
  ];

  async function setStatus(participantId: string, status: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/raid-plans/${planId}/registrations/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationStatus: status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (matched.length === 0) {
    return <p className="text-sm text-text-muted">{t("reservoirRaid.participants.empty")}</p>;
  }

  const compositeInfoTitle = t("reservoirRaid.participants.compositeScoreInfo");

  const capBar = (
    <div className="rounded-md border border-border-dim bg-raised px-4 py-2 text-xs text-text-secondary">
      {t("reservoirRaid.participants.cap", {
        participants: selectedParticipants.length,
        participantLimit: PARTICIPANT_LIMIT,
        reservists: selectedReservists.length,
        reservistLimit: RESERVIST_LIMIT,
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {capBar}

      {/* Sort controls + export */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted shrink-0">{t("reservoirRaid.participants.sortBy")}:</span>
        <select
          className={nativeSelectCls + " w-48"}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ParticipantSortOption)}
        >
          <option value="composite">{t("reservoirRaid.participants.sortComposite")}</option>
          <option value="squad1">{t("reservoirRaid.participants.sortSquad1")}</option>
          <option value="rrs">{t("reservoirRaid.participants.sortRRS")}</option>
        </select>
        <div className="ml-auto">
          <ExportButton baseUrl={`/api/export?type=raid-participants&planId=${planId}`} />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {allSorted.map((participant) => {
          const isParticipant = participant.registrationStatus === "SELECTED_PARTICIPANT";
          const isReservist = participant.registrationStatus === "SELECTED_RESERVIST";
          const participantCapReached = selectedParticipants.length >= PARTICIPANT_LIMIT && !isParticipant;
          const reservistCapReached = selectedReservists.length >= RESERVIST_LIMIT && !isReservist;
          return (
            <div key={participant.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-text-primary">{participant.username}</span>
                <Badge variant={statusBadgeVariant(participant.registrationStatus)} className="shrink-0">
                  {t(`reservoirRaid.participants.statusLabels.${participant.registrationStatus}`)}
                </Badge>
              </div>
              {(participant.squad1Power > 0 || participant.totalSquadPower > 0) && (
                <p className="flex items-center gap-1 text-xs text-text-muted">
                  <Zap className="h-3 w-3 shrink-0" />
                  {participant.squad1Power > 0 ? formatPower(participant.squad1Power) : "—"}
                  {participant.totalSquadPower > 0 && (
                    <span className="opacity-60">· {formatPower(participant.totalSquadPower)}</span>
                  )}
                </p>
              )}
              <p className="flex items-center gap-1 text-xs">
                <Trophy className="h-3 w-3 shrink-0 text-text-muted" />
                <span className={tierColorClass(participant.compositeScoreTier)}>
                  {formatScore(participant.reservoirRaidScore)}
                </span>
                {participant.isScoreStale && (
                  <span title={t("reservoirRaid.participants.scoreStaleWarning")}>
                    <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                  </span>
                )}
                <span className="text-text-muted opacity-60">· {t("reservoirRaid.participants.compositeAbbr")}: {participant.compositeScore.toFixed(1)}</span>
              </p>
              {participant.memberId && (
                <div className="flex flex-wrap gap-1">
                  <span className="flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                    <Droplet className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                    {t("reservoirRaid.lastWater")}:{" "}
                    {participant.lastWaterCollected !== null
                      ? participant.lastWaterCollected.toLocaleString()
                      : t("common.unknown")}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                    <Droplets className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                    {t("reservoirRaid.totalWater")}:{" "}
                    {participant.totalWaterCollected !== null
                      ? formatWater(participant.totalWaterCollected)
                      : t("common.unknown")}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={isParticipant ? "default" : "secondary"}
                  disabled={busy || (participantCapReached && !isParticipant)}
                  onClick={() => setStatus(participant.id, isParticipant ? "NOT_SELECTED" : "SELECTED_PARTICIPANT")}
                >
                  {t("reservoirRaid.participants.participant")}
                </Button>
                <Button
                  size="sm"
                  variant={isReservist ? "default" : "ghost"}
                  disabled={busy || (reservistCapReached && !isReservist)}
                  onClick={() => setStatus(participant.id, isReservist ? "NOT_SELECTED" : "SELECTED_RESERVIST")}
                >
                  {t("reservoirRaid.participants.reservist")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reservoirRaid.participants.ingameName")}</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {t("reservoirRaid.participants.powerHeader")}
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {t("reservoirRaid.participants.rrsHeader")}
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1" title={compositeInfoTitle}>
                  <Info className="h-3 w-3" />
                  {t("reservoirRaid.participants.compositeHeader")}
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  {t("reservoirRaid.participants.waterHeader")}
                </span>
              </TableHead>
              <TableHead>{t("reservoirRaid.participants.status")}</TableHead>
              <TableHead>{t("reservoirRaid.participants.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allSorted.map((participant) => {
              const isParticipant = participant.registrationStatus === "SELECTED_PARTICIPANT";
              const isReservist = participant.registrationStatus === "SELECTED_RESERVIST";
              const participantCapReached = selectedParticipants.length >= PARTICIPANT_LIMIT && !isParticipant;
              const reservistCapReached = selectedReservists.length >= RESERVIST_LIMIT && !isReservist;
              return (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium text-text-primary">{participant.username}</TableCell>
                  <TableCell>
                    <span className="font-medium tabular-nums">{participant.squad1Power > 0 ? formatPower(participant.squad1Power) : "—"}</span>
                    {participant.totalSquadPower > 0 && (
                      <span className="ml-1 text-xs text-text-muted opacity-70 tabular-nums">· {formatPower(participant.totalSquadPower)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium tabular-nums ${tierColorClass(participant.compositeScoreTier)}`}>
                      {formatScore(participant.reservoirRaidScore)}
                    </span>
                    {participant.isScoreStale && (
                      <span title={t("reservoirRaid.participants.scoreStaleWarning")} className="inline-flex">
                        <Clock className="inline-block ml-1 h-3 w-3 text-amber-400" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium tabular-nums ${tierColorClass(participant.compositeScoreTier)}`}
                      title={compositeInfoTitle}
                    >
                      {participant.compositeScore.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {participant.memberId ? (
                      <div className="space-y-0.5">
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <Droplet className="h-3 w-3 text-sky-400 shrink-0" />
                          {participant.lastWaterCollected !== null
                            ? participant.lastWaterCollected.toLocaleString()
                            : t("common.unknown")}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <Droplets className="h-3 w-3 text-sky-400 shrink-0" />
                          {participant.totalWaterCollected !== null
                            ? formatWater(participant.totalWaterCollected)
                            : t("common.unknown")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(participant.registrationStatus)}>
                      {t(`reservoirRaid.participants.statusLabels.${participant.registrationStatus}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant={isParticipant ? "default" : "secondary"}
                        disabled={busy || (participantCapReached && !isParticipant)}
                        onClick={() => setStatus(participant.id, isParticipant ? "NOT_SELECTED" : "SELECTED_PARTICIPANT")}
                        title={participantCapReached ? t("reservoirRaid.participants.capReached") : undefined}
                      >
                        {t("reservoirRaid.participants.participant")}
                      </Button>
                      <Button
                        size="sm"
                        variant={isReservist ? "default" : "ghost"}
                        disabled={busy || (reservistCapReached && !isReservist)}
                        onClick={() => setStatus(participant.id, isReservist ? "NOT_SELECTED" : "SELECTED_RESERVIST")}
                        title={reservistCapReached ? t("reservoirRaid.participants.reservistCapReached") : undefined}
                      >
                        {t("reservoirRaid.participants.reservist")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab 3: Objectives
// ─────────────────────────────────────────────

function ObjectivesTab({
  planId,
  raidDate,
  objectives,
  participants,
  isAdmin,
  role,
  startsAt,
  planLang,
}: {
  planId: string;
  raidDate: string;
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  isAdmin: boolean;
  role: string;
  startsAt: string;
  planLang: import("@/lib/raid-objectives").ObjectiveLang;
}) {
  return (
    <ObjectivesTabImpl
      planId={planId}
      raidDate={raidDate}
      startsAt={startsAt}
      objectives={objectives}
      participants={participants}
      isAdmin={isAdmin}
      role={role}
      planLang={planLang}
    />
  );
}

// ─────────────────────────────────────────────
// Tab 4: Results
// ─────────────────────────────────────────────

function ResultsTab({
  planId,
  participants,
  pendingResults,
  isAdmin,
}: {
  planId: string;
  participants: RaidParticipantRow[];
  pendingResults: boolean;
  isAdmin: boolean;
}) {
  const t = useTranslations("phase6");

  const withData = participants.filter((p) => p.waterCollected !== null).sort((a, b) => (b.waterCollected ?? 0) - (a.waterCollected ?? 0));
  const noData = participants.filter((p) => p.waterCollected === null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isAdmin && (
          <Button
            variant={pendingResults ? "ghost" : "secondary"}
            disabled={pendingResults}
            render={!pendingResults ? <Link href={`/upload?kind=RESERVOIR_RAID_RESULTS&eventInstanceId=${planId}`} /> : undefined}
          >
            <Upload />
            {pendingResults ? t("reservoirRaid.results.pendingUpload") : t("reservoirRaid.results.uploadResults")}
          </Button>
        )}
        <ExportButton baseUrl={`/api/export?type=raid-results&planId=${planId}`} />
      </div>

      {withData.length === 0 && noData.length === 0 && (
        <p className="text-sm text-text-muted">{t("reservoirRaid.results.empty")}</p>
      )}

      {(withData.length > 0 || noData.length > 0) && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reservoirRaid.results.playerName")}</TableHead>
              <TableHead>{t("reservoirRaid.results.waterCollected")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withData.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-text-primary">{p.username}</TableCell>
                <TableCell>{p.waterCollected}</TableCell>
              </TableRow>
            ))}
            {noData.map((p) => (
              <TableRow key={p.id} className="opacity-50">
                <TableCell className="text-text-muted">{p.username}</TableCell>
                <TableCell className="text-text-muted">{t("reservoirRaid.results.noData")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Read-only view for R1-R3 members
// ─────────────────────────────────────────────

function MemberRaidView({
  raid,
  userMemberId,
  userMemberName,
}: {
  raid: RaidDetailData;
  userMemberId: string | null;
  userMemberName: string | null;
}) {
  const t = useTranslations("phase6");
  const locale = useLocale();
  const planLang = (["en", "ru", "tr"].includes(locale) ? locale : "en") as ObjectiveLang;

  const myParticipant = userMemberId
    ? raid.participants.find((p) => p.memberId === userMemberId)
    : null;

  const myObjective = myParticipant
    ? raid.objectives.find((o) => o.assignments.some((a) => a.participantId === myParticipant.id))
    : null;

  const selectedParticipants = raid.participants
    .filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT" || p.registrationStatus === "SELECTED_RESERVIST")
    .sort((a, b) => b.squad1Power - a.squad1Power || b.totalSquadPower - a.totalSquadPower);

  const raidStarted = new Date(raid.startsAt) <= new Date();
  const currentSquad1 = myParticipant?.squadPowers.find((s) => s.squadIndex === 1)?.power ?? null;

  function buildRegUrl() {
    const base = `/events/reservoir-raid/${raid.publicToken}/register`;
    const params = new URLSearchParams();
    if (userMemberName) params.set("name", userMemberName);
    if (currentSquad1 != null) params.set("s1", String(currentSquad1));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div className="space-y-4">
      {myParticipant ? (
        <div className="rounded-md border border-gold-border bg-surface p-4 space-y-3">
          <h2 className="text-sm font-bold text-gold">{t("reservoirRaid.yourAssignment")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("reservoirRaid.yourStatus")}</p>
              <Badge variant={statusBadgeVariant(myParticipant.registrationStatus)}>
                {t(`reservoirRaid.participants.statusLabels.${myParticipant.registrationStatus}`)}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("reservoirRaid.assignedObjective")}</p>
              <p className="text-sm text-text-primary">
                {myObjective
                  ? `${getObjectiveName(myObjective.key, planLang)} (Tier ${myObjective.tier})`
                  : t("reservoirRaid.noObjectiveAssigned")}
              </p>
            </div>
            {currentSquad1 != null && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("registration.squad1Power")}</p>
                <p className="text-sm text-text-primary">{currentSquad1.toLocaleString()}</p>
              </div>
            )}
          </div>
          {!raidStarted && (
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={buildRegUrl()} />}>
              {t("reservoirRaid.editRegistration")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">{t("reservoirRaid.notRegistered")}</p>
          {raid.registrationOpen && (
            <Button size="sm" variant="default" nativeButton={false} render={<Link href={buildRegUrl()} />}>
              {t("reservoirRaid.registerNow")}
            </Button>
          )}
        </div>
      )}

      {myParticipant && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">{t("reservoirRaid.tabs.objectives")}</h2>
          <MemberObjectivesMap
            objectives={raid.objectives}
            planLang={planLang}
            myObjectiveId={myObjective?.id ?? null}
          />
        </div>
      )}

      {selectedParticipants.length > 0 && (
        <div className="rounded-md border border-border-subtle bg-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reservoirRaid.registrations.ingameName")}</TableHead>
                <TableHead>{t("reservoirRaid.participants.status")}</TableHead>
                <TableHead>{t("reservoirRaid.participants.powerHeader")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedParticipants.map((p) => {
                const isMe = userMemberId !== null && p.memberId === userMemberId;
                return (
                  <TableRow key={p.id} className={isMe ? "bg-gold/5 font-semibold" : undefined}>
                    <TableCell className={isMe ? "text-gold" : undefined}>{p.username}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(p.registrationStatus)}>
                        {t(`reservoirRaid.participants.statusLabels.${p.registrationStatus}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium tabular-nums">{p.squad1Power > 0 ? formatPower(p.squad1Power) : "—"}</span>
                      {p.totalSquadPower > 0 && (
                        <span className="ml-1 text-xs text-text-muted opacity-70 tabular-nums">· {formatPower(p.totalSquadPower)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Detail Component
// ─────────────────────────────────────────────

export function ReservoirRaidDetail({
  raid,
  members,
  isAdmin,
  role,
  userLanguage,
  userMemberId,
}: {
  raid: RaidDetailData;
  members: MemberOption[];
  isAdmin: boolean;
  role: string;
  userLanguage: string;
  userMemberId?: string | null;
}) {
  const t = useTranslations("phase6");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "registrations");
  const [toggling, setToggling] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const locale = useLocale();
  const planLang = (["en", "ru", "tr"].includes(locale) ? locale : "en") as import("@/lib/raid-objectives").ObjectiveLang;

  const canManage = isAdmin || role === "r4" || role === "r5";

  async function toggleRegistration() {
    setToggling(true);
    try {
      await fetch(`/api/admin/raid-plans/${raid.id}/toggle-registration`, { method: "PATCH" });
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  const tabs = [
    { key: "registrations", label: t("reservoirRaid.tabs.registrations") },
    { key: "participants", label: t("reservoirRaid.tabs.participants") },
    { key: "objectives", label: t("reservoirRaid.tabs.objectives") },
    { key: "results", label: t("reservoirRaid.tabs.results") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={raid.registrationOpen ? "success" : "outline"}>
              {raid.registrationOpen ? t("reservoirRaid.registrationOpen") : t("reservoirRaid.registrationClosed")}
            </Badge>
            <span className="text-xs text-text-muted">
              <TimeDisplay date={new Date(raid.startsAt)} />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/events/reservoir-raid/${raid.publicToken}/register`;
                navigator.clipboard.writeText(url).catch(() => {});
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              {linkCopied ? <Check /> : <Copy />}
              {linkCopied ? t("reservoirRaid.regLinkCopied") : t("reservoirRaid.copyRegLink")}
            </Button>
          )}
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" disabled={toggling} onClick={toggleRegistration}>
                {raid.registrationOpen ? t("reservoirRaid.closeRegistration") : t("reservoirRaid.openRegistration")}
              </Button>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/upload?kind=RESERVOIR_RAID_SCORES" />}>
                <Trophy />
                {t("reservoirRaid.uploadScores")}
              </Button>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/events/reservoir-raid/${raid.id}/edit`} />}>
                <Edit />
                {t("reservoirRaid.edit")}
              </Button>
            </>
          )}
        </div>
      </div>

      {canManage ? (
        <>
          <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-2">
            {tabs.map((item) => (
              <Button
                key={item.key}
                variant={tab === item.key ? "default" : "tab"}
                size="sm"
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {tab === "registrations" && (
            <RegistrationsTab
              planId={raid.id}
              participants={raid.participants}
              members={members}
              isAdmin={isAdmin}
              showUnmatchedWarning={raid.showUnmatchedWarning}
            />
          )}
          {tab === "participants" && (
            <ParticipantsTab planId={raid.id} participants={raid.participants} />
          )}
          {tab === "objectives" && (
            <ObjectivesTab
              planId={raid.id}
              raidDate={raid.raidDate}
              objectives={raid.objectives}
              participants={raid.participants}
              isAdmin={isAdmin}
              role={role}
              startsAt={raid.startsAt}
              planLang={planLang}
            />
          )}
          {tab === "results" && (
            <ResultsTab
              planId={raid.id}
              participants={raid.participants}
              pendingResults={raid.pendingResults}
              isAdmin={isAdmin}
            />
          )}
        </>
      ) : (
        <MemberRaidView
          raid={raid}
          userMemberId={userMemberId ?? null}
          userMemberName={userMemberId ? (members.find((m) => m.id === userMemberId)?.username ?? null) : null}
        />
      )}
    </div>
  );
}
