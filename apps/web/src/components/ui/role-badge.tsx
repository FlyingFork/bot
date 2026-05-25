import { cn } from "@/lib/utils";

type RoleVariant = "admin" | "r5" | "r4" | "r3" | "r2" | "r1" | "active" | "pending" | "away" | "left";

const variantStyles: Record<RoleVariant, string> = {
  admin:   "bg-[rgba(224,82,82,0.15)]   border-[rgba(224,82,82,0.25)]   text-[#e05252]",
  r5:      "bg-[rgba(232,160,32,0.15)]  border-[rgba(232,160,32,0.25)]  text-[#e8a020]",
  r4:      "bg-[rgba(155,127,232,0.15)] border-[rgba(155,127,232,0.25)] text-[#9b7fe8]",
  r3:      "bg-[rgba(74,144,217,0.15)]  border-[rgba(74,144,217,0.25)]  text-[#4a90d9]",
  r2:      "bg-[rgba(52,199,123,0.15)]  border-[rgba(52,199,123,0.25)]  text-[#34c77b]",
  r1:      "bg-[rgba(107,127,160,0.15)] border-[rgba(107,127,160,0.25)] text-[#6b7fa0]",
  active:  "bg-[rgba(52,199,123,0.15)]  border-[rgba(52,199,123,0.25)]  text-[#34c77b]",
  pending: "bg-[rgba(232,160,32,0.15)]  border-[rgba(232,160,32,0.25)]  text-[#e8a020]",
  away:    "bg-[rgba(74,144,217,0.15)]  border-[rgba(74,144,217,0.25)]  text-[#4a90d9]",
  left:    "bg-[rgba(107,127,160,0.10)] border-[rgba(107,127,160,0.15)] text-[#6b7fa0]",
};

interface RoleBadgeProps {
  variant: RoleVariant;
  label: string;
  pulse?: boolean;
  className?: string;
}

export function RoleBadge({ variant, label, pulse, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.04em] px-2.5 py-0.5 rounded-sm border",
        variantStyles[variant],
        className,
      )}
    >
      {variant === "active" && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full bg-[#34c77b]",
            pulse && "animate-pulse-slow",
          )}
        />
      )}
      {label}
    </span>
  );
}
