"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordMover, RankingPoint } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { TrendLine } from "@/components/charts/Sparkline";
import { MoversPanel } from "@/components/rankings/MoversPanel";
import { positionTrail } from "@/components/rankings/position-trail";
import {
  appDetailOptions,
  appSummaryOptions,
  rankingsOptions,
} from "@/lib/queries";
import { presetDays, presetToRange } from "@/lib/ranges";
import { GapHeadline } from "./GapHeadline";
import { NearTopTen } from "./NearTopTen";

const MOVER_DAYS = 7;

const TRAIL_RANGE = "30d";

function PositionTrend({
  points,
  translator,
}: {
  points: readonly RankingPoint[];
  translator: MessageTranslator;
}) {
  const latest = points.at(-1);
  if (!latest || points.length < 2) return null;
  return (
    <TrendLine
      values={positionTrail(points)}
      label={translator("movers.positionTrend", {
        count: presetDays(TRAIL_RANGE),
      })}
      now={formatRankPosition(
        latest.position,
        latest.depth,
        latest.resultCount,
      )}
      className="ml-auto hidden sm:block print:hidden"
    />
  );
}

function useMoverTrails(id: string, movers: readonly KeywordMover[]) {
  const keywordIds = movers.map((mover) => mover.keywordId).sort();
  const { data } = useQuery({
    ...rankingsOptions(id, { ...presetToRange(TRAIL_RANGE), keywordIds }),
    enabled: keywordIds.length > 0,
  });
  return new Map(
    data?.series.map((series) => [series.keywordId, series.points]),
  );
}

export function MoversCard({ id }: { id: string }) {
  const t = useTranslations("overview");
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { up, down } = summary.movers;
  const trails = useMoverTrails(id, [...up, ...down]);

  return (
    <MoversPanel
      movers={summary.movers}
      period={{
        within: t("movers.withinDays", { count: MOVER_DAYS }),
        span: t("movers.spanDays", { count: MOVER_DAYS }),
      }}
      quiet={
        up.length + down.length > 0
          ? null
          : t("movers.quiet", { count: MOVER_DAYS })
      }
      changeHeading={t("movers.changeHeading", { count: MOVER_DAYS })}
      hrefOf={(mover) => `/apps/${id}/rankings?keywords=${mover.keywordId}`}
      lead={(mover) => (
        <>
          <span
            translate="no"
            className="truncate font-medium print:whitespace-normal"
          >
            {mover.text}
          </span>
          <PositionTrend
            points={trails.get(mover.keywordId) ?? []}
            translator={t}
          />
        </>
      )}
      footer={
        app.isCompetitor ? null : <GapHeadline id={id} home={app.country} />
      }
    >
      <NearTopTen id={id} />
    </MoversPanel>
  );
}
