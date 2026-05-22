"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { verifyUser } from "./actions";

type PendingUser = {
  id: string;
  username: string | null;
  createdAt: string;
};

export function PendingTable({ initialUsers }: { initialUsers: PendingUser[] }) {
  const t = useTranslations("admin.pending");
  const [users, setUsers] = useState(initialUsers);
  const [, startTransition] = useTransition();

  function handleVerify(userId: string) {
    // Optimistic: remove row immediately
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    startTransition(async () => {
      const result = await verifyUser(userId);
      if (!result.success) {
        // Revert on failure
        setUsers(initialUsers);
        toast.error(t("verifyError"));
      }
    });
  }

  if (users.length === 0) {
    return <p className="text-text-muted text-xs">{t("noResults")}</p>;
  }

  return (
    <div className="rounded-lg border border-border-subtle overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("username")}</TableHead>
            <TableHead>{t("registeredAt")}</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-mono text-text-primary">{user.username ?? "—"}</TableCell>
              <TableCell className="text-text-muted">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={() => handleVerify(user.id)}>
                  {t("verify")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
