"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { RoleBadge } from "@/components/ui/role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserEditModal } from "./UserEditModal";

export type UserRow = {
  id: string;
  username: string | null;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
  role: string;
  emailVerified: boolean;
  banned: boolean | null;
  banReason: string | null;
};

export function UsersTable({
  users,
  page,
  totalPages,
}: {
  users: UserRow[];
  page: number;
  totalPages: number;
}) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = search
    ? users.filter((u) =>
        (u.username ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  function handleEditUser(user: UserRow) {
    setSelectedUser(user);
    setModalOpen(true);
  }

  function handleModalOpenChange(open: boolean) {
    setModalOpen(open);
    if (!open) setSelectedUser(null);
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-border-subtle overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("username")}</TableHead>
              <TableHead>{t("joined")}</TableHead>
              <TableHead>{t("lastSignIn")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-muted">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-text-primary">
                    <span className="flex items-center gap-2">
                      {user.username ?? "—"}
                      {user.banned === true && (
                        <RoleBadge variant="banned" label={t("banned")} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {user.lastSignIn
                      ? new Date(user.lastSignIn).toLocaleDateString()
                      : t("never")}
                  </TableCell>
                  <TableCell>
                    <RoleBadge
                      variant={user.role === "admin" ? "r5" : "r3"}
                      label={user.role === "admin" ? t("roleAdmin") : t("roleUser")}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleEditUser(user)}
                    >
                      {t("edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => router.push(`/admin/users?page=${page - 1}`)}
          >
            {t("previousPage")}
          </Button>
          <span className="text-xs text-text-muted">
            {t("page", { current: page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => router.push(`/admin/users?page=${page + 1}`)}
          >
            {t("nextPage")}
          </Button>
        </div>
      )}

      {selectedUser && (
        <UserEditModal
          user={selectedUser}
          open={modalOpen}
          onOpenChange={handleModalOpenChange}
        />
      )}
    </div>
  );
}
