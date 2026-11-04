import { describe, expect, it } from "vitest";
import { essentialNeedCopy } from "./essential-alerts-copy";

describe("essentialNeedCopy", () => {
  it("says what turns the essential alerts on", () => {
    expect(essentialNeedCopy("smtp")).toBe(
      "Once email works, AsoBeast turns on the essential alerts for a new workspace after its first daily run.",
    );
    expect(essentialNeedCopy("https")).toBe(
      "AsoBeast turns on the essential alerts after your first daily run once WEB_PUBLIC_URL is an https address.",
    );
  });

  it("says nothing when nothing is missing", () => {
    expect(essentialNeedCopy(null)).toBeNull();
    expect(essentialNeedCopy(undefined)).toBeNull();
  });
});
