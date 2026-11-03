import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "layout.css"), "utf8");

function maxWidth(utility: string): number {
  const block =
    css.match(new RegExp(`@utility ${utility} \\{([^}]*)\\}`))?.[1] ?? "";
  expect(block).toContain("width: 100%");
  expect(block).toContain("margin-inline: auto");
  return Number.parseFloat(block.match(/max-width: ([\d.]+)rem/)?.[1] ?? "");
}

describe("page widths", () => {
  it("places the checkout width between reading and wide", () => {
    expect(maxWidth("page-reading")).toBe(45);
    expect(maxWidth("page-checkout")).toBe(76);
    expect(maxWidth("page-wide")).toBe(100);
  });
});
