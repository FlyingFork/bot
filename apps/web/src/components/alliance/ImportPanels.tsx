"use client";

import { Check, Copy, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import {
  applyEventImport,
  applyRosterImport,
  previewEventImport,
  previewRosterImport,
  type EventPreview,
  type RosterPreview,
  type UiMessage,
} from "@/app/dashboard/alliance-actions";
import { Button } from "@/components/ui/button";
import { DataCard } from "@/components/ui/data-card";
import { formatPower } from "@/lib/alliance-format";

function PromptBlock({ prompt }: { prompt: string }) {
  const t = useTranslations("alliance.imports");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {t("prompt")}
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-raised"
          style={{ color: copied ? "var(--color-cn-success)" : "var(--color-text-muted)" }}
        >
          {copied ? <Check key="check" size={11} /> : <Copy key="copy" size={11} />}
          <span>{copied ? t("copied") : t("copy")}</span>
        </button>
      </div>
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border-dim bg-base p-3 text-[11px] leading-4 text-text-secondary">
        {prompt}
      </pre>
    </div>
  );
}

function JsonTextarea({
  payload,
  setPayload,
}: {
  payload: string;
  setPayload: (value: string) => void;
}) {
  const t = useTranslations("alliance.imports");

  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {t("pasteJson")}
      </span>
      <textarea
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        spellCheck={false}
        className="min-h-56 w-full rounded-md border border-border-default bg-raised p-3 font-mono text-xs leading-5 text-text-primary outline-none placeholder:text-text-muted focus:border-border-active focus:ring-2 focus:ring-cn-cyan/15"
        placeholder='{ "members": [] }'
      />
    </label>
  );
}

function InvalidRows({
  rows,
}: {
  rows: { row: number; messages: UiMessage[] }[];
}) {
  const t = useTranslations("alliance");

  if (!rows.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-cn-danger/35 bg-cn-danger/10 p-3">
      <p className="text-xs font-semibold text-cn-danger">{t("imports.invalidRows")}</p>
      <div className="mt-2 space-y-1 text-[11px] text-text-secondary">
        {rows.map((row) => (
          <p key={row.row}>
            {t("imports.invalidRow", { row: row.row })}{" "}
            {row.messages.map((item) => t(item.key, item.values)).join(" ")}
          </p>
        ))}
      </div>
    </div>
  );
}

export function RosterImportPanel({ prompt }: { prompt: string }) {
  const locale = useLocale();
  const t = useTranslations("alliance");
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState("");
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [archiveOmitted, setArchiveOmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<UiMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen((value) => !value)}>
        <Upload />
        {t("imports.updateList")}
      </Button>
      {open && (
        <DataCard
          title={t("imports.rosterTitle")}
          description={t("imports.rosterDescription")}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <PromptBlock prompt={prompt} />
            <JsonTextarea payload={payload} setPayload={setPayload} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={isPending || !payload.trim()}
              onClick={() =>
                startTransition(async () => {
                  setStatusMessage(null);
                  setPreview(await previewRosterImport(payload));
                })
              }
            >
              {isPending ? t("imports.working") : t("imports.previewUpdate")}
            </Button>
            {preview && !preview.error && !preview.invalidRows.length && (
              <Button
                disabled={isPending || !preview.rows.length}
                onClick={() =>
                  startTransition(async () => {
                    const result = await applyRosterImport(payload, archiveOmitted);
                    setStatusMessage(result.message ?? null);
                    if (result.success) {
                      setPreview(null);
                      setPayload("");
                    }
                  })
                }
              >
                {t("imports.applyRoster")}
              </Button>
            )}
            {statusMessage && (
              <p className="text-xs text-text-secondary">
                {t(statusMessage.key, statusMessage.values)}
              </p>
            )}
          </div>
          {preview && (
            <div className="mt-4 space-y-3">
              {preview.error && (
                <p className="rounded-md border border-cn-danger/35 bg-cn-danger/10 p-3 text-xs text-cn-danger">
                  {t(preview.error.key, preview.error.values)}
                </p>
              )}
              <InvalidRows rows={preview.invalidRows} />
              {!preview.error && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-md border border-border-dim bg-base p-3">
                    <p className="text-xs font-semibold text-text-primary">
                      {t("imports.validRosterRows", { count: preview.rows.length })}
                    </p>
                    <div className="mt-2 max-h-48 space-y-1 overflow-auto text-[11px] text-text-secondary">
                      {preview.rows.map((row) => (
                        <p key={row.username}>
                          {row.username} - {t(`imports.rosterStatus.${row.status}`)} -{" "}
                          {row.rank} - {formatPower(row.power, locale)}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border-dim bg-base p-3">
                    <p className="text-xs font-semibold text-text-primary">
                      {t("imports.omittedMembers", {
                        count: preview.omittedMembers.length,
                      })}
                    </p>
                    <label className="mt-2 flex items-start gap-2 text-[11px] text-text-secondary">
                      <input
                        type="checkbox"
                        checked={archiveOmitted}
                        onChange={(event) => setArchiveOmitted(event.target.checked)}
                        className="mt-0.5 accent-[#00D2FF]"
                      />
                      {t("imports.archiveOmitted")}
                    </label>
                    <div className="mt-2 max-h-32 space-y-1 overflow-auto text-[11px] text-text-muted">
                      {preview.omittedMembers.map((member) => (
                        <p key={member.id}>{member.username}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DataCard>
      )}
    </div>
  );
}

export function EventImportPanel({
  eventType,
  prompt,
}: {
  eventType: "ALLIANCE_SIEGE" | "EXPLORATION";
  prompt: string;
}) {
  const locale = useLocale();
  const t = useTranslations("alliance");
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState("");
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<UiMessage | null>(null);
  const [isPending, startTransition] = useTransition();
  const unmatched = useMemo(
    () => preview?.rows.filter((row) => row.status === "unmatched") ?? [],
    [preview],
  );
  const allUnmatchedAccepted =
    unmatched.length > 0 &&
    unmatched.every((row) => accepted.includes(row.username));

  function toggleAccepted(username: string) {
    setAccepted((current) =>
      current.includes(username)
        ? current.filter((value) => value !== username)
        : [...current, username],
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen((value) => !value)}>
        <Upload />
        {t("imports.uploadEvent")}
      </Button>
      {open && (
        <DataCard
          title={t("imports.eventTitle")}
          description={t("imports.eventDescription")}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <PromptBlock prompt={prompt} />
            <JsonTextarea payload={payload} setPayload={setPayload} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={isPending || !payload.trim()}
              onClick={() =>
                startTransition(async () => {
                  setStatusMessage(null);
                  const result = await previewEventImport(eventType, payload);
                  setPreview(result);
                  setAccepted([]);
                })
              }
            >
              {isPending ? t("imports.working") : t("imports.previewEvent")}
            </Button>
            {preview && !preview.error && !preview.invalidRows.length && (
              <Button
                disabled={isPending || !preview.rows.length}
                onClick={() =>
                  startTransition(async () => {
                    const result = await applyEventImport(eventType, payload, accepted);

                    if (result.pending) {
                      toast.info(t("pendingApproval"));
                      setPreview(null);
                      setPayload("");
                      setAccepted([]);
                      return;
                    }

                    setStatusMessage(result.message ?? null);
                    if (result.success) {
                      setPreview(null);
                      setPayload("");
                      setAccepted([]);
                    }
                  })
                }
              >
                {t("imports.applyEvent")}
              </Button>
            )}
            {statusMessage && (
              <p className="text-xs text-text-secondary">
                {t(statusMessage.key, statusMessage.values)}
              </p>
            )}
          </div>
          {preview && (
            <div className="mt-4 space-y-3">
              {preview.error && (
                <p className="rounded-md border border-cn-danger/35 bg-cn-danger/10 p-3 text-xs text-cn-danger">
                  {t(preview.error.key, preview.error.values)}
                </p>
              )}
              <InvalidRows rows={preview.invalidRows} />
              {!preview.error && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-md border border-border-dim bg-base p-3">
                    <p className="text-xs font-semibold text-text-primary">
                      {t("imports.matchedRows")}
                    </p>
                    <div className="mt-2 max-h-48 space-y-1 overflow-auto text-[11px] text-text-secondary">
                      {preview.rows
                        .filter((row) => row.status === "matched")
                        .map((row) => (
                          <p key={row.username}>
                            {row.username} - {formatPower(row.power, locale)}
                          </p>
                        ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-cn-warning/25 bg-cn-warning/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text-primary">
                        {t("imports.unmatchedRows", { count: unmatched.length })}
                      </p>
                      {unmatched.length > 0 && (
                        <div className="flex gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              setAccepted(
                                allUnmatchedAccepted
                                  ? []
                                  : unmatched.map((row) => row.username),
                              )
                            }
                          >
                            {allUnmatchedAccepted
                              ? t("imports.rejectAll")
                              : t("imports.acceptAll")}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 max-h-48 space-y-2 overflow-auto text-[11px] text-text-secondary">
                      {unmatched.map((row) => (
                        <label key={row.username} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={accepted.includes(row.username)}
                            onChange={() => toggleAccepted(row.username)}
                            className="mt-0.5 accent-[#00D2FF]"
                          />
                          <span>
                            {row.username} - {formatPower(row.power, locale)}
                            <span className="block text-text-muted">
                              {t("imports.acceptMember")}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DataCard>
      )}
    </div>
  );
}
