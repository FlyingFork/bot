"use client";

import { useState } from "react";
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminTestPanel } from "@/components/phase2/AdminTestPanel";

export function AdminTestPanelTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-muted hover:text-gold"
        aria-label="Open test panel"
      >
        <Terminal size={15} />
      </Button>

      <AdminTestPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
