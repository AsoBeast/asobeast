import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKOUT_BRAND } from "@asobeast/shared";
import { declarations, resolve } from "@/styles/token-scope";
import { hexOf } from "./contrast";

function read(file: string): string {
  return readFileSync(join(import.meta.dirname, "..", "styles", file), "utf8");
}

const primitives = declarations(read("primitives.css"), ":root");
const semantic = read("semantic.css");
const LIGHT = { ...primitives, ...declarations(semantic, ":root") };
const DARK = { ...primitives, ...declarations(semantic, "\\.dark") };

describe("the checkout brand", () => {
  it("paints each theme's page background behind the checkout", () => {
    expect(CHECKOUT_BRAND.light.backgroundColor).toBe(
      hexOf(resolve("--background", LIGHT)),
    );
    expect(CHECKOUT_BRAND.dark.backgroundColor).toBe(
      hexOf(resolve("--background", DARK)),
    );
  });

  it("paints the checkout button in the brand orange in both themes", () => {
    const orange = hexOf(resolve("--brand-500", LIGHT));

    expect(CHECKOUT_BRAND.light.buttonColor).toBe(orange);
    expect(CHECKOUT_BRAND.dark.buttonColor).toBe(orange);
  });
});

describe("hexOf", () => {
  it("prints an srgb color as lowercase bytes", () => {
    expect(hexOf("rgb(255 128 0)")).toBe("#ff8000");
    expect(hexOf("#ABCDEF")).toBe("#abcdef");
  });

  it("answers nothing for a value it cannot read", () => {
    expect(hexOf("transparent")).toBeNull();
  });
});
