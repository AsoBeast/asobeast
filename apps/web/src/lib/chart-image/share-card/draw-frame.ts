import { PRODUCT_NAME, PRODUCT_SITE } from "@/lib/brand";
import {
  type CardPainter,
  clearOf,
  fontOf,
  traceRoundedBox,
} from "./card-paint";

const DOT_COLUMNS = 50;
const DOT_RADIUS = 1.6;
const SHADOW_BLUR = 1.8;
const SHADOW_DROP = 0.7;
const PANEL_LINE = 1.5;
const MARK_RADIUS = 0.25;
const CREDIT_LEAD = "Tracked with ";

function drawGlows(painter: CardPainter) {
  const { context, layout, theme } = painter;
  const { width, height } = layout;
  for (const glow of theme.glows) {
    const x = glow.x * width;
    const y = glow.y * height;
    const corner = Math.max(
      Math.hypot(x, y),
      Math.hypot(width - x, y),
      Math.hypot(x, height - y),
      Math.hypot(width - x, height - y),
    );
    const light = context.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      corner * glow.reach,
    );
    light.addColorStop(0, glow.color);
    light.addColorStop(1, clearOf(glow.color));
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);
  }
}

function drawDots(painter: CardPainter) {
  const { context, layout, theme } = painter;
  const step = Math.round(layout.width / DOT_COLUMNS);
  context.beginPath();
  for (let x = step / 2; x < layout.width; x += step) {
    for (let y = step / 2; y < layout.height; y += step) {
      context.moveTo(x + DOT_RADIUS, y);
      context.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
    }
  }
  context.fillStyle = theme.dots;
  context.fill();
}

function drawPanel(painter: CardPainter) {
  const { context, layout, theme } = painter;
  context.save();
  context.shadowColor = theme.shadow;
  context.shadowBlur = layout.radius * SHADOW_BLUR;
  context.shadowOffsetY = layout.radius * SHADOW_DROP;
  traceRoundedBox(context, layout.panel, layout.radius);
  context.fillStyle = theme.panel;
  context.fill();
  context.restore();
  context.lineWidth = PANEL_LINE;
  context.strokeStyle = theme.panelLine;
  context.stroke();
}

export function drawBackdrop(painter: CardPainter) {
  const { context, layout, theme } = painter;
  context.fillStyle = theme.base;
  context.fillRect(0, 0, layout.width, layout.height);
  drawGlows(painter);
  drawDots(painter);
  drawPanel(painter);
}

export function drawCredit(
  painter: CardPainter,
  mark: HTMLImageElement | null,
) {
  const { context, layout, theme } = painter;
  const { mark: tile, credit, fonts } = layout;
  if (mark) {
    context.save();
    traceRoundedBox(context, tile, tile.width * MARK_RADIUS);
    context.clip();
    context.drawImage(mark, tile.x, tile.y, tile.width, tile.height);
    context.restore();
  }
  const y = credit.y + credit.height / 2;
  context.direction = "ltr";
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.font = fontOf(painter, 500, fonts.credit);
  context.fillStyle = theme.frameMuted;
  context.fillText(CREDIT_LEAD, credit.x, y);
  const leadWidth = context.measureText(CREDIT_LEAD).width;
  context.font = fontOf(painter, 700, fonts.credit);
  context.fillStyle = theme.frameInk;
  context.fillText(PRODUCT_NAME, credit.x + leadWidth, y);
  context.font = fontOf(painter, 600, fonts.credit);
  context.textAlign = "right";
  context.fillText(PRODUCT_SITE, credit.x + credit.width, y);
}
