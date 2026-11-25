import type { CSSProperties } from "react";
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
  className,
}: {
  text: string;
  layout: StoreTextLayout;
  device: StorePreviewDevice;
  className?: string;
}) {
  return (
    <span
      dir="auto"
      data-slot="store-text"
      className={className}
      style={{ ...textStyle(layout, device), ...clampStyle(layout.lines) }}
    >
      {text}
    </span>
  );
}
