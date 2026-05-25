"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("phase2.profile");

  function switchLocale(newLocale: Locale) {
    Reflect.set(
      document,
      "cookie",
      `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;samesite=lax`,
    );
    try {
      localStorage.setItem("locale", newLocale);
    } catch {}
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
      >
        <span>{locale.toUpperCase()}</span>
        <span>{t(`languages.${locale}`)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? "font-medium" : ""}
          >
            <span className="mr-2">{l.toUpperCase()}</span>
            {t(`languages.${l}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
