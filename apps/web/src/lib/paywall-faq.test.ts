import { describe, expect, it } from "vitest";
import { formatDate } from "./format";
import { paywallFaq } from "./paywall-faq";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const ENDS_ON = formatDate("2026-10-29T12:00:00.000Z");

describe("paywallFaq", () => {
  it("answers seven questions, the first with the trial end date", () => {
    const items = paywallFaq({ days: 7 }, "$10 per month", NOW);

    expect(items).toHaveLength(7);
    expect(items[0]).toEqual({
      question: "Will I be charged today?",
      answer: `No. Your card is verified today and nothing is charged. $10 per month is charged on ${ENDS_ON} unless you cancel from settings before then.`,
    });
  });

  it("says when the plan is charged without a trial", () => {
    expect(paywallFaq(null, "$10 per month", NOW)[0]).toEqual({
      question: "When am I charged?",
      answer: "Today, for the first period. The plan renews until you cancel.",
    });
  });

  it("links every other answer to the page that states it", () => {
    for (const item of paywallFaq({ days: 7 }, "$10 per month", NOW).slice(1)) {
      expect(item.href).toMatch(
        /^https:\/\/(docs\.asobeast\.com|github\.com)\//,
      );
    }
  });
});
