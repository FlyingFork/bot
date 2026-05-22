import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin.overview");

  const [totalUsers, pendingUsers, verifiedUsers, pendingChanges] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.pendingChange.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader title={t("title")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("totalUsers")} value={String(totalUsers)} />
        <StatCard label={t("pendingUsers")} value={String(pendingUsers)} />
        <StatCard label={t("verifiedUsers")} value={String(verifiedUsers)} />
        <StatCard label={t("pendingChanges")} value={String(pendingChanges)} />
      </div>
    </div>
  );
}
