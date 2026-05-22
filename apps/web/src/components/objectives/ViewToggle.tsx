"use client";

import { List, Map } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewToggle({
  onChange,
  value,
}: {
  onChange: (value: "list" | "map") => void;
  value: "list" | "map";
}) {
  const t = useTranslations("objectives");

  return (
    <div className="grid grid-cols-2 rounded-md border border-border-default bg-base p-1">
      <Button
        className={cn(value === "list" && "border-border-active text-cn-cyan")}
        onClick={() => onChange("list")}
        variant="ghost"
      >
        <List />
        {t("list")}
      </Button>
      <Button
        className={cn(value === "map" && "border-border-active text-cn-cyan")}
        onClick={() => onChange("map")}
        variant="ghost"
      >
        <Map />
        {t("map")}
      </Button>
    </div>
  );
}
