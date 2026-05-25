"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsList({
  notifications,
  filter,
  page,
  totalPages,
}: {
  notifications: NotificationListItem[];
  filter: string;
  page: number;
  totalPages: number;
}) {
  const t = useTranslations("phase3.notifications");
  const router = useRouter();

  async function post(path: string) {
    await fetch(path, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["all", "unread", "UPLOAD_SUBMITTED", "UPLOAD_APPROVED", "UPLOAD_REJECTED", "ACCOUNT_VERIFIED", "EVENT_CREATED"].map((value) => (
          <Button key={value} variant={filter === value ? "default" : "ghost"} size="sm" render={<Link href={`/notifications?filter=${value}`} />}>
            {value === "all" || value === "unread" ? t(`filters.${value}`) : t(`types.${value}`)}
          </Button>
        ))}
        <Button variant="secondary" size="sm" onClick={() => post("/api/notifications/mark-all-read")}>
          <CheckCheck />
          {t("markAllRead")}
        </Button>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="rounded-md border border-border-dim bg-raised/40 p-4 text-sm text-text-muted">{t("empty")}</div>
        ) : notifications.map((item) => (
          <div key={item.id} className="rounded-md border border-border-subtle bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => post(`/api/notifications/${item.id}/read`)}>
                <div className="flex items-center gap-2">
                  {!item.read && <span className="size-2 rounded-full bg-cn-danger" />}
                  <h2 className="text-sm font-bold text-text-primary">{item.title}</h2>
                  <Badge variant="secondary">{t(`types.${item.type}`)}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{item.message}</p>
                <p className="mt-2 text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
              </button>
              <Button variant="ghost" size="icon-sm" aria-label={t("dismiss")} onClick={() => post(`/api/notifications/${item.id}/dismiss`)}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={page <= 1} render={<Link href={`/notifications?filter=${filter}&page=${Math.max(1, page - 1)}`} />}>
          {t("previous")}
        </Button>
        <span className="text-xs text-text-muted">{t("page", { page, totalPages })}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} render={<Link href={`/notifications?filter=${filter}&page=${Math.min(totalPages, page + 1)}`} />}>
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
