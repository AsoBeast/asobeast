import { describe, expect, it } from "vitest";
import { toolText } from "./index";

describe("toolText", () => {
  it("serialises an object on one line that parses back", () => {
    const data = {
      appId: "app-1",
      series: [{ date: "2026-09-01", position: null }],
    };

    const text = toolText(data);

    expect(text).not.toContain("\n");
    expect(JSON.parse(text)).toEqual(data);
  });

  it("answers null for an empty response", () => {
    expect(toolText(undefined)).toBe("null");
  });

  it("keeps a string as its json form", () => {
    expect(toolText("ok")).toBe('"ok"');
  });
});
