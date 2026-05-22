import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { prisma } from "@tiles-survive/database";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataCard } from "@/components/ui/data-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRaidPlan } from "./actions";

export const dynamic = "force-dynamic";

function formatUtc(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export default async function ReservoirRaidPlansPage() {
  const [locale, eventT, t] = await Promise.all([
    getLocale(),
    getTranslations("alliance.events"),
    getTranslations("reservoirRaid.plans"),
  ]);
  const plans = await prisma.reservoirRaidPlan.findMany({
    orderBy: { raidDate: "desc" },
    include: {
      _count: {
        select: {
          assignments: true,
          participants: true,
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={eventT("reservoirRaid")}
        subtitle={eventT("reservoirRaidSubtitle")}
      />
      <DataCard
        title={t("createTitle")}
        description={t("createDescription")}
      >
        <form action={createRaidPlan} className="grid gap-3 md:grid-cols-[12rem_10rem_auto] md:items-end">
          <label className="grid gap-1 text-xs text-text-secondary">
            {t("sundayDate")}
            <Input name="raidDate" required type="date" />
          </label>
          <label className="grid gap-1 text-xs text-text-secondary">
            {t("eventTimeUtc")}
            <Input name="eventTimeUtc" required type="time" />
          </label>
          <Button className="md:w-fit" type="submit">
            <CalendarPlus />
            {t("create")}
          </Button>
        </form>
      </DataCard>
      <div className="grid gap-3">
        {plans.map((plan) => (
          <Link href={`/dashboard/events/reservoir-raid/${plan.id}`} key={plan.id}>
            <DataCard
              className="transition-colors hover:border-border-active"
              title={formatUtc(plan.raidDate, locale)}
              description={t("eventStart", { date: formatUtc(plan.startsAt, locale) })}
            >
              <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
                <span>{t("registeredPlayers", { count: plan._count.participants })}</span>
                <span>{t("assignments", { count: plan._count.assignments })}</span>
                <span>
                  {plan.registrationOpen ? t("registrationOpen") : t("registrationClosed")}
                </span>
              </div>
            </DataCard>
          </Link>
        ))}
        {!plans.length && (
          <p className="rounded-md border border-border-dim bg-base p-4 text-sm text-text-muted">
            {t("empty")}
          </p>
        )}
      </div>
    </div>
  );
}
