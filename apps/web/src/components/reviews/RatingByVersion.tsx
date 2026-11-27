"use client";

import { useId } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { LIST_HEAD, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GradedNumber } from "@/components/ui/graded";
import { formatNumberInLocale, formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import { useAppLocale } from "@/lib/use-app-locale";
import { reviewsOptions } from "@/lib/queries";
import { reviewVersionParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { BREAKDOWN_BUTTON_ROW, BreakdownBar } from "./breakdown";
import { versionRatings, type VersionRating } from "./version-ratings";

const SHOWN_VERSIONS = 6;
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-3 px-2";

export function RatingByVersion({ id }: { id: string }) {
  const t = useTranslations("reviews");
  const format = useTranslations("format");
  const locale = useAppLocale();
  const headingId = useId();
  const [version, setVersion] = useQueryState("version", reviewVersionParser);
  const { data } = useSuspenseQuery(reviewsOptions(id, {}));
  const rows = versionRatings(data.reviews, data.versions);

  if (rows.length === 0) return null;
  const shown = rows.slice(0, SHOWN_VERSIONS);
  const hidden = rows.length - shown.length;
  const largest = Math.max(...rows.map((row) => row.reviews));
  const loaded = data.reviews.length;

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>{t("ratings.byVersion")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
            <span>{t("ratings.version")}</span>
            <span className="text-right">{t("ratings.ratings")}</span>
            <span className="text-right">{t("ratings.average")}</span>
          </div>
          <ul className="flex list-none flex-col p-0">
            {shown.map((row) => {
              const selected = version === row.version;
              const judged = grade("rating", row.average);
              return (
                <li key={row.version}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={t("ratings.versionAria", {
                      version: row.version,
                      count: row.reviews,
                      average: formatRating(row.average),
                      grade: judged ? `, ${format(`grade.${judged}`)}` : "",
                    })}
                    onClick={() =>
                      void setVersion(selected ? null : row.version)
                    }
                    className={cn(COLUMNS, BREAKDOWN_BUTTON_ROW)}
                  >
                    <BreakdownBar share={row.reviews / largest} />
                    <span className="relative truncate font-medium">
                      {`v${row.version}`}
                    </span>
                    <span className="numeric relative text-right">
                      {formatNumberInLocale(row.reviews, locale)}
                    </span>
                    <GradedNumber
                      value={formatRating(row.average)}
                      grade={grade("rating", row.average)}
                      label={t("ratings.averageTitle")}
                      aligned
                      className="relative justify-end"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          {hidden > 0 ? (
            <p className="px-2 text-caption text-muted-foreground">
              {t("ratings.andMore", { count: hidden })}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <span>
            {data.total > loaded
              ? t("ratings.fromNewest", { loaded, total: data.total })
              : t("ratings.fromAll", { total: data.total })}
          </span>
        </CardFooter>
      </Card>
    </section>
  );
}
