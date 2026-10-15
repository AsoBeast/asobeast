import { describe, expect, it } from "vitest";
import type { ReviewReplyItem } from "@asobeast/shared";
import {
  replyBadgeLabel,
  replyStateLabel,
  replyStateVariant,
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
  });
});

describe("replyStateLabel", () => {
  it("labels the three states for the strip and the filter", () => {
    expect(replyStateLabel("needs_reply")).toBe("Needs reply");
    expect(replyStateLabel("drafted")).toBe("Draft saved");
    expect(replyStateLabel("replied")).toBe("Replied");
  });
});

describe("replyStateVariant", () => {
  it("picks a badge variant that is never colour alone", () => {
    expect(replyStateVariant("replied")).toBe("success");
    expect(replyStateVariant("drafted")).toBe("secondary");
    expect(replyStateVariant("needs_reply")).toBe("outline");
  });
});
