import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { PendingChangesTable } from "./PendingChangesTable";

export const dynamic = "force-dynamic";

export default async function AdminPendingChangesPage() {
  const t = await getTranslations("admin.pendingChanges");

  const pendingChanges = await prisma.pendingChange.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      createdAt: true,
      submitter: { select: { username: true, name: true } },
    },
  });

  const rows = pendingChanges.map((c) => ({
    id: c.id,
    type: c.type,
    submitterUsername: c.submitter.username ?? c.submitter.name,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader title={t("title")} />
      <PendingChangesTable initialChanges={rows} />
    </div>
  );
}
