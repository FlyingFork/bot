"use client";

import Link from "next/link";
import { Check, Copy, Upload, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
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
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/alliance/ExportMenu";
import { formatImportedAt, formatPower } from "@/lib/alliance-format";
import type { RaidWorkspacePlan } from "./RaidPlanWorkspace";

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

function utcTimeValue(startsAt: string) {
  const date = new Date(startsAt);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

function totalPower(value: string) {
  return BigInt(value);
}

export function RaidPlayersPanel({
  participants,
  plan,
}: {
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
  const [isPending, startTransition] = useTransition();
  const signupPath = `/reservoir-raid/register/${plan.publicToken}`;
  const participantCount = participants.filter((participant) => participant.participant).length;
  const reservistCount = participants.filter((participant) => participant.reservist).length;
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

  function refreshWith(result: RaidActionResult) {
    setStatus(result.message ? result : null);
    router.refresh();
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
    </div>
  );
}
