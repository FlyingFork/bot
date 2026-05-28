import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 25;
const SORTS = ["name", "username", "email", "role", "platformStatus", "createdAt", "lastSeenAt"] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date | string | null | undefined, none: string) {
  if (!value) return none;
  return new Date(value).toLocaleString();
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warning";
  if (status === "SUSPENDED") return "destructive";
  return "secondary";
}

function roleLabel(role: string | null | undefined, none: string, admin: string) {
  if (!role) return none;
  return role === "admin" ? admin : role.toUpperCase();
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const t = await getTranslations("phase2.users");
  const common = await getTranslations("phase2.common");
  const rolesT = await getTranslations("phase2.roles");
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") notFound();

  const params = await searchParams;
  const q = one(params.q)?.trim() ?? "";
  const status = one(params.status)?.trim() ?? "";
  const role = one(params.role)?.trim() ?? "";
  const linked = one(params.linked)?.trim() ?? "";
  const banned = one(params.banned)?.trim() ?? "";
  const sort = SORTS.includes(one(params.sort) as (typeof SORTS)[number]) ? one(params.sort)! : "lastSeenAt";
  const dir = one(params.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(Number(one(params.page) ?? "1"), 1);

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { username: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { platformStatus: status as "PENDING" | "ACTIVE" | "SUSPENDED" } : {}),
    ...(role ? { role } : {}),
    ...(linked === "linked" ? { allianceMemberId: { not: null } } : {}),
    ...(linked === "unlinked" ? { allianceMemberId: null } : {}),
    ...(banned === "banned" ? { banned: true } : {}),
    ...(banned === "notBanned" ? { OR: [{ banned: false }, { banned: null }] } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        allianceMember: { select: { id: true, username: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: [{ [sort]: dir }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  if (status) baseQuery.set("status", status);
  if (role) baseQuery.set("role", role);
  if (linked) baseQuery.set("linked", linked);
  if (banned) baseQuery.set("banned", banned);
  baseQuery.set("sort", sort);
  baseQuery.set("dir", dir);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <form className="grid gap-3 rounded-md border border-border-subtle bg-surface p-3 lg:grid-cols-6">
        <label className="space-y-1 text-xs font-medium text-text-secondary lg:col-span-2">
          {common("search")}
          <Input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} />
        </label>
        <Select label={t("status")} name="status" value={status} options={[["", t("allStatuses")], ["PENDING", "PENDING"], ["ACTIVE", "ACTIVE"], ["SUSPENDED", "SUSPENDED"]]} />
        <Select label={t("role")} name="role" value={role} options={[["", t("allRoles")], ["admin", rolesT("admin")], ["r5", "R5"], ["r4", "R4"], ["r3", "R3"], ["r2", "R2"], ["r1", "R1"]]} />
        <Select label={t("linked")} name="linked" value={linked} options={[["", t("allLinked")], ["linked", t("linked")], ["unlinked", t("unlinked")]]} />
        <Select label={t("banState")} name="banned" value={banned} options={[["", t("allBanStates")], ["banned", t("banned")], ["notBanned", t("notBanned")]]} />
        <Select label={t("sort")} name="sort" value={sort} options={SORTS.map((item) => [item, t(`sorts.${item}`)] as [string, string])} />
        <Select label={t("direction")} name="dir" value={dir} options={[["desc", t("desc")], ["asc", t("asc")]]} />
        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="submit" size="sm">{common("filter")}</Button>
          <Link href="/admin/users" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>{common("reset")}</Link>
        </div>
      </form>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {users.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{t("empty")}</p>
        ) : users.map((item) => (
          <div key={item.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm text-text-primary truncate">{item.username ?? item.name}</div>
                <div className="text-xs text-text-muted truncate">{item.email}</div>
              </div>
              <Link href={`/admin/users/${item.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>{common("view")}</Link>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant={statusVariant(item.platformStatus)}>{item.platformStatus}</Badge>
              {item.banned && <Badge variant="destructive">{t("banned")}</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
              <span>{t("role")}: {roleLabel(item.role, common("none"), rolesT("admin"))}</span>
              <span>{t("sessions")}: {item._count.sessions}</span>
              <span>{t("lastSeen")}: {formatDate(item.lastSeenAt, t("neverSeen"))}</span>
              {item.allianceMember && <span>{t("linkedMember")}: {item.allianceMember.username}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border border-border-subtle bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("user")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("linkedMember")}</TableHead>
              <TableHead>{t("lastSeen")}</TableHead>
              <TableHead>{t("sessions")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium text-text-primary">{item.username ?? item.name}</div>
                  <div className="text-xs text-text-muted">{item.name}</div>
                </TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>{roleLabel(item.role, common("none"), rolesT("admin"))}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={statusVariant(item.platformStatus)}>{item.platformStatus}</Badge>
                    {item.banned && <Badge variant="destructive">{t("banned")}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {item.allianceMember ? (
                    <Link href={`/members/${item.allianceMember.id}`} className="text-cn-cyan hover:underline">{item.allianceMember.username}</Link>
                  ) : common("notLinked")}
                </TableCell>
                <TableCell>{formatDate(item.lastSeenAt, t("neverSeen"))}</TableCell>
                <TableCell>{item._count.sessions}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/users/${item.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>{common("view")}</Link>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-text-muted">{t("empty")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>{t("page", { page, totalPages, total })}</span>
        <div className="flex gap-2">
          <Link
            href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(baseQuery), page: String(Math.max(page - 1, 1)) })}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}
          >
            {common("previous")}
          </Link>
          <Link
            href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(baseQuery), page: String(Math.min(page + 1, totalPages)) })}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-40")}
          >
            {common("next")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: [string, string][];
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-text-secondary">
      {label}
      <select name={name} defaultValue={value} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}
