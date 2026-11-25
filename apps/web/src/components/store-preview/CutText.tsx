import type { CSSProperties } from "react";
import type { FontMeasure } from "@/lib/store-preview/canvas-measure";
import { fitStoreText } from "@/lib/store-preview/cut-sentence";
import type {
  StorePreviewDevice,
  StoreTextLayout,
} from "@/lib/store-preview/store-layouts";

const textStyle = (
  layout: StoreTextLayout,
  device: StorePreviewDevice,
): CSSProperties => ({
  width: layout.widths[device],
  fontFamily: layout.fontFamily,
  fontSize: layout.fontPx,
  fontWeight: layout.weight,
  lineHeight: `${layout.lineHeightPx}px`,
});

const clampStyle = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
  overflowWrap: "anywhere",
});

export function CutText({
  text,
  layout,
  device,
  measure,
  className,
}: {
  text: string;
  layout: StoreTextLayout;
  device: StorePreviewDevice;
  measure: FontMeasure | null;
  className?: string;
}) {
  const style = textStyle(layout, device);
  if (measure === null) {
    return (
      <span
        dir="auto"
        data-slot="store-text"
        className={className}
        style={{ ...style, ...clampStyle(layout.lines) }}
      >
        {text}
      </span>
    );
  }
  const fit = fitStoreText(text, layout, device, measure);
  return (
    <span
      dir="auto"
      data-slot="store-text"
      data-cut={fit.cut ? "true" : undefined}
      className={className}
      style={style}
    >
      {fit.lines.map((line, index) => (
        <span key={index} className="block overflow-hidden whitespace-pre">
          {line}
        </span>
      ))}
    </span>
  );
}
