import { seriesColor, seriesDash } from "@/components/charts/theme";

export function SeriesSwatch({ index }: { index: number }) {
  return (
    <svg
      data-swatch
      aria-hidden
      width="18"
      height="8"
      viewBox="0 0 18 8"
      className="shrink-0 [print-color-adjust:exact]"
    >
      <line
        x1="0"
        y1="4"
        x2="18"
        y2="4"
        stroke={seriesColor(index)}
        strokeWidth="2"
        strokeDasharray={seriesDash(index)}
      />
    </svg>
  );
}
