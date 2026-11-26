import type { Store } from "@asobeast/shared";
import { iconRadius } from "@/lib/app-icon-radius";
import { PRODUCT_NAME } from "@/lib/brand";
import { storeLabel } from "@/lib/format";
import { dayRangeLabel } from "../caption";
import type { CardChartKind } from "./card-chart";
import type { CardBox } from "./card-layout";
import type { ShareCardOptions } from "./card-options";
import { type CardPainter, drawText, traceRoundedBox } from "./card-paint";
import { drawCardChart } from "./draw-chart";
import type { ShareHeadline } from "./headline";

export interface ShareCardSpec {
  headline: ShareHeadline;
  kind: CardChartKind;
  depth: number;
  appName: string;
  store: Store;
  options: ShareCardOptions;
  icon: HTMLImageElement | null;
  mark: HTMLImageElement | null;
}

const PLACEHOLDER_SHARE = 0.4;
const PLACEHOLDER_RADIUS = 0.3;
const FIGURE_BASELINE = 0.8;
const TRAIL_GAP_UNITS = 0.4;

function drawImageTile(
  painter: CardPainter,
  image: HTMLImageElement,
  box: CardBox,
) {
  const { context } = painter;
  context.save();
  traceRoundedBox(context, box, iconRadius(box.width));
  context.clip();
  context.drawImage(image, box.x, box.y, box.width, box.height);
  context.restore();
}

function drawPlaceholder(painter: CardPainter, box: CardBox) {
  const { context, theme } = painter;
  traceRoundedBox(context, box, iconRadius(box.width));
  context.fillStyle = theme.tile;
  context.fill();
  context.strokeStyle = theme.line;
  context.lineWidth = 1;
  context.stroke();
  const inner = box.width * PLACEHOLDER_SHARE;
  const offset = (box.width - inner) / 2;
  traceRoundedBox(
    context,
    { x: box.x + offset, y: box.y + offset, width: inner, height: inner },
    inner * PLACEHOLDER_RADIUS,
  );
  context.fillStyle = theme.line;
  context.fill();
}

function drawHeader(painter: CardPainter, spec: ShareCardSpec) {
  const { layout, theme } = painter;
  if (!layout.icon || !layout.name || !layout.store) return;
  if (spec.icon) drawImageTile(painter, spec.icon, layout.icon);
  else drawPlaceholder(painter, layout.icon);
  drawText(painter, spec.appName, layout.name, {
    role: "name",
    weight: 600,
    color: theme.ink,
  });
  drawText(painter, storeLabel(spec.store), layout.store, {
    role: "store",
    weight: 400,
    color: theme.muted,
  });
}

function drawHeadline(painter: CardPainter, headline: ShareHeadline) {
  const { layout, theme } = painter;
  const { figure } = layout;
  drawText(painter, headline.lead, layout.lead, {
    role: "lead",
    weight: 500,
    color: theme.muted,
  });
  const baseline = figure.y + figure.height * FIGURE_BASELINE;
  const figureWidth = drawText(painter, headline.figure, figure, {
    role: "figure",
    weight: 600,
    color: theme.ink,
    baseline,
  });
  if (headline.trail !== null) {
    const indent = figureWidth + Math.round(layout.unit * TRAIL_GAP_UNITS);
    drawText(
      painter,
      headline.trail,
      { ...figure, x: figure.x + indent, width: figure.width - indent },
      { role: "trail", weight: 500, color: theme.ink, baseline },
    );
  }
  if (layout.change && headline.change !== null) {
    drawText(painter, headline.change, layout.change, {
      role: "change",
      weight: 400,
      color: theme.muted,
    });
  }
}

function drawFooter(painter: CardPainter, mark: HTMLImageElement | null) {
  const { layout, theme } = painter;
  if (mark) drawImageTile(painter, mark, layout.mark);
  drawText(painter, `Made with ${PRODUCT_NAME}`, layout.credit, {
    role: "credit",
    weight: 500,
    color: theme.muted,
  });
}

export function drawCard(painter: CardPainter, spec: ShareCardSpec) {
  const { context, layout, theme } = painter;
  const { headline } = spec;
  context.fillStyle = theme.background;
  context.fillRect(0, 0, layout.width, layout.height);
  drawHeader(painter, spec);
  drawHeadline(painter, headline);
  drawCardChart(painter, {
    line: headline.line,
    kind: spec.kind,
    depth: spec.depth,
  });
  drawText(painter, dayRangeLabel(headline.from, headline.to), layout.range, {
    role: "range",
    weight: 400,
    color: theme.muted,
  });
  drawFooter(painter, spec.mark);
}
