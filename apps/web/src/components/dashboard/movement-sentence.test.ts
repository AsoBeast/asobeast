import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type {
  PortfolioApp,
  PortfolioHistory,
  PortfolioMovement,
  PortfolioRangeChange,
} from "@asobeast/shared";
import enDashboard from "../../../messages/en/dashboard.json";
import zhDashboard from "../../../messages/zh-CN/dashboard.json";
import type { Locale } from "@/lib/locale";
import {
  dashboardLede,
  movementLede,
  quietSentence,
  type LedePart,
} from "./movement-sentence";

const t = createTranslator({
  locale: "en",
  namespace: "dashboard",
  messages: { dashboard: enDashboard },
});

function read(
  parts: LedePart[],
  locale: Locale = "en",
  dashboard: unknown = locale === "zh-CN" ? zhDashboard : enDashboard,
): string {
  const translator = createTranslator({
    locale,
    namespace: "dashboard",
    messages: { dashboard } as Parameters<
      typeof createTranslator
    >[0]["messages"],
  });
  return parts
    .map((part) =>
      translator.rich(part.key, {
        ...part.values,
        strong: (chunks) => chunks,
      }),
    )
    .join("");
}

const change = (
  up: number,
  down: number,
  rest: Partial<PortfolioRangeChange> = {},
): PortfolioRangeChange => ({
  compared: true,
  visibilityDelta: 1,
  top10Delta: 0,
  movement: { up, down, entered: 0, lost: 0 },
  appsMoved: 1,
  movers: { up: [], down: [] },
  ...rest,
});

const sentence = (value: PortfolioRangeChange, days: number): string =>
  read(movementLede(value, days));

describe("movementLede", () => {
  it("returns one complete ICU descriptor for a range sentence", () => {
    expect(movementLede(change(4, 3, { appsMoved: 5 }), 30)).toEqual([
      {
        key: "lede.rangeBothMany",
        values: { days: 30, up: 4, down: 3, count: 5 },
      },
    ]);
  });

  it("says no keyword moved once the range has a day to compare with", () => {
    expect(sentence(change(0, 0), 7)).toBe(
      "No keyword moved in the last 7 days.",
    );
  });

  it("says when movement will appear before the range has history", () => {
    expect(sentence(change(0, 0, { compared: false }), 90)).toBe(
      "Movement appears after 90 days of daily runs.",
    );
  });

  it("leaves the app count out for a single app", () => {
    expect(sentence(change(1, 0), 7)).toBe(
      "In the last 7 days 1 keyword climbed.",
    );
  });

  it("counts a fall alone with its noun", () => {
    expect(sentence(change(0, 2, { appsMoved: 2 }), 7)).toBe(
      "In the last 7 days 2 keywords fell across 2 apps.",
    );
  });

  it("lets a reordered catalog place the fall before the climb", () => {
    const reordered = {
      ...enDashboard,
      lede: {
        ...enDashboard.lede,
        rangeBothSingle:
          "<strong>{down, plural, one {# fell} other {# fell}}</strong> before <strong>{up, plural, one {# keyword climbed} other {# keywords climbed}}</strong> in {days, number} days",
      },
    };

    expect(read(movementLede(change(4, 3), 30), "en", reordered)).toBe(
      "3 fell before 4 keywords climbed in 30 days",
    );
  });
});

describe("quietSentence", () => {
  it("names the range it speaks for", () => {
    expect(quietSentence(true, 30, t)).toBe(
      "No keyword moved in the last 30 days.",
    );
  });
});

describe("dashboardLede", () => {
  const app = (id: string, name: string, country = "us"): PortfolioApp => ({
    id,
    store: "APP_STORE",
    storeAppId: id,
    country,
    name,
    iconUrl: null,
    groupId: null,
    groupName: null,
    visibility: { current: 0, delta7d: null },
    sparkline: [],
    trackedKeywords: 0,
    competitors: 0,
    lastCapturedAt: null,
  });
  const APPS = [
    app("us", "Focus Timer"),
    app("de", "Focus Timer", "de"),
    app("tc", "Tomato Clock"),
  ];
  const moved = (up: number, down: number): PortfolioMovement => ({
    up,
    down,
    entered: 0,
    lost: 0,
  });
  const history = (
    lastRun: PortfolioRangeChange | undefined,
    runs: Record<string, PortfolioMovement> = {},
    range = change(4, 3, { visibilityDelta: 3.4 }),
  ): PortfolioHistory => ({
    days: 30,
    points: [],
    previous: [],
    change: range,
    lastRun,
    apps: Object.entries(runs).map(([appId, run]) => ({
      appId,
      points: [],
      change: {
        visibility: 0,
        visibilityDelta: null,
        top10: 0,
        top10Delta: null,
        movement: moved(0, 0),
      },
      lastRun: run,
    })),
  });
  const readDashboard = (
    value: PortfolioHistory,
    apps: readonly PortfolioApp[],
    locale: Locale = "en",
  ): string => read(dashboardLede(value, apps, t), locale);

  it("reads the last run first and names the app that moved most", () => {
    expect(
      readDashboard(
        history(change(3, 5), {
          us: moved(1, 1),
          de: moved(0, 4),
          tc: moved(2, 0),
        }),
        APPS,
      ),
    ).toBe(
      "In the last run 3 keywords climbed and 5 fell, most in Focus Timer (DE). Over the last 30 days visibility is up 3.",
    );
  });

  it("names no app when two moved as much or only one moved", () => {
    const tied = { us: moved(2, 0), tc: moved(1, 1) };
    expect(readDashboard(history(change(3, 1), tied), APPS)).toBe(
      "In the last run 3 keywords climbed and 1 fell. Over the last 30 days visibility is up 3.",
    );
    expect(
      readDashboard(history(change(2, 0), { us: moved(2, 0) }), APPS),
    ).toBe(
      "In the last run 2 keywords climbed. Over the last 30 days visibility is up 3.",
    );
  });

  it("says a quiet run and a flat or falling range in words", () => {
    expect(
      readDashboard(
        history(change(0, 0), {}, change(1, 1, { visibilityDelta: 0.2 })),
        APPS,
      ),
    ).toBe(
      "In the last run no keyword moved. Over the last 30 days visibility is unchanged.",
    );
    expect(
      readDashboard(
        history(change(0, 2), {}, change(1, 1, { visibilityDelta: -2.6 })),
        APPS,
      ),
    ).toBe(
      "In the last run 2 keywords fell. Over the last 30 days visibility is down 3.",
    );
  });

  it("leaves the range out until it can be compared", () => {
    expect(
      readDashboard(
        history(change(1, 0), {}, change(0, 0, { compared: false })),
        APPS,
      ),
    ).toBe("In the last run 1 keyword climbed.");
  });

  it("falls back to the range sentence without a run to compare", () => {
    expect(readDashboard(history(undefined), APPS)).toBe(
      "In the last 30 days 4 keywords climbed and 3 fell.",
    );
    expect(
      readDashboard(history(change(0, 0, { compared: false })), APPS),
    ).toBe("In the last 30 days 4 keywords climbed and 3 fell.");
  });

  it("marks only the translated facts for emphasis", () => {
    const translator = createTranslator({
      locale: "en",
      namespace: "dashboard",
      messages: { dashboard: enDashboard } as Parameters<
        typeof createTranslator
      >[0]["messages"],
    });
    const markup = dashboardLede(
      history(change(1, 0), { us: moved(1, 0) }),
      APPS,
      t,
    )
      .map((part) =>
        translator.rich(part.key, {
          ...part.values,
          strong: (chunks) => `<strong>${chunks}</strong>`,
        }),
      )
      .join("");

    expect(markup).toBe(
      "In the last run <strong>1 keyword climbed</strong>. Over the last 30 days visibility is <strong>up 3</strong>.",
    );
  });
});

describe("Simplified Chinese dashboard movement copy", () => {
  const chinese = createTranslator({
    locale: "zh-CN",
    namespace: "dashboard",
    messages: { dashboard: zhDashboard },
  });

  it("uses complete Chinese sentences for range and last-run movement", () => {
    expect(
      read(movementLede(change(4, 3, { appsMoved: 5 }), 30), "zh-CN"),
    ).toBe("最近 30 天内，4 个关键词上升，3 个下降，涉及 5 个应用。");
    expect(quietSentence(true, 30, chinese)).toBe(
      "最近 30 天内没有关键词排名变化。",
    );
  });
});
