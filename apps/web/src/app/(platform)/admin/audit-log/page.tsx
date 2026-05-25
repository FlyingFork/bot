import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditLogTable } from "@/components/phase2/AuditLogTable";
import type { AuditEntry } from "@/components/phase2/types";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAuditLogPage({ searchParams }: Props) {
  const t = await getTranslations("phase2.audit");
  const common = await getTranslations("phase2.common");
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();

  const params = await searchParams;
  const page = Math.max(Number(one(params.page) ?? "1"), 1);
  const actor = one(params.actor)?.trim() ?? "";
  const action = one(params.action)?.trim() ?? "";
  const entityType = one(params.entityType)?.trim() ?? "";
  const from = one(params.from)?.trim() ?? "";
  const to = one(params.to)?.trim() ?? "";
  const pageSize = 25;

  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actor
      ? {
          actor: {
            OR: [
              { username: { contains: actor, mode: "insensitive" as const } },
              { name: { contains: actor, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [entries, total, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, username: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const query = new URLSearchParams();
  if (actor) query.set("actor", actor);
  if (action) query.set("action", action);
  if (entityType) query.set("entityType", entityType);
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <form className="grid gap-3 rounded-md border border-border-subtle bg-surface p-3 md:grid-cols-5">
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("actor")}
          <Input name="actor" defaultValue={actor} placeholder={t("actor")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("action")}
          <select name="action" defaultValue={action} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="">{t("allActions")}</option>
            {actions.map((item) => <option key={item.action} value={item.action}>{item.action}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("entity")}
          <select name="entityType" defaultValue={entityType} className="h-8 w-full rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary">
            <option value="">{t("allEntities")}</option>
            {entityTypes.filter((item) => item.entityType).map((item) => <option key={item.entityType!} value={item.entityType!}>{item.entityType}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("from")}
          <Input name="from" type="date" defaultValue={from} />
        </label>
        <label className="space-y-1 text-xs font-medium text-text-secondary">
          {t("to")}
          <Input name="to" type="date" defaultValue={to} />
        </label>
        <div className="md:col-span-5 flex gap-2">
          <Button type="submit" size="sm">{common("filter")}</Button>
          <Link href="/admin/audit-log" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>{common("reset")}</Link>
        </div>
      </form>

      <AuditLogTable entries={jsonSafe(entries) as AuditEntry[]} />

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>{t("page", { page, totalPages })}</span>
        <div className="flex gap-2">
          <Link
            href={`/admin/audit-log?${new URLSearchParams({ ...Object.fromEntries(query), page: String(Math.max(page - 1, 1)) })}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}
          >
            {common("previous")}
          </Link>
          <Link
            href={`/admin/audit-log?${new URLSearchParams({ ...Object.fromEntries(query), page: String(Math.min(page + 1, totalPages)) })}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-40")}
          >
            {common("next")}
          </Link>
        </div>
      </div>
    </div>
  );
}
