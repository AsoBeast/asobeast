import { describe, expect, it } from "vitest";
import { formatDate } from "./format";
import { summaryFromCatalog } from "./order-summary";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const ENDS_ON = formatDate("2026-10-29T12:00:00.000Z");

describe("summaryFromCatalog", () => {
  it("charges nothing today and names the first charge of a trial", () => {
    expect(summaryFromCatalog("indie", "month", { days: 7 }, NOW)).toEqual({
      planName: "Indie",
      intervalLabel: "Monthly",
      unitAmount: "$10.00",
      dueToday: "$0.00",
      thenLine: `Then $10.00 on ${ENDS_ON}`,
      cancelLine:
        "Cancel any time from settings. Nothing is charged before the date above.",
    });
  });

  it("charges the price today without a trial", () => {
    expect(summaryFromCatalog("indie", "month", null, NOW)).toMatchObject({
      dueToday: "$10.00",
      thenLine: null,
      cancelLine: "Cancel any time from settings.",
    });
  });

  it("reads the annual price of a plan", () => {
    expect(
      summaryFromCatalog("ultimate", "year", { days: 7 }, NOW),
    ).toMatchObject({
      planName: "Ultimate",
      intervalLabel: "Annual",
      unitAmount: "$990.00",
      thenLine: `Then $990.00 on ${ENDS_ON}`,
    });
  });
});
