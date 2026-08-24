import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance, toLinear } from "./contrast";

describe("toLinear", () => {
  it("reads hex in both lengths", () => {
    expect(toLinear("#fff")).toEqual([1, 1, 1]);
    expect(toLinear("#ffffff")).toEqual([1, 1, 1]);
    expect(toLinear("#000000")).toEqual([0, 0, 0]);
  });

  it("reads rgb in comma and space syntax", () => {
    expect(toLinear("rgb(255, 255, 255)")).toEqual([1, 1, 1]);
    expect(toLinear("rgb(0 0 0)")).toEqual([0, 0, 0]);
  });

  it("reads oklch", () => {
    const white = toLinear("oklch(1 0 0)");
    expect(white?.[0]).toBeCloseTo(1, 3);
    expect(white?.[1]).toBeCloseTo(1, 3);
    expect(white?.[2]).toBeCloseTo(1, 3);
  });

  it("reads the lab form browsers resolve custom properties into", () => {
    const white = toLinear("lab(100% 0 0)");
    expect(white?.[0]).toBeCloseTo(1, 2);
    expect(white?.[1]).toBeCloseTo(1, 2);
    expect(white?.[2]).toBeCloseTo(1, 2);
  });

  it("agrees between oklch and the lab value a browser resolves it to", () => {
    const viaOklch = relativeLuminance("oklch(0.985 0.003 75)");
    const viaLab = relativeLuminance("lab(98.2655% .254273 1.10695)");
    expect(viaOklch).toBeCloseTo(viaLab!, 3);
  });

  it("returns null for syntax it cannot read", () => {
    expect(toLinear("color-mix(in oklch, red 10%, transparent)")).toBeNull();
    expect(toLinear("transparent")).toBeNull();
    expect(toLinear("")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("anchors black and white", () => {
    expect(relativeLuminance("rgb(0 0 0)")).toBeCloseTo(0, 6);
    expect(relativeLuminance("rgb(255 255 255)")).toBeCloseTo(1, 6);
  });
});

describe("contrastRatio", () => {
  it("returns the maximum ratio for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 6);
  });

  it("is symmetric", () => {
    const a = contrastRatio("#777777", "#ffffff");
    const b = contrastRatio("#ffffff", "#777777");
    expect(a).toBeCloseTo(b!, 10);
  });

  it("returns one for identical colours", () => {
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 10);
  });

  it("matches a published reference pair", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("returns null when either colour is unreadable", () => {
    expect(contrastRatio("transparent", "#000000")).toBeNull();
    expect(contrastRatio("#000000", "transparent")).toBeNull();
  });
});

describe("alpha and malformed input", () => {
  it("refuses translucent colours rather than reporting them as opaque", () => {
    expect(toLinear("oklch(1 0 0 / 10%)")).toBeNull();
    expect(toLinear("rgba(255, 255, 255, 0.1)")).toBeNull();
    expect(toLinear("rgb(255 255 255 / 50%)")).toBeNull();
    expect(toLinear("#ffffff00")).toBeNull();
  });

  it("refuses malformed hex instead of producing NaN", () => {
    expect(toLinear("#zzzzzz")).toBeNull();
    expect(toLinear("#ff")).toBeNull();
    expect(contrastRatio("#zzzzzz", "#ffffff")).toBeNull();
  });

  it("refuses a colour function carrying anything but numeric components", () => {
    expect(toLinear("rgb(255 255 255 garbage)")).toBeNull();
    expect(toLinear("rgb(255 255 255) trailing")).toBeNull();
    expect(toLinear("oklch(1 0 var(--hue))")).toBeNull();
    expect(contrastRatio("rgb(255 255 255 garbage)", "#000000")).toBeNull();
  });

  it("reads percentage rgb on the same scale as byte rgb", () => {
    expect(relativeLuminance("rgb(50% 50% 50%)")).toBeCloseTo(
      relativeLuminance("rgb(127.5 127.5 127.5)")!,
      6,
    );
  });
});
