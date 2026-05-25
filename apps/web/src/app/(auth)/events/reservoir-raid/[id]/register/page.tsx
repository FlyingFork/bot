import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { isRaidDateReached } from "@/lib/phase6";
import { PublicRegistrationForm, type PublicRaidInfo } from "@/components/phase6/PublicRegistrationForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Props = { params: Promise<{ id: string }> };

export default async function PublicRegistrationPage({ params }: Props) {
  const { id: publicToken } = await params;
  const t = await getTranslations("phase6.registration");

  let plan = await prisma.reservoirRaidPlan.findUnique({
    where: { publicToken },
    select: {
      id: true,
      publicToken: true,
      raidDate: true,
      startsAt: true,
      registrationOpen: true,
    },
  });

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-md border border-border-subtle bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  if (plan.registrationOpen && isRaidDateReached(plan.raidDate)) {
    await prisma.reservoirRaidPlan.update({
      where: { id: plan.id },
      data: { registrationOpen: false },
    });
    plan = { ...plan, registrationOpen: false };
  }

  const info: PublicRaidInfo = {
    publicToken: plan.publicToken,
    raidDate: plan.raidDate.toISOString(),
    startsAt: plan.startsAt.toISOString(),
    registrationOpen: plan.registrationOpen,
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-text-primary">{t("title")}</h1>
          <LanguageSwitcher />
        </div>
        <PublicRegistrationForm plan={info} />
      </div>
    </div>
  );
}
