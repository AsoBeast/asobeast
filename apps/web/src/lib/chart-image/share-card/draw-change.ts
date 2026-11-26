import type { CardBox } from "./card-layout";
import {
  type CardPainter,
  drawText,
  fontOf,
  traceRoundedBox,
} from "./card-paint";
import { type ShareChange, type ShareDirection, spanText } from "./headline";

const GLYPH = 1.05;
const GLYPH_VIEW = 24;
const GLYPH_STROKE = 3.2;
const PAD_START = 0.55;
const PAD_END = 0.75;
const GLYPH_GAP = 0.3;
const SPAN_GAP = 0.5;

const sentenceCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

function traceGlyph(
  context: CanvasRenderingContext2D,
  direction: ShareDirection,
) {
  context.beginPath();
  if (direction === "flat") {
    context.moveTo(5, 12);
    context.lineTo(19, 12);
    return;
  }
  context.moveTo(12, 19);
  context.lineTo(12, 5.5);
  context.moveTo(5.5, 11.5);
  context.lineTo(12, 5);
  context.lineTo(18.5, 11.5);
}

function drawGlyph(
  painter: CardPainter,
  direction: ShareDirection,
  at: CardBox,
  color: string,
) {
  const { context } = painter;
  const scale = at.width / GLYPH_VIEW;
  context.save();
  context.translate(at.x, at.y);
  if (direction === "down") {
    context.translate(at.width, at.height);
    context.rotate(Math.PI);
  }
  context.scale(scale, scale);
  traceGlyph(context, direction);
  context.lineWidth = GLYPH_STROKE;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.stroke();
  context.restore();
}

export function drawChange(
  painter: CardPainter,
  change: ShareChange,
  span: number,
) {
  const { context, layout, theme } = painter;
  const row = layout.change;
  if (row === null) return;
  const size = layout.fonts.change;
  const tone = theme.change[change.direction];
  const label = sentenceCase(change.text);
  const glyph = size * GLYPH;
  context.font = fontOf(painter, 600, size);
  const labelX = row.x + size * PAD_START + glyph + size * GLYPH_GAP;
  const width =
    labelX - row.x + context.measureText(label).width + size * PAD_END;
  traceRoundedBox(context, { ...row, width }, row.height / 2);
  context.fillStyle = tone.fill;
  context.fill();
  const middle = row.y + row.height / 2;
  drawGlyph(
    painter,
    change.direction,
    {
      x: row.x + size * PAD_START,
      y: middle - glyph / 2,
      width: glyph,
      height: glyph,
    },
    tone.text,
  );
  context.direction = "ltr";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = tone.text;
  context.fillText(label, labelX, middle);
  const spanX = row.x + width + size * SPAN_GAP;
  if (spanX >= row.x + row.width) return;
  drawText(
    painter,
    spanText(span),
    { ...row, x: spanX, width: row.x + row.width - spanX },
    { role: "change", weight: 500, color: theme.muted },
  );
}
