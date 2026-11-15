import { describe, expect, it } from "vitest";
import { DELETION_REASONS } from "@asobeast/shared";
import { DELETION_REASON_CHOICES, deletionReasonOf } from "./deletion-reasons";

describe("deletion reasons", () => {
  it("offers prefer not to say first, then every reason the api takes", () => {
    expect(DELETION_REASON_CHOICES[0]).toEqual({
      value: "unanswered",
      label: "Prefer not to say",
    });
    expect(
      DELETION_REASON_CHOICES.slice(1).map((choice) => choice.value),
    ).toEqual([...DELETION_REASONS]);
  });

  it("sends no reason for prefer not to say or anything unknown", () => {
    expect(deletionReasonOf("unanswered")).toBeUndefined();
    expect(deletionReasonOf("my boss")).toBeUndefined();
    expect(deletionReasonOf("not-using")).toBe("not-using");
  });
});
