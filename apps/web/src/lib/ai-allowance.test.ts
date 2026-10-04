import { describe, expect, it } from "vitest";
import {
  aiAllowanceRefusal,
  aiAllowanceSpent,
  aiCallsLeftText,
  aiRenewalText,
  aiUsageNote,
} from "./ai-allowance";

const RESETS = "2026-11-01T00:00:00.000Z";

describe("aiCallsLeftText", () => {
  it("counts the calls left this month", () => {
    expect(aiCallsLeftText({ used: 37, limit: 200, resetsAt: RESETS })).toBe(
      "163 of 200 AI calls left this month",
    );
  });

  it("says when spent calls renew", () => {
    expect(aiCallsLeftText({ used: 200, limit: 200, resetsAt: RESETS })).toBe(
      "AI calls used up. Renews Nov 1, 2026",
    );
  });

  it("says a workspace includes none", () => {
    expect(aiCallsLeftText({ used: 0, limit: 0, resetsAt: RESETS })).toBe(
      "This workspace includes no AI calls",
    );
  });

  it("says nothing when unlimited", () => {
    expect(
      aiCallsLeftText({ used: 9_000, limit: null, resetsAt: RESETS }),
    ).toBeNull();
  });
});

describe("aiAllowanceSpent", () => {
  it.each([
    [{ used: 200, limit: 200, resetsAt: RESETS }, true],
    [{ used: 250, limit: 200, resetsAt: RESETS }, true],
    [{ used: 199, limit: 200, resetsAt: RESETS }, false],
    [{ used: 9_000, limit: null, resetsAt: RESETS }, false],
    [undefined, false],
  ])("reads %j as spent %s", (usage, spent) => {
    expect(aiAllowanceSpent(usage)).toBe(spent);
  });
});

describe("aiRenewalText", () => {
  it("formats the renewal date in UTC", () => {
    expect(aiRenewalText(RESETS)).toBe("Renews Nov 1, 2026");
  });

  it("keeps the renewal on the 1st whatever the reader's time zone", () => {
    expect(aiRenewalText("2026-12-01T00:00:00.000Z")).toBe(
      "Renews Dec 1, 2026",
    );
  });
});

describe("aiAllowanceRefusal", () => {
  it("explains a refusal from its allowance object", () => {
    expect(
      aiAllowanceRefusal({
        plan: "indie",
        limit: 200,
        used: 200,
        resetsAt: RESETS,
        upgradeTo: "ultimate",
      }),
    ).toBe(
      "This workspace has used the 200 AI calls its plan includes this month. Renews Nov 1, 2026.",
    );
  });

  it("says AI is off for a zero allowance instead of a renewal", () => {
    expect(
      aiAllowanceRefusal({
        plan: "free",
        limit: 0,
        used: 4,
        resetsAt: RESETS,
        upgradeTo: null,
      }),
    ).toBe("This workspace includes no AI calls.");
  });
});

describe("aiUsageNote", () => {
  it("says when a limited allowance renews", () => {
    expect(aiUsageNote({ used: 37, limit: 200, resetsAt: RESETS })).toBe(
      "Renews Nov 1, 2026",
    );
  });

  it("says when an unlimited allowance's month ends", () => {
    expect(aiUsageNote({ used: 37, limit: null, resetsAt: RESETS })).toBe(
      "Renews Nov 1, 2026",
    );
  });

  it("promises no renewal when no ai calls are included", () => {
    expect(
      aiUsageNote({ used: 4, limit: 0, resetsAt: RESETS }),
    ).toBeUndefined();
  });
});
