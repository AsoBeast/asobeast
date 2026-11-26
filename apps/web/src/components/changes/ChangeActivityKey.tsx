"use client";

import { useTranslations } from "next-intl";
import { seriesColor } from "@/components/charts/theme";
import { changeKindLabel, CHANGE_KINDS } from "./change-fields";
import { KindMark } from "./KindMark";

export function ChangeActivityKey() {
  const t = useTranslations("changes");
  return (
    <ul
      aria-label={t("activity.chartMarks")}
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      <li className="flex items-center gap-1.5">
        <svg aria-hidden width="16" height="8" viewBox="0 0 16 8">
          <line
            x1="0"
            y1="4"
            x2="16"
            y2="4"
            stroke={seriesColor(0)}
            strokeWidth="2"
          />
        </svg>
        <span>{t("timeline.visibility")}</span>
      </li>
      {CHANGE_KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <KindMark kind={kind} />
          <span>{changeKindLabel(kind, t)}</span>
        </li>
      ))}
    </ul>
  );
}
