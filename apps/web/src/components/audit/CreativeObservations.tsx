import type { AuditCreative, AuditIconObservation } from "@asobeast/shared";
import { AppIconImage } from "@/components/AppIconImage";
import { screenshotSummary } from "./creative-summary";
import { ScreenshotCard } from "./ScreenshotCard";

const ICON_SIZES = [120, 60, 40];

const ELEMENT_COUNT_LABEL: Record<
  AuditIconObservation["elementCount"],
  string
> = {
  one: "One element",
  two: "Two elements",
  "three-or-more": "Three or more elements",
};

const CONTRAST_LABEL: Record<AuditIconObservation["contrast"], string> = {
  high: "High contrast",
  medium: "Medium contrast",
  low: "Low contrast",
};

const SUB_HEADER =
  "flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border px-4 py-1.5 text-label";

function iconLines(icon: AuditIconObservation): string[] {
  return [
    icon.hasText ? "The icon contains text" : "No text in the icon",
    ELEMENT_COUNT_LABEL[icon.elementCount],
    CONTRAST_LABEL[icon.contrast],
    icon.similarCompetitor
      ? `Looks like ${icon.similarCompetitor.name ?? "a competitor"}`
      : "Distinct from the competitor icons we sent",
  ];
}

function IconObservations({ icon }: { icon: AuditIconObservation }) {
  return (
    <>
      <h3 className={SUB_HEADER}>Icon</h3>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-border-subtle p-4">
        {ICON_SIZES.map((size) => (
          <figure key={size} className="flex flex-col items-center gap-1.5">
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
          {iconLines(icon).map((line) => (
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
  const { icon, screenshots } = creative;

  return (
    <>
      {creative.stale ? (
        <p className="border-t border-border px-4 py-2.5 text-caption text-muted-foreground">
          These observations describe your previous screenshots.
        </p>
      ) : null}
      {icon ? <IconObservations icon={icon} /> : null}
      {screenshots.length > 0 ? (
        <>
          <div className={SUB_HEADER}>
            <h3>Screenshots</h3>
            <span className="numeric font-normal text-faint-foreground">
              {screenshots.length}
            </span>
            <span className="font-normal text-muted-foreground sm:ml-auto">
              {screenshotSummary(screenshots)}
            </span>
          </div>
          <ul
            aria-label="Screenshots"
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
