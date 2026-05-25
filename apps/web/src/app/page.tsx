import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart2, Swords, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getTranslations } from "next-intl/server";

export default async function IndexPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    const user = session.user as Record<string, unknown>;
    const platformStatus = user.platformStatus as string | undefined;
    if (platformStatus === "PENDING") redirect("/pending");
    if (platformStatus === "SUSPENDED" || user.banned) redirect("/suspended");
    redirect("/dashboard");
  }

  const t = await getTranslations("landing");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-8 bg-bg">
      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-grid-pattern opacity-40" />

      {/* Radial gold glow — stronger than before */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(232,160,32,0.13) 0%, transparent 68%)",
        }}
      />

      {/* Top-right controls */}
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      {/* Hero content */}
      <div className="flex flex-col items-center gap-0 text-center max-w-lg w-full">

        {/* Logo mark */}
        <div
          className="mb-7"
          style={{ animation: "fadeUp 0.35s ease-out both", animationDelay: "0ms" }}
        >
          <div
            className="relative w-14 h-14 sm:w-16 sm:h-16 bg-gold rounded-2xl flex items-center justify-center mx-auto select-none"
            style={{ animation: "pulse-ring 3s ease-in-out infinite" }}
          >
            <span className="text-bg font-extrabold text-[18px] sm:text-[20px] tracking-tight leading-none">
              TS
            </span>
          </div>
        </div>

        {/* Heading */}
        <div
          className="space-y-3 mb-8"
          style={{ animation: "fadeUp 0.35s ease-out both", animationDelay: "60ms" }}
        >
          <h1 className="text-[42px] sm:text-[56px] font-extrabold tracking-tight text-text leading-[1.05]">
            {t("title")}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-muted leading-relaxed max-w-sm mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {/* CTA buttons */}
        <div
          className="flex items-center gap-3 mb-8"
          style={{ animation: "fadeUp 0.35s ease-out both", animationDelay: "120ms" }}
        >
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ size: "lg" }),
              "px-8 shadow-[0_4px_16px_rgba(232,160,32,0.22)]",
            )}
          >
            {t("signIn")}
          </Link>
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "px-8")}
          >
            {t("signUp")}
          </Link>
        </div>

        {/* Divider */}
        <div
          className="w-full max-w-xs mb-7"
          style={{ animation: "fadeUp 0.35s ease-out both", animationDelay: "180ms" }}
        >
          <div className="h-px bg-border-line" />
        </div>

        {/* Feature pills */}
        <div
          className="flex flex-wrap items-center justify-center gap-3"
          style={{ animation: "fadeUp 0.35s ease-out both", animationDelay: "220ms" }}
        >
          {[
            { icon: BarChart2, label: t("featureStats") },
            { icon: Swords, label: t("featureEvents") },
            { icon: Users, label: t("featureMembers") },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border-line text-muted text-[12px] sm:text-[13px] font-medium"
            >
              <Icon size={13} strokeWidth={1.5} className="text-gold shrink-0" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
