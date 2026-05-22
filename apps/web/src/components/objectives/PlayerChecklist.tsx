"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPower } from "@/lib/alliance-format";
import type { ObjectiveId, ObjectiveMember } from "@/types/objectives";

export function PlayerChecklist({
  assignedMemberIds,
  getMemberLoad,
  members,
  objectiveId,
  onPlayerNameClick,
  onToggle,
}: {
  assignedMemberIds: Set<string>;
  getMemberLoad: (memberId: string) => number;
  members: ObjectiveMember[];
  objectiveId: ObjectiveId;
  onPlayerNameClick: (memberId: string) => void;
  onToggle: (objectiveId: ObjectiveId, memberId: string) => void;
}) {
  const t = useTranslations("objectives");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"power" | "name">("power");

  const [assignedMembers, unassignedMembers] = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    const filtered = [...members]
      .filter((member) =>
        normalized ? member.username.toLowerCase().includes(normalized) : true,
      )
      .sort((left, right) => {
        if (sort === "name") {
          return left.username.localeCompare(right.username);
        }

        const leftPower = BigInt(left.totalSquadPower);
        const rightPower = BigInt(right.totalSquadPower);
        return leftPower === rightPower
          ? left.username.localeCompare(right.username)
          : leftPower > rightPower
            ? -1
            : 1;
      });

    return [
      filtered.filter((m) => assignedMemberIds.has(m.id)),
      filtered.filter((m) => !assignedMemberIds.has(m.id)),
    ];
  }, [members, search, sort, assignedMemberIds]);

  const renderMember = (member: ObjectiveMember) => {
    const load = getMemberLoad(member.id);

    return (
      <div
        className="grid grid-cols-[1rem_1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raised"
        key={member.id}
      >
        <Checkbox
          aria-label={member.username}
          checked={assignedMemberIds.has(member.id)}
          onCheckedChange={() => onToggle(objectiveId, member.id)}
        />
        <Avatar className="size-6" size="sm">
          <AvatarFallback className={cn("text-[10px] font-bold", member.avatarColor)}>
            {member.avatarInitials}
          </AvatarFallback>
        </Avatar>
        <button
          aria-label={t("openPlayer", { username: member.username })}
          className="min-w-0 truncate text-left text-xs font-semibold text-text-primary hover:text-cn-cyan"
          onClick={() => onPlayerNameClick(member.id)}
          type="button"
        >
          {member.username}
        </button>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-[10px] text-text-muted">
            {formatPower(member.totalSquadPower, locale)}
          </span>
          <span
            className={cn(
              "rounded border border-border-default bg-base px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary",
              load >= 3 && "border-cn-warning/40 text-cn-warning",
            )}
          >
            {t("playerLoad", { count: load })}
          </span>
        </div>
      </div>
    );
  };

  const isEmpty = !assignedMembers.length && !unassignedMembers.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Input
          aria-label={t("searchPlayers")}
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlayers")}
          type="search"
          value={search}
        />
        <select
          className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary outline-none focus:border-border-active"
          onChange={(event) => setSort(event.target.value as "power" | "name")}
          value={sort}
        >
          <option value="power">{t("squadPower")}</option>
          <option value="name">{t("username")}</option>
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isEmpty ? (
          <p className="rounded-md border border-border-dim bg-base px-3 py-4 text-xs text-text-muted">
            {members.length ? t("noPlayers") : t("noActiveMembers")}
          </p>
        ) : (
          <>
            {assignedMembers.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-surface px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-cn-cyan">
                  {t("assigned")} · {assignedMembers.length}
                </div>
                <div className="space-y-1">
                  {assignedMembers.map(renderMember)}
                </div>
              </div>
            )}
            {unassignedMembers.length > 0 && (
              <div className={assignedMembers.length > 0 ? "mt-2" : ""}>
                <div className="sticky top-0 z-10 bg-surface px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("unassigned")} · {unassignedMembers.length}
                </div>
                <div className="space-y-1">
                  {unassignedMembers.map(renderMember)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
