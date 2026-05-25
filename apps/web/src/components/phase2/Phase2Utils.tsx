import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const RANKS = ["R5", "R4", "R3", "R2", "R1"] as const;
export const ROLES = ["r5", "r4", "r3", "r2", "r1"] as const;
export const STATUSES = ["ACTIVE", "TEMP_AWAY", "LEFT"] as const;

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "None";
  return new Date(value).toLocaleString();
}

export function toDateInput(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function roleLabel(role: string | null | undefined, none = "None", admin = "Admin") {
  if (!role) return none;
  return role === "admin" ? admin : role.toUpperCase();
}

export function statusBadge(status: string, className?: string, label?: string) {
  const variant =
    status === "ACTIVE" ? "success" :
    status === "TEMP_AWAY" ? "warning" :
    status === "LEFT" ? "destructive" : "secondary";
  return <Badge variant={variant} className={cn(className)}>{label ?? status.replace("_", " ")}</Badge>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border-dim bg-raised/40 p-4 text-sm text-text-muted">
      {children}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-cn-cyan hover:underline">{children}</Link>;
}
