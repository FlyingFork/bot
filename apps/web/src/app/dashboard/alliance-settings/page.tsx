import { prisma } from "@tiles-survive/database";
import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/alliance/SettingsForm";
import { DataCard } from "@/components/ui/data-card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AllianceSettingsPage() {
  const t = await getTranslations("alliance.settings");
  const settings = await prisma.allianceSettings.findUnique({
    where: { id: "primary" },
  });

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <DataCard
        title={t("identity")}
        description={t("identityDescription")}
      >
        <SettingsForm name={settings?.name ?? ""} tag={settings?.tag ?? ""} />
      </DataCard>
    </div>
  );
}
