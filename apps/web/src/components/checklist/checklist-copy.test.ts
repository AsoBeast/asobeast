import { WORKSPACE_CHECKLIST_ITEMS, WORKSPACE_GOALS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { GOAL_COPY, ITEM_COPY } from "./checklist-copy";

const DASH = /[–—]| - /;

const copyStrings = (): string[] => [
  ...Object.values(ITEM_COPY).flatMap((copy) => [
    copy.description,
    copy.action,
    copy.doneText,
  ]),
  ...Object.values(GOAL_COPY).flatMap((copy) => [copy.label, copy.description]),
];

describe("the checklist copy", () => {
  it.each(WORKSPACE_CHECKLIST_ITEMS)("words the %s item", (id) => {
    const copy = ITEM_COPY[id];
    expect(copy.description.length).toBeGreaterThan(0);
    expect(copy.action.length).toBeGreaterThan(0);
    expect(copy.doneText.length).toBeGreaterThan(0);
  });

  it.each(WORKSPACE_GOALS)("words the %s goal", (goal) => {
    expect(GOAL_COPY[goal].label.length).toBeGreaterThan(0);
    expect(GOAL_COPY[goal].description.length).toBeGreaterThan(0);
  });

  it.each([
    ["second_market", "/apps/app-1/keywords"],
    ["add_competitor", "/apps/app-1/competitors"],
    [
      "reply_to_review",
      "/apps/app-1/reviews?replyState=needs_reply&sort=lowest",
    ],
    ["fill_keyword_field", "/apps/app-1/metadata"],
  ] as const)("links %s to the app page that does it", (id, href) => {
    expect(ITEM_COPY[id].href("app-1")).toBe(href);
    expect(ITEM_COPY[id].href(null)).toBeNull();
  });

  it.each([
    ["import_app", "/"],
    ["connect_console", "/integrations#store-connections"],
    ["connect_ai_client", "/integrations#api-and-mcp"],
    ["turn_on_alert", "/settings#alerts"],
  ] as const)("links %s to the same page for any app", (id, href) => {
    expect(ITEM_COPY[id].href(null)).toBe(href);
    expect(ITEM_COPY[id].href("app-1")).toBe(href);
  });

  it("uses no dash punctuation", () => {
    for (const text of copyStrings()) expect(text).not.toMatch(DASH);
  });
});
