"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type BellNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({
  unreadCount,
  notifications,
}: {
  unreadCount: number;
  notifications: BellNotification[];
}) {
  const t = useTranslations("phase3.notifications");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-raised/60 transition-colors"
        aria-label={t("label")}
      >
        <Bell size={16} className="text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cn-danger text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("latest")}</span>
          <Button variant="ghost" size="xs" disabled={busy || unreadCount === 0} onClick={markAllRead}>
            <CheckCheck />
            {t("markAllRead")}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-3 text-xs text-text-muted">{t("empty")}</div>
        ) : (
          notifications.map((item) => (
            <DropdownMenuItem key={item.id} className="items-start gap-2 whitespace-normal" render={<Link href="/notifications" />}>
              {!item.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cn-danger" />}
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-text-primary">{item.title}</span>
                <span className="block truncate text-[11px] text-text-muted">{item.message}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/notifications" />}>{t("viewAll")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
