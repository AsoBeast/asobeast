import { describe, expect, it } from "vitest";
import type { AuditTarget, AuditUnlockKind } from "@asobeast/shared";
import { targetHref, unlockHref } from "./audit-links";

describe("targetHref", () => {
  it.each([
    ["metadata", "/apps/app-1/metadata"],
    ["keywords", "/apps/app-1/keywords"],
    ["competitors", "/apps/app-1/competitors"],
    ["reviews", "/apps/app-1/reviews"],
    ["rankings", "/apps/app-1/rankings"],
    ["ai-analysis", "#ai-analysis"],
    ["store-console", null],
  ])("sends %s to %s", (target, href) => {
    expect(targetHref("app-1", target as AuditTarget)).toBe(href);
  });
});

describe("unlockHref", () => {
  it.each([
    ["ai-analysis", "#ai-analysis"],
    ["keyword-field", "/apps/app-1/keywords"],
    ["keywords", "/apps/app-1/keywords"],
    ["competitors", "/apps/app-1/competitors"],
    ["history", "/apps/app-1/rankings"],
    ["reviews", "/apps/app-1/reviews"],
  ])("sends %s to %s", (kind, href) => {
    expect(unlockHref("app-1", kind as AuditUnlockKind)).toBe(href);
  });
});
