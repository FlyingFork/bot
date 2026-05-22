"use client";

import { Check, Copy, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateReservoirRaidOutput } from "@/lib/generate-output";
import { cn } from "@/lib/utils";
import type {
  ExportFormat,
  ExportLocale,
  ObjectiveMember,
  ReservoirRaidAssignmentRow,
} from "@/types/objectives";

const formats: ExportFormat[] = ["discord", "plaintext", "per-player", "table"];
const exportLocales: ExportLocale[] = ["en", "tr", "ru"];

export function ExportModal({
  assignments,
  members,
}: {
  assignments: ReservoirRaidAssignmentRow[];
  members: ObjectiveMember[];
}) {
  const t = useTranslations("objectives.export");
  const commonT = useTranslations("common");
  const locale = useLocale() as ExportLocale;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("discord");
  const [outputLocale, setOutputLocale] = useState<ExportLocale>(locale);
  const preview = useMemo(
    () =>
      generateReservoirRaidOutput({
        assignments,
        format,
        locale: outputLocale,
        members,
      }),
    [assignments, format, members, outputLocale],
  );

  async function copyPreview() {
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">
        <Download />
        {t("button")}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="border-b border-border-dim">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>{t("description")}</DialogDescription>
              </div>
              <DialogClose className="text-xs text-text-secondary hover:text-text-primary">
                {commonT("close")}
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="grid gap-4 p-4">
            <div className="grid gap-2">
              <p className="text-[11px] font-bold uppercase text-text-muted">{t("format")}</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {formats.map((value) => (
                  <button
                    className={cn(
                      "rounded-md border border-border-default bg-base px-2 py-2 text-left text-xs font-semibold text-text-secondary hover:border-border-active hover:text-text-primary",
                      format === value && "border-border-active bg-cn-cyan-dim text-cn-cyan",
                    )}
                    key={value}
                    onClick={() => setFormat(value)}
                    type="button"
                  >
                    {t(value === "per-player" ? "perPlayer" : value)}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-[11px] font-bold uppercase text-text-muted">
              {t("language")}
              <select
                className="h-8 rounded border border-border-default bg-raised px-2 text-xs font-normal text-text-primary outline-none focus:border-border-active"
                onChange={(event) => setOutputLocale(event.target.value as ExportLocale)}
                value={outputLocale}
              >
                {exportLocales.map((value) => (
                  <option key={value} value={value}>
                    {t(value === "en" ? "english" : value === "tr" ? "turkish" : "russian")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase text-text-muted">
              {t("preview")}
              <textarea
                className="min-h-52 w-full resize-y rounded-md border border-border-default bg-base p-3 font-mono text-[11px] font-normal leading-5 text-text-primary outline-none focus:border-border-active"
                readOnly
                value={assignments.length ? preview : `${preview}\n\n${t("empty")}`}
              />
            </label>
            <div className="flex justify-end">
              <Button onClick={copyPreview}>
                {copied ? <Check /> : <Copy />}
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
