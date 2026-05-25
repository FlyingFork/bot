import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { PageHeader } from "@/components/ui/page-header";
import { AllianceDuelEditForm } from "@/components/phase5/AllianceDuelForms";

type Props = { params: Promise<{ id: string }> };

export default async function EditAllianceDuelPage({ params }: Props) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();
  const { id } = await params;
  const t = await getTranslations("phase5.allianceDuel");

  const duel = await prisma.allianceDuelInstance.findUnique({
    where: { id },
    include: { days: { select: { hasData: true } } },
  });
  if (!duel) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={t("editTitle")} subtitle={duel.opponentName ?? duel.opponentTag ?? t("opponentPending")} />
      <AllianceDuelEditForm
        initial={{
          id: duel.id,
          startDate: duel.startDate.toISOString().slice(0, 10),
          endDate: duel.endDate.toISOString().slice(0, 10),
          opponentTag: duel.opponentTag ?? "",
          opponentName: duel.opponentName ?? "",
          status: duel.status,
          outcome: duel.outcome ?? "",
          canDelete: duel.days.every((day) => !day.hasData),
        }}
      />
    </div>
  );
}
