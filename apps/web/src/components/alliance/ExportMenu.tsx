"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  exportCsv,
  exportXlsx,
  type ExportColumn,
} from "@/lib/export-table";

export function ExportMenu<Row>({
  columns,
  fileName,
  rows,
}: {
  columns: ExportColumn<Row>[];
  fileName: string;
  rows: Row[];
}) {
  const t = useTranslations("alliance.export");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((value) => !value)}>
        <Download />
        {t("button")}
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-72 rounded-md border border-border-default bg-surface p-3 shadow-card">
          <p className="text-xs font-semibold text-text-primary">{t("title")}</p>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">
            {t("description")}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                exportCsv(fileName, rows, columns);
                setOpen(false);
              }}
            >
              CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                exportXlsx(fileName, rows, columns);
                setOpen(false);
              }}
            >
              XLSX
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
