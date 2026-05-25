import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignUpForm } from "./SignUpForm";

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-bg font-extrabold text-sm select-none">
            TS
          </div>
          <span className="text-[13px] font-semibold text-muted">Tiles Survive</span>
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-sm text-text-secondary">{t("subtitle")}</p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-card">
          <SignUpForm />
        </div>

        <p className="text-center text-sm text-text-secondary">
          {t("hasAccount")}{" "}
          <Link
            href="/sign-in"
            className="font-medium text-cn-cyan underline-offset-4 hover:underline"
          >
            {t("signInLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
