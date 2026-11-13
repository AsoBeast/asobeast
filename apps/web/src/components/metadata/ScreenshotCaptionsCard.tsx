"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
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
import { formatDate } from "@/lib/format";
import { screenshotsOptions } from "@/lib/queries";
import {
  CAPTION_STATUS_LABELS,
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
  const { data } = useSuspenseQuery(
    screenshotsOptions(id, market, localization),
  );

  const empty = data.screenshots.length === 0;
  const captioned = data.screenshots.filter(
    (item) => item.caption !== null,
  ).length;
  const settled = !hasPendingScreenshots(data);

  return (
    <section aria-labelledby={HEADING_ID}>
      <Card className="min-w-0">
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={HEADING_ID}>Screenshot captions</h2>
          </CardTitle>
          {!empty && settled && data.reading === "on" ? (
            <CardAction className={PANEL_COUNT}>
              <span className="numeric">
                {`${captioned} of ${data.screenshots.length} with a caption`}
              </span>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyState
              title="No screenshots recorded"
              body="Screenshots are recorded with every snapshot. Refresh the app to capture them."
            />
          ) : (
            <ol
              aria-label="Screenshots in store order"
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
                    alt={`Screenshot ${item.position}`}
                    height={THUMB_HEIGHT}
                    className="mb-1 self-start"
                  />
                  {item.caption !== null ? (
                    <p className="min-w-28 text-dense font-medium break-words text-foreground">
                      {item.caption}
                    </p>
                  ) : null}
                  <p className="min-w-28 text-caption text-faint-foreground">
                    {CAPTION_STATUS_LABELS[item.status]}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
        {empty && data.reading === "on" ? null : (
          <CardFooter className="flex-wrap gap-x-2 gap-y-1">
            <span aria-live="polite">{screenshotSummary(data)}</span>
            {data.capturedAt && !empty ? (
              <span>{`Captured ${formatDate(data.capturedAt)}.`}</span>
            ) : null}
          </CardFooter>
        )}
      </Card>
    </section>
  );
}
