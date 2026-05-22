"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  submitPublicRaidRegistration,
  type PublicRaidRegistrationInput,
  type PublicRaidRegistrationResult,
} from "@/app/dashboard/events/reservoir-raid/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emptyInput: PublicRaidRegistrationInput = {
  username: "",
  squad1Power: "",
  squad2Power: "",
  squad3Power: "",
  squad4Power: "",
  squad5Power: "",
  contactType: "",
  contact: "",
  confirmed: false,
};

function FieldError({ message }: { message?: string }) {
  const t = useTranslations("reservoirRaid.registration.errors");

  return message ? <p className="text-xs text-cn-danger">{t(message)}</p> : null;
}

export function PublicRaidRegistrationForm({
  registrationOpen,
  token,
}: {
  registrationOpen: boolean;
  token: string;
}) {
  const t = useTranslations("reservoirRaid.registration");
  const [input, setInput] = useState(emptyInput);
  const [result, setResult] = useState<PublicRaidRegistrationResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function setField<Key extends keyof PublicRaidRegistrationInput>(
    field: Key,
    value: PublicRaidRegistrationInput[Key],
  ) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        startTransition(async () => {
          const next = await submitPublicRaidRegistration(token, input);
          setResult(next);
        });
      }}
    >
      <label className="grid gap-1.5 text-sm text-text-secondary">
        {t("username")}
        <Input
          autoComplete="nickname"
          disabled={!registrationOpen}
          onChange={(event) => setField("username", event.target.value)}
          required
          value={input.username}
        />
        <FieldError message={result?.fieldErrors?.username} />
      </label>
      <div className="grid gap-2">
        {(["squad1Power", "squad2Power", "squad3Power", "squad4Power", "squad5Power"] as const).map(
          (field, index) => (
            <label className="grid gap-1.5 text-sm text-text-secondary sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-3" key={field}>
              <span className="sm:pt-1.5">
                {index === 0
                  ? t("requiredSquadPower", { squad: index + 1 })
                  : t("optionalSquadPower", { squad: index + 1 })}
              </span>
              <div className="grid gap-1">
                <Input
                  disabled={!registrationOpen}
                  onChange={(event) => setField(field, event.target.value)}
                  placeholder={index === 0 ? "24.6M" : "875K"}
                  required={index === 0}
                  value={input[field]}
                />
                <FieldError message={result?.fieldErrors?.[field]} />
              </div>
            </label>
          ),
        )}
      </div>
      <p className="text-xs text-text-muted">
        {t("powerHint")}
      </p>
      <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)]">
        <label className="grid gap-1.5 text-sm text-text-secondary">
          {t("contactType")}
          <select
            className="h-8 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary outline-none focus:border-border-active disabled:opacity-40"
            disabled={!registrationOpen}
            onChange={(event) => setField("contactType", event.target.value)}
            value={input.contactType}
          >
            <option value="">{t("noContact")}</option>
            <option value="discord">Discord</option>
            <option value="telegram">Telegram</option>
          </select>
          <FieldError message={result?.fieldErrors?.contactType} />
        </label>
        <label className="grid gap-1.5 text-sm text-text-secondary">
          {t("contactHandle")}
          <Input
            disabled={!registrationOpen || !input.contactType}
            onChange={(event) => setField("contact", event.target.value)}
            value={input.contact}
          />
          <FieldError message={result?.fieldErrors?.contact} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-text-secondary">
        <input
          checked={input.confirmed}
          className="mt-1 accent-[#00D2FF]"
          disabled={!registrationOpen}
          onChange={(event) => setField("confirmed", event.target.checked)}
          type="checkbox"
        />
        <span>
          {t("confirmed")}
          <FieldError message={result?.fieldErrors?.confirmed} />
        </span>
      </label>
      {result?.message && (
        <p
          className={
            result.ok
              ? "rounded-md border border-cn-success/35 bg-cn-success/10 p-3 text-sm text-cn-success"
              : "rounded-md border border-cn-danger/35 bg-cn-danger/10 p-3 text-sm text-cn-danger"
          }
        >
          {t(`messages.${result.message}`)}
        </p>
      )}
      <Button className="w-fit" disabled={!registrationOpen || isPending} type="submit">
        {isPending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
