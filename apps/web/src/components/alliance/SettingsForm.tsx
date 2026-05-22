"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  updateAllianceSettings,
  type ApplyResult,
} from "@/app/dashboard/alliance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ApplyResult = { success: false };

export function SettingsForm({
  name,
  tag,
}: {
  name: string;
  tag: string;
}) {
  const t = useTranslations("alliance");
  const [state, formAction, pending] = useActionState(
    updateAllianceSettings,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-4" key={`${name}|${tag}`}>
      <label className="block space-y-1.5 text-xs font-semibold text-text-secondary">
        {t("settings.name")}
        <Input
          name="name"
          defaultValue={name}
          placeholder={t("settings.namePlaceholder")}
        />
      </label>
      <label className="block space-y-1.5 text-xs font-semibold text-text-secondary">
        {t("settings.tag")}
        <Input
          name="tag"
          defaultValue={tag}
          placeholder={t("settings.tagPlaceholder")}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("settings.saving") : t("settings.save")}
        </Button>
        {state.message && (
          <p
            className={
              state.success ? "text-xs text-cn-success" : "text-xs text-cn-danger"
            }
          >
            {t(state.message.key, state.message.values)}
          </p>
        )}
      </div>
    </form>
  );
}
