import { monotoneSegments, type Point } from "@/lib/monotone-curve";
import {
  axisLabels,
  cardChartShape,
  type CardChartKind,
  type CardChartShape,
  type CardMark,
} from "./card-chart";
import type { CardBox } from "./card-layout";
import {
  type CardPainter,
  clearOf,
  fontOf,
  traceRoundedBox,
} from "./card-paint";
import type { ShareLinePoint } from "./headline";

export interface CardChartSpec {
  line: readonly ShareLinePoint[];
  kind: CardChartKind;
  from: string;
  to: string;
}

const AXIS_BAND = 1.9;
const AXIS_BASELINE = 0.68;
const GUTTER_GAP = 0.7;
const RIGHT_INSET = 2.6;
const START_CLEARANCE = 2.2;
const START_LABEL_SIZE = 1.1;
const START_LABEL_ABOVE = 1.05;
const START_LABEL_BELOW = 1.75;
const START_LABEL_SHIFT = 0.4;
const START_DOT = 0.62;
const START_RING = 0.6;
const LONE_DOT = 0.9;
const GAP_DASH = 2.4;
const GAP_WIDTH = 0.7;
const GAP_ALPHA = 0.55;
const GLOW_BLUR = 2.8;
const HALO = 2.3;
const HALO_ALPHA = 0.18;
const RING = 0.42;
const CHIP_HEIGHT = 1.7;
const CHIP_PADDING = 0.55;
const CHIP_RADIUS = 0.32;
const CHIP_OFFSET = 2.4;
const CHIP_REACH = 2.2;

function traceRun(
  context: CanvasRenderingContext2D,
  run: readonly Point[],
  move: boolean,
) {
  const [x, y] = run[0];
  if (move) context.moveTo(x, y);
  else context.lineTo(x, y);
  for (const { first, second, end } of monotoneSegments(run)) {
    context.bezierCurveTo(...first, ...second, ...end);
  }
}

function plotOf(painter: CardPainter, chart: CardChartSpec): CardBox {
  const { context, layout } = painter;
  const { chart: box, fonts, dot } = layout;
  const headroom = Math.round(fonts.chip * CHIP_HEIGHT + dot * CHIP_OFFSET);
  const area = {
    x: box.x,
    y: box.y + headroom,
    width: box.width - dot * RIGHT_INSET,
    height: box.height - headroom - Math.round(fonts.axis * AXIS_BAND),
  };
  const { ticks } = cardChartShape(chart.line, chart.kind, area, 0);
  context.font = fontOf(painter, 500, fonts.tick);
  const widths = ticks.map(({ label }) => context.measureText(label).width);
  const gutter = Math.ceil(Math.max(0, ...widths) + fonts.tick * GUTTER_GAP);
  return { ...area, x: area.x + gutter, width: area.width - gutter };
}

function drawGrid(painter: CardPainter, shape: CardChartShape, plot: CardBox) {
  const { context, layout, theme } = painter;
  const right = layout.chart.x + layout.chart.width;
  context.font = fontOf(painter, 500, layout.fonts.tick);
  context.lineWidth = 1.5;
  context.strokeStyle = theme.grid;
  context.fillStyle = theme.muted;
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (const { label, y } of shape.ticks) {
    context.beginPath();
    context.moveTo(plot.x, y);
    context.lineTo(right, y);
    context.stroke();
    context.fillText(label, plot.x - layout.fonts.tick * GUTTER_GAP, y);
  }
}

function drawArea(painter: CardPainter, shape: CardChartShape, plot: CardBox) {
  const { context, theme } = painter;
  const bottom = plot.y + plot.height;
  const fade = context.createLinearGradient(0, plot.y, 0, bottom);
  fade.addColorStop(0, theme.seriesFill);
  fade.addColorStop(1, clearOf(theme.seriesFill));
  context.fillStyle = fade;
  for (const trace of shape.traces) {
    const first = trace[0][0];
    const last = trace[trace.length - 1].at(-1) ?? first;
    context.beginPath();
    trace.forEach((run, index) => traceRun(context, run, index === 0));
    context.lineTo(last[0], bottom);
    context.lineTo(first[0], bottom);
    context.closePath();
    context.fill();
  }
}

function drawGaps(painter: CardPainter, trace: readonly Point[][]) {
  const { context, layout } = painter;
  context.save();
  context.setLineDash([0.1, layout.stroke * GAP_DASH]);
  context.lineWidth = layout.stroke * GAP_WIDTH;
  context.globalAlpha = GAP_ALPHA;
  trace.slice(1).forEach((run, index) => {
    const [fromX, fromY] = trace[index].at(-1) ?? run[0];
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(...run[0]);
    context.stroke();
  });
  context.restore();
}

function drawLine(painter: CardPainter, shape: CardChartShape) {
  const { context, layout, theme } = painter;
  context.save();
  if (theme.glow !== null) {
    context.shadowColor = theme.glow;
    context.shadowBlur = layout.stroke * GLOW_BLUR;
  }
  context.strokeStyle = theme.series;
  context.fillStyle = theme.series;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const trace of shape.traces) {
    drawGaps(painter, trace);
    context.lineWidth = layout.stroke;
    for (const run of trace) {
      context.beginPath();
      if (run.length === 1) {
        context.arc(...run[0], layout.stroke * LONE_DOT, 0, Math.PI * 2);
        context.fill();
      } else {
        traceRun(context, run, true);
        context.stroke();
      }
    }
  }
  context.restore();
}

function drawStart(painter: CardPainter, shape: CardChartShape, plot: CardBox) {
  const { start } = shape;
  if (start === null) return;
  const { context, layout, theme } = painter;
  context.beginPath();
  context.arc(start.x, start.y, layout.dot * START_DOT, 0, Math.PI * 2);
  context.fillStyle = theme.panel;
  context.fill();
  context.lineWidth = layout.stroke * START_RING;
  context.strokeStyle = theme.series;
  context.stroke();
  if (!shape.startLabelled) return;
  const size = layout.fonts.tick * START_LABEL_SIZE;
  const next = shape.traces[0]?.[0]?.[1];
  const below = next !== undefined && next[1] < start.y;
  const fits = below
    ? start.y + size * 2 < plot.y + plot.height
    : start.y - size * 2 > plot.y;
  if (!fits) return;
  context.font = fontOf(painter, 600, size);
  context.fillStyle = theme.muted;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(
    start.label,
    start.x - layout.dot * START_LABEL_SHIFT,
    below
      ? start.y + size * START_LABEL_BELOW
      : start.y - size * START_LABEL_ABOVE,
  );
}

function drawChip(painter: CardPainter, end: CardMark) {
  const { context, layout, theme } = painter;
  const { chart: box, fonts, dot } = layout;
  context.font = fontOf(painter, 600, fonts.chip);
  const height = Math.round(fonts.chip * CHIP_HEIGHT);
  const width = Math.round(
    context.measureText(end.label).width + fonts.chip * CHIP_PADDING * 2,
  );
  const x = Math.min(end.x + dot * CHIP_REACH, box.x + box.width) - width;
  const y = end.y - dot * CHIP_OFFSET - height;
  traceRoundedBox(context, { x, y, width, height }, height * CHIP_RADIUS);
  context.fillStyle = theme.chip.fill;
  context.fill();
  context.fillStyle = theme.chip.text;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(end.label, x + width / 2, y + height / 2);
}

function drawEnd(painter: CardPainter, shape: CardChartShape) {
  const { end } = shape;
  if (end === null) return;
  const { context, layout, theme } = painter;
  context.save();
  context.globalAlpha = HALO_ALPHA;
  context.beginPath();
  context.arc(end.x, end.y, layout.dot * HALO, 0, Math.PI * 2);
  context.fillStyle = theme.series;
  context.fill();
  context.restore();
  context.beginPath();
  context.arc(end.x, end.y, layout.dot, 0, Math.PI * 2);
  context.fillStyle = theme.series;
  context.fill();
  context.lineWidth = layout.dot * RING;
  context.strokeStyle = theme.panel;
  context.stroke();
  drawChip(painter, end);
}

function drawAxis(painter: CardPainter, chart: CardChartSpec, plot: CardBox) {
  const { context, layout, theme } = painter;
  const [from, to] = axisLabels(chart.from, chart.to);
  const y =
    plot.y +
    plot.height +
    Math.round(layout.fonts.axis * AXIS_BAND) * AXIS_BASELINE;
  context.font = fontOf(painter, 500, layout.fonts.axis);
  context.fillStyle = theme.muted;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(from, plot.x, y);
  context.textAlign = "right";
  context.fillText(to, layout.chart.x + layout.chart.width, y);
}

export function drawCardChart(painter: CardPainter, chart: CardChartSpec) {
  const { context, layout } = painter;
  const plot = plotOf(painter, chart);
  const shape = cardChartShape(
    chart.line,
    chart.kind,
    plot,
    layout.fonts.tick * START_CLEARANCE,
  );
  context.direction = "ltr";
  drawGrid(painter, shape, plot);
  drawArea(painter, shape, plot);
  drawLine(painter, shape);
  drawStart(painter, shape, plot);
  drawEnd(painter, shape);
  drawAxis(painter, chart, plot);
}
