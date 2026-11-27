import {
  cardChartShape,
  type CardChartKind,
  type CardPoint,
} from "./card-chart";
import type { CardBox } from "./card-layout";
import { type CardPainter, fontOf } from "./card-paint";
import type { ShareLinePoint } from "./headline";

export interface CardChartSpec {
  line: readonly ShareLinePoint[];
  kind: CardChartKind;
  depth: number;
}

const LINE_UNITS = 0.1;
const DOT_UNITS = 0.17;
const END_DOT_UNITS = 0.24;
const END_RING_UNITS = 0.08;
const LABEL_GAP_UNITS = 0.4;
const GUTTER_GAP_UNITS = 0.5;

function tracePath(
  context: CanvasRenderingContext2D,
  run: readonly CardPoint[],
) {
  context.beginPath();
  run.forEach(({ x, y }, index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
}

function fadeUnder(painter: CardPainter, plot: CardBox): CanvasGradient {
  const { context, theme } = painter;
  const fade = context.createLinearGradient(0, plot.y, 0, plot.y + plot.height);
  fade.addColorStop(0, theme.seriesFill);
  fade.addColorStop(1, theme.seriesFill.replace(/[\d.]+\)$/, "0)"));
  return fade;
}

function drawSeries(painter: CardPainter, chart: CardChartSpec, plot: CardBox) {
  const { context, theme, layout } = painter;
  const { runs, dots, end } = cardChartShape(
    chart.line,
    chart.kind,
    plot,
    chart.depth,
  );
  const bottom = plot.y + plot.height;
  const fade = fadeUnder(painter, plot);
  context.lineWidth = Math.max(2, layout.unit * LINE_UNITS);
  context.lineJoin = "round";
  context.lineCap = "round";
  for (const run of runs) {
    tracePath(context, run);
    context.lineTo(run[run.length - 1].x, bottom);
    context.lineTo(run[0].x, bottom);
    context.closePath();
    context.fillStyle = fade;
    context.fill();
    tracePath(context, run);
    context.strokeStyle = theme.series;
    context.stroke();
  }
  context.fillStyle = theme.series;
  for (const dot of dots) {
    context.beginPath();
    context.arc(dot.x, dot.y, layout.unit * DOT_UNITS, 0, Math.PI * 2);
    context.fill();
  }
  if (end) {
    context.beginPath();
    context.arc(end.x, end.y, layout.unit * END_DOT_UNITS, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = layout.unit * END_RING_UNITS;
    context.strokeStyle = theme.background;
    context.stroke();
  }
}

function plotBox(painter: CardPainter, chart: CardChartSpec): CardBox {
  const { context, layout } = painter;
  const { chart: box, fonts, unit } = layout;
  const { ticks } = cardChartShape(chart.line, chart.kind, box, chart.depth);
  context.font = fontOf(painter, 400, fonts.tick);
  const labels = ticks.map(({ label }) => context.measureText(label).width);
  const gutter = Math.ceil(Math.max(...labels) + unit * GUTTER_GAP_UNITS);
  return {
    x: box.x + gutter,
    y: box.y + fonts.tick / 2,
    width: box.width - gutter,
    height: box.height - fonts.tick,
  };
}

export function drawCardChart(painter: CardPainter, chart: CardChartSpec) {
  const { context, layout, theme } = painter;
  const plot = plotBox(painter, chart);
  const { ticks } = cardChartShape(chart.line, chart.kind, plot, chart.depth);
  context.font = fontOf(painter, 400, layout.fonts.tick);
  context.lineWidth = 1;
  context.strokeStyle = theme.grid;
  context.fillStyle = theme.muted;
  context.direction = "ltr";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (const tick of ticks) {
    context.beginPath();
    context.moveTo(plot.x, tick.y + 0.5);
    context.lineTo(plot.x + plot.width, tick.y + 0.5);
    context.stroke();
    context.fillText(
      tick.label,
      plot.x - layout.unit * LABEL_GAP_UNITS,
      tick.y,
    );
  }
  drawSeries(painter, chart, plot);
}
