import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({ title, subtitle, action, backHref }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="mt-0.5 flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </Link>
        )}
        <div>
          <h1 className="text-[22px] font-semibold text-text tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[14px] text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
