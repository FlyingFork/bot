"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, ArrowDown, ArrowUp, Ban, CheckCircle2, ChevronsUpDown, Edit, Plus, RotateCcw, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/phase4/ExportButton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPower, formatPowerFull } from "@/lib/power";
import type { MemberSummary } from "./types";
import { formatDate, RANKS, STATUSES, statusBadge, toDateInput } from "./Phase2Utils";

type SortKey = "username" | "rank" | "status" | "linked" | "tempAway" | "power" | "joinedAt";
type MemberForm = {
  id?: string;
  username: string;
  currentRank: string;
  joinedAt: string;
  isTempAway: boolean;
  tempAwayAllianceTag: string;
};
type AvailableUser = { id: string; name: string; username: string | null; platformStatus: string; role: string | null };

function powerLabel(power: string | null, none: string) {
  if (!power) return none;
  return formatPower(BigInt(power));
}

function powerSort(power: string | null) {
  return power ? Number(power) : 0;
}

function emptyForm(): MemberForm {
  return { username: "", currentRank: "R1", joinedAt: "", isTempAway: false, tempAwayAllianceTag: "" };
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />;
}

export function MembersTable({
  members,
  admin = false,
}: {
  members: MemberSummary[];
  admin?: boolean;
}) {
  const t = useTranslations("phase2.members");
  const common = useTranslations("phase2.common");
  const statusT = useTranslations("phase2.status");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rank, setRank] = useState("ALL");
  const [linked, setLinked] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MemberForm>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<MemberSummary | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const filtered = useMemo(() => {
    const rows = members.filter((member) => {
      const text = `${member.username} ${member.user?.username ?? ""} ${member.user?.name ?? ""}`.toLowerCase();
      if (query && !text.includes(query.toLowerCase())) return false;
      if (status !== "ALL" && member.memberStatus !== status) return false;
      if (rank !== "ALL" && member.currentRank !== rank) return false;
      if (linked === "LINKED" && !member.user) return false;
      if (linked === "UNLINKED" && member.user) return false;
      return true;
    });

    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const value = (member: MemberSummary) => {
        if (sortKey === "rank") return member.currentRank ?? "";
        if (sortKey === "status") return member.memberStatus;
        if (sortKey === "linked") return member.user ? "1" : "0";
        if (sortKey === "tempAway") return member.isTempAway ? "1" : "0";
        if (sortKey === "power") return powerSort(member.currentPower);
        if (sortKey === "joinedAt") return member.joinedAt ? new Date(member.joinedAt).getTime() : 0;
        return member.username.toLowerCase();
      };
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return rows;
  }, [members, query, rank, sortDir, sortKey, status, linked]);

  function sort(label: SortKey) {
    if (sortKey === label) {
      setSortDir((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(label);
    setSortDir("asc");
  }

  function openCreate() {
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(member: MemberSummary) {
    setForm({
      id: member.id,
      username: member.username,
      currentRank: member.currentRank ?? "R1",
      joinedAt: toDateInput(member.joinedAt),
      isTempAway: member.isTempAway,
      tempAwayAllianceTag: member.tempAwayAllianceTag ?? "",
    });
    setFormOpen(true);
  }

  async function saveMember() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        form.id ? `/api/admin/members/${form.id}` : "/api/admin/members",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (!response.ok) throw new Error(t("saveError"));
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function postAction(member: MemberSummary, action: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/members/${member.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) throw new Error(common("actionFailed"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : common("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function archive(member: MemberSummary) {
    const ok = window.confirm(t("archiveConfirm"));
    if (ok) await postAction(member, "archive");
  }

  async function openLinkUser(member: MemberSummary) {
    setLinkTarget(member);
    setUserSearch("");
    setSelectedUserId("");
    setError(null);
    try {
      const response = await fetch("/api/admin/users?available=true");
      const data = (await response.json()) as { users: AvailableUser[] };
      setAvailableUsers(data.users ?? []);
    } catch {
      setAvailableUsers([]);
    }
  }

  async function confirmLinkUser() {
    if (!linkTarget || !selectedUserId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/members/${linkTarget.id}/assign-user`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? t("linkError"));
      }
      setLinkTarget(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("linkError"));
    } finally {
      setBusy(false);
    }
  }

  async function unlinkUser(member: MemberSummary) {
    const ok = window.confirm(t("unlinkConfirm"));
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/members/${member.id}/unassign-user`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) throw new Error(t("unlinkError"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unlinkError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleTempAway(member: MemberSummary) {
    if (member.isTempAway) {
      await postAction(member, "toggle-temp-away", { enabled: false });
      return;
    }
    const tag = window.prompt(t("tempAwayPrompt"));
    if (tag === null) return;
    await postAction(member, "toggle-temp-away", {
      enabled: true,
      tempAwayAllianceTag: tag,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface p-3 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-text-secondary">
          {common("search")}
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("status")}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="ALL">{t("allStatuses")}</option>
            {STATUSES.map((item) => <option key={item} value={item}>{statusT(item)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("rank")}
          <select value={rank} onChange={(event) => setRank(event.target.value)} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="ALL">{t("allRanks")}</option>
            {RANKS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t("linkedAccountSection")}
          <select value={linked} onChange={(event) => setLinked(event.target.value)} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="ALL">{t("allAccounts")}</option>
            <option value="LINKED">{t("linked")}</option>
            <option value="UNLINKED">{t("unlinked")}</option>
          </select>
        </label>
        {admin && (
          <Button onClick={openCreate}>
            <Plus />
            {t("createMember")}
          </Button>
        )}
        <ExportButton baseUrl="/api/export?type=member-list" />
      </div>

      {error && <p className="text-sm text-cn-danger">{error}</p>}

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{t("noMatches")}</p>
        ) : (
          filtered.map((member) => (
            <div key={member.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/members/${member.id}`} className="font-semibold text-sm text-cn-cyan hover:underline">
                  {member.username}
                </Link>
                <div className="flex items-center gap-1.5 shrink-0">
                  {member.currentRank && <span className="text-xs text-text-muted">{member.currentRank}</span>}
                  {statusBadge(member.memberStatus, undefined, statusT(member.memberStatus))}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                <span>{t("power")}: {powerLabel(member.currentPower, common("none"))}</span>
                <span>{t("joined")}: {formatDate(member.joinedAt)}</span>
                {member.user && <span>{t("linkedAccount")}: {member.user.username ?? member.user.name}</span>}
                {member.isTempAway && <span>{t("tempAway")}: {member.tempAwayAllianceTag ?? t("tagMissing")}</span>}
              </div>
              <div className="flex gap-1">
                <Button size="icon-xs" variant="ghost" title={t("toggleTempAway")} onClick={() => toggleTempAway(member)} disabled={busy}>
                  <RotateCcw />
                </Button>
                {admin && (
                  <>
                    <Button size="icon-xs" variant="ghost" title={t("edit")} onClick={() => openEdit(member)} disabled={busy}>
                      <Edit />
                    </Button>
                    {member.user ? (
                      <>
                        {member.user.platformStatus === "SUSPENDED" ? (
                          <Button size="icon-xs" variant="ghost" title={t("unsuspendAccount")} onClick={() => postAction(member, "unsuspend")} disabled={busy}>
                            <CheckCircle2 />
                          </Button>
                        ) : (
                          <Button size="icon-xs" variant="destructive" title={t("suspendAccount")} onClick={() => postAction(member, "suspend")} disabled={busy}>
                            <Ban />
                          </Button>
                        )}
                        <Button size="icon-xs" variant="destructive" title={t("unlinkUser")} onClick={() => unlinkUser(member)} disabled={busy}>
                          <UserX />
                        </Button>
                      </>
                    ) : (
                      <Button size="icon-xs" variant="ghost" title={t("linkUser")} onClick={() => openLinkUser(member)} disabled={busy}>
                        <UserCheck />
                      </Button>
                    )}
                    <Button size="icon-xs" variant="destructive" title={t("archive")} onClick={() => archive(member)} disabled={busy}>
                      <Archive />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border border-border-subtle bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><button onClick={() => sort("username")} className="flex items-center gap-1">{t("ingameName")}<SortIcon active={sortKey === "username"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("rank")} className="flex items-center gap-1">{t("rank")}<SortIcon active={sortKey === "rank"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("status")} className="flex items-center gap-1">{t("status")}<SortIcon active={sortKey === "status"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("linked")} className="flex items-center gap-1">{t("linkedAccount")}<SortIcon active={sortKey === "linked"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("tempAway")} className="flex items-center gap-1">{t("tempAway")}<SortIcon active={sortKey === "tempAway"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("power")} className="flex items-center gap-1">{t("power")}<SortIcon active={sortKey === "power"} dir={sortDir} /></button></TableHead>
              <TableHead><button onClick={() => sort("joinedAt")} className="flex items-center gap-1">{t("joined")}<SortIcon active={sortKey === "joinedAt"} dir={sortDir} /></button></TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium text-text-primary">
                  <Link href={`/members/${member.id}`} className="text-cn-cyan hover:underline">
                    {member.username}
                  </Link>
                </TableCell>
                <TableCell>{member.currentRank ?? common("none")}</TableCell>
                <TableCell>{statusBadge(member.memberStatus, undefined, statusT(member.memberStatus))}</TableCell>
                <TableCell>{member.user ? (member.user.username ?? member.user.name) : common("no")}</TableCell>
                <TableCell>
                  {member.isTempAway ? `${common("yes")} (${member.tempAwayAllianceTag ?? t("tagMissing")})` : common("no")}
                </TableCell>
                <TableCell title={member.currentPower ? formatPowerFull(BigInt(member.currentPower)) : undefined}>
                  {powerLabel(member.currentPower, common("none"))}
                </TableCell>
                <TableCell>{formatDate(member.joinedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon-xs" variant="ghost" title={t("toggleTempAway")} onClick={() => toggleTempAway(member)} disabled={busy}>
                      <RotateCcw />
                    </Button>
                    {admin && (
                      <>
                        <Button size="icon-xs" variant="ghost" title={t("edit")} onClick={() => openEdit(member)} disabled={busy}>
                          <Edit />
                        </Button>
                        {member.user ? (
                          <>
                            {member.user.platformStatus === "SUSPENDED" ? (
                              <Button size="icon-xs" variant="ghost" title={t("unsuspendAccount")} onClick={() => postAction(member, "unsuspend")} disabled={busy}>
                                <CheckCircle2 />
                              </Button>
                            ) : (
                              <Button size="icon-xs" variant="destructive" title={t("suspendAccount")} onClick={() => postAction(member, "suspend")} disabled={busy}>
                                <Ban />
                              </Button>
                            )}
                            <Button size="icon-xs" variant="destructive" title={t("unlinkUser")} onClick={() => unlinkUser(member)} disabled={busy}>
                              <UserX />
                            </Button>
                          </>
                        ) : (
                          <Button size="icon-xs" variant="ghost" title={t("linkUser")} onClick={() => openLinkUser(member)} disabled={busy}>
                            <UserCheck />
                          </Button>
                        )}
                        <Button size="icon-xs" variant="destructive" title={t("archive")} onClick={() => archive(member)} disabled={busy}>
                          <Archive />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-text-muted">
                  {t("noMatches")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!linkTarget} onOpenChange={(open) => { if (!open) setLinkTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("linkUserTitle")}</DialogTitle>
            <DialogDescription>{t("linkUserDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-2">
            <Input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder={t("searchUsers")}
            />
            <div className="max-h-48 overflow-y-auto rounded-md border border-border-default">
              {availableUsers.filter((user) => {
                const text = `${user.name} ${user.username ?? ""}`.toLowerCase();
                return !userSearch || text.includes(userSearch.toLowerCase());
              }).length === 0 ? (
                <p className="p-3 text-xs text-text-muted">{t("noAvailableUsers")}</p>
              ) : (
                availableUsers
                  .filter((user) => {
                    const text = `${user.name} ${user.username ?? ""}`.toLowerCase();
                    return !userSearch || text.includes(userSearch.toLowerCase());
                  })
                  .map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-raised ${selectedUserId === user.id ? "bg-raised font-semibold text-text-primary" : "text-text-secondary"}`}
                    >
                      {user.username ?? user.name}
                      {user.username && user.name !== user.username && <span className="ml-1 text-text-muted">({user.name})</span>}
                    </button>
                  ))
              )}
            </div>
            {error && <p className="text-xs text-cn-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTarget(null)}>{common("cancel")}</Button>
            <Button onClick={confirmLinkUser} disabled={busy || !selectedUserId}>{busy ? common("saving") : t("linkUser")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{t("formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-2">
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("ingameName")}
              <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("rank")}
              <select value={form.currentRank} onChange={(event) => setForm({ ...form, currentRank: event.target.value })} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
                {RANKS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("joinedAt")}
              <Input type="date" value={form.joinedAt} onChange={(event) => setForm({ ...form, joinedAt: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <input
                type="checkbox"
                checked={form.isTempAway}
                onChange={(event) => setForm({ ...form, isTempAway: event.target.checked })}
              />
              {t("tempAway")}
            </label>
            {form.isTempAway && (
              <label className="space-y-1 text-xs font-medium text-text-secondary">
                {t("tempAwayPrompt")}
                <Input value={form.tempAwayAllianceTag} onChange={(event) => setForm({ ...form, tempAwayAllianceTag: event.target.value })} />
              </label>
            )}
            {error && <p className="text-xs text-cn-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{common("cancel")}</Button>
            <Button onClick={saveMember} disabled={busy}>{busy ? common("saving") : common("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
