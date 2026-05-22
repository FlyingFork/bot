import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { MembersTable } from "@/components/alliance/MembersTable";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ArchivedMembersPage() {
  const t = await getTranslations("alliance.members");
  const members = await prisma.allianceMember.findMany({
    where: { active: false },
    orderBy: [{ currentPower: "desc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      active: true,
      currentRank: true,
      currentPower: true,
      currentPowerPlantLevel: true,
      lastRosterImportedAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={t("archivedTitle")}
        subtitle={t("archivedSubtitle")}
        action={
          <Link
            href="/dashboard/members"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("activeRoster")}
          </Link>
        }
      />
      <MembersTable
        exportName="archived-alliance-members"
        members={members.map((member) => ({
          ...member,
          currentRank: member.currentRank,
          currentPower: member.currentPower?.toString() ?? null,
          lastRosterImportedAt: member.lastRosterImportedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
