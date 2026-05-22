import { cn } from "@/lib/utils";

interface ActivityItemProps {
  actor: string;
  action: string;
  target?: string;
  time: string;
  type?: "info" | "warning" | "danger" | "success";
}

const typeStyles = {
  info: "text-cn-cyan",
  warning: "text-cn-warning",
  danger: "text-cn-danger",
  success: "text-cn-success",
};

export function ActivityItem({
  actor,
  action,
  target,
  time,
  type = "info",
}: ActivityItemProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-border-dim last:border-0">
      <span className="text-text-secondary">
        <span className={cn("font-semibold", typeStyles[type])}>{actor}</span>{" "}
        {action}
        {target && (
          <span className="text-text-primary font-medium"> {target}</span>
        )}
      </span>
      <span className="text-text-muted shrink-0 ml-4">{time}</span>
    </div>
  );
}
