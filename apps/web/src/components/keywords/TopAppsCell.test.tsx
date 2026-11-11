import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeywordTopApp } from "@asobeast/shared";
import { TopAppsCell } from "./TopAppsCell";

const app = (
  position: number,
  title: string,
  role: KeywordTopApp["role"],
): KeywordTopApp => ({
  position,
  title,
  role,
  iconUrl: null,
  storeAppId: `id-${position}`,
});

const render = (topApps: KeywordTopApp[] | null | undefined) =>
  renderToStaticMarkup(
    <TopAppsCell
      keyword={{ keywordId: "kw-1", text: "focus timer", topApps }}
      onOpen={() => undefined}
    />,
  );

describe("TopAppsCell", () => {
  it("is one button into the search results that describes the apps", () => {
    const markup = render([
      app(1, "Tomato Clock", "competitor"),
      app(2, "Focus Timer", "own"),
      app(3, "Sand", "other"),
    ]);

    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain(
      'aria-label="View search results for focus timer"',
    );
    expect(markup).toContain('data-serp-keyword="kw-1"');
    expect(markup).toContain(
      "Top apps: #1 Tomato Clock (competitor), #2 Focus Timer (your app), #3 Sand",
    );
    expect(markup.match(/data-role="own"/g)).toHaveLength(1);
  });

  it("says where your app stands instead of ringing its icon", () => {
    const markup = render([
      app(1, "Tomato Clock", "competitor"),
      app(2, "Focus Timer", "own"),
    ]);

    expect(markup).toContain(">you #2<");
    expect(markup).not.toContain("ring-foreground");
    expect(markup.match(/after:bg-foreground/g)).toHaveLength(1);
    expect(render([app(1, "Tomato Clock", "competitor")])).not.toContain(
      "you #",
    );
  });

  it.each([[null], [undefined], [[]]])(
    "shows a dash and no button without fresh results (%j)",
    (topApps) => {
      const markup = render(topApps);

      expect(markup).not.toContain("<button");
      expect(markup).toContain("No search results from today or yesterday");
    },
  );
});
