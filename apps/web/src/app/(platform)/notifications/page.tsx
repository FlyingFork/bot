import { getLocale, getTranslations } from "next-intl/server";
import { prisma, type NotificationType } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationsList, type NotificationListItem } from "@/components/phase3/NotificationsList";
import { requireUser } from "@/lib/server-auth";
import { notificationCopy, type NotificationTemplate } from "@/lib/notifications";

type PageProps = {
  searchParams?: Promise<{ filter?: string; page?: string }>;
};

const TYPES = ["UPLOAD_SUBMITTED", "UPLOAD_APPROVED", "UPLOAD_REJECTED", "ACCOUNT_VERIFIED", "EVENT_CREATED"] as const;

function valuesFrom(data: unknown) {
  if (typeof data !== "object" || data === null || !("values" in data)) return undefined;
  return (data as { values?: Record<string, string | number | null | undefined> }).values;
}

function templateFrom(data: unknown): NotificationTemplate | null {
  if (typeof data !== "object" || data === null || !("template" in data)) return null;
  const template = (data as { template?: string }).template;
  if (
    template === "uploadSubmitted" ||
    template === "uploadApproved" ||
    template === "uploadRejected" ||
    template === "accountVerified" ||
    template === "eventCreated"
  ) {
    return template;
  }
  return null;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const t = await getTranslations("phase3.notifications");
  const locale = await getLocale();
  const params = (await searchParams) ?? {};
  const filter = params.filter ?? "all";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const take = 20;
  const typeFilter = TYPES.includes(filter as NotificationType) ? (filter as NotificationType) : undefined;
  const where = {
    userId: user.id,
    dismissedAt: null,
    ...(filter === "unread" ? { read: false } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));

  const formatted: NotificationListItem[] = notifications.map((item) => {
    const template = templateFrom(item.data);
    const copy = template ? notificationCopy(locale, template, valuesFrom(item.data)) : null;
    return {
      id: item.id,
      type: item.type,
      title: copy?.title ?? item.title,
      message: copy?.message ?? item.message,
      read: item.read,
      createdAt: item.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <NotificationsList notifications={formatted} filter={filter} page={page} totalPages={totalPages} />
    </div>
  );
}
