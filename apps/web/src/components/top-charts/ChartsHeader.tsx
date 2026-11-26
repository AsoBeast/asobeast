"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import type { LedePart } from "./chart-summary";
import { FollowedCharts } from "./FollowedCharts";

export function ChartsHeader({
  actions,
  lede,
}: {
  actions: ReactNode;
  lede: readonly LedePart[];
}) {
  const t = useTranslations("topCharts");
  return (
    <PageHeader
      title={t("title")}
      controls={
        <>
          <FollowedCharts />
          {actions}
        </>
      }
      lede={lede.map((part, index) => {
        const Part = part.app ? "bdi" : "span";
        return (
          <Part
            key={index}
            translate={part.app ? "no" : undefined}
            className={part.strong ? "font-medium text-foreground" : undefined}
          >
            {part.text}
          </Part>
        );
      })}
    />
  );
}
