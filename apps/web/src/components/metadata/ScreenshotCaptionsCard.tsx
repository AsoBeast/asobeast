"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ScreenshotThumb } from "@/components/screenshots/ScreenshotThumb";
import { PANEL_COUNT, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { invalidateMetadataAudit, screenshotsOptions } from "@/lib/queries";
import {
  captionStatusLabel,
  hasPendingScreenshots,
  screenshotSummary,
} from "@/lib/screenshot-captions";

const HEADING_ID = "screenshot-captions-heading";
const THUMB_HEIGHT = 224;

export function ScreenshotCaptionsCard({
  id,
  market,
  localization,
}: {
  id: string;
  market?: string;
  localization?: string;
}) {
  const t = useTranslations("screenshots");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(
    screenshotsOptions(id, market, localization),
  );

  const empty = data.screenshots.length === 0;
  const captioned = data.screenshots.filter(
    (item) => item.caption !== null,
  ).length;
  const settled = !hasPendingScreenshots(data);
  const queryClient = useQueryClient();
  const wasPending = useRef(!settled);
  useEffect(() => {
    if (wasPending.current && settled) {
      invalidateMetadataAudit(queryClient, id);
    }
    wasPending.current = !settled;
  }, [settled, queryClient, id]);

  return (
    <section aria-labelledby={HEADING_ID}>
      <Card className="min-w-0">
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={HEADING_ID}>{t("title")}</h2>
          </CardTitle>
          {!empty && settled && data.reading === "on" ? (
            <CardAction className={PANEL_COUNT}>
              <span className="numeric">
                {t("count", {
                  captioned,
                  total: data.screenshots.length,
                })}
              </span>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          ) : (
            <ol
              aria-label={t("aria")}
              tabIndex={0}
              className="flex list-none gap-4 overflow-x-auto p-0 pb-2"
            >
              {data.screenshots.map((item) => (
                <li
                  key={item.position}
                  className="flex w-min shrink-0 flex-col gap-1"
                >
                  <ScreenshotThumb
                    src={item.url}
                    alt={t("alt", { position: item.position })}
                    height={THUMB_HEIGHT}
                    className="mb-1 self-start"
                  />
                  {item.caption !== null ? (
                    <p className="min-w-28 text-dense font-medium wrap-anywhere text-foreground">
                      {item.caption}
                    </p>
                  ) : null}
                  <p className="min-w-28 text-caption text-faint-foreground">
                    {captionStatusLabel(item.status, t)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
        {empty && data.reading === "on" ? null : (
          <CardFooter className="flex-wrap gap-x-2 gap-y-1">
            <span aria-live="polite">{screenshotSummary(data, t)}</span>
            {data.capturedAt && !empty ? (
              <span>
                {t("captured", {
                  date: formatDateInLocale(data.capturedAt, locale),
                })}
              </span>
            ) : null}
          </CardFooter>
        )}
      </Card>
    </section>
  );
}
