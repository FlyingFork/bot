import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { UploadRequestsTable } from "@/components/phase3/UploadRequestsTable";
import { requireAdmin } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";

export default async function AdminUploadRequestsPage() {
  await requireAdmin();
  const t = await getTranslations("phase3.adminQueue");
  const requests = await prisma.pendingChange.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      submitter: { select: { username: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <UploadRequestsTable requests={jsonSafe(requests)} />
    </div>
  );
}
