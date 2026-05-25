import { cn } from "@/lib/utils";

interface DataCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function DataCard({
  title,
  description,
  children,
  className,
  headerAction,
}: DataCardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border-subtle rounded-lg",
        className,
      )}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim">
          <div>
            {title && (
              <h3 className="text-[16px] font-medium text-text">{title}</h3>
            )}
            {description && (
              <p className="text-[13px] text-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          {headerAction}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
