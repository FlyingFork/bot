"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewActions({ id }: { id: string }) {
  const t = useTranslations("phase3.review");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function action(kind: "approve" | "reject") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/upload-requests/${id}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = (await response.json()) as { errorCode?: string };
      if (!response.ok) {
        setMessage(t(`errors.${data.errorCode ?? "generic"}`));
        return;
      }
      setMessage(t(kind === "approve" ? "approved" : "rejected"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface p-4">
      {message && <p className="text-sm text-text-secondary">{message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => action("approve")} disabled={busy}>
          <Check />
          {t("approve")}
        </Button>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("rejectionNote")}
          className="h-8 min-w-64 rounded-[4px] border border-border-default bg-raised px-3 text-xs text-text-primary"
        />
        <Button variant="destructive" onClick={() => action("reject")} disabled={busy || !note.trim()}>
          <X />
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}
