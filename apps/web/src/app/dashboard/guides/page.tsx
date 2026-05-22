import { getTranslations } from "next-intl/server";
import { DataCard } from "@/components/ui/data-card";
import { PageHeader } from "@/components/ui/page-header";

export default async function GuidesPage() {
  const t = await getTranslations("alliance.guides");

  return (
    <div className="animate-fade-up">
      <PageHeader title={t("title")} />
      <DataCard>
        <div className="flex min-h-56 items-center justify-center">
          <p className="text-sm font-bold uppercase tracking-widest text-text-muted">
            {t("maintenance")}
          </p>
        </div>
      </DataCard>
    </div>
  );
}
