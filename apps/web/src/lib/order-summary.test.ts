import { describe, expect, it } from "vitest";
import { formatDate } from "./format";
import { summaryFromCatalog } from "./order-summary";

const CLOCK = { now: new Date("2026-10-22T12:00:00.000Z"), timeZone: "UTC" };
const ENDS_ON = formatDate("2026-10-29T12:00:00.000Z");

describe("summaryFromCatalog", () => {
  it("charges nothing today and names the first charge of a trial", () => {
    expect(summaryFromCatalog("indie", "month", { days: 7 }, CLOCK)).toEqual({
      planName: "Indie",
      intervalLabel: "Monthly",
      unitAmount: "$10.00",
      dueToday: "$0.00",
      thenLine: `From ${ENDS_ON}: $10 per month plus any VAT or sales tax, renewing monthly until you cancel.`,
      cancelLine:
        "Cancel any time from settings. Nothing is charged before the date above.",
    });
  });

  it("charges the price today without a trial", () => {
    expect(summaryFromCatalog("indie", "month", null, CLOCK)).toMatchObject({
      dueToday: "$10.00",
      thenLine:
        "Then $10 per month plus any VAT or sales tax, renewing monthly until you cancel.",
      cancelLine: "Cancel any time from settings.",
    });
  });

  it("reads the annual price of a plan", () => {
    expect(
      summaryFromCatalog("ultimate", "year", { days: 7 }, CLOCK),
    ).toMatchObject({
      planName: "Ultimate",
      intervalLabel: "Annual",
      unitAmount: "$990.00",
      thenLine: `From ${ENDS_ON}: $990 per year plus any VAT or sales tax, renewing yearly until you cancel.`,
    });
  });
});
