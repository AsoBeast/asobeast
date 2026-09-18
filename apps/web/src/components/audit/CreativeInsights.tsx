import Link from "next/link";
import type { AppAuditResult } from "@asobeast/shared";
import { AppIconImage } from "@/components/AppIconImage";
import { Card, CardContent } from "@/components/ui/card";
import { ScreenshotCard } from "./ScreenshotCard";

const ICON_SIZES = [180, 60, 40];

const ELEMENT_COUNT_LABEL: Readonly<Record<string, string>> = Object.freeze({
  one: "One element",
  two: "Two elements",
  "three-or-more": "Three or more elements",
});

export function CreativeInsights({ audit }: { audit: AppAuditResult }) {
  const { creative, ai } = audit;

  if (!creative) {
    if (!ai.configured) return null;
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run the analysis to see what AI reads on your icon and screenshots.{" "}
            <Link
              href="#ai-analysis"
              className="font-medium underline-offset-4 hover:underline"
            >
              Analyze creative
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <section
          aria-labelledby="creative-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="creative-heading" className="text-lg font-medium">
            Creative
          </h2>
          {creative.stale ? (
            <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              These observations describe your previous screenshots.
            </p>
          ) : null}

          {creative.icon ? (
            <div className="flex flex-wrap items-end gap-4">
              {ICON_SIZES.map((size) => (
                <AppIconImage
                  key={size}
                  src={creative.icon!.url}
                  size={size}
                  fallback={
                    <span
                      style={{ width: size, height: size }}
                      className="grid shrink-0 place-items-center rounded-xl bg-muted text-caption text-muted-foreground"
                    >
                      —
                    </span>
                  }
                />
              ))}
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                <li>
                  {creative.icon.hasText
                    ? "The icon contains text"
                    : "No text in the icon"}
                </li>
                <li>{ELEMENT_COUNT_LABEL[creative.icon.elementCount]}</li>
                <li>{creative.icon.contrast} contrast</li>
                <li>
                  {creative.icon.similarCompetitor
                    ? `Looks like ${creative.icon.similarCompetitor.name ?? "a competitor"}`
                    : "Distinct from the competitor icons we sent"}
                </li>
              </ul>
            </div>
          ) : null}

          {creative.screenshots.length > 0 ? (
            <ul
              aria-label="Screenshots"
              tabIndex={0}
              className="flex w-full min-w-0 snap-x gap-4 overflow-x-auto pb-2"
            >
              {creative.screenshots.map((screenshot) => (
                <ScreenshotCard
                  key={`${screenshot.position}-${screenshot.url}`}
                  screenshot={screenshot}
                />
              ))}
            </ul>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
