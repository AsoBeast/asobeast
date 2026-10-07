import type { Locator, Page } from "@playwright/test";

export type Rgb = [number, number, number];

export function renderedTokenRgb(page: Page, token: string): Promise<Rgb> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return [red!, green!, blue!] as [number, number, number];
  }, token);
}

export function renderedRgb(
  locator: Locator,
  property: "backgroundColor" | "color" | "textDecorationColor",
): Promise<Rgb> {
  return locator.evaluate((element, name) => {
    const value = getComputedStyle(element)[name];
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return [red!, green!, blue!] as [number, number, number];
  }, property);
}
