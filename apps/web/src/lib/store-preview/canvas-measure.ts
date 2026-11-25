import type { Measure } from "../text-fit";

export type FontMeasure = (font: string) => Measure;

const CACHE_LIMIT = 500;

export function createCanvasMeasure(
  context: () => CanvasRenderingContext2D | null,
): FontMeasure | null {
  const canvas = context();
  if (!canvas) return null;
  const widths = new Map<string, number>();
  return (font) => (text) => {
    const key = `${font}\n${text}`;
    const known = widths.get(key);
    if (known !== undefined) return known;
    if (widths.size >= CACHE_LIMIT) widths.clear();
    canvas.font = font;
    const width = canvas.measureText(text).width;
    widths.set(key, width);
    return width;
  };
}
