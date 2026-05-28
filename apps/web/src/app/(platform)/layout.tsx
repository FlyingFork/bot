import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@tiles-survive/database";
import { Sidebar } from "@/components/platform/Sidebar";
import { Navbar } from "@/components/platform/Navbar";
import { BottomNav } from "@/components/platform/BottomNav";
import { touchLastSeen } from "@/lib/last-seen";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/sign-in");

  const user = session.user as Record<string, unknown>;
  const platformStatus = user.platformStatus as string | undefined;
  const banned = user.banned as boolean | undefined;

  if (platformStatus === "PENDING") redirect("/pending");
  if (platformStatus === "SUSPENDED" || banned) redirect("/suspended");

  await touchLastSeen(user.id as string);

  const [settings, unreadCount, notifications] = await Promise.all([
    prisma.allianceSettings
      .findUnique({ where: { id: "primary" }, select: { name: true } })
      .catch(() => null),
    prisma.notification.count({
      where: { userId: user.id as string, read: false, dismissedAt: null },
    }).catch(() => 0),
    prisma.notification.findMany({
      where: { userId: user.id as string, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }).catch(() => []),
  ]);

  const allianceName = settings?.name ?? "";
  const role = (user.role as string | undefined) ?? "r1";
  const username = (user.username as string | undefined) ?? (user.name as string | undefined) ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role} allianceName={allianceName} unreadCount={unreadCount} />

      <div className="flex flex-1 flex-col min-h-0">
        <Navbar
          allianceName={allianceName}
          username={username}
          role={role}
          unreadCount={unreadCount}
          notifications={notifications}
        />

        <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:px-[32px]">
            {children}
          </div>
        </main>
      </div>

      <BottomNav role={role} unreadCount={unreadCount} />
    </div>
  );
}
