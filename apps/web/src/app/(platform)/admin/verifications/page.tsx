import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import { PageHeader } from "@/components/ui/page-header";
import { VerificationsPanel } from "@/components/phase2/VerificationsPanel";
import type { MemberSummary, PendingUser } from "@/components/phase2/types";

export default async function AdminVerificationsPage() {
  const t = await getTranslations("phase2.verifications");
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();

  const [users, members] = await Promise.all([
    prisma.user.findMany({
      where: { platformStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    }),
    prisma.allianceMember.findMany({
      orderBy: { username: "asc" },
      include: {
        user: {
          select: { id: true, username: true, name: true, role: true, platformStatus: true, banned: true },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <VerificationsPanel
        users={jsonSafe(users) as PendingUser[]}
        members={jsonSafe(members) as MemberSummary[]}
      />
    </div>
  );
}
