import { Metadata } from "next";
import { getBoostsData } from "@/app/actions/boosts";
import { BoostManagerClient } from "./BoostManagerClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { SeasonsSubTabs } from "@/components/phase4/SeasonsSubTabs";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Менеджер Бустов | Tiles Survive",
  description: "Очередь и распределение строительных и исследовательских бустов альянса.",
};

export default async function BoostManagerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as Record<string, unknown> | undefined;
  const userRole = (user?.role as string | undefined) ?? "r1";
  
  const initialData = await getBoostsData();
  const t = await getTranslations("phase2.boostManager");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-text">{t("title")}</h1>
        <p className="text-sm text-muted">
          {t("subtitle")}
        </p>
      </div>

      <SeasonsSubTabs isAdmin={userRole === "admin"} />

      <BoostManagerClient 
        initialData={initialData} 
        userRole={userRole} 
      />
    </div>
  );
}
