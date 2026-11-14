"use client";

import { useState } from "react";
import Image from "next/image";
import type { AuditScreenshotObservation } from "@asobeast/shared";
import { formatList } from "@/lib/format";
import { MESSAGE_LABEL } from "./audit-copy";

const SCREENSHOT_HEIGHT = 224;
const PLACEHOLDER_WIDTH = Math.round((SCREENSHOT_HEIGHT * 1320) / 2868);

export function ScreenshotCard({
  screenshot,
}: {
  screenshot: AuditScreenshotObservation;
}) {
  const [failed, setFailed] = useState(false);
  const alt = `Screenshot ${screenshot.position}${
    screenshot.captionText ? `: ${screenshot.captionText}` : ""
  }`;
  const hits = screenshot.keywordHits;

  return (
    <li className="shrink-0 snap-start">
      <figure className="table">
        {failed ? (
          <span
            role="img"
            aria-label={`${alt}, image unavailable`}
            style={{ width: PLACEHOLDER_WIDTH, height: SCREENSHOT_HEIGHT }}
            className="grid place-items-center rounded-lg border bg-muted text-center text-caption text-muted-foreground"
          >
            Image unavailable
          </span>
        ) : (
          <Image
            src={screenshot.url}
            alt={alt}
            width={PLACEHOLDER_WIDTH}
            height={SCREENSHOT_HEIGHT}
            loading="lazy"
            style={{ height: SCREENSHOT_HEIGHT, width: "auto" }}
            className="max-w-none rounded-lg border object-contain"
            onError={() => setFailed(true)}
          />
        )}
        <figcaption className="table-caption caption-bottom pt-2 text-dense">
          <span dir="auto" className="block font-medium wrap-anywhere">
            {screenshot.captionText ?? "No readable caption"}
          </span>
          <span className="block text-caption text-muted-foreground">
            {screenshot.captionLanguage
              ? `${MESSAGE_LABEL[screenshot.message]} · ${screenshot.captionLanguage}`
              : MESSAGE_LABEL[screenshot.message]}
          </span>
          {hits.length > 0 ? (
            <span className="block text-caption wrap-anywhere text-faint-foreground">
              {`${hits.length === 1 ? "Keyword" : "Keywords"}: ${formatList(hits)}`}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </li>
  );
}
