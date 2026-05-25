"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ExportButton({ baseUrl }: { baseUrl: string }) {
  const t = useTranslations("phase4.export");
  const separator = baseUrl.includes("?") ? "&" : "?";

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" render={<a href={`${baseUrl}${separator}format=csv`} />}>
        <Download />
        {t("csv")}
      </Button>
      <Button variant="ghost" size="sm" render={<a href={`${baseUrl}${separator}format=xlsx`} />}>
        <Download />
        {t("xlsx")}
      </Button>
    </div>
  );
}
