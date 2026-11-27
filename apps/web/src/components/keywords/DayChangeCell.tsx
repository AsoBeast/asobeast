"use client";

import { useTranslations } from "next-intl";
import { DeltaChip } from "@/components/ui/delta-chip";
import type { DayChange } from "@/lib/keyword-day-change";
import { cn } from "@/lib/utils";

const WORD =
  "inline-flex h-[22px] items-center rounded-md px-[7px] text-label font-medium";

const TONES = {
  lost: "bg-signal-down-subtle text-signal-down",
  entered: "bg-signal-up-subtle text-signal-up",
};

const MUTED = "bg-transparent px-0 text-muted-foreground";

export function DayChangeCell({
  change,
  muted,
}: {
  change: DayChange | null;
  muted: boolean;
}) {
  const t = useTranslations("keywords");
  if (change === null) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">{t("change.none")}</span>
      </span>
    );
  }
  if (change.kind === "lost" || change.kind === "entered") {
    return (
      <span
        data-change={change.kind}
        className={cn(WORD, muted ? MUTED : TONES[change.kind])}
      >
        <span aria-hidden>{t(`change.${change.kind}`)}</span>
        <span className="sr-only">{t(`change.${change.kind}Name`)}</span>
      </span>
    );
  }
  const places = change.kind === "moved" ? change.places : 0;
  return (
    <DeltaChip
      value={places}
      period={t("change.period")}
      form={places === 0 ? "text" : "pill"}
      className={muted ? MUTED : undefined}
    />
  );
}
