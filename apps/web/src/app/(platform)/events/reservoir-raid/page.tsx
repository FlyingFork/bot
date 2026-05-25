import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { ReservoirRaidList, type RaidListRow } from "@/components/phase6/ReservoirRaidList";
import { requireUser } from "@/lib/server-auth";

export default async function ReservoirRaidPage() {
  const user = await requireUser();
  const t = await getTranslations("phase6.reservoirRaid");

  const plans = await prisma.reservoirRaidPlan.findMany({
    orderBy: { raidDate: "desc" },
    include: { _count: { select: { participants: true } } },
  });

  const rows: RaidListRow[] = plans.map((plan) => ({
    id: plan.id,
    raidDate: plan.raidDate.toISOString(),
    startsAt: plan.startsAt.toISOString(),
    status: plan.status,
    registrationOpen: plan.registrationOpen,
    participantCount: plan._count.participants,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReservoirRaidList rows={rows} isAdmin={user.role === "admin"} />
    </div>
  );
}
