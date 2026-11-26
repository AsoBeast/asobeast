"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  staleCheckLabel,
  staleCheckLine,
} from "@/components/keywords/stale-check";

import { useAppLocale } from "@/lib/use-app-locale";

export function StaleClock({ day }: { day: string }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          tabIndex={0}
          aria-label={staleCheckLabel(day, t, locale)}
          className="inline-flex rounded-sm text-muted-foreground"
        >
          <Clock aria-hidden className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{staleCheckLine(day, t, locale)}</TooltipContent>
    </Tooltip>
  );
}
