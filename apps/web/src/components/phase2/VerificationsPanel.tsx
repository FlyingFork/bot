"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { MemberSummary, PendingUser } from "./types";
import { formatDate, ROLES, roleLabel } from "./Phase2Utils";

type Selection = { query: string; memberId: string; role: string };

export function VerificationsPanel({
  users,
  members,
}: {
  users: PendingUser[];
  members: MemberSummary[];
}) {
  const t = useTranslations("phase2.verifications");
  const common = useTranslations("phase2.common");
  const rolesT = useTranslations("phase2.roles");
  const router = useRouter();
  const [state, setState] = useState<Record<string, Selection>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableMembers = useMemo(
    () => members.filter((member) => !member.user),
    [members],
  );

  function selectionFor(user: PendingUser): Selection {
    return state[user.id] ?? { query: "", memberId: "", role: user.role ?? "r1" };
  }

  function update(userId: string, patch: Partial<Selection>) {
    setState((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? { query: "", memberId: "", role: "r1" }),
        ...patch,
      },
    }));
  }

  async function approve(user: PendingUser) {
    const selection = selectionFor(user);
    if (!selection.memberId) {
      setError(t("chooseMember"));
      return;
    }

    setBusyId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/verifications/${user.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allianceMemberId: selection.memberId,
          role: selection.role,
        }),
      });
      if (!response.ok) throw new Error(t("verificationFailed"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("verificationFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-md border border-border-dim bg-raised/40 p-4 text-sm text-text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-cn-danger">{error}</p>}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const selection = selectionFor(user);
          const filteredMembers = availableMembers
            .filter((member) => member.username.toLowerCase().includes(selection.query.toLowerCase()))
            .slice(0, 30);
          return (
            <div key={user.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm text-text-primary">{user.username ?? common("none")}</div>
                  <div className="text-xs text-text-muted">{formatDate(user.createdAt)}</div>
                </div>
              </div>
              <div className="text-xs text-text-muted">{t("ingameName")}: {user.name}</div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">{t("allianceMember")}</p>
                <Input
                  value={selection.query}
                  onChange={(event) => update(user.id, { query: event.target.value })}
                  placeholder={t("searchMembers")}
                />
                <select
                  value={selection.memberId}
                  onChange={(event) => update(user.id, { memberId: event.target.value })}
                  className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary"
                >
                  <option value="">{t("selectMember")}</option>
                  {filteredMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.username}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">{t("role")}</p>
                {user.role === "admin" ? (
                  <span className="text-sm text-text-primary">{roleLabel(user.role, common("none"), rolesT("admin"))}</span>
                ) : (
                  <select
                    value={selection.role}
                    onChange={(event) => update(user.id, { role: event.target.value })}
                    className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role.toUpperCase()}</option>
                    ))}
                  </select>
                )}
              </div>
              <Button size="sm" onClick={() => approve(user)} disabled={busyId === user.id}>
                <ShieldCheck />
                {busyId === user.id ? t("verifying") : t("verify")}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border border-border-subtle bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("username")}</TableHead>
              <TableHead>{t("ingameName")}</TableHead>
              <TableHead>{t("registered")}</TableHead>
              <TableHead>{t("allianceMember")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead className="text-right">{t("action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const selection = selectionFor(user);
              const filteredMembers = availableMembers
                .filter((member) => member.username.toLowerCase().includes(selection.query.toLowerCase()))
                .slice(0, 30);

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-text-primary">{user.username ?? common("none")}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="min-w-56">
                    <div className="flex flex-col gap-1">
                      <Input
                        value={selection.query}
                        onChange={(event) => update(user.id, { query: event.target.value })}
                        placeholder={t("searchMembers")}
                      />
                      <select
                        value={selection.memberId}
                        onChange={(event) => update(user.id, { memberId: event.target.value })}
                        className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary"
                      >
                        <option value="">{t("selectMember")}</option>
                        {filteredMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role === "admin" ? (
                      <span>{roleLabel(user.role, common("none"), rolesT("admin"))}</span>
                    ) : (
                      <select
                        value={selection.role}
                        onChange={(event) => update(user.id, { role: event.target.value })}
                        className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role.toUpperCase()}</option>
                        ))}
                      </select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => approve(user)} disabled={busyId === user.id}>
                      <ShieldCheck />
                      {busyId === user.id ? t("verifying") : t("verify")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
