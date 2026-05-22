import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function PendingPage() {
  const t = await getTranslations("auth.pending");

  // Try to get the username from an active session (if it exists)
  let username: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      username = session.user.username ?? session.user.name ?? null;
    }
  } catch {}

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary">{t("heading")}</h1>
          <p className="text-sm text-text-secondary">{t("description")}</p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-card space-y-4">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cn-cyan text-xs font-bold text-void">
              1
            </span>
            <div>
              <p className="font-medium text-text-primary">{t("step1Heading")}</p>
              <p className="text-sm text-text-secondary">{t("step1")}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cn-cyan text-xs font-bold text-void">
              2
            </span>
            <div>
              <p className="font-medium text-text-primary">{t("step2Heading")}</p>
              <p className="text-sm text-text-secondary">{t("step2")}</p>
              {username && (
                <code className="mt-1 block rounded-[3px] border border-border-dim bg-raised px-2 py-1 text-sm font-mono font-semibold text-text-primary">
                  {username}
                </code>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border-dim bg-raised p-3 text-xs text-text-muted">
            {t("passwordNote")}
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("backToHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
