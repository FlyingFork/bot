"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-8 w-8"
      aria-label="Toggle theme"
    >
      <Sun size={15} className="hidden dark:block" />
      <Moon size={15} className="block dark:hidden" />
    </Button>
  );
}
