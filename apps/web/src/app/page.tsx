import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  const t = await getTranslations("landing");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, oklch(0.25 0.05 264) 0%, transparent 70%)",
        }}
      />

      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-extrabold tracking-tight text-text-primary sm:text-6xl">
            {t("title")}
          </h1>
          <p className="text-lg text-text-secondary">{t("subtitle")}</p>
        </div>

        <div className="flex gap-3">
          <Link href="/sign-in" className={cn(buttonVariants({ size: "lg" }))}>
            {t("signIn")}
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            {t("signUp")}
          </Link>
        </div>
      </div>
    </main>
  );
}
