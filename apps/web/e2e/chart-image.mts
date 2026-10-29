import type { Page } from "@playwright/test";
import type { HeldRequest } from "./held-request.mts";

export interface PngReading {
  width: number;
  height: number;
  corner: number[];
  background: number[];
  seriesPixels: number;
}

export async function clipboardPng(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    if (!item) throw new Error("The clipboard is empty");
    return Array.from(
      new Uint8Array(await (await item.getType("image/png")).arrayBuffer()),
    );
  });
  return Buffer.from(bytes);
}

export async function readPng(
  page: Page,
  png: Buffer,
  seriesToken: string,
): Promise<PngReading> {
  return page.evaluate(
    async ({ base64, token }) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${base64}`)).blob(),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("No 2d context");
      context.drawImage(bitmap, 0, 0);

      const bytesOf = (value: string) => {
        const swatch = document
          .createElement("canvas")
          .getContext("2d", { willReadFrequently: true });
        if (!swatch) throw new Error("No 2d context");
        swatch.fillStyle = value;
        swatch.fillRect(0, 0, 1, 1);
        return Array.from(swatch.getImageData(0, 0, 1, 1).data);
      };
      const root = getComputedStyle(document.documentElement);
      const wanted = bytesOf(root.getPropertyValue(token).trim());
      const pixels = context.getImageData(
        0,
        0,
        bitmap.width,
        bitmap.height,
      ).data;
      let seriesPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const near = [0, 1, 2].every(
          (channel) =>
            Math.abs((pixels[index + channel] ?? 0) - (wanted[channel] ?? 0)) <=
            8,
        );
        if (near) seriesPixels += 1;
      }
      return {
        width: bitmap.width,
        height: bitmap.height,
        corner: Array.from(context.getImageData(6, 6, 1, 1).data),
        background: bytesOf(root.getPropertyValue("--card").trim()),
        seriesPixels,
      };
    },
    { base64: png.toString("base64"), token: seriesToken },
  );
}

const PNG_SIGNATURE = "89504e470d0a1a0a";

export const isPng = (bytes: Buffer): boolean =>
  bytes.subarray(0, 8).toString("hex") === PNG_SIGNATURE;

const RENDER_GATE = "__heldRender";

export async function holdRender(page: Page): Promise<HeldRequest> {
  await page.addInitScript((gate) => {
    const { promise, resolve } = Promise.withResolvers<void>();
    Reflect.set(window, gate, resolve);
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      void promise.then(() => encode.call(this, callback, type, quality));
    };
  }, RENDER_GATE);
  return {
    release: () =>
      void page.evaluate(
        (gate) => Reflect.apply(Reflect.get(window, gate), undefined, []),
        RENDER_GATE,
      ),
  };
}

export async function withoutImageClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "ClipboardItem", {
      value: undefined,
      configurable: true,
    });
  });
}

export async function withRefusedClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Clipboard.prototype, "write", {
      value: () =>
        Promise.reject(new DOMException("denied", "NotAllowedError")),
      configurable: true,
    });
  });
}
