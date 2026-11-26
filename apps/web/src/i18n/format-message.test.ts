import { describe, expect, it } from "vitest";
import { formatMessage } from "./format-message";

describe("formatMessage", () => {
  it("formats registered ICU plurals and numbers", () => {
    expect(
      formatMessage("{count, plural, one {# day} other {# days}}", "en", {
        count: 1,
      }),
    ).toBe("1 day");
    expect(formatMessage("{value, number}", "zh-CN", { value: 1234 })).toBe(
      "1,234",
    );
  });
});
