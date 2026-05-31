"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { OBJECTIVE_DEFINITIONS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";
import { formatPower } from "@/lib/power";

type Props = {
  planId: string;
  raidDate: string;
  startsAt: string;
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  defaultLang: ObjectiveLang;
};

const LANG_LABELS: Record<ObjectiveLang, string> = { en: "EN", ru: "RU", tr: "TR" };

function buildTxt(
  objectives: RaidObjectiveRow[],
  lang: ObjectiveLang,
): string {
  const assignable = objectives
    .filter((o) => o.isAssignable)
    .sort((a, b) => a.tier - b.tier || b.waterRate - a.waterRate);

  return assignable
    .map((obj) => {
      const name = getObjectiveName(obj.key, lang);
      const players = obj.assignments.map((a) => a.playerName).join(", ");
      return `${name}: ${players}`;
    })
    .join("\n\n");
}

function buildCsv(
  objectives: RaidObjectiveRow[],
  participants: RaidParticipantRow[],
  lang: ObjectiveLang,
): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const headers = ["Tier", "Objective", "Water Rate", "Player", "Squad Power", "Role"].map(esc).join(",");
  const rows: string[] = [headers];

  const assignable = objectives
    .filter((o) => o.isAssignable)
    .sort((a, b) => a.tier - b.tier || b.waterRate - a.waterRate);

  const assignedIds = new Set(assignable.flatMap((o) => o.assignments.map((a) => a.participantId)));

  for (const obj of assignable) {
    const name = getObjectiveName(obj.key, lang);
    if (obj.assignments.length === 0) {
      rows.push([esc(String(obj.tier)), esc(name), esc(`+${obj.waterRate}/min`), esc(""), esc(""), esc("")].join(","));
    } else {
      for (const a of obj.assignments) {
        const role = a.registrationStatus === "SELECTED_PARTICIPANT" ? "Participant" : "Reservist";
        rows.push([
          esc(String(obj.tier)),
          esc(name),
          esc(`+${obj.waterRate}/min`),
          esc(a.playerName),
          esc(formatPower(a.squad1Power)),
          esc(role),
        ].join(","));
      }
    }
  }

  // Unassigned
  const eligible = participants.filter(
    (p) => p.registrationStatus === "SELECTED_PARTICIPANT" || p.registrationStatus === "SELECTED_RESERVIST",
  );
  const unassigned = eligible.filter((p) => !assignedIds.has(p.id));
  for (const p of unassigned) {
    const squad1 = p.squadPowers.find((s) => s.squadIndex === 1)?.power ?? 0;
    const role = p.registrationStatus === "SELECTED_PARTICIPANT" ? "Participant" : "Reservist";
    rows.push([esc(""), esc("Unassigned"), esc(""), esc(p.username), esc(formatPower(squad1)), esc(role)].join(","));
  }

  return "﻿" + rows.join("\r\n");
}

export function ExportDialog({ planId, raidDate, startsAt, objectives, participants, defaultLang }: Props) {
  const t = useTranslations("phase6.reservoirRaid.objectives");
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ObjectiveLang>(defaultLang);
  const [format, setFormat] = useState<"txt" | "csv">("txt");

  function handleDownload() {
    const content =
      format === "txt"
        ? buildTxt(objectives, lang)
        : buildCsv(objectives, participants, lang);

    const mime = format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raid-plan-${planId}-${lang}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setLang(defaultLang); setOpen(true); }}>
        <Download className="h-3.5 w-3.5" />
        {t("exportPlan")}
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-void/60 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-lg border border-border-subtle bg-surface shadow-card p-4 space-y-4 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-start justify-between">
              <Dialog.Title className="text-sm font-semibold text-text-primary">{t("exportTitle")}</Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1.5">{t("exportLanguage")}</p>
                <div className="flex gap-1">
                  {(["en", "ru", "tr"] as ObjectiveLang[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className="px-3 py-1.5 text-xs font-semibold rounded border transition-colors"
                      style={{
                        borderColor: lang === l ? "var(--cn-brand, #4a90d9)" : "var(--border-default)",
                        backgroundColor: lang === l ? "rgba(74,144,217,0.12)" : "transparent",
                        color: lang === l ? "#4a90d9" : "var(--text-muted)",
                      }}
                    >
                      {LANG_LABELS[l]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-text-secondary mb-1.5">{t("exportFormat")}</p>
                <div className="flex gap-1">
                  {(["txt", "csv"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className="px-3 py-1.5 text-xs font-semibold rounded border uppercase transition-colors"
                      style={{
                        borderColor: format === f ? "var(--cn-brand, #4a90d9)" : "var(--border-default)",
                        backgroundColor: format === f ? "rgba(74,144,217,0.12)" : "transparent",
                        color: format === f ? "#4a90d9" : "var(--text-muted)",
                      }}
                    >
                      {f === "txt" ? t("exportTxt") : t("exportCsv")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button size="sm" className="w-full" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              {t("exportDownload")}
            </Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
