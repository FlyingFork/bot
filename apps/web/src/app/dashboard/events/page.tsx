import Link from "next/link";
import { Droplets, Swords, Telescope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DataCard } from "@/components/ui/data-card";
import { PageHeader } from "@/components/ui/page-header";

export default async function EventsPage() {
  const t = await getTranslations("alliance.events");

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Link href="/dashboard/events/alliance-siege">
          <DataCard
            title={t("allianceSiege")}
            description={t("allianceSiegeDescription")}
            className="h-full transition-colors hover:border-border-active"
          >
            <Swords className="text-cn-cyan" />
          </DataCard>
        </Link>
        <Link href="/dashboard/events/exploration">
          <DataCard
            title={t("exploration")}
            description={t("explorationDescription")}
            className="h-full transition-colors hover:border-border-active"
          >
            <Telescope className="text-cn-warning" />
          </DataCard>
        </Link>
        <Link href="/dashboard/events/reservoir-raid">
          <DataCard
            title={t("reservoirRaid")}
            description={t("reservoirRaidDescription")}
            className="h-full transition-colors hover:border-border-active"
          >
            <Droplets className="text-cn-success" />
          </DataCard>
        </Link>
      </div>
    </div>
  );
}
