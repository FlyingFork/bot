"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function SeasonsSubTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("phase2.nav");

  if (!isAdmin) return null;

  const isSeasonsActive = pathname === "/seasons";
  const isBoostsActive = pathname.startsWith("/seasons/boosts");

  return (
    <div className="flex gap-1.5 border-b border-border-line pb-px mb-6">
      <Link
        href="/seasons"
        className={cn(
          "px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors",
          isSeasonsActive
            ? "border-gold text-gold font-bold"
            : "border-transparent text-muted hover:text-text"
        )}
      >
        {t("seasons")}
      </Link>
      <Link
        href="/seasons/boosts"
        className={cn(
          "px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors",
          isBoostsActive
            ? "border-gold text-gold font-bold"
            : "border-transparent text-muted hover:text-text"
        )}
      >
        {t("boosts")}
      </Link>
    </div>
  );
}
