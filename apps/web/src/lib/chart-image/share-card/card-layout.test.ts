import { describe, expect, it } from "vitest";
import {
  CARD_SIZE_NAMES,
  CARD_SIZES,
  cardLayout,
  type CardBox,
  type CardParts,
} from "./card-layout";

const PART_SETS: CardParts[] = [false, true].flatMap((change) =>
  [false, true].map((app) => ({ change, app })),
);

const CASES = CARD_SIZE_NAMES.flatMap((size) =>
  PART_SETS.map((parts) => ({ size, parts })),
);

function boxesOf(size: (typeof CARD_SIZE_NAMES)[number], parts: CardParts) {
  const layout = cardLayout(size, parts);
  return {
    layout,
    boxes: [layout.header, layout.headline, layout.chart, layout.footer].filter(
      (box): box is CardBox => box !== null,
    ),
  };
}

const overlaps = (a: CardBox, b: CardBox) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

describe("cardLayout", () => {
  it("sizes each card", () => {
    expect(CARD_SIZES).toEqual({
      landscape: { width: 1200, height: 675, label: "16:9" },
      square: { width: 1080, height: 1080, label: "1:1" },
      portrait: { width: 1080, height: 1350, label: "4:5" },
    });
  });

  it.each(CASES)(
    "keeps every box inside the margins of $size with $parts",
    ({ size, parts }) => {
      const { layout, boxes } = boxesOf(size, parts);
      const { width, height } = CARD_SIZES[size];
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(layout.margin);
        expect(box.y).toBeGreaterThanOrEqual(layout.margin);
        expect(box.x + box.width).toBeLessThanOrEqual(width - layout.margin);
        expect(box.y + box.height).toBeLessThanOrEqual(height - layout.margin);
        expect(box.height).toBeGreaterThan(0);
      }
    },
  );

  it.each(CASES)(
    "never overlaps two boxes of $size with $parts",
    ({ size, parts }) => {
      const { boxes } = boxesOf(size, parts);
      const overlapping = boxes.flatMap((box, index) =>
        boxes.slice(index + 1).filter((other) => overlaps(box, other)),
      );
      expect(overlapping).toEqual([]);
    },
  );

  it.each(CASES)(
    "keeps the icon inside the header of $size with $parts",
    ({ size, parts }) => {
      const { header, icon } = cardLayout(size, parts);
      if (header === null || icon === null) {
        expect([header, icon]).toEqual([null, null]);
        return;
      }
      expect(icon.width).toBe(icon.height);
      expect(icon.x).toBe(header.x);
      expect(icon.y + icon.height).toBeLessThanOrEqual(
        header.y + header.height,
      );
    },
  );

  it("leaves out the boxes of the parts turned off", () => {
    const layout = cardLayout("square", { change: false, app: false });

    expect([layout.header, layout.icon, layout.change]).toEqual([
      null,
      null,
      null,
    ]);
    expect(layout.footer).not.toBeNull();
  });

  it.each(CARD_SIZE_NAMES)(
    "gives the chart the room the header and change leave on %s",
    (size) => {
      const all = cardLayout(size, { change: true, app: true });
      const noApp = cardLayout(size, { change: true, app: false });
      const noChange = cardLayout(size, { change: false, app: true });

      expect(noApp.chart.height).toBeGreaterThan(all.chart.height);
      expect(noChange.chart.height).toBeGreaterThan(all.chart.height);
    },
  );

  it("shares one rhythm across the sizes", () => {
    const landscape = cardLayout("landscape", PART_SETS[3]);
    const square = cardLayout("square", PART_SETS[3]);

    expect(landscape.unit).toBe(30);
    expect(square.unit).toBe(27);
    expect(landscape.fonts.figure / landscape.unit).toBeCloseTo(
      square.fonts.figure / square.unit,
    );
  });

  it("sets the figure larger than every other text", () => {
    const { fonts } = cardLayout("landscape", PART_SETS[3]);
    const others = Object.entries(fonts)
      .filter(([role]) => role !== "figure")
      .map(([, size]) => size);

    expect(Math.max(...others)).toBeLessThan(fonts.figure);
  });
});
