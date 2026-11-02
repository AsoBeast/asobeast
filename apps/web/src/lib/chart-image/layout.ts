import type { CaptionSeries, ChartCaption } from "./caption";

export type Measure = (text: string) => number;

export const IMAGE_SCALE = 2;

const PADDING = 20;
const TITLE_BASELINE = 16;
const TITLE_HEIGHT = 24;
const META_BASELINE = 12;
const META_HEIGHT = 18;
const SECTION_GAP = 10;
const LEGEND_TOP_GAP = 8;
const LEGEND_ROW_HEIGHT = 22;
const BRAND_GAP = 16;

export const LEGEND_SAMPLE_WIDTH = 22;
export const LEGEND_SAMPLE_GAP = 6;
const LEGEND_ITEM_GAP = 16;
const ELLIPSIS = "…";

export function clipText(
  text: string,
  maxWidth: number,
  measure: Measure,
): string {
  if (measure(text) <= maxWidth) return text;
  const characters = Array.from(text);
  while (
    characters.length > 0 &&
    measure(`${characters.join("")}${ELLIPSIS}`) > maxWidth
  ) {
    characters.pop();
  }
  return `${characters.join("")}${ELLIPSIS}`;
}

export function wrapWords(
  text: string,
  maxWidth: number,
  measure: Measure,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  return line === "" ? lines : [...lines, line];
}

export function dashPattern(dash: string | undefined): number[] {
  return dash === undefined ? [] : dash.split(" ").map(Number);
}

export interface LegendEntry {
  series: CaptionSeries;
  label: string;
  x: number;
}

export function legendRows(
  series: readonly CaptionSeries[],
  maxWidth: number,
  measure: Measure,
): LegendEntry[][] {
  const labelRoom = maxWidth - LEGEND_SAMPLE_WIDTH - LEGEND_SAMPLE_GAP;
  const rows: LegendEntry[][] = [];
  let row: LegendEntry[] = [];
  let cursor = 0;
  for (const item of series) {
    const label = clipText(item.label, labelRoom, measure);
    const width = LEGEND_SAMPLE_WIDTH + LEGEND_SAMPLE_GAP + measure(label);
    if (row.length > 0 && cursor + width > maxWidth) {
      rows.push(row);
      row = [];
      cursor = 0;
    }
    row.push({ series: item, label, x: cursor });
    cursor += width + LEGEND_ITEM_GAP;
  }
  return row.length > 0 ? [...rows, row] : rows;
}

export interface TextLine {
  text: string;
  baseline: number;
}

export interface LegendRowLayout {
  entries: LegendEntry[];
  middle: number;
}

export interface ImageLayout {
  width: number;
  height: number;
  contentX: number;
  chartY: number;
  title: TextLine;
  brand: TextLine;
  meta: TextLine[];
  legend: LegendRowLayout[];
}

export interface Measures {
  title: Measure;
  meta: Measure;
  legend: Measure;
}

export function layoutImage(
  chart: { width: number; height: number },
  caption: ChartCaption,
  measures: Measures,
): ImageLayout {
  const brandWidth = measures.meta(caption.brand);
  const titleRoom = chart.width - brandWidth - BRAND_GAP;
  const metaLines = wrapWords(caption.subtitle, chart.width, measures.meta).map(
    (line) => clipText(line, chart.width, measures.meta),
  );
  const metaTop = PADDING + TITLE_HEIGHT;
  const chartY = metaTop + metaLines.length * META_HEIGHT + SECTION_GAP;
  const legendTop = chartY + chart.height + LEGEND_TOP_GAP;
  const rows = legendRows(caption.series, chart.width, measures.legend);
  const legendBottom = legendTop + rows.length * LEGEND_ROW_HEIGHT;
  return {
    width: chart.width + 2 * PADDING,
    height: legendBottom + PADDING,
    contentX: PADDING,
    chartY,
    title: {
      text: clipText(caption.title, titleRoom, measures.title),
      baseline: PADDING + TITLE_BASELINE,
    },
    brand: { text: caption.brand, baseline: PADDING + TITLE_BASELINE },
    meta: metaLines.map((text, index) => ({
      text,
      baseline: metaTop + META_BASELINE + index * META_HEIGHT,
    })),
    legend: rows.map((entries, index) => ({
      entries,
      middle: legendTop + index * LEGEND_ROW_HEIGHT + LEGEND_ROW_HEIGHT / 2,
    })),
  };
}
