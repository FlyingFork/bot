import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/SignOutButton";

export default async function SuspendedPage() {
  const t = await getTranslations("auth.suspended");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-cn-danger">{t("heading")}</h1>
          <p className="text-sm text-text-secondary">{t("description")}</p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-card">
          <p className="text-sm text-text-secondary">{t("contact")}</p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("backToHome")}
          </Link>
          <SignOutButton label={t("signOut")} />
        </div>
      </div>
    </main>
  );
}
