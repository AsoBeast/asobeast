"use client";

import { useState } from "react";
import Image from "next/image";
import type { AuditScreenshotObservation } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { MESSAGE_LABEL } from "./audit-copy";

const SCREENSHOT_WIDTH = 180;
const SCREENSHOT_HEIGHT = 320;

export function ScreenshotCard({
  screenshot,
}: {
  screenshot: AuditScreenshotObservation;
}) {
  const [failed, setFailed] = useState(false);
  const alt = `Screenshot ${screenshot.position}${
    screenshot.captionText ? `: ${screenshot.captionText}` : ""
  }`;

  return (
    <li className="w-[45vw] shrink-0 snap-start sm:w-[180px]">
      <figure className="flex flex-col gap-2">
        {failed ? (
          <span
            role="img"
            aria-label={`${alt}, image unavailable`}
            style={{ height: SCREENSHOT_HEIGHT }}
            className="grid place-items-center rounded-xl bg-muted text-caption text-muted-foreground"
          >
            Image unavailable
          </span>
        ) : (
          <Image
            src={screenshot.url}
            alt={alt}
            width={SCREENSHOT_WIDTH}
            height={SCREENSHOT_HEIGHT}
            loading="lazy"
            sizes="(max-width: 640px) 45vw, 180px"
            className="w-full rounded-xl object-cover"
            onError={() => setFailed(true)}
          />
        )}
        <figcaption className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {screenshot.captionText ?? "No readable caption"}
          </span>
          <span className="text-caption text-muted-foreground">
            {MESSAGE_LABEL[screenshot.message]}
            {screenshot.captionLanguage
              ? ` · ${screenshot.captionLanguage}`
              : ""}
          </span>
          {screenshot.keywordHits.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {screenshot.keywordHits.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </li>
  );
}
