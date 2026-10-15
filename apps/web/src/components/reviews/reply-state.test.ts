import { describe, expect, it } from "vitest";
import type { ReviewReplyItem } from "@asobeast/shared";
import {
  replyBadgeLabel,
  replyStateLabel,
  replyStateVariant,
  shownReplyStates,
} from "./reply-state";

const ISO = "2026-10-01T00:00:00.000Z";
const REPLY: ReviewReplyItem = {
  text: "Thanks",
  tone: null,
  model: null,
  generatedAt: null,
  updatedAt: ISO,
  repliedAt: null,
};

describe("replyBadgeLabel", () => {
  it("labels each state and names the source of a reply", () => {
    expect(replyBadgeLabel({ repliedAt: null, reply: null })).toBe(
      "Needs reply",
    );
    expect(replyBadgeLabel({ repliedAt: null, reply: REPLY })).toBe(
      "Draft saved",
    );
    expect(replyBadgeLabel({ repliedAt: ISO, reply: null })).toBe(
      "Replied on Google Play",
    );
    expect(
      replyBadgeLabel({ repliedAt: null, reply: { ...REPLY, repliedAt: ISO } }),
    ).toBe("Marked replied");
    expect(
      replyBadgeLabel({ repliedAt: ISO, reply: { ...REPLY, repliedAt: ISO } }),
    ).toBe("Replied on Google Play");
    expect(
      replyBadgeLabel({
        reviewedAt: "2026-10-03T00:00:00.000Z",
        repliedAt: ISO,
        reply: null,
      }),
    ).toBe("Updated after reply");
  });
});

describe("shownReplyStates", () => {
  const COUNTS = { needsReply: 1, drafted: 0, replied: 2, updated: 0 };
  const values = (states: ReturnType<typeof shownReplyStates>) =>
    states.map((state) => state.value);

  it("offers updated after reply only when a review is in it or it is picked", () => {
    expect(values(shownReplyStates(COUNTS, null))).toEqual([
      "needs_reply",
      "drafted",
      "replied",
    ]);
    expect(values(shownReplyStates({ ...COUNTS, updated: 1 }, null))).toContain(
      "updated",
    );
    expect(values(shownReplyStates(undefined, "updated"))).toContain("updated");
  });
});

describe("replyStateLabel", () => {
  it("labels the four states for the strip and the filter", () => {
    expect(replyStateLabel("needs_reply")).toBe("Needs reply");
    expect(replyStateLabel("drafted")).toBe("Draft saved");
    expect(replyStateLabel("replied")).toBe("Replied");
    expect(replyStateLabel("updated")).toBe("Updated after reply");
  });
});

describe("replyStateVariant", () => {
  it("picks a badge variant that is never colour alone", () => {
    expect(replyStateVariant("replied")).toBe("success");
    expect(replyStateVariant("drafted")).toBe("secondary");
    expect(replyStateVariant("needs_reply")).toBe("outline");
    expect(replyStateVariant("updated")).toBe("warning");
  });
});
