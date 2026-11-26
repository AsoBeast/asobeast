"use client";

import type { AuditCreative, AuditIconObservation } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { AppIconImage } from "@/components/AppIconImage";
import type { MessageTranslator } from "@/i18n/translator";
import { screenshotSummary } from "./creative-summary";
import { ScreenshotCard } from "./ScreenshotCard";

const ICON_SIZES = [120, 60, 40];

const SUB_HEADER =
  "flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border px-4 py-1.5 text-label";

function iconLines(icon: AuditIconObservation, t: MessageTranslator): string[] {
  return [
    icon.hasText ? t("creative.hasText") : t("creative.noText"),
    t(`creative.elements.${icon.elementCount}`),
    t(`creative.contrast.${icon.contrast}`),
    icon.similarCompetitor
      ? t("creative.similar", {
          name: icon.similarCompetitor.name ?? t("creative.aCompetitor"),
        })
      : t("creative.distinct"),
  ];
}

function IconObservations({ icon }: { icon: AuditIconObservation }) {
  const t = useTranslations("audit");
  return (
    <>
      <h3 className={SUB_HEADER}>{t("creative.icon")}</h3>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-border-subtle p-4">
        {ICON_SIZES.map((size) => (
          <figure
            key={`${icon.url}:${size}`}
            className="flex flex-col items-center gap-1.5"
          >
            <AppIconImage
              src={icon.url}
              size={size}
              fallback={
                <span
                  aria-hidden
                  style={{ width: size, height: size }}
                  className="block shrink-0 rounded-[22.5%] bg-muted"
                />
              }
            />
            <figcaption className="numeric text-tick text-faint-foreground">
              {`${size} px`}
            </figcaption>
          </figure>
        ))}
        <ul className="flex list-disc flex-col gap-1 self-center pl-4 text-dense text-muted-foreground">
          {iconLines(icon, t).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function CreativeObservations({
  creative,
}: {
  creative: AuditCreative;
}) {
  const t = useTranslations("audit");
  const { icon, screenshots } = creative;

  return (
    <>
      {creative.stale ? (
        <p className="border-t border-border px-4 py-2.5 text-caption text-muted-foreground">
          {t("creative.stale")}
        </p>
      ) : null}
      {icon ? <IconObservations icon={icon} /> : null}
      {screenshots.length > 0 ? (
        <>
          <div className={SUB_HEADER}>
            <h3>{t("creative.screenshots")}</h3>
            <span className="numeric font-normal text-faint-foreground">
              {screenshots.length}
            </span>
            <span className="font-normal text-muted-foreground sm:ml-auto">
              {screenshotSummary(screenshots)}
            </span>
          </div>
          <ul
            aria-label={t("screenshot.aria")}
            tabIndex={0}
            className="flex w-full min-w-0 list-none snap-x gap-4 overflow-x-auto border-t border-border-subtle p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {screenshots.map((screenshot) => (
              <ScreenshotCard
                key={`${screenshot.position}-${screenshot.url}`}
                screenshot={screenshot}
              />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
