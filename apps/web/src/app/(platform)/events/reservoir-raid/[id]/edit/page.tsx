import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { ReservoirRaidEditForm, type RaidEditInitial } from "@/components/phase6/ReservoirRaidForms";
import { requireUser } from "@/lib/server-auth";

type Props = { params: Promise<{ id: string }> };

export default async function ReservoirRaidEditPage({ params }: Props) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/events/reservoir-raid");

  const { id } = await params;
  const t = await getTranslations("phase6.reservoirRaid");

  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { id },
    include: { _count: { select: { participants: true } } },
  });
  if (!plan) notFound();

  const initial: RaidEditInitial = {
    id: plan.id,
    raidDate: plan.raidDate.toISOString().slice(0, 10),
    startsAtDate: plan.startsAt.toISOString().slice(0, 10),
    startsAtTime: plan.startsAt.toISOString().slice(11, 16),
    status: plan.status,
    registrationOpen: plan.registrationOpen,
    canDelete: plan._count.participants === 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("editTitle")} />
      <ReservoirRaidEditForm initial={initial} />
    </div>
  );
}
