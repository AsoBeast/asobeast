"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { changesOptions, competitorsOptions } from "@/lib/queries";
import { competitorLede, LEDE_CHANGE_DAYS } from "./competitor-lede";

const FIGURE = "font-medium text-foreground";

export function CompetitorLede({ id }: { id: string }) {
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  const { data: changes } = useSuspenseQuery(
    changesOptions(id, LEDE_CHANGE_DAYS),
  );
  const lede = competitorLede(competitors.length, changes.events);
  return (
    <PageHeader
      title="Competitors"
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
