import type { Store } from "@asobeast/shared";
import { iconRadius } from "@/lib/app-icon-radius";
import { storeLabel } from "@/lib/format";
import type { CardChartKind } from "./card-chart";
import type { CardBox } from "./card-layout";
import type { ShareCardOptions } from "./card-options";
import {
  type CardPainter,
  type TextStyle,
  drawText,
  measurerOf,
  traceRoundedBox,
} from "./card-paint";
import { fitLead } from "./card-text";
import { drawChange } from "./draw-change";
import { drawCardChart } from "./draw-chart";
import { drawBackdrop, drawCredit } from "./draw-frame";
import type { ShareHeadline } from "./headline";

export interface ShareCardSpec {
  headline: ShareHeadline;
  kind: CardChartKind;
  appName: string;
  store: Store;
  options: ShareCardOptions;
  icon: HTMLImageElement | null;
  mark: HTMLImageElement | null;
}

const PLACEHOLDER_SHARE = 0.4;
const PLACEHOLDER_RADIUS = 0.3;
const FIGURE_TRACKING = -0.04;

function drawIcon(painter: CardPainter, image: HTMLImageElement, box: CardBox) {
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
  context.strokeStyle = theme.panelLine;
  context.lineWidth = 1;
  context.stroke();
  const inner = box.width * PLACEHOLDER_SHARE;
  const offset = (box.width - inner) / 2;
  traceRoundedBox(
    context,
    { x: box.x + offset, y: box.y + offset, width: inner, height: inner },
    inner * PLACEHOLDER_RADIUS,
  );
  context.fillStyle = theme.panelLine;
  context.fill();
}

function drawHeader(painter: CardPainter, spec: ShareCardSpec) {
  const { layout, theme } = painter;
  if (!layout.icon || !layout.name || !layout.store) return;
  if (spec.icon) drawIcon(painter, spec.icon, layout.icon);
  else drawPlaceholder(painter, layout.icon);
  drawText(painter, spec.appName, layout.name, {
    role: "name",
    weight: 600,
    color: theme.ink,
  });
  drawText(painter, storeLabel(spec.store), layout.store, {
    role: "store",
    weight: 500,
    color: theme.muted,
  });
}

function drawLead(painter: CardPainter, headline: ShareHeadline) {
  const { layout, theme } = painter;
  const { lead } = layout;
  const muted: TextStyle = { role: "lead", weight: 500, color: theme.muted };
  if (headline.term === null) {
    drawText(painter, headline.lead, lead, muted);
    return;
  }
  const prefix = `${headline.lead} `;
  const term = fitLead(
    { prefix, term: headline.term },
    lead.width,
    layout.fonts.lead,
    measurerOf(painter, 600),
  );
  const shared: Pick<TextStyle, "size" | "direction"> = {
    size: term.size,
    direction: "ltr",
  };
  const width = drawText(painter, prefix, lead, { ...muted, ...shared });
  drawText(
    painter,
    term.text,
    { ...lead, x: lead.x + width, width: lead.width - width },
    { role: "lead", weight: 600, color: theme.ink, ...shared },
  );
}

function drawHeadline(painter: CardPainter, headline: ShareHeadline) {
  const { layout, theme } = painter;
  const { figure } = layout;
  drawLead(painter, headline);
  drawText(painter, headline.figure, figure, {
    role: "figure",
    weight: 700,
    color: theme.ink,
    baseline: figure.y + figure.height,
    tracking: FIGURE_TRACKING,
  });
  if (headline.change !== null) {
    drawChange(painter, headline.change, headline.span);
  }
}

export function drawCard(painter: CardPainter, spec: ShareCardSpec) {
  const { headline } = spec;
  drawBackdrop(painter);
  drawHeader(painter, spec);
  drawHeadline(painter, headline);
  drawCardChart(painter, {
    line: headline.line,
    kind: spec.kind,
    from: headline.from,
    to: headline.to,
  });
  drawCredit(painter, spec.mark);
}
