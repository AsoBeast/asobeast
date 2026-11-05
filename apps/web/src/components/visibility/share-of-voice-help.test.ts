import { describe, expect, it } from "vitest";
import { SHARE_EXAMPLE } from "./share-of-voice-help";

describe("the share of voice example", () => {
  it("measures the worked example with the visibility formula", () => {
    expect(SHARE_EXAMPLE).toEqual({
      you: 33.4,
      rivals: [34.4, 11.8],
      share: "42.0%",
      againstOne: "49.3%",
    });
  });
});
