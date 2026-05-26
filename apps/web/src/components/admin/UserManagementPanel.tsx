"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, KeyRound, LogOut, Save, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROLES = ["admin", "r5", "r4", "r3", "r2", "r1"] as const;
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
const LANGUAGES = ["en", "ru", "tr"] as const;

export type ManagedUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string | null;
  platformStatus: string;
  language: string;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  allianceMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  allianceMember: { id: string; username: string } | null;
};

export type UserSessionSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AllianceMemberOption = {
  id: string;
  username: string;
  user: { id: string; username: string | null; name: string } | null;
};

export type UserAuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; username: string | null; name: string };
};

function formatDate(value: string | null | undefined, none: string) {
  if (!value) return none;
  return new Date(value).toLocaleString();
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warning";
  if (status === "SUSPENDED") return "destructive";
  return "secondary";
}

function roleLabel(role: string | null, none: string, admin: string) {
  if (!role) return none;
  return role === "admin" ? admin : role.toUpperCase();
}

export function UserManagementPanel({
  user,
  currentUserId,
  members,
  sessions,
  auditEntries,
  submittedCount,
  reviewedCount,
}: {
  user: ManagedUser;
  currentUserId: string;
  members: AllianceMemberOption[];
  sessions: UserSessionSummary[];
  auditEntries: UserAuditEntry[];
  submittedCount: number;
  reviewedCount: number;
}) {
  const t = useTranslations("phase2.users");
  const common = useTranslations("phase2.common");
  const rolesT = useTranslations("phase2.roles");
  const router = useRouter();
  const isSelf = user.id === currentUserId;
  const [form, setForm] = useState({
    name: user.name,
    username: user.username ?? "",
    email: user.email,
    role: user.role ?? "r1",
    platformStatus: user.platformStatus,
    language: user.language,
    allianceMemberId: user.allianceMemberId ?? "",
  });
  const [password, setPassword] = useState("");
  const [banReason, setBanReason] = useState(user.banReason ?? "");
  const [banExpiresAt, setBanExpiresAt] = useState(user.banExpires ? user.banExpires.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? common("actionFailed"));
      setMessage(t("saved"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : common("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveUser() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? t("saveError"));
      setMessage(t("saved"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function setNewPassword() {
    await post(`/api/admin/users/${user.id}/password`, { newPassword: password });
    setPassword("");
  }

  return (
    <div className="space-y-4">
      {(message || error) && (
        <div className={`rounded-md border p-3 text-sm ${error ? "border-danger/30 bg-danger-bg text-danger" : "border-success/25 bg-success-bg text-success"}`}>
          {error ?? message}
        </div>
      )}

      <section className="rounded-md border border-border-subtle bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(user.platformStatus)}>{user.platformStatus}</Badge>
          <Badge variant={user.banned ? "destructive" : "secondary"}>{user.banned ? t("banned") : t("notBanned")}</Badge>
          <Badge>{roleLabel(user.role, common("none"), rolesT("admin"))}</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label={t("created")} value={formatDate(user.createdAt, common("none"))} />
          <Info label={t("updated")} value={formatDate(user.updatedAt, common("none"))} />
          <Info label={t("lastSeen")} value={formatDate(user.lastSeenAt, t("neverSeen"))} />
          <Info label={t("sessions")} value={String(sessions.length)} />
          <Info label={t("submittedUploads")} value={String(submittedCount)} />
          <Info label={t("reviewedUploads")} value={String(reviewedCount)} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("linkedMember")}</p>
            {user.allianceMember ? (
              <Link href={`/members/${user.allianceMember.id}`} className="text-sm text-cn-cyan hover:underline">
                {user.allianceMember.username}
              </Link>
            ) : (
              <p className="text-sm text-text-muted">{common("notLinked")}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text">{t("accountDetails")}</h2>
          <p className="text-sm text-muted">{t("accountDetailsSubtitle")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("name")} value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Field label={t("username")} value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
          <Field label={t("email")} value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <label className="space-y-1 text-xs font-medium text-text-secondary">
            {t("language")}
            <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
              {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-text-secondary">
            {t("role")}
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary" disabled={isSelf}>
              {ROLES.map((item) => <option key={item} value={item}>{roleLabel(item, common("none"), rolesT("admin"))}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-text-secondary">
            {t("status")}
            <select value={form.platformStatus} onChange={(event) => setForm({ ...form, platformStatus: event.target.value })} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary" disabled={isSelf}>
              {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-text-secondary md:col-span-2">
            {t("linkedMember")}
            <select value={form.allianceMemberId} onChange={(event) => setForm({ ...form, allianceMemberId: event.target.value })} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
              <option value="">{common("notLinked")}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.username}{member.user && member.user.id !== user.id ? ` (${t("linkedTo", { name: member.user.username ?? member.user.name })})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isSelf && <p className="text-xs text-text-muted">{t("selfGuard")}</p>}
        <Button onClick={saveUser} disabled={busy}>
          <Save />
          {busy ? common("saving") : common("save")}
        </Button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-text">{t("password")}</h2>
            <p className="text-sm text-muted">{t("passwordSubtitle")}</p>
          </div>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("newPassword")} />
          <Button onClick={setNewPassword} disabled={busy || password.length < 8}>
            <KeyRound />
            {t("setPassword")}
          </Button>
        </div>

        <div className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-text">{t("banControls")}</h2>
            <p className="text-sm text-muted">{t("banControlsSubtitle")}</p>
          </div>
          <Input value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder={t("banReason")} />
          <Input type="date" value={banExpiresAt} onChange={(event) => setBanExpiresAt(event.target.value)} />
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => post(`/api/admin/users/${user.id}/ban`, { banReason, banExpiresAt })} disabled={busy || isSelf}>
              <Ban />
              {t("banUser")}
            </Button>
            <Button variant="outline" onClick={() => post(`/api/admin/users/${user.id}/unban`)} disabled={busy}>
              <CheckCircle2 />
              {t("unbanUser")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">{t("activeSessions")}</h2>
            <p className="text-sm text-muted">{t("activeSessionsSubtitle")}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => post(`/api/admin/users/${user.id}/sessions/revoke-all`)} disabled={busy || isSelf || sessions.length === 0}>
            <ShieldX />
            {t("revokeAll")}
          </Button>
        </div>
        <div className="divide-y divide-border-line rounded-md border border-border-dim">
          {sessions.length === 0 ? (
            <p className="p-3 text-sm text-text-muted">{t("noSessions")}</p>
          ) : sessions.map((session) => (
            <div key={session.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 text-sm">
                <p className="text-text-primary">{formatDate(session.updatedAt, common("none"))}</p>
                <p className="truncate text-xs text-text-muted">{session.ipAddress ?? common("unknown")} - {session.userAgent ?? common("unknown")}</p>
                <p className="text-xs text-text-muted">{t("expires")}: {formatDate(session.expiresAt, common("none"))}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => post(`/api/admin/users/${user.id}/sessions/${session.id}/revoke`)} disabled={busy}>
                <LogOut />
                {t("revoke")}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <h2 className="text-base font-semibold text-text">{t("recentAudit")}</h2>
        <div className="divide-y divide-border-line rounded-md border border-border-dim">
          {auditEntries.length === 0 ? (
            <p className="p-3 text-sm text-text-muted">{t("noAudit")}</p>
          ) : auditEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium text-text-primary">{entry.action}</p>
                <p className="text-xs text-text-muted">{entry.actor.username ?? entry.actor.name}</p>
              </div>
              <p className="text-xs text-text-muted">{formatDate(entry.createdAt, common("none"))}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="text-sm text-text-primary">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-text-secondary">
      {label}
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
