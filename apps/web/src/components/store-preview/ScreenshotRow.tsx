import type { ScreenshotItem } from "@asobeast/shared";
import { ScreenshotThumb } from "@/components/screenshots/ScreenshotThumb";
import { PREVIEW_SCREENSHOTS } from "@/lib/store-preview/preview-listing";

const WIDEST_PORTRAIT = 9 / 16;
const SCREEN_INSET = 16;
const GAP = 8;

const rowHeight = (screenWidth: number): number =>
  Math.floor(
    (screenWidth - 2 * SCREEN_INSET - (PREVIEW_SCREENSHOTS - 1) * GAP) /
      PREVIEW_SCREENSHOTS /
      WIDEST_PORTRAIT,
  );

export function ScreenshotRow({
  screenshots,
  screenWidth,
}: {
  screenshots: readonly ScreenshotItem[];
  screenWidth: number;
}) {
  if (screenshots.length === 0) {
    return (
      <p className="text-caption text-muted-foreground">
        No screenshots captured yet
      </p>
    );
  }
  const height = rowHeight(screenWidth);
  return (
    <div
      data-slot="store-preview-screenshots"
      className="flex flex-wrap gap-2 overflow-hidden"
      style={{ height }}
    >
      {screenshots.map((screenshot, index) => (
        <ScreenshotThumb
          key={screenshot.url}
          src={screenshot.url}
          alt={`Screenshot ${index + 1}`}
          height={height}
          className="max-w-full"
        />
      ))}
    </div>
  );
}
