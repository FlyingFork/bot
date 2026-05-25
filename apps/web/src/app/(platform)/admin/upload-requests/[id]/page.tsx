import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DiffTable } from "@/components/phase3/DiffTable";
import { ReviewActions } from "@/components/phase3/ReviewActions";
import { requireAdmin } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import type { DiffEntry } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export default async function UploadRequestDetailPage(context: Params) {
  await requireAdmin();
  const t = await getTranslations("phase3.review");
  const { id } = await context.params;
  const request = await prisma.pendingChange.findUnique({
    where: { id },
    include: {
      submitter: { select: { username: true, name: true } },
      reviewer: { select: { username: true, name: true } },
    },
  });
  if (!request) notFound();

  const diffData = request.diffData as { items?: DiffEntry[] } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={request.submitter.username ?? request.submitter.name ?? "-"}
        action={<Button variant="ghost" render={<Link href="/admin/upload-requests" />}>{t("back")}</Button>}
      />

      <section className="grid gap-3 rounded-md border border-border-subtle bg-surface p-4 text-sm text-text-secondary md:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-text-muted">{t("type")}</p>
          <p className="font-medium text-text-primary">{request.leaderboardType ?? request.type}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-text-muted">{t("submittedAt")}</p>
          <p>{request.createdAt.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-text-muted">{t("status")}</p>
          <Badge variant={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : "destructive"}>{request.status}</Badge>
        </div>
      </section>

      {request.status === "PENDING" && <ReviewActions id={request.id} />}
      {request.rejectionNote && <p className="rounded-md border border-cn-danger/30 bg-cn-danger/5 p-3 text-sm text-cn-danger">{request.rejectionNote}</p>}

      <DiffTable diff={jsonSafe(diffData?.items ?? [])} />

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-text-primary">{t("payload")}</h2>
        <pre className="max-h-96 overflow-auto rounded-md border border-border-subtle bg-base p-3 text-xs text-text-secondary">
          {request.payload}
        </pre>
      </section>
    </div>
  );
}
