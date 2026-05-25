import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { hasRole } from "@/lib/roles";
import { jsonSafe } from "@/lib/json";
import { PageHeader } from "@/components/ui/page-header";
import { MembersTable } from "@/components/phase2/MembersTable";
import type { MemberSummary } from "@/components/phase2/types";

export default async function MembersPage() {
  const t = await getTranslations("phase2.members");
  const user = await getCurrentUser();
  if (!hasRole(user?.role, "r4")) notFound();

  const members = await prisma.allianceMember.findMany({
    orderBy: { username: "asc" },
    include: {
      user: {
        select: { id: true, username: true, name: true, role: true, platformStatus: true, banned: true },
      },
    },
  });

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <MembersTable members={jsonSafe(members) as MemberSummary[]} />
    </div>
  );
}
