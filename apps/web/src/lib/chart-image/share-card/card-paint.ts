import type { CardBox, CardFontRole, CardLayout } from "./card-layout";
import { fitCardText, textDirection } from "./card-text";
import type { CardTheme } from "./card-themes";

export interface CardPainter {
  context: CanvasRenderingContext2D;
  layout: CardLayout;
  theme: CardTheme;
  family: string;
}

export interface TextStyle {
  role: CardFontRole;
  weight: number;
  color: string;
  baseline?: number;
  tracking?: number;
}

const BASELINE_SHARE = 0.35;

export const fontOf = (painter: CardPainter, weight: number, size: number) =>
  `${weight} ${size}px ${painter.family}`;

export function drawText(
  painter: CardPainter,
  text: string,
  box: CardBox,
  style: TextStyle,
): number {
  const { context } = painter;
  const measureAt = (size: number) => (value: string) => {
    context.font = fontOf(painter, style.weight, size);
    context.letterSpacing = `${size * (style.tracking ?? 0)}px`;
    return context.measureText(value).width;
  };
  const fitted = fitCardText(
    text,
    box.width,
    painter.layout.fonts[style.role],
    measureAt,
  );
  context.font = fontOf(painter, style.weight, fitted.size);
  context.letterSpacing = `${fitted.size * (style.tracking ?? 0)}px`;
  context.fillStyle = style.color;
  context.direction = textDirection(text);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(
    fitted.text,
    box.x,
    style.baseline ?? box.y + box.height / 2 + fitted.size * BASELINE_SHARE,
  );
  const width = context.measureText(fitted.text).width;
  context.letterSpacing = "0px";
  return width;
}

export const clearOf = (color: string): string =>
  color.replace(/[\d.]+\)$/, "0)");

export function traceRoundedBox(
  context: CanvasRenderingContext2D,
  box: CardBox,
  radius: number,
) {
  context.beginPath();
  context.roundRect(box.x, box.y, box.width, box.height, radius);
}
