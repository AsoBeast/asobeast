import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WEBHOOK_EVENTS,
  WORKSPACE_CHECKLIST_ITEMS,
  WORKSPACE_GOALS,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { APP_SECTIONS } from "@/lib/app-sections";
import { translationContext } from "@/test/translation-context";
import {
  GOAL_COPY,
  ITEM_COPY,
  checklistGoalCopy,
  checklistItemCopy,
  checklistTips,
} from "./checklist-copy";

const DASH = /[–—]| - /;
const en = translationContext("en", "settings").translator;
const zh = translationContext("zh-CN", "settings").translator;

const copyStrings = (): string[] => [
  ...WORKSPACE_CHECKLIST_ITEMS.flatMap((id) => {
    const copy = checklistItemCopy(id, en);
    return [copy.description, copy.action, copy.doneText];
  }),
  ...WORKSPACE_GOALS.flatMap((goal) => {
    const copy = checklistGoalCopy(goal, en);
    return [copy.label, copy.description];
  }),
];

describe("the checklist copy", () => {
  it.each(WORKSPACE_CHECKLIST_ITEMS)("words the %s item", (id) => {
    const copy = checklistItemCopy(id, en);
    expect(copy.description.length).toBeGreaterThan(0);
    expect(copy.action.length).toBeGreaterThan(0);
    expect(copy.doneText.length).toBeGreaterThan(0);
    expect(ITEM_COPY[id].titleKey).toBe(
      `checklist.items.${ITEM_COPY[id].catalogKey}.title`,
    );
  });

  it.each(WORKSPACE_GOALS)("words the %s goal", (goal) => {
    const copy = checklistGoalCopy(goal, en);
    expect(copy.label.length).toBeGreaterThan(0);
    expect(copy.description.length).toBeGreaterThan(0);
    expect(GOAL_COPY[goal].labelKey).toBe(
      `checklist.goals.${GOAL_COPY[goal].catalogKey}.label`,
    );
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
    expect(checklistItemCopy(id, en).href("app-1")).toBe(href);
    expect(checklistItemCopy(id, en).href(null)).toBeNull();
  });

  it.each([
    ["import_app", "/"],
    ["connect_console", "/integrations#store-connections"],
    ["connect_ai_client", "/integrations#api-and-mcp"],
    ["turn_on_alert", "/settings#alerts"],
  ] as const)("links %s to the same page for any app", (id, href) => {
    expect(checklistItemCopy(id, en).href(null)).toBe(href);
    expect(checklistItemCopy(id, en).href("app-1")).toBe(href);
  });

  it("uses no dash punctuation", () => {
    for (const text of copyStrings()) expect(text).not.toMatch(DASH);
  });

  it("localizes goals and item titles by stable code", () => {
    expect(checklistGoalCopy("improve_rankings", zh)).toEqual({
      label: "提升我的排名",
      description: "填写关键词字段、添加竞品，并观察您的排名变化。",
    });
    expect(checklistItemCopy("second_market", zh).title).toBe(
      "在第二个市场跟踪关键词",
    );
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
    checklistItemCopy(id, en).href("app-1"),
    ...checklistTips(id, en).map((tip) => tip.href("app-1")),
  ]).filter((href): href is string => href !== null);

describe("the checklist tips", () => {
  it.each(WORKSPACE_CHECKLIST_ITEMS)(
    "points %s at the features its page holds",
    (id) => {
      const labels = checklistTips(id, en).map((tip) => tip.label);
      expect(labels).toHaveLength(TIP_WORDS[id].length);
      TIP_WORDS[id].forEach((word, index) => {
        expect(labels[index]).toContain(word);
      });
    },
  );

  it("keeps every item to four tips at most", () => {
    for (const id of WORKSPACE_CHECKLIST_ITEMS) {
      expect(checklistTips(id, en).length).toBeLessThanOrEqual(4);
    }
  });

  it("counts the webhook events instead of typing the number", () => {
    expect(checklistTips("turn_on_alert", en)[0]?.label).toContain(
      String(WEBHOOK_EVENTS.length),
    );
    expect(checklistTips("turn_on_alert", zh)[0]?.label).toContain(
      String(WEBHOOK_EVENTS.length),
    );
  });

  it("links every in app tip to a real page", () => {
    for (const href of linksOf().filter((link) => link.startsWith("/apps/"))) {
      expect(href).toMatch(APP_ROUTE);
    }
  });

  it("links an app bound tip only when there is an app", () => {
    const appBound = WORKSPACE_CHECKLIST_ITEMS.flatMap((id) =>
      checklistTips(id, en).filter((tip) =>
        tip.href("app-1")?.startsWith("/apps/"),
      ),
    );
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
    const external = WORKSPACE_CHECKLIST_ITEMS.flatMap((id) =>
      checklistTips(id, en).filter((tip) => tip.external),
    );
    expect(external.map((tip) => tip.href(null))).toEqual([
      "https://docs.asobeast.com/concepts/stores#how-are-auto-tracked-keywords-chosen",
    ]);
  });
});
