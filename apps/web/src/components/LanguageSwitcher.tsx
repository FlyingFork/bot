"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  tr: "Türkçe",
};

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  ru: "🇷🇺",
  tr: "🇹🇷",
};

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale() as Locale;

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
        <span>{LOCALE_FLAGS[locale]}</span>
        <span>{LOCALE_LABELS[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? "font-medium" : ""}
          >
            <span className="mr-2">{LOCALE_FLAGS[l]}</span>
            {LOCALE_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
