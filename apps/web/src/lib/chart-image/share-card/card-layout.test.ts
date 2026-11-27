import { describe, expect, it } from "vitest";
import {
  CARD_SIZE_NAMES,
  CARD_SIZES,
  cardLayout,
  type CardBox,
  type CardParts,
  type CardSizeName,
} from "./card-layout";

const PART_SETS: CardParts[] = [false, true].flatMap((change) =>
  [false, true].map((app) => ({ change, app })),
);

const ALL_PARTS: CardParts = { change: true, app: true };

const CASES = CARD_SIZE_NAMES.flatMap((size) =>
  PART_SETS.map((parts) => ({ size, parts })),
);

const STACKED: CardSizeName[] = ["square", "portrait"];

function panelBoxes(size: CardSizeName, parts: CardParts) {
  const layout = cardLayout(size, parts);
  return {
    layout,
    boxes: [
      layout.header,
      layout.lead,
      layout.figure,
      layout.change,
      layout.chart,
    ].filter((box): box is CardBox => box !== null),
  };
}

const inside = (inner: CardBox, outer: CardBox) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: CardBox, b: CardBox) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

describe("cardLayout", () => {
  it("sizes each card", () => {
    expect(CARD_SIZES).toEqual({
      landscape: { width: 1200, height: 675, label: "16:9", name: "Landscape" },
      square: { width: 1080, height: 1080, label: "1:1", name: "Square" },
      portrait: { width: 1080, height: 1350, label: "4:5", name: "Portrait" },
    });
  });

  it.each(CARD_SIZE_NAMES)("frames the panel above the strip on %s", (size) => {
    const { panel, strip, width, height } = cardLayout(size, ALL_PARTS);

    expect(panel.x).toBe(width - panel.x - panel.width);
    expect(panel.y).toBe(panel.x);
    expect(strip.y).toBe(panel.y + panel.height);
    expect(strip.y + strip.height).toBe(height);
  });

  it.each(CASES)(
    "keeps the content inside the panel of $size with $parts",
    ({ size, parts }) => {
      const { layout, boxes } = panelBoxes(size, parts);

      expect(boxes.filter((box) => !inside(box, layout.panel))).toEqual([]);
      expect(boxes.every((box) => box.height > 0)).toBe(true);
    },
  );

  it.each(CASES)(
    "never overlaps two boxes of $size with $parts",
    ({ size, parts }) => {
      const { boxes } = panelBoxes(size, parts);
      const overlapping = boxes.flatMap((box, index) =>
        boxes.slice(index + 1).filter((other) => overlaps(box, other)),
      );

      expect(overlapping).toEqual([]);
    },
  );

  it.each(CARD_SIZE_NAMES)("sets the credit in the strip on %s", (size) => {
    const { strip, mark, credit } = cardLayout(size, ALL_PARTS);

    expect(inside(mark, strip)).toBe(true);
    expect(inside(credit, strip)).toBe(true);
    expect(mark.width).toBe(mark.height);
    expect(credit.x).toBeGreaterThan(mark.x + mark.width);
  });

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
  });

  it("sets the headline beside the chart on landscape", () => {
    const { header, lead, figure, change, chart } = cardLayout(
      "landscape",
      ALL_PARTS,
    );

    for (const box of [lead, figure, change]) {
      expect(box && box.x + box.width).toBeLessThan(chart.x);
    }
    expect(chart.y).toBe(header?.y);
    expect(chart.y + chart.height).toBe(change && change.y + change.height);
  });

  it.each(STACKED)(
    "gives the chart the room the header and change leave on %s",
    (size) => {
      const all = cardLayout(size, ALL_PARTS);
      const noApp = cardLayout(size, { change: true, app: false });
      const noChange = cardLayout(size, { change: false, app: true });

      expect(noApp.chart.height).toBeGreaterThan(all.chart.height);
      expect(noChange.chart.height).toBeGreaterThan(all.chart.height);
    },
  );

  it.each(CARD_SIZE_NAMES)(
    "sets the figure larger than every other text on %s",
    (size) => {
      const { fonts } = cardLayout(size, ALL_PARTS);
      const others = Object.entries(fonts)
        .filter(([role]) => role !== "figure")
        .map(([, value]) => value);

      expect(Math.max(...others)).toBeLessThan(fonts.figure / 4);
    },
  );
});
