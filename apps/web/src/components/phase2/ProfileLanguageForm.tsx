"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { locales, type Locale } from "@/i18n/config";

export function ProfileLanguageForm({ initialLanguage }: { initialLanguage: Locale }) {
  const t = useTranslations("phase2.profile");
  const common = useTranslations("phase2.common");
  const router = useRouter();
  const [language, setLanguage] = useState<Locale>(initialLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/user/language", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (!response.ok) throw new Error("save failed");
      document.cookie = `NEXT_LOCALE=${language};path=/;max-age=31536000;samesite=lax`;
      router.refresh();
    } catch {
      setError(t("languageSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-widest text-text-muted" htmlFor="language">
        {t("language")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          id="language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Locale)}
          className="h-8 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary outline-none focus:border-border-active"
        >
          {locales.map((locale) => (
            <option key={locale} value={locale}>{t(`languages.${locale}`)}</option>
          ))}
        </select>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? common("saving") : t("saveLanguage")}
        </Button>
      </div>
      {error && <p className="text-xs text-cn-danger">{error}</p>}
    </div>
  );
}
