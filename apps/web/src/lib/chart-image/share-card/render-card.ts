import { encodePng } from "../rasterize";
import { cardLayout } from "./card-layout";
import { CARD_THEMES } from "./card-themes";
import { drawCard, type ShareCardSpec } from "./draw-card";

export type { ShareCardSpec } from "./draw-card";

export async function paintShareCard(
  canvas: HTMLCanvasElement,
  spec: ShareCardSpec,
): Promise<void> {
  await document.fonts.ready;
  const layout = cardLayout(spec.options.size, spec.options);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser cannot draw images");
  drawCard(
    {
      context,
      layout,
      theme: CARD_THEMES[spec.options.theme],
      family: getComputedStyle(document.body).fontFamily,
    },
    spec,
  );
}

export async function renderShareCard(spec: ShareCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await paintShareCard(canvas, spec);
  return encodePng(canvas);
}
