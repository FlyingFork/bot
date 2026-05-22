import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ForbiddenPage() {
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold text-text-primary">403</h1>
      <p className="text-text-secondary">{t("errors.forbidden")}</p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
        {t("common.backToHome")}
      </Link>
    </main>
  );
}
