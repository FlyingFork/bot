import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { isRaidDateReached } from "@/lib/phase6";
import {
  PublicRegistrationForm,
  type PublicRaidInfo,
  type PublicRegistrationPrefill,
} from "@/components/phase6/PublicRegistrationForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function formatForForm(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const s = Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/\.?0+$/, "");
    return `${s}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    const s = Number.isInteger(k) ? String(k) : k.toFixed(2).replace(/\.?0+$/, "");
    return `${s}K`;
  }
  return String(n);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicRegistrationPage({ params, searchParams }: Props) {
  const { id: publicToken } = await params;
  const query = await searchParams;
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

  const prefillName = typeof query.name === "string" ? query.name : undefined;
  const s1Raw = typeof query.s1 === "string" ? Number(query.s1) : NaN;
  const prefill: PublicRegistrationPrefill = {
    ingameName: prefillName,
    squad1: !isNaN(s1Raw) && s1Raw > 0 ? formatForForm(s1Raw) : undefined,
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-text-primary">{t("title")}</h1>
          <LanguageSwitcher />
        </div>
        <PublicRegistrationForm plan={info} prefill={prefill} />
      </div>
    </div>
  );
}
