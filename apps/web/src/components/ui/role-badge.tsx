import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-[3px] border",
  {
    variants: {
      variant: {
        r5: "bg-cn-cyan-glow text-cn-cyan border-border-active",
        r4: "bg-amber-500/10 text-cn-warning border-cn-warning/30",
        r3: "bg-raised text-text-secondary border-border-subtle",
        online: "bg-cn-success/10 text-cn-success border-cn-success/25",
        offline: "bg-raised text-text-muted border-border-dim",
        banned: "bg-cn-danger/10 text-cn-danger border-cn-danger/25",
        warning: "bg-cn-warning/10 text-cn-warning border-cn-warning/25",
      },
    },
    defaultVariants: { variant: "r3" },
  },
);

interface RoleBadgeProps extends VariantProps<typeof badgeVariants> {
  label: string;
  pulse?: boolean;
  className?: string;
}

export function RoleBadge({
  variant,
  label,
  pulse,
  className,
}: RoleBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {variant === "online" && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full bg-cn-success",
            pulse && "animate-pulse-slow",
          )}
        />
      )}
      {label}
    </span>
  );
}
