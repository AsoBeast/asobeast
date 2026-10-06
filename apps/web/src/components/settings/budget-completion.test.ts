import { describe, expect, it } from "vitest";
import { budgetCompletionSentence } from "./budget-completion";

describe("budgetCompletionSentence", () => {
  it("names the next run, not today's, once today's run has started", () => {
    const sentence = budgetCompletionSentence(
      {
        startsAt: "2026-10-05T03:00:00.000Z",
        completesAt: "2026-10-05T03:01:00.000Z",
        hours: 0.02,
      },
      120,
    );

    expect(sentence).toBe(
      "The next run starts Oct 5, 2026, 3:00 AM UTC and is expected to finish around Oct 5, 2026, 3:01 AM UTC, after about 0.02 hours of collection.",
    );
    expect(sentence).not.toMatch(/today/i);
  });

  it("reads the same before today's run, because the projection is of the next run", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: "2026-10-04T03:00:00.000Z",
          completesAt: "2026-10-04T15:00:00.000Z",
          hours: 12,
        },
        10_800,
      ),
    ).toBe(
      "The next run starts Oct 4, 2026, 3:00 AM UTC and is expected to finish around Oct 4, 2026, 3:00 PM UTC, after about 12 hours of collection.",
    );
  });

  it("says when a run that starts late finishes after midnight", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: "2026-10-04T22:00:00.000Z",
          completesAt: "2026-10-05T04:00:00.000Z",
          hours: 6,
        },
        5_400,
      ),
    ).toBe(
      "The next run starts Oct 4, 2026, 10:00 PM UTC and is expected to finish around Oct 5, 2026, 4:00 AM UTC, after about 6 hours of collection.",
    );
  });

  it("says one hour in the singular", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: "2026-10-05T03:00:00.000Z",
          completesAt: "2026-10-05T04:00:00.000Z",
          hours: 1,
        },
        900,
      ),
    ).toContain("after about 1 hour of collection.");
  });

  it("gives the start alone when the capacity cannot finish the work", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: "2026-10-05T03:00:00.000Z",
          completesAt: null,
          hours: null,
        },
        400,
      ),
    ).toBe("The next run starts Oct 5, 2026, 3:00 AM UTC.");
  });

  it("says there is nothing to collect when the run has no work", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: "2026-10-05T03:00:00.000Z",
          completesAt: "2026-10-05T03:00:00.000Z",
          hours: 0,
        },
        0,
      ),
    ).toBe(
      "The next run starts Oct 5, 2026, 3:00 AM UTC and has nothing to collect yet.",
    );
  });

  it("does not call a short run empty when its hours round to zero", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: "2026-10-05T03:00:00.000Z",
          completesAt: "2026-10-05T03:00:00.000Z",
          hours: 0,
        },
        4,
      ),
    ).toBe(
      "The next run starts Oct 5, 2026, 3:00 AM UTC and is expected to finish within a minute.",
    );
  });

  it("says a run of a few seconds finishes within a minute instead of naming the start twice", () => {
    const sentence = budgetCompletionSentence(
      {
        startsAt: "2026-10-06T03:00:00.000Z",
        completesAt: "2026-10-06T03:00:36.000Z",
        hours: 0.01,
      },
      13,
    );

    expect(sentence).toContain("expected to finish within a minute.");
    expect(sentence).not.toContain("finish around");
    expect(sentence).not.toContain("hours of collection");
  });

  it("names the finish once a run takes a minute or more", () => {
    const sentence = budgetCompletionSentence(
      {
        startsAt: "2026-10-06T03:00:00.000Z",
        completesAt: "2026-10-06T03:01:12.000Z",
        hours: 0.02,
      },
      22,
    );

    expect(sentence).toContain("expected to finish around");
    expect(sentence).not.toContain("within a minute");
  });

  it("says nothing for a schedule that is not once a day", () => {
    expect(
      budgetCompletionSentence(
        {
          startsAt: null,
          completesAt: null,
          hours: null,
        },
        0,
      ),
    ).toBeNull();
  });
});
