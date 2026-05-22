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
        "flex items-center gap-2 py-2 text-sm font-medium transition-colors relative",
        subItem ? "pl-9 pr-3 text-xs" : "px-3.5",
        isActive
          ? "text-cn-cyan bg-cn-cyan-glow before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-cn-cyan before:rounded-r-sm"
          : "text-text-secondary hover:bg-raised/50 hover:text-text-primary",
        className,
      )}
    >
      {children}
    </Link>
  );
}
