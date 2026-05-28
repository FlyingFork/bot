import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@tiles-survive/database";
import { hasRole } from "@/lib/roles";
import { getUploadHealth, getContributionScores, type ContributionScore } from "@/lib/phase4";
import { formatPower } from "@/lib/power";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeDisplay } from "@/components/TimeDisplay";
import { UploadHealthChips } from "@/components/phase4/UploadHealthChips";

export default async function DashboardPage() {
  const t = await getTranslations("phase2.dashboard");
  const common = await getTranslations("phase2.common");
  const rolesT = await getTranslations("phase2.roles");
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session!.user as Record<string, unknown>;
  const username = (user.username as string | undefined) ?? (user.name as string | undefined) ?? common("unknown");
  const role = (user.role as string | undefined) ?? "r1";
  const roleLabel = role === "admin" ? rolesT("admin") : role.toUpperCase();
  const isAdmin = role === "admin";
  const isR4Plus = hasRole(role, "r4");
  const allianceMemberId = user.allianceMemberId as string | undefined;

  const [
    pendingUploads,
    pendingVerifications,
    duel,
    raid,
    notifications,
    ownMember,
    health,
    contributionMap,
  ] = await Promise.all([
    isR4Plus ? prisma.pendingChange.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    isAdmin ? prisma.user.count({ where: { platformStatus: "PENDING" } }) : Promise.resolve(0),
    prisma.allianceDuelInstance.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, startDate: true, opponentName: true, opponentTag: true },
    }),
    prisma.reservoirRaidPlan.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, raidDate: true, registrationOpen: true },
    }),
    prisma.notification.findMany({
      where: { userId: user.id as string, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    allianceMemberId
      ? prisma.allianceMember.findUnique({
          where: { id: allianceMemberId },
          select: { id: true, username: true, currentRank: true, currentPower: true },
        })
      : Promise.resolve(null),
    isR4Plus ? getUploadHealth() : Promise.resolve([]),
    !isR4Plus && allianceMemberId
      ? getContributionScores([allianceMemberId])
      : Promise.resolve(new Map<string, ContributionScore>()),
  ]);

  const myContribution = allianceMemberId ? contributionMap.get(allianceMemberId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("welcome", { username })} />

      <div className="flex items-center gap-2">
        <Badge variant="secondary">{roleLabel}</Badge>
      </div>

      {isR4Plus ? (
        <>
          <div className="grid gap-3 xl:gap-4 md:grid-cols-3">
            <Link href={isAdmin ? "/admin/upload-requests" : "/upload"}>
              <StatCard label={t("pendingUploads")} value={pendingUploads} delta={isAdmin ? t("openQueue") : t("adminApprovalQueue")} />
            </Link>
            {isAdmin && (
              <Link href="/admin/verifications">
                <StatCard label={t("pendingVerifications")} value={pendingVerifications} delta={t("openVerificationQueue")} />
              </Link>
            )}
            <Link href="/notifications">
              <StatCard label={t("notifications")} value={notifications.length} delta={t("latestPreview")} />
            </Link>
          </div>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>{t("uploadHealth")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <UploadHealthChips health={health} />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-3 xl:gap-4 md:grid-cols-3">
            <StatCard
              label={t("member")}
              value={ownMember?.username ?? t("unlinked")}
              delta={ownMember?.currentRank ?? t("noRank")}
            />
            <StatCard
              label={t("power")}
              value={ownMember?.currentPower != null ? formatPower(ownMember.currentPower) : common("noDataYet")}
            />
            <StatCard
              label={t("contributionScore")}
              value={myContribution ? String(myContribution.score) : common("noDataYet")}
            />
          </div>

          {myContribution && (myContribution.duelTotal > 0 || myContribution.raidTotal > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              <StatCard
                label={t("duelParticipation")}
                value={`${myContribution.duelParticipated}/${myContribution.duelTotal}`}
              />
              <StatCard
                label={t("raidParticipation")}
                value={`${myContribution.raidParticipated}/${myContribution.raidTotal}`}
              />
            </div>
          )}

          {raid?.registrationOpen && (
            <Link
              href={`/events/reservoir-raid/${raid.id}`}
              className="block rounded-lg border border-gold-border bg-surface-2 p-3 hover:border-gold transition-colors"
            >
              <p className="font-medium text-gold">{t("raidRegistrationOpen")}</p>
              <p className="text-xs text-muted mt-0.5">{t("raidRegistrationCta")}</p>
            </Link>
          )}
        </>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>{t("upcomingEvents")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {duel && (
              <Link href={`/events/alliance-duel/${duel.id}`} className="block rounded-lg border border-border-line bg-surface-2 p-3 hover:border-gold-border transition-colors">
                <p className="font-medium text-text">{t("allianceDuel")}</p>
                <p className="text-xs text-muted mt-0.5">
                  {duel.opponentName ?? duel.opponentTag ?? t("opponentPending")} · <TimeDisplay date={duel.startDate} />
                </p>
              </Link>
            )}
            {raid && (
              <Link href={`/events/reservoir-raid/${raid.id}`} className="block rounded-lg border border-border-line bg-surface-2 p-3 hover:border-gold-border transition-colors">
                <p className="font-medium text-text">{t("reservoirRaid")}</p>
                <p className="text-xs text-muted mt-0.5"><TimeDisplay date={raid.startsAt} /></p>
              </Link>
            )}
            {!duel && !raid && (
              <p className="text-sm text-muted">{t("noActiveEvents")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>{t("recentNotifications")}</CardTitle>
            <div data-slot="card-action">
              <Link href="/notifications" className="text-xs text-gold hover:underline">{t("viewAll")}</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div key={item.id} className="rounded-lg border border-border-line bg-surface-2 p-3">
                  <p className="text-sm font-medium text-text">{item.title}</p>
                  <p className="text-xs text-muted mt-0.5">{item.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">{t("noNotifications")}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
