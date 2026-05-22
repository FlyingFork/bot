"use client";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function MobileNavTrigger({ onClick }: { onClick: () => void }) {
  const t = useTranslations("nav");

  return (
    <button
      onClick={onClick}
      className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 text-text-secondary hover:text-text-primary"
      aria-label={t("openNavigation")}
    >
      <Menu size={20} />
    </button>
  );
}

interface MobileNavOverlayProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileNavOverlay({ open, onClose, children }: MobileNavOverlayProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base bg-grid-pattern md:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-cn-cyan rounded flex items-center justify-center text-void font-extrabold text-[10px] shrink-0">
            TS
          </div>
          <span className="text-sm font-extrabold tracking-tight text-text-primary">Tiles Survive</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 text-text-secondary hover:text-text-primary"
          aria-label={t("closeNavigation")}
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex flex-col flex-1 overflow-y-auto pt-2 pb-6">
        {children}
      </nav>
    </div>
  );
}

export function MobileNav({ navContent }: { navContent: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <MobileNavTrigger onClick={() => setOpen(true)} />
      <MobileNavOverlay open={open} onClose={() => setOpen(false)}>
        {navContent}
      </MobileNavOverlay>
    </>
  );
}
