import { cn } from "@/lib/utils";

interface ActivityItemProps {
  actor: string;
  action: string;
  target?: string;
  time: string;
  type?: "info" | "warning" | "danger" | "success";
}

const typeStyles = {
  info: "text-gold",
  warning: "text-gold",
  danger: "text-danger",
  success: "text-success",
};

export function ActivityItem({
  actor,
  action,
  target,
  time,
  type = "info",
}: ActivityItemProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px] border-b border-border-line last:border-0">
      <span className="text-muted">
        <span className={cn("font-medium", typeStyles[type])}>{actor}</span>{" "}
        {action}
        {target && (
          <span className="text-text font-medium"> {target}</span>
        )}
      </span>
      <span className="text-muted shrink-0 ml-4">{time}</span>
    </div>
  );
}
