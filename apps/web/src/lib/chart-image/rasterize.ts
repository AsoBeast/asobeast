import { resolveCssVariables } from "./css-variables";
import type { ChartCaption } from "./caption";
import {
  dashPattern,
  IMAGE_SCALE,
  LEGEND_SAMPLE_WIDTH,
  layoutImage,
  type Measure,
} from "./layout";
import { untilStable } from "./settle";
import {
  chartSurface,
  linesDrawingIn,
  snapshotChartSvg,
  variableLookup,
} from "./svg-snapshot";

export interface ChartImageRequest {
  container: HTMLElement;
  caption: ChartCaption;
}

const MAX_SETTLE_CHECKS = 60;
const SETTLE_INTERVAL_MS = 50;
const LEGEND_SAMPLE_GAP = 6;

const pause = () =>
  new Promise<void>((resolve) => setTimeout(resolve, SETTLE_INTERVAL_MS));

function loadImage(markup: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The chart drawing could not load"));
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The image could not be saved")),
      "image/png",
    );
  });
}

export async function renderChartPng({
  container,
  caption,
}: ChartImageRequest): Promise<Blob> {
  await document.fonts.ready;
  await untilStable(
    () => chartSurface(container).outerHTML,
    () => linesDrawingIn(container),
    pause,
    MAX_SETTLE_CHECKS,
  );
  const chart = snapshotChartSvg(container, IMAGE_SCALE);
  const image = await loadImage(chart.markup);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser cannot draw images");

  const lookup = variableLookup(container);
  const paint = (token: string, fallback: string) =>
    resolveCssVariables(`var(${token}, ${fallback})`, lookup);
  const family = getComputedStyle(container).fontFamily;
  const fonts = {
    title: `600 16px ${family}`,
    meta: `400 12px ${family}`,
    legend: `400 12px ${family}`,
  };
  const measure =
    (font: string): Measure =>
    (text) => {
      context.font = font;
      return context.measureText(text).width;
    };
  const layout = layoutImage(chart, caption, {
    title: measure(fonts.title),
    meta: measure(fonts.meta),
    legend: measure(fonts.legend),
  });

  canvas.width = layout.width * IMAGE_SCALE;
  canvas.height = layout.height * IMAGE_SCALE;
  context.scale(IMAGE_SCALE, IMAGE_SCALE);
  context.fillStyle = paint("--card", "#ffffff");
  context.fillRect(0, 0, layout.width, layout.height);
  context.strokeStyle = paint("--border", "#d4d4d4");
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, layout.width - 1, layout.height - 1);
  context.drawImage(
    image,
    layout.contentX,
    layout.chartY,
    chart.width,
    chart.height,
  );

  context.textBaseline = "alphabetic";
  context.fillStyle = paint("--foreground", "#171717");
  context.font = fonts.title;
  context.fillText(layout.title.text, layout.contentX, layout.title.baseline);
  context.textAlign = "right";
  context.font = fonts.meta;
  context.fillStyle = paint("--muted-foreground", "#525252");
  context.fillText(
    layout.brand.text,
    layout.width - layout.contentX,
    layout.brand.baseline,
  );
  context.textAlign = "left";
  for (const line of layout.meta) {
    context.fillText(line.text, layout.contentX, line.baseline);
  }

  context.textBaseline = "middle";
  context.font = fonts.legend;
  for (const row of layout.legend) {
    for (const entry of row.entries) {
      const x = layout.contentX + entry.x;
      context.strokeStyle = resolveCssVariables(entry.series.color, lookup);
      context.lineWidth = 2;
      context.setLineDash(dashPattern(entry.series.dash));
      context.beginPath();
      context.moveTo(x, row.middle);
      context.lineTo(x + LEGEND_SAMPLE_WIDTH, row.middle);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = paint("--foreground", "#171717");
      context.fillText(
        entry.label,
        x + LEGEND_SAMPLE_WIDTH + LEGEND_SAMPLE_GAP,
        row.middle,
      );
    }
  }
  return encodePng(canvas);
}
