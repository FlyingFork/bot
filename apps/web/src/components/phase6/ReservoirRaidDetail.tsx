"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Droplet, Droplets, Edit, Plus, Trash2, Upload, UserCheck, Zap } from "lucide-react";
import { TimeDisplay } from "@/components/TimeDisplay";
import { ExportButton } from "@/components/phase4/ExportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PARTICIPANT_LIMIT, RESERVIST_LIMIT } from "@/lib/phase6-constants";
import { ObjectivesTab as ObjectivesTabImpl } from "@/components/phase6/objectives/ObjectivesTab";

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
  totalSquadPower: number;
  squadPowers: SquadPower[];
  raidReliability: { score: number; participated: number; total: number } | null;
  lastWaterCollected: number | null;
  totalWaterCollected: number | null;
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
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

function statusBadgeVariant(status: string) {
  if (status === "SELECTED_PARTICIPANT") return "success" as const;
  if (status === "SELECTED_RESERVIST") return "warning" as const;
  return "secondary" as const;
}

// ─────────────────────────────────────────────
// Tab 1: Registrations
// ─────────────────────────────────────────────

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
  const [busy, setBusy] = useState(false);

  const matched = participants.filter((p) => p.registrationStatus !== "UNMATCHED");
  const unmatched = participants.filter((p) => p.registrationStatus === "UNMATCHED");
  const showWarning = showUnmatchedWarning && unmatched.length > 0;

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

  function ParticipantCard({ participant, showAssign }: { participant: RaidParticipantRow; showAssign: boolean }) {
    const contact = contactLabel(participant.contactType, participant.contact);
    return (
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
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs"
                />
                <div className="max-h-40 overflow-auto rounded border border-border-dim bg-raised">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full px-2 py-1.5 text-left text-xs text-text-primary hover:bg-surface"
                      onClick={() => setAssignMemberId(m.id)}
                    >
                      {m.username}
                      {assignMemberId === m.id && " ✓"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!assignMemberId || busy} onClick={() => assignMember(participant.id)}>
                    {t("reservoirRaid.registrations.assign")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAssigningId(null); setSearch(""); setAssignMemberId(""); }}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAssigningId(participant.id)}>
                  <UserCheck />
                  {t("reservoirRaid.registrations.assignMember")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteRegistration(participant.id)} disabled={busy}>
                  <Trash2 />
                  {t("reservoirRaid.registrations.delete")}
                </Button>
              </div>
            )}
          </div>
        )}

        {isAdmin && !showAssign && (
          <Button size="sm" variant="ghost" onClick={() => deleteRegistration(participant.id)} disabled={busy}>
            <Trash2 />
            {t("reservoirRaid.registrations.delete")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showWarning && (
        <div className="rounded-md border border-cn-warning/40 bg-cn-warning/10 px-4 py-3 text-sm text-cn-warning">
          {t("reservoirRaid.registrations.unmatchedWarning", { count: unmatched.length })}
        </div>
      )}

      {matched.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("reservoirRaid.registrations.matched")} ({matched.length})
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {matched.map((p) => <ParticipantCard key={p.id} participant={p} showAssign={false} />)}
          </div>
        </section>
      )}

      {unmatched.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-cn-warning">
            {t("reservoirRaid.registrations.unmatched")} ({unmatched.length})
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {unmatched.map((p) => <ParticipantCard key={p.id} participant={p} showAssign={true} />)}
          </div>
        </section>
      )}

      {participants.length === 0 && (
        <p className="text-sm text-text-muted">{t("reservoirRaid.registrations.empty")}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab 2: Participants
// ─────────────────────────────────────────────

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

  const matched = participants.filter((p) => p.registrationStatus !== "UNMATCHED");

  const selectedParticipants = matched.filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT");
  const selectedReservists = matched.filter((p) => p.registrationStatus === "SELECTED_RESERVIST");
  const notSelected = matched.filter((p) => p.registrationStatus === "NOT_SELECTED" || p.registrationStatus === "MATCHED");

  const sorted = (arr: RaidParticipantRow[]) => [...arr].sort((a, b) => b.totalSquadPower - a.totalSquadPower);

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

  const allSorted = [...sorted(selectedParticipants), ...sorted(selectedReservists), ...sorted(notSelected)];

  if (matched.length === 0) {
    return <p className="text-sm text-text-muted">{t("reservoirRaid.participants.empty")}</p>;
  }

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
              {participant.totalSquadPower > 0 && (
                <p className="flex items-center gap-1 text-xs text-text-muted">
                  <Zap className="h-3 w-3 shrink-0" />
                  {t("reservoirRaid.participants.squadPower")}: {formatPower(participant.totalSquadPower)}
                </p>
              )}
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
                  {t("reservoirRaid.participants.squadPower")}
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
                  <TableCell>{participant.totalSquadPower > 0 ? formatPower(participant.totalSquadPower) : "—"}</TableCell>
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
// Main Detail Component
// ─────────────────────────────────────────────

export function ReservoirRaidDetail({
  raid,
  members,
  isAdmin,
  role,
  userLanguage,
}: {
  raid: RaidDetailData;
  members: MemberOption[];
  isAdmin: boolean;
  role: string;
  userLanguage: string;
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
        <p className="text-sm text-text-muted">{t("reservoirRaid.notAuthorized")}</p>
      )}
    </div>
  );
}
