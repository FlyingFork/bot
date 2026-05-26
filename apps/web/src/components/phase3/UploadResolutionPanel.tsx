"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  RosterAbsentResolution,
  RowResolution,
  UploadOutlier,
  UploadResolutionData,
} from "@/lib/uploads";

type MemberOption = { id: string; username: string };

function selectClass() {
  return "h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary";
}

function rowActionValue(action?: RowResolution) {
  return action?.action ?? "";
}

function resolutionMemberId(action?: RowResolution) {
  return action?.action === "assign" || action?.action === "renameMember" ? action.memberId : "";
}

function resolutionName(action?: RowResolution) {
  return action?.action === "editRow" || action?.action === "renameMember" ? action.name : "";
}

export function UploadResolutionPanel({
  id,
  outliers,
  resolutionData,
  members,
}: {
  id: string;
  outliers: UploadOutlier[];
  resolutionData: UploadResolutionData;
  members: MemberOption[];
}) {
  const t = useTranslations("phase3.resolutions");
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowResolution>>(resolutionData.rows ?? {});
  const [absentMembers, setAbsentMembers] = useState<Record<string, RosterAbsentResolution>>(resolutionData.absentMembers ?? {});
  const [memberQuery, setMemberQuery] = useState("");
  const [rowMemberQueries, setRowMemberQueries] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const unresolved = outliers.filter((item) => item.blocking).length;
  if (outliers.length === 0) return null;

  function updateRow(row: number, action: RowResolution) {
    setRows((current) => ({ ...current, [String(row)]: action }));
  }

  function membersForRow(row: number, current?: RowResolution) {
    const query = (rowMemberQueries[String(row)] ?? memberQuery).trim().toLowerCase();
    const selectedMemberId = resolutionMemberId(current);
    const filtered = query
      ? members.filter((member) => member.username.toLowerCase().includes(query)).slice(0, 80)
      : members.slice(0, 80);
    if (selectedMemberId && !filtered.some((member) => member.id === selectedMemberId)) {
      const selected = members.find((member) => member.id === selectedMemberId);
      if (selected) return [selected, ...filtered];
    }
    return filtered;
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/upload-requests/${id}/resolutions`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolutionData: { rows, absentMembers } }),
      });
      if (!response.ok) {
        setMessage(t("saveError"));
        return;
      }
      setMessage(t("saved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-border-subtle bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-text-primary">{t("title")}</h2>
          <p className="text-xs text-text-muted">{t("summary", { unresolved, total: outliers.length })}</p>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save />
          {t("save")}
        </Button>
      </div>
      {message && <p className="text-sm text-text-secondary">{message}</p>}

      <Input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder={t("memberSearch")} />

      <div className="grid gap-3">
        {outliers.map((outlier) => {
          if (outlier.type === "absentMember" && outlier.memberId) {
            const value = absentMembers[outlier.memberId] ?? "";
            return (
              <div key={outlier.id} className="grid gap-2 rounded-md border border-border-dim bg-raised p-3 md:grid-cols-[1fr_220px] md:items-center">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{outlier.playerName}</p>
                  <p className="text-xs text-text-muted">{t("types.absentMember")}</p>
                </div>
                <select
                  className={selectClass()}
                  value={value}
                  onChange={(event) => setAbsentMembers((current) => ({ ...current, [outlier.memberId!]: event.target.value as RosterAbsentResolution }))}
                >
                  <option value="">{t("choose")}</option>
                  <option value="keep">{t("absent.keep")}</option>
                  <option value="inactive">{t("absent.inactive")}</option>
                  <option value="transferred">{t("absent.transferred")}</option>
                </select>
              </div>
            );
          }

          const row = outlier.row ?? 0;
          const current = rows[String(row)];
          const action = rowActionValue(current);
          const rowMembers = membersForRow(row, current);
          return (
            <div key={outlier.id} className="space-y-2 rounded-md border border-border-dim bg-raised p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{outlier.playerName}</p>
                  <p className="text-xs text-text-muted">{t("rowLabel", { row })} · {t(`types.${outlier.type}`)}</p>
                </div>
                <span className={outlier.blocking ? "text-xs text-cn-warning" : "text-xs text-cn-success"}>
                  {outlier.blocking ? t("blocking") : t("resolved")}
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className={selectClass()}
                  value={action}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "remove") updateRow(row, { action: "remove" });
                    else if (next === "createPartial") updateRow(row, { action: "createPartial" });
                    else if (next === "editRow") updateRow(row, { action: "editRow", name: outlier.playerName });
                    else if (next === "assign") updateRow(row, { action: "assign", memberId: rowMembers[0]?.id ?? "" });
                    else if (next === "renameMember") updateRow(row, { action: "renameMember", memberId: rowMembers[0]?.id ?? "", name: outlier.playerName });
                  }}
                >
                  <option value="">{t("choose")}</option>
                  <option value="assign">{t("actions.assign")}</option>
                  <option value="renameMember">{t("actions.renameMember")}</option>
                  <option value="editRow">{t("actions.editRow")}</option>
                  <option value="createPartial">{t("actions.createPartial")}</option>
                  <option value="remove">{t("actions.remove")}</option>
                </select>

                {(action === "assign" || action === "renameMember") && (
                  <div className="grid gap-2">
                    <Input
                      value={rowMemberQueries[String(row)] ?? ""}
                      onChange={(event) => setRowMemberQueries((currentQueries) => ({ ...currentQueries, [String(row)]: event.target.value }))}
                      placeholder={t("memberSearch")}
                    />
                    <select
                      className={selectClass()}
                      value={resolutionMemberId(current)}
                      onChange={(event) => {
                        if (action === "assign") updateRow(row, { action: "assign", memberId: event.target.value });
                        else updateRow(row, { action: "renameMember", memberId: event.target.value, name: resolutionName(current) || outlier.playerName });
                      }}
                    >
                      <option value="">{t("member")}</option>
                      {rowMembers.map((member) => <option key={member.id} value={member.id}>{member.username}</option>)}
                    </select>
                  </div>
                )}

                {(action === "editRow" || action === "renameMember") && (
                  <Input
                    value={resolutionName(current)}
                    onChange={(event) => {
                      if (action === "editRow") updateRow(row, { action: "editRow", name: event.target.value });
                      else updateRow(row, { action: "renameMember", memberId: resolutionMemberId(current), name: event.target.value });
                    }}
                    placeholder={t("name")}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
