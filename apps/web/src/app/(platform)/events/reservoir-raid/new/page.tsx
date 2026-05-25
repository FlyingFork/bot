import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { ReservoirRaidCreateForm } from "@/components/phase6/ReservoirRaidForms";
import { requireUser } from "@/lib/server-auth";

export default async function NewReservoirRaidPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/events/reservoir-raid");

  const t = await getTranslations("phase6.reservoirRaid");

  return (
    <div className="space-y-6">
      <PageHeader title={t("newTitle")} subtitle={t("newSubtitle")} />
      <ReservoirRaidCreateForm />
    </div>
  );
}
