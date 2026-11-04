import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MapPoint } from "./map-points";
import { MapDotShape } from "./MapDot";

const point = (overrides: Partial<MapPoint>): MapPoint => ({
  keywordId: "kw-1",
  text: "focus timer",
  country: "us",
  popularity: 62,
  difficulty: 18,
  zone: "quickWins",
  opportunity: 82,
  position: 3,
  depth: 200,
  positionLabel: "3",
  ranked: true,
  floor: false,
  active: true,
  ...overrides,
});

const markup = (payload: MapPoint) =>
  renderToStaticMarkup(
    <svg>
      <MapDotShape
        {...({ cx: 10, cy: 20, payload, index: 0 } as Parameters<
          typeof MapDotShape
        >[0])}
      />
    </svg>,
  );

describe("MapDotShape", () => {
  it("is a button that opens a dialog once the keyword was checked", () => {
    const html = markup(point({}));
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("is not a button while the keyword was never checked", () => {
    const html = markup(
      point({
        position: null,
        depth: null,
        positionLabel: null,
        ranked: false,
      }),
    );
    expect(html).not.toContain('role="button"');
    expect(html).toContain('role="img"');
    expect(html).not.toContain("aria-haspopup");
    expect(html).toContain('tabindex="-1"');
  });
});
