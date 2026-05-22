import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DataCard } from "@/components/ui/data-card";
import { LocalRaidTime } from "@/components/reservoir-raid/LocalRaidTime";
import { PublicRaidRegistrationForm } from "@/components/reservoir-raid/PublicRaidRegistrationForm";

export const dynamic = "force-dynamic";

function utcEventTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: "UTC",
    timeZoneName: "short",
    weekday: "long",
    year: "numeric",
  }).format(date);
}

export default async function PublicReservoirRaidRegistrationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const t = await getTranslations("reservoirRaid.registration");
  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { publicToken: token },
    select: {
      publicToken: true,
      raidDate: true,
      registrationOpen: true,
      startsAt: true,
    },
  });

  if (!plan) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 p-4 md:p-8">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <DataCard
        title={t("title")}
        description={t("raidWeek", { date: plan.raidDate.toISOString().slice(0, 10) })}
      >
        <div className="grid gap-2 text-sm text-text-secondary">
          <p>
            {t("eventTimeUtc")}:{" "}
            <span className="font-semibold text-text-primary">
              {utcEventTime(plan.startsAt, locale)}
            </span>
          </p>
          <p>
            {t("localTime")}:{" "}
            <span className="font-semibold text-text-primary">
              <LocalRaidTime startsAt={plan.startsAt.toISOString()} />
            </span>
          </p>
          {!plan.registrationOpen && (
            <p className="rounded-md border border-cn-warning/35 bg-cn-warning/10 p-3 text-cn-warning">
              {t("closed")}
            </p>
          )}
        </div>
      </DataCard>
      <DataCard>
        <PublicRaidRegistrationForm
          registrationOpen={plan.registrationOpen}
          token={plan.publicToken}
        />
      </DataCard>
    </main>
  );
}
