import { describe, expect, it } from "vitest";
import {
  DAYS_HINT,
  goalNotes,
  goalSentence,
  paceSentence,
  TARGET_HINT,
} from "./ratings-goal-copy";

describe("goalSentence", () => {
  it("names the count and the daily pace", () => {
    expect(
      goalSentence(
        { kind: "needed", ratings: 273, pace: { kind: "daily", ratings: 10 } },
        45,
        4.3,
        30,
      ),
    ).toBe(
      "To show 4.5 you need 273 more five-star ratings, about 10 a day for 30 days.",
    );
  });

  it("spaces a small goal over the days", () => {
    expect(
      goalSentence(
        { kind: "needed", ratings: 3, pace: { kind: "every", days: 10 } },
        45,
        4.3,
        30,
      ),
    ).toBe(
      "To show 4.5 you need 3 more five-star ratings, about one every 10 days for 30 days.",
    );
  });

  it("keeps one day singular", () => {
    expect(
      goalSentence(
        { kind: "needed", ratings: 2, pace: { kind: "daily", ratings: 2 } },
        45,
        4.44,
        1,
      ),
    ).toBe(
      "To show 4.5 you need 2 more five-star ratings, about 2 a day for 1 day.",
    );
  });

  it("leaves the pace out when one rating is enough", () => {
    expect(
      goalSentence(
        { kind: "needed", ratings: 1, pace: { kind: "every", days: 30 } },
        44,
        4.3,
        30,
      ),
    ).toBe("To show 4.4 you need 1 more five-star rating.");
  });

  it("says the store already shows the target without repeating it", () => {
    expect(goalSentence({ kind: "reached" }, 45, 4.46, 30)).toBe(
      "The store already shows 4.5.",
    );
  });

  it("says the store shows more than the target", () => {
    expect(goalSentence({ kind: "reached" }, 45, 4.8, 30)).toBe(
      "The store already shows 4.8, above 4.5.",
    );
  });

  it("says the first rating decides the average", () => {
    expect(goalSentence({ kind: "first" }, 50, 0, 30)).toBe(
      "With no ratings yet, the first five-star rating shows 5.0.",
    );
  });
});

describe("goalNotes", () => {
  it("states the assumption for every app", () => {
    expect(goalNotes("APP_STORE", 1000)).toEqual([
      "Assumes every new rating is five stars and that the store shows one decimal.",
    ]);
  });

  it("calls the Google Play answer a rough guide", () => {
    expect(goalNotes("GOOGLE_PLAY", 1000)).toContain(
      "Google Play reports its own average, so read this as a rough guide.",
    );
  });

  it("warns about a thin sample below 20 ratings only", () => {
    const thin =
      "With fewer than 20 ratings the average moves a lot with each new one.";
    expect(goalNotes("APP_STORE", 19)).toContain(thin);
    expect(goalNotes("APP_STORE", 20)).not.toContain(thin);
  });
});

describe("hints", () => {
  it("names the accepted ranges", () => {
    expect(TARGET_HINT).toBe(
      "Enter a target from 0.1 to 5.0 with at most one decimal.",
    );
    expect(DAYS_HINT).toBe("Enter a whole number of days from 1 to 365.");
  });
});

describe("paceSentence", () => {
  it("names the average the store shows after the days entered", () => {
    expect(paceSentence({ kind: "reaches", projected: 4.47 }, 45, 30)).toBe(
      "At your current pace the store shows 4.5 in 30 days, your target.",
    );
    expect(paceSentence({ kind: "fallsShort", projected: 4.43 }, 45, 30)).toBe(
      "At your current pace the store shows 4.4 in 30 days.",
    );
    expect(paceSentence({ kind: "fallsShort", projected: 4.43 }, 45, 1)).toBe(
      "At your current pace the store shows 4.4 in 1 day.",
    );
  });

  it("says when the projection passes the target", () => {
    expect(paceSentence({ kind: "reaches", projected: 4.9 }, 45, 30)).toBe(
      "At your current pace the store shows 4.9 in 30 days, above your target.",
    );
  });

  it("says when the current mix cannot reach the target", () => {
    expect(paceSentence({ kind: "belowTarget", newAverage: 4.2 }, 45, 30)).toBe(
      "Not at the current mix: new ratings average 4.2, below 4.5.",
    );
  });
});
