import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PendingTable } from "./PendingTable";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminPendingPage() {
  const t = await getTranslations("admin.pending");

  const pendingUsers = await prisma.user.findMany({
    where: { emailVerified: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, name: true, createdAt: true },
  });

  const usersData = pendingUsers.map((u) => ({
    id: u.id,
    username: u.username ?? u.name,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader title={t("title")} />
      <PendingTable initialUsers={usersData} />
    </div>
  );
}
