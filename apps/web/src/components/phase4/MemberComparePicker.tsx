"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { formatPower, formatPowerFull } from "@/lib/power";

export type CompareMemberOption = {
  id: string;
  username: string;
  currentPower: string | null;
};

function powerValue(value: string | null) {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function comparePowerDistance(a: CompareMemberOption, b: CompareMemberOption, currentPower: bigint | null) {
  const aPower = powerValue(a.currentPower);
  const bPower = powerValue(b.currentPower);
  if (currentPower === null) {
    if (aPower !== null && bPower === null) return -1;
    if (aPower === null && bPower !== null) return 1;
    return a.username.localeCompare(b.username);
  }
  if (aPower === null && bPower === null) return a.username.localeCompare(b.username);
  if (aPower === null) return 1;
  if (bPower === null) return -1;
  const aDistance = aPower > currentPower ? aPower - currentPower : currentPower - aPower;
  const bDistance = bPower > currentPower ? bPower - currentPower : currentPower - bPower;
  if (aDistance < bDistance) return -1;
  if (aDistance > bDistance) return 1;
  return a.username.localeCompare(b.username);
}

function powerLabel(power: string | null, none: string) {
  if (!power) return none;
  return formatPower(BigInt(power));
}

function MemberLink({
  currentMemberId,
  option,
  noneLabel,
}: {
  currentMemberId: string;
  option: CompareMemberOption;
  noneLabel: string;
}) {
  return (
    <Link
      href={`/members/${currentMemberId}?compare=${option.id}`}
      className="flex min-w-0 items-center justify-between gap-3 rounded-[4px] border border-border-default bg-raised px-3 py-2 text-left hover:border-cn-cyan/70 hover:bg-surface-2"
    >
      <span className="min-w-0 truncate text-sm font-semibold text-text-primary">{option.username}</span>
      <span
        className="shrink-0 text-xs text-text-muted"
        title={option.currentPower ? formatPowerFull(BigInt(option.currentPower)) : undefined}
      >
        {powerLabel(option.currentPower, noneLabel)}
      </span>
    </Link>
  );
}

export function MemberComparePicker({
  currentMemberId,
  currentPower,
  selectedCompareId,
  options,
}: {
  currentMemberId: string;
  currentPower: string | null;
  selectedCompareId?: string | null;
  options: CompareMemberOption[];
}) {
  const t = useTranslations("phase4.memberProfile");
  const common = useTranslations("phase2.common");
  const [query, setQuery] = useState("");
  const currentPowerValue = powerValue(currentPower);

  const sortedByPower = useMemo(
    () => [...options].sort((a, b) => comparePowerDistance(a, b, currentPowerValue)),
    [currentPowerValue, options],
  );
  const suggestions = sortedByPower.slice(0, Math.min(5, sortedByPower.length));

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return options
      .filter((option) => option.username.toLowerCase().includes(normalized))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 8);
  }, [options, query]);

  const selected = options.find((option) => option.id === selectedCompareId);

  return (
    <section className="rounded-md border border-border-subtle bg-surface p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-text-primary">{t("compareWith")}</h2>
          {selected && (
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {t("selectedCompare", { member: selected.username })}
            </p>
          )}
        </div>
        {selectedCompareId && (
          <Link
            href={`/members/${currentMemberId}`}
            className="shrink-0 rounded-[4px] border border-border-default bg-raised px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
          >
            {t("clearCompare")}
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          <label className="text-xs font-medium text-text-secondary">
            {t("searchCompare")}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchComparePlaceholder")}
              className="mt-1"
            />
          </label>
          {query.trim() && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("searchResults")}</p>
              {searchResults.length > 0 ? (
                searchResults.map((option) => (
                  <MemberLink key={option.id} currentMemberId={currentMemberId} option={option} noneLabel={common("none")} />
                ))
              ) : (
                <p className="rounded-[4px] border border-border-dim bg-raised px-3 py-2 text-sm text-text-muted">
                  {t("noCompareMatches")}
                </p>
              )}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("similarPowerSuggestions")}</p>
            {suggestions.map((option) => (
              <MemberLink key={option.id} currentMemberId={currentMemberId} option={option} noneLabel={common("none")} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
