import { getLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell, type BellNotification } from "@/components/phase3/NotificationBell";
import { notificationCopy, type NotificationTemplate } from "@/lib/notifications";
import { NavBreadcrumb } from "@/components/ui/breadcrumb";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";

interface NavbarProps {
  allianceName: string;
  username: string;
  role: string;
  unreadCount?: number;
  notifications?: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: Date | string;
    data?: unknown;
  }>;
}

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

export async function Navbar({ allianceName, username, role, unreadCount = 0, notifications = [] }: NavbarProps) {
  const locale = await getLocale();
  const formatted: BellNotification[] = notifications.map((item) => {
    const template = templateFrom(item.data);
    const copy = template ? notificationCopy(locale, template, valuesFrom(item.data)) : null;
    return {
      id: item.id,
      title: copy?.title ?? item.title,
      message: copy?.message ?? item.message,
      read: item.read,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    };
  });
  return (
    <header className="flex items-center justify-between border-b border-border-line bg-surface px-4 md:px-6 py-3 lg:py-0 lg:h-[52px] shrink-0">
      <div className="flex items-center gap-3">
        <NavBreadcrumb allianceName={allianceName} />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell unreadCount={unreadCount} notifications={formatted} />

        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu username={username} role={role} />
      </div>
    </header>
  );
}
