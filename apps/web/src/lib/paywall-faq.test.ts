import { describe, expect, it } from "vitest";
import { formatDate } from "./format";
import { paywallFaq } from "./paywall-faq";

const CLOCK = { now: new Date("2026-10-22T12:00:00.000Z"), timeZone: "UTC" };
const ENDS_ON = formatDate("2026-10-29T12:00:00.000Z");
const TERMS =
  "$10 per month plus any VAT or sales tax, renewing monthly until you cancel";

describe("paywallFaq", () => {
  it("answers seven questions, the first with the trial end date", () => {
    const items = paywallFaq({ days: 7 }, TERMS, CLOCK);

    expect(items).toHaveLength(7);
    expect(items[0]).toEqual({
      question: "Will I be charged today?",
      answer: `No. Your card is verified today and nothing is charged. From ${ENDS_ON}: ${TERMS}. Cancel from settings before then and nothing is charged.`,
    });
  });

  it("says when the plan is charged without a trial", () => {
    expect(paywallFaq(null, TERMS, CLOCK)[0]).toEqual({
      question: "When am I charged?",
      answer: `Today, for the first period. Then ${TERMS}.`,
    });
  });

  it("links every other answer to the page that states it", () => {
    for (const item of paywallFaq({ days: 7 }, TERMS, CLOCK).slice(1)) {
      expect(item.href).toMatch(
        /^https:\/\/(docs\.asobeast\.com|github\.com)\//,
      );
    }
  });
});
