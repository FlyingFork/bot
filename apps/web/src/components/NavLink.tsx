"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  subItem?: boolean;
  className?: string;
}

export function NavLink({
  href,
  children,
  exact = false,
  subItem = false,
  className,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 py-[7px] text-[13px] font-medium transition-colors relative [&_svg]:transition-colors",
        subItem ? "pl-9 pr-3 text-xs" : "px-2.5",
        isActive
          ? "text-gold bg-gold-bg before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-gold before:rounded-r-sm [&_svg]:text-gold"
          : "text-muted hover:bg-surface-2/60 hover:text-text [&_svg]:text-muted hover:[&_svg]:text-text",
        className,
      )}
    >
      {children}
    </Link>
  );
}
