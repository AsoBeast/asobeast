"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

const ORDER = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const;

const FALLBACK = ORDER.length - 1;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const found = ORDER.findIndex((choice) => choice.value === theme);
  const index = hydrated && found !== -1 ? found : FALLBACK;
  const { value, Icon } = ORDER[index];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(ORDER[(index + 1) % ORDER.length].value)}
      aria-label={`Theme: ${value}. Switch theme`}
    >
      <Icon className="size-4" />
    </Button>
  );
}
