"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { RoleBadge } from "@/components/ui/role-badge";
import type { UserRow } from "./UsersTable";

interface UserEditModalProps {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditModal({ user, open, onOpenChange }: UserEditModalProps) {
  const t = useTranslations("admin.users");
  const commonT = useTranslations("common");
  const router = useRouter();

  const [name, setName] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [role, setRole] = useState<string>(user.role);
  const [loadingRole, setLoadingRole] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  const [banReasonInput, setBanReasonInput] = useState("");
  const [loadingBan, setLoadingBan] = useState(false);
  const [loadingRevoke, setLoadingRevoke] = useState(false);

  async function handleSaveDetails() {
    setLoadingDetails(true);
    const { error } = await authClient.admin.updateUser({
      userId: user.id,
      data: { name, email, username: name },
    });
    setLoadingDetails(false);
    if (error) {
      toast.error(t("errorGeneric"));
    } else {
      toast.success(t("detailsSaved"));
      router.refresh();
    }
  }

  async function handleToggleRole() {
    const newRole = role === "admin" ? "user" : "admin";
    setLoadingRole(true);
    const { error } = await authClient.admin.setRole({
      userId: user.id,
      role: newRole,
    });
    setLoadingRole(false);
    if (error) {
      toast.error(t("errorGeneric"));
    } else {
      setRole(newRole);
      toast.success(t("roleSaved"));
      router.refresh();
    }
  }

  async function handleSetPassword() {
    if (newPassword.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    setLoadingPassword(true);
    const { error } = await authClient.admin.setUserPassword({
      userId: user.id,
      newPassword,
    });
    setLoadingPassword(false);
    if (error) {
      toast.error(t("errorGeneric"));
    } else {
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("passwordSaved"));
    }
  }

  async function handleBan() {
    setLoadingBan(true);
    const { error } = await authClient.admin.banUser({
      userId: user.id,
      ...(banReasonInput.trim() ? { banReason: banReasonInput.trim() } : {}),
    });
    setLoadingBan(false);
    if (error) {
      toast.error(t("errorGeneric"));
    } else {
      toast.success(t("banSaved"));
      router.refresh();
      onOpenChange(false);
    }
  }

  async function handleUnban() {
    setLoadingBan(true);
    const { error } = await authClient.admin.unbanUser({ userId: user.id });
    setLoadingBan(false);
    if (error) {
      toast.error(t("errorGeneric"));
    } else {
      toast.success(t("unbanSaved"));
      router.refresh();
      onOpenChange(false);
    }
  }

  async function handleRevokeSessions() {
    setLoadingRevoke(true);
    const { error } = await authClient.admin.revokeUserSessions({ userId: user.id });
    setLoadingRevoke(false);
    if (error) {
      toast.error(t("errorGeneric"));
    } else {
      toast.success(t("sessionsSaved"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div className="space-y-0.5">
            <DialogTitle>{t("editTitle", { username: user.username ?? user.email })}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </div>
          <DialogClose
            aria-label={commonT("close")}
            className="inline-flex items-center justify-center size-6 rounded-[4px] text-text-muted hover:text-text-primary hover:bg-overlay transition-colors text-xs outline-none focus-visible:ring-2 focus-visible:ring-cn-cyan/40"
          >
            ✕
          </DialogClose>
        </div>

        <div className="px-4 pb-4 space-y-5">

          {/* Details */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-text-muted">
              {t("sectionDetails")}
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary">{t("fieldUsername")}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary">{t("fieldEmail")}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <Button size="sm" disabled={loadingDetails} onClick={handleSaveDetails}>
              {loadingDetails ? t("saving") : t("saveDetails")}
            </Button>
          </section>

          <Separator />

          {/* Role */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-text-muted">
              {t("sectionRole")}
            </h3>
            <div className="flex items-center gap-3">
              <RoleBadge
                variant={role === "admin" ? "r5" : "r3"}
                label={role === "admin" ? t("roleAdmin") : t("roleUser")}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={loadingRole}
                onClick={handleToggleRole}
              >
                {loadingRole
                  ? t("saving")
                  : role === "admin"
                  ? t("demoteToUser")
                  : t("promoteToAdmin")}
              </Button>
            </div>
          </section>

          <Separator />

          {/* Password */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-text-muted">
              {t("sectionPassword")}
            </h3>
            <Input
              type="password"
              placeholder={t("newPasswordPlaceholder")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-7 text-xs"
            />
            <Button size="sm" disabled={loadingPassword} onClick={handleSetPassword}>
              {loadingPassword ? t("saving") : t("setPassword")}
            </Button>
          </section>

          <Separator />

          {/* Danger Zone */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-cn-danger">
              {t("sectionDanger")}
            </h3>

            {user.banned === true ? (
              <div className="space-y-2">
                {user.banReason && (
                  <p className="text-[11px] text-text-muted">
                    <span className="text-text-secondary">{t("banReason")}:</span>{" "}
                    {user.banReason}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingBan}
                  onClick={handleUnban}
                >
                  {loadingBan ? t("saving") : t("unban")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder={t("banReasonPlaceholder")}
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={loadingBan}
                  onClick={handleBan}
                >
                  {loadingBan ? t("saving") : t("ban")}
                </Button>
              </div>
            )}

            <div className="pt-1">
              <p className="text-[11px] text-text-muted mb-2">{t("revokeSessionsDescription")}</p>
              <Button
                size="sm"
                variant="destructive"
                disabled={loadingRevoke}
                onClick={handleRevokeSessions}
              >
                {loadingRevoke ? t("saving") : t("revokeSessions")}
              </Button>
            </div>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
