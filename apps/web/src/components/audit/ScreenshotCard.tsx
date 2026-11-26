"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { AuditScreenshotObservation } from "@asobeast/shared";
import { formatListInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

const SCREENSHOT_HEIGHT = 224;
const PLACEHOLDER_WIDTH = Math.round((SCREENSHOT_HEIGHT * 1320) / 2868);

export function ScreenshotCard({
  screenshot,
}: {
  screenshot: AuditScreenshotObservation;
}) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  const [failed, setFailed] = useState(false);
  const alt = t("screenshotAlt", {
    position: screenshot.position,
    caption: screenshot.captionText
      ? t("screenshotCaption", { caption: screenshot.captionText })
      : "",
  });
  const hits = screenshot.keywordHits;

  return (
    <li className="shrink-0 snap-start">
      <figure className="table">
        {failed ? (
          <span
            role="img"
            aria-label={t("imageUnavailableAria", { alt })}
            style={{ width: PLACEHOLDER_WIDTH, height: SCREENSHOT_HEIGHT }}
            className="grid place-items-center rounded-lg border bg-muted text-center text-caption text-muted-foreground"
          >
            {t("imageUnavailable")}
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
            {screenshot.captionText ?? t("screenshot.noCaption")}
          </span>
          <span className="block text-caption text-muted-foreground">
            {screenshot.captionLanguage
              ? `${t(`messages.${screenshot.message}`)} · ${screenshot.captionLanguage}`
              : t(`messages.${screenshot.message}`)}
          </span>
          {hits.length > 0 ? (
            <span className="block text-caption wrap-anywhere text-faint-foreground">
              {t("keywordHits", {
                kind: t(
                  hits.length === 1
                    ? "screenshot.keyword"
                    : "screenshot.keywords",
                ),
                keywords: formatListInLocale(hits, locale),
              })}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </li>
  );
}
