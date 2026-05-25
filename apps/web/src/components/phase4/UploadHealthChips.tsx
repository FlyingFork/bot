import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { UploadHealth } from "@/lib/phase4";

function variant(status: UploadHealth["status"]) {
  if (status === "fresh") return "success" as const;
  if (status === "warning") return "warning" as const;
  return "destructive" as const;
}

export async function UploadHealthChips({ health }: { health: UploadHealth[] }) {
  const t = await getTranslations("phase4.health");
  const typeT = await getTranslations("phase2.leaderboardTypes");

  return (
    <div className="flex flex-wrap gap-2">
      {health.map((item) => (
        <Badge key={item.type} variant={variant(item.status)} title={item.capturedAt ? t("title", { days: item.daysSinceLastSnapshot ?? 0, threshold: item.threshold }) : t("missing")}>
          {typeT(item.type)}
        </Badge>
      ))}
    </div>
  );
}
