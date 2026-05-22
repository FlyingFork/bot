import { DataCard } from "./data-card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  description,
  headerAction,
  children,
  className,
}: ChartCardProps) {
  return (
    <DataCard
      title={title}
      description={description}
      headerAction={headerAction}
      className={className}
    >
      <div className={cn("w-full", className)}>{children}</div>
    </DataCard>
  );
}
