import { describe, expect, it } from "vitest";
import { statusPageUrl } from "./status-page";

describe("statusPageUrl", () => {
  it("accepts an https origin", () => {
    expect(statusPageUrl("https://status.example.com")).toBe(
      "https://status.example.com/",
    );
  });

  it("accepts an http origin, because a lan status page is legitimate", () => {
    expect(statusPageUrl("http://status.local:3000/page")).toBe(
      "http://status.local:3000/page",
    );
  });

  it("trims the surrounding whitespace a compose file leaves behind", () => {
    expect(statusPageUrl("  https://status.example.com  ")).toBe(
      "https://status.example.com/",
    );
  });

  it.each([undefined, "", "   "])("reports %p as not configured", (raw) => {
    expect(statusPageUrl(raw)).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "mailto:ops@example.com",
    "file:///etc/passwd",
    "status.example.com",
  ])("refuses %s rather than linking to it", (raw) => {
    expect(statusPageUrl(raw)).toBeNull();
  });
});
