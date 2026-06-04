import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ProfileLanguageForm } from "@/components/phase2/ProfileLanguageForm";
import { roleLabel, statusBadge, TextLink } from "@/components/phase2/Phase2Utils";
import { type Locale, locales, defaultLocale } from "@/i18n/config";
import { ProfileIntegrations } from "@/components/phase2/ProfileIntegrations";

export default async function ProfilePage() {
  const t = await getTranslations("phase2.profile");
  const common = await getTranslations("phase2.common");
  const statusT = await getTranslations("phase2.status");
  const rolesT = await getTranslations("phase2.roles");
  const session = await auth.api.getSession({ headers: await headers() });
  const sessionUser = session!.user as Record<string, unknown>;
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id as string },
    include: { allianceMember: { select: { id: true, username: true, currentRank: true, memberStatus: true } } },
  });

  const language = user?.language && locales.includes(user.language as Locale)
    ? user.language as Locale
    : defaultLocale;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("username")}</p>
            <p className="text-sm text-text-primary">{user?.username ?? common("none")}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("ingameName")}</p>
            <p className="text-sm text-text-primary">{user?.name ?? common("none")}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("role")}</p>
            <Badge>{roleLabel(user?.role, common("none"), rolesT("admin"))}</Badge>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("linkedMember")}</p>
            {user?.allianceMember ? (
              <TextLink href={`/members/${user.allianceMember.id}`}>{user.allianceMember.username}</TextLink>
            ) : (
              <p className="text-sm text-text-muted">{common("notLinked")}</p>
            )}
          </div>
        </div>

        {user?.allianceMember && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{user.allianceMember.currentRank ?? common("none")}</Badge>
            {statusBadge(user.allianceMember.memberStatus, undefined, statusT(user.allianceMember.memberStatus))}
          </div>
        )}
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-4">
        <ProfileLanguageForm initialLanguage={language} />
        <div className="rounded-md border border-border-dim bg-raised p-3 text-sm text-text-muted">
          {t("passwordResetNote")}
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-4">
        <h3 className="text-sm font-bold text-text-primary">{t("integrations.title")}</h3>
        <ProfileIntegrations
          initialDiscord={{ id: user?.discordId, username: user?.discordUsername }}
          initialTelegram={{ id: user?.telegramId, username: user?.telegramUsername }}
        />
      </section>
    </div>
  );
}
