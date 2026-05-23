"use client";

import Link from "next/link";
import { Check, Copy, Upload, UserRoundPlus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRaidRegistrationFromAllianceMember,
  type AllianceRaidRegistrationInput,
  type AllianceRaidRegistrationResult,
  importRaidRegistrations,
  promoteRaidParticipant,
  type RaidActionResult,
  setRaidRosterFlag,
  setRaidRegistrationOpen,
  updateRaidPlanTime,
} from "@/app/dashboard/events/reservoir-raid/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataCard } from "@/components/ui/data-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/alliance/ExportMenu";
import { formatImportedAt, formatPower } from "@/lib/alliance-format";
import type { RaidAllianceMember, RaidWorkspacePlan } from "./RaidPlanWorkspace";

export type RaidParticipantRow = {
  id: string;
  username: string;
  memberId: string | null;
  memberActive: boolean;
  contactType: "DISCORD" | "TELEGRAM" | null;
  contact: string | null;
  confirmed: boolean;
  participant: boolean;
  reservist: boolean;
  updatedAt: string;
  squadPowers: { power: string; squadIndex: number }[];
  totalSquadPower: string;
  avatarColor: string;
  avatarInitials: string;
};

const importExample = `{
  "registrations": [
    {
      "username": "PlayerOne",
      "squad1Power": "24.6M",
      "squad2Power": "875K",
      "squad3Power": null,
      "squad4Power": null,
      "squad5Power": null,
      "contactType": "discord",
      "contact": "player.one",
      "confirmed": true
    }
  ]
}`;

const emptyAllianceRegistrationInput: AllianceRaidRegistrationInput = {
  squad1Power: "",
  squad2Power: "",
  squad3Power: "",
  squad4Power: "",
  squad5Power: "",
  contactType: "",
  contact: "",
  confirmed: false,
};

function utcTimeValue(startsAt: string) {
  const date = new Date(startsAt);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

function totalPower(value: string) {
  return BigInt(value);
}

function FieldError({ message }: { message?: string }) {
  const t = useTranslations("reservoirRaid.registration.errors");

  return message ? <p className="text-xs text-cn-danger">{t(message)}</p> : null;
}

export function RaidPlayersPanel({
  allianceMembers,
  participants,
  plan,
}: {
  allianceMembers: RaidAllianceMember[];
  participants: RaidParticipantRow[];
  plan: RaidWorkspacePlan;
}) {
  const locale = useLocale();
  const t = useTranslations("reservoirRaid.players");
  const actionT = useTranslations("reservoirRaid.actions");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"power" | "name">("power");
  const [eventTimeUtc, setEventTimeUtc] = useState(() => utcTimeValue(plan.startsAt));
  const [payload, setPayload] = useState("");
  const [status, setStatus] = useState<RaidActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedAllianceMember, setSelectedAllianceMember] =
    useState<RaidAllianceMember | null>(null);
  const [registrationInput, setRegistrationInput] = useState<AllianceRaidRegistrationInput>(
    emptyAllianceRegistrationInput,
  );
  const [registrationResult, setRegistrationResult] =
    useState<AllianceRaidRegistrationResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const signupPath = `/reservoir-raid/register/${plan.publicToken}`;
  const participantCount = participants.filter((participant) => participant.participant).length;
  const reservistCount = participants.filter((participant) => participant.reservist).length;
  const registeredMemberIds = useMemo(
    () =>
      new Set(
        participants.flatMap((participant) =>
          participant.memberId ? [participant.memberId] : [],
        ),
      ),
    [participants],
  );
  const registeredUsernames = useMemo(
    () => new Set(participants.map((participant) => participant.username.toLowerCase())),
    [participants],
  );
  const visibleParticipants = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return [...participants]
      .filter((participant) =>
        normalized ? participant.username.toLowerCase().includes(normalized) : true,
      )
      .sort((left, right) => {
        if (sort === "name") {
          return left.username.localeCompare(right.username);
        }

        const leftPower = totalPower(left.totalSquadPower);
        const rightPower = totalPower(right.totalSquadPower);
        return leftPower === rightPower
          ? left.username.localeCompare(right.username)
          : leftPower > rightPower
            ? -1
            : 1;
      });
  }, [participants, search, sort]);
  const allianceMatches = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    return allianceMembers.filter(
      (member) =>
        member.username.toLowerCase().includes(normalized) &&
        !registeredMemberIds.has(member.id) &&
        !registeredUsernames.has(member.username.toLowerCase()),
    );
  }, [allianceMembers, registeredMemberIds, registeredUsernames, search]);

  function refreshWith(result: RaidActionResult) {
    setStatus(result.message ? result : null);
    router.refresh();
  }

  function openAllianceRegistration(member: RaidAllianceMember) {
    setSelectedAllianceMember(member);
    setRegistrationInput(emptyAllianceRegistrationInput);
    setRegistrationResult(null);
  }

  function setRegistrationField<Key extends keyof AllianceRaidRegistrationInput>(
    field: Key,
    value: AllianceRaidRegistrationInput[Key],
  ) {
    setRegistrationInput((current) => ({ ...current, [field]: value }));
  }

  async function copySignupPath() {
    await navigator.clipboard.writeText(`${window.location.origin}${signupPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1fr)]">
        <DataCard
          title={t("registrationTitle")}
          description={t("registrationDescription")}
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="min-w-0 break-all text-xs font-semibold text-cn-cyan hover:underline"
                href={signupPath}
                target="_blank"
              >
                {signupPath}
              </Link>
              <Button onClick={copySignupPath} size="sm" variant="outline">
                {copied ? <Check /> : <Copy />}
                {copied ? t("copied") : t("copyLink")}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-text-secondary">
                {t("eventTimeUtc")}
                <Input
                  onChange={(event) => setEventTimeUtc(event.target.value)}
                  type="time"
                  value={eventTimeUtc}
                />
              </label>
              <Button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () =>
                    refreshWith(await updateRaidPlanTime(plan.id, eventTimeUtc)),
                  )
                }
                size="sm"
                variant="secondary"
              >
                {t("saveTime")}
              </Button>
              <Button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () =>
                    refreshWith(
                      await setRaidRegistrationOpen(plan.id, !plan.registrationOpen),
                    ),
                  )
                }
                size="sm"
                variant={plan.registrationOpen ? "destructive" : "secondary"}
              >
                {plan.registrationOpen ? t("closeRegistration") : t("openRegistration")}
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              {t("weekStatus", { date: plan.raidDate.slice(0, 10) })}{" "}
              <span className="font-semibold text-text-primary">
                {plan.registrationOpen ? t("open") : t("closed")}
              </span>
            </p>
          </div>
        </DataCard>
        <DataCard
          title={t("jsonTitle")}
          description={t("jsonDescription")}
        >
          <div className="grid gap-3">
            <textarea
              className="min-h-48 w-full rounded-md border border-border-default bg-base p-3 font-mono text-[11px] leading-5 text-text-primary outline-none focus:border-border-active"
              onChange={(event) => setPayload(event.target.value)}
              placeholder={importExample}
              spellCheck={false}
              value={payload}
            />
            <details className="text-xs text-text-secondary">
              <summary className="cursor-pointer font-semibold text-text-primary">
                {t("jsonStructure")}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border-dim bg-base p-3 font-mono text-[11px] leading-5">
                {importExample}
              </pre>
            </details>
            <Button
              className="w-fit"
              disabled={isPending || !payload.trim()}
              onClick={() =>
                startTransition(async () => {
                  const result = await importRaidRegistrations(plan.id, payload);

                  if (result.pending) {
                    toast.info(t("pendingApproval"));
                    setPayload("");
                    return;
                  }

                  refreshWith(result);

                  if (result.ok) {
                    setPayload("");
                  }
                })
              }
              variant="secondary"
            >
              <Upload />
              {t("loadJson")}
            </Button>
          </div>
        </DataCard>
      </div>
      {status && (
        <p className="rounded-md border border-border-dim bg-base px-3 py-2 text-xs text-text-secondary">
          {status.message ? actionT(status.message, status.values) : null}
        </p>
      )}
      <DataCard
        title={t("registeredTitle")}
        description={t("registeredDescription")}
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              type="search"
              value={search}
            />
            <select
              className="h-8 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary outline-none focus:border-border-active"
              onChange={(event) => setSort(event.target.value as "power" | "name")}
              value={sort}
            >
              <option value="power">{t("sortPower")}</option>
              <option value="name">{t("username")}</option>
            </select>
            <ExportMenu
              fileName={`reservoir-raid-registrations-${plan.raidDate.slice(0, 10)}`}
              rows={visibleParticipants}
              columns={[
                { key: "username", label: t("username"), value: (row) => row.username },
                {
                  key: "squad1",
                  label: t("squadPower", { squad: 1 }),
                  value: (row) => row.squadPowers.find((squad) => squad.squadIndex === 1)?.power,
                },
                {
                  key: "squad2",
                  label: t("squadPower", { squad: 2 }),
                  value: (row) => row.squadPowers.find((squad) => squad.squadIndex === 2)?.power,
                },
                {
                  key: "squad3",
                  label: t("squadPower", { squad: 3 }),
                  value: (row) => row.squadPowers.find((squad) => squad.squadIndex === 3)?.power,
                },
                {
                  key: "squad4",
                  label: t("squadPower", { squad: 4 }),
                  value: (row) => row.squadPowers.find((squad) => squad.squadIndex === 4)?.power,
                },
                {
                  key: "squad5",
                  label: t("squadPower", { squad: 5 }),
                  value: (row) => row.squadPowers.find((squad) => squad.squadIndex === 5)?.power,
                },
                {
                  key: "totalPower",
                  label: t("total"),
                  value: (row) => row.totalSquadPower,
                },
                {
                  key: "contactType",
                  label: t("contactType"),
                  value: (row) => row.contactType ?? "",
                },
                { key: "contact", label: t("contact"), value: (row) => row.contact },
                {
                  key: "confirmed",
                  label: t("confirmed"),
                  value: (row) => row.confirmed ? t("yes") : t("no"),
                },
                {
                  key: "participant",
                  label: t("participant"),
                  value: (row) => row.participant ? t("yes") : t("no"),
                },
                {
                  key: "reservist",
                  label: t("reservist"),
                  value: (row) => row.reservist ? t("yes") : t("no"),
                },
                {
                  key: "status",
                  label: t("status"),
                  value: (row) => row.memberId ? t("member") : t("archived"),
                },
                { key: "updatedAt", label: t("updated"), value: (row) => row.updatedAt },
              ]}
            />
            <span className="text-xs text-text-secondary">
              {t("rosterCounts", {
                participants: participantCount,
                participantLimit: 30,
                reservists: reservistCount,
                reservistLimit: 10,
              })}
            </span>
          </div>
          {allianceMatches.length > 0 && (
            <div className="grid gap-2 rounded-md border border-border-dim bg-base p-3">
              <div>
                <h4 className="text-xs font-bold text-text-primary">
                  {t("allianceMatchesTitle")}
                </h4>
                <p className="text-[11px] text-text-muted">
                  {t("allianceMatchesDescription")}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {allianceMatches.map((member) => (
                  <div
                    className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border-dim bg-surface p-2"
                    key={member.id}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${member.avatarColor}`}
                      >
                        {member.avatarInitials}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-text-primary">
                        {member.username}
                      </span>
                    </div>
                    <Button
                      disabled={isPending}
                      onClick={() => openAllianceRegistration(member)}
                      size="sm"
                      variant="secondary"
                    >
                      <UserPlus />
                      {t("addRegistration")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-auto rounded-md border border-border-dim">
            <table className="w-full min-w-[48rem] text-left text-xs">
              <thead className="bg-base text-text-muted">
                <tr>
                  <th className="px-3 py-2">{t("player")}</th>
                  <th className="px-3 py-2">{t("squads")}</th>
                  <th className="px-3 py-2 text-right">{t("total")}</th>
                  <th className="px-3 py-2">{t("contact")}</th>
                  <th className="px-3 py-2">{t("updated")}</th>
                  <th className="px-3 py-2">{t("eventRoster")}</th>
                  <th className="px-3 py-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleParticipants.map((participant) => (
                  <tr className="border-t border-border-dim" key={participant.id}>
                    <td className="px-3 py-2 font-semibold text-text-primary">
                      {participant.memberId ? (
                        <Link
                          className="hover:text-cn-cyan"
                          href={`/dashboard/members/${participant.memberId}`}
                        >
                          {participant.username}
                        </Link>
                      ) : (
                        participant.username
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-secondary">
                      {participant.squadPowers
                        .map(
                          (squad) =>
                            `S${squad.squadIndex} ${formatPower(squad.power, locale)}`,
                        )
                        .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">
                      {formatPower(participant.totalSquadPower, locale)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {participant.contactType && participant.contact
                        ? `${participant.contactType}: ${participant.contact}`
                        : t("none")}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {formatImportedAt(participant.updatedAt, locale)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="grid gap-2 text-[11px]">
                        <label className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={participant.participant}
                            disabled={isPending}
                            onCheckedChange={() =>
                              startTransition(async () =>
                                refreshWith(
                                  await setRaidRosterFlag({
                                    enabled: !participant.participant,
                                    participantId: participant.id,
                                    slot: "participant",
                                  }),
                                ),
                              )
                            }
                          />
                          <span className={participant.participant ? "font-semibold text-cn-cyan" : "text-text-secondary"}>
                            {t("participant")}
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={participant.reservist}
                            disabled={isPending}
                            onCheckedChange={() =>
                              startTransition(async () =>
                                refreshWith(
                                  await setRaidRosterFlag({
                                    enabled: !participant.reservist,
                                    participantId: participant.id,
                                    slot: "reservist",
                                  }),
                                ),
                              )
                            }
                          />
                          <span className={participant.reservist ? "font-semibold text-cn-warning" : "text-text-secondary"}>
                            {t("reservist")}
                          </span>
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {participant.memberId ? (
                        <span className="rounded border border-cn-success/35 bg-cn-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-cn-success">
                          {t("member")}
                        </span>
                      ) : (
                        <Button
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () =>
                              refreshWith(await promoteRaidParticipant(participant.id)),
                            )
                          }
                          size="xs"
                          variant="outline"
                        >
                          <UserRoundPlus />
                          {t("promoteArchived")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleParticipants.length && (
              <p className="border-t border-border-dim p-4 text-sm text-text-muted">
                {t("empty")}
              </p>
            )}
          </div>
        </div>
      </DataCard>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAllianceMember(null);
            setRegistrationResult(null);
          }
        }}
        open={selectedAllianceMember !== null}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("addDialogTitle", {
                username: selectedAllianceMember?.username ?? "",
              })}
            </DialogTitle>
            <DialogDescription>{t("addDialogDescription")}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 px-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();

              if (!selectedAllianceMember) {
                return;
              }

              setRegistrationResult(null);
              startTransition(async () => {
                const result = await addRaidRegistrationFromAllianceMember(
                  plan.id,
                  selectedAllianceMember.id,
                  registrationInput,
                );
                setRegistrationResult(result);

                if (result.ok) {
                  refreshWith(result);
                  setSelectedAllianceMember(null);
                  setRegistrationInput(emptyAllianceRegistrationInput);
                }
              });
            }}
          >
            <label className="grid gap-1.5 text-sm text-text-secondary">
              {t("username")}
              <Input readOnly value={selectedAllianceMember?.username ?? ""} />
            </label>
            <div className="grid gap-2">
              {(["squad1Power", "squad2Power", "squad3Power", "squad4Power", "squad5Power"] as const).map(
                (field, index) => (
                  <label
                    className="grid gap-1.5 text-sm text-text-secondary sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-3"
                    key={field}
                  >
                    <span className="sm:pt-1.5">
                      {index === 0
                        ? t("requiredSquadPower", { squad: index + 1 })
                        : t("optionalSquadPower", { squad: index + 1 })}
                    </span>
                    <div className="grid gap-1">
                      <Input
                        disabled={isPending}
                        onChange={(event) =>
                          setRegistrationField(field, event.target.value)
                        }
                        placeholder={index === 0 ? "24.6M" : "875K"}
                        required={index === 0}
                        value={registrationInput[field]}
                      />
                      <FieldError message={registrationResult?.fieldErrors?.[field]} />
                    </div>
                  </label>
                ),
              )}
            </div>
            <p className="text-xs text-text-muted">{t("powerHint")}</p>
            <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-sm text-text-secondary">
                {t("contactType")}
                <select
                  className="h-8 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary outline-none focus:border-border-active disabled:opacity-40"
                  disabled={isPending}
                  onChange={(event) =>
                    setRegistrationField("contactType", event.target.value)
                  }
                  value={registrationInput.contactType}
                >
                  <option value="">{t("noContact")}</option>
                  <option value="discord">Discord</option>
                  <option value="telegram">Telegram</option>
                </select>
                <FieldError message={registrationResult?.fieldErrors?.contactType} />
              </label>
              <label className="grid gap-1.5 text-sm text-text-secondary">
                {t("contactHandle")}
                <Input
                  disabled={isPending || !registrationInput.contactType}
                  onChange={(event) =>
                    setRegistrationField("contact", event.target.value)
                  }
                  value={registrationInput.contact}
                />
                <FieldError message={registrationResult?.fieldErrors?.contact} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <Checkbox
                checked={registrationInput.confirmed}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  setRegistrationField("confirmed", checked === true)
                }
              />
              <span>
                {t("confirmed")}
                <FieldError message={registrationResult?.fieldErrors?.confirmed} />
              </span>
            </label>
            {registrationResult?.message && !registrationResult.ok && (
              <p className="rounded-md border border-cn-danger/35 bg-cn-danger/10 p-3 text-sm text-cn-danger">
                {actionT(registrationResult.message, registrationResult.values)}
              </p>
            )}
            <DialogFooter className="px-0 pb-0">
              <Button
                disabled={isPending}
                onClick={() => setSelectedAllianceMember(null)}
                type="button"
                variant="outline"
              >
                {t("cancel")}
              </Button>
              <Button disabled={isPending} type="submit">
                <UserPlus />
                {isPending ? t("saving") : t("saveRegistration")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
