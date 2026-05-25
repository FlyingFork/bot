import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/phase2/SettingsForm";
import type { AllianceSettingsData } from "@/components/phase2/types";

export default async function AdminSettingsPage() {
  const t = await getTranslations("phase2.settings");
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();

  const settings = await prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: {},
    create: { id: "primary" },
  });

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm settings={jsonSafe(settings) as AllianceSettingsData} />
    </div>
  );
}
