"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { changesOptions, competitorsOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { competitorLede, LEDE_CHANGE_DAYS } from "./competitor-lede";

const FIGURE = "font-medium text-foreground";

export function CompetitorLede({ id }: { id: string }) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  const { data: changes } = useQuery(changesOptions(id, LEDE_CHANGE_DAYS));
  const lede = competitorLede(competitors.length, changes?.events, t, locale);
  return (
    <PageHeader
      title={t("title")}
      titleHidden
      lede={
        <>
          <span className={FIGURE}>{lede.count}</span> <span>{lede.rest}</span>
          {lede.changed ? (
            <>
              {" "}
              <bdi className={FIGURE}>{lede.changed.name}</bdi>{" "}
              <span>{lede.changed.rest}</span>
            </>
          ) : null}
        </>
      }
    />
  );
}
