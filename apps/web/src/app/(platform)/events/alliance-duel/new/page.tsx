import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/server-auth";
import { PageHeader } from "@/components/ui/page-header";
import { AllianceDuelCreateForm } from "@/components/phase5/AllianceDuelForms";

export default async function NewAllianceDuelPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();
  const t = await getTranslations("phase5.allianceDuel");

  return (
    <div className="space-y-6">
      <PageHeader title={t("newTitle")} subtitle={t("newSubtitle")} />
      <AllianceDuelCreateForm />
    </div>
  );
}
