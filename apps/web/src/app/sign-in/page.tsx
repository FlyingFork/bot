import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignInForm } from "./SignInForm";

export default async function SignInPage() {
  const t = await getTranslations("auth.signIn");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-sm text-text-secondary">{t("subtitle")}</p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-card">
          <SignInForm />
        </div>

        <p className="text-center text-sm text-text-secondary">
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="font-medium text-cn-cyan underline-offset-4 hover:underline">
            {t("signUpLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
