import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WEBHOOK_EVENTS,
  WORKSPACE_CHECKLIST_ITEMS,
  WORKSPACE_GOALS,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { APP_SECTIONS } from "@/lib/app-sections";
import { GOAL_COPY, ITEM_COPY, ITEM_TIPS } from "./checklist-copy";

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

const TIP_WORDS = {
  import_app: [],
  second_market: ["quotes", "Paste", "reads", "score"],
  add_competitor: ["rating"],
  connect_console: [],
  connect_ai_client: ["last used"],
  turn_on_alert: ["webhook", "retire"],
  reply_to_review: ["language"],
  fill_keyword_field: ["localization", "limits", "Bangla", "Chinese"],
} as const;

const APP_ROUTE = new RegExp(
  `^/apps/app-1/(${APP_SECTIONS.map((section) => section.segment)
    .filter(Boolean)
    .join("|")})(\\?[^#]*)?$`,
);

const pageSource = (route: string) =>
  readFileSync(
    join(process.cwd(), "src", "app", "(app)", route, "page.tsx"),
    "utf8",
  );

const ANCHOR_PAGES: Record<string, string> = {
  "/settings": pageSource("settings"),
  "/integrations": pageSource("integrations"),
};

const linksOf = () =>
  WORKSPACE_CHECKLIST_ITEMS.flatMap((id) => [
    ITEM_COPY[id].href("app-1"),
    ...ITEM_TIPS[id].map((tip) => tip.href("app-1")),
  ]).filter((href): href is string => href !== null);

describe("the checklist tips", () => {
  it.each(WORKSPACE_CHECKLIST_ITEMS)(
    "points %s at the features its page holds",
    (id) => {
      const labels = ITEM_TIPS[id].map((tip) => tip.label);
      expect(labels).toHaveLength(TIP_WORDS[id].length);
      TIP_WORDS[id].forEach((word, index) => {
        expect(labels[index]).toContain(word);
      });
    },
  );

  it("keeps every item to four tips at most", () => {
    for (const tips of Object.values(ITEM_TIPS)) {
      expect(tips.length).toBeLessThanOrEqual(4);
    }
  });

  it("counts the webhook events instead of typing the number", () => {
    expect(ITEM_TIPS.turn_on_alert[0].label).toContain(
      String(WEBHOOK_EVENTS.length),
    );
  });

  it("links every in app tip to a real page", () => {
    for (const href of linksOf().filter((link) => link.startsWith("/apps/"))) {
      expect(href).toMatch(APP_ROUTE);
    }
  });

  it("links an app bound tip only when there is an app", () => {
    const appBound = Object.values(ITEM_TIPS)
      .flat()
      .filter((tip) => tip.href("app-1")?.startsWith("/apps/"));
    expect(appBound.length).toBeGreaterThan(0);
    for (const tip of appBound) expect(tip.href(null)).toBeNull();
  });

  it("links only to anchors the pages define", () => {
    for (const href of linksOf()) {
      const [path, anchor] = href.split("#");
      if (anchor === undefined || href.startsWith("http")) continue;
      const source = ANCHOR_PAGES[path];
      expect(source).toBeDefined();
      expect(
        source.includes(`id="${anchor}"`) ||
          (anchor === "store-connections" &&
            source.includes("id={STORE_CONNECTIONS_SECTION_ID}")),
      ).toBe(true);
    }
  });

  it("opens the one documentation tip on the docs site", () => {
    const external = Object.values(ITEM_TIPS)
      .flat()
      .filter((tip) => tip.external);
    expect(external.map((tip) => tip.href(null))).toEqual([
      "https://docs.asobeast.com/concepts/stores#how-are-auto-tracked-keywords-chosen",
    ]);
  });
});
