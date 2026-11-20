import type * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DeltaChip,
  DirectionArrow,
  PositionDeltaChip,
  TrendChip,
} from "./delta-chip";

const textOf = (chip: React.ReactElement) =>
  renderToString(chip).replace(/^<span[^>]*><svg.*?<\/svg>|<\/span>$/g, "");

const arrowClasses = (chip: React.ReactElement) =>
  [...renderToString(chip).matchAll(/<svg[^>]*class="([^"]*)"/g)].map(
    ([, classes]) => classes,
  );

describe("delta chips", () => {
  it("lifts every arrow to the middle of the digits beside it", () => {
    const arrows = [
      <DeltaChip key="delta" value={-3} period="over 7 days" form="pill" />,
      <DeltaChip key="flat" value={0} period="over 7 days" />,
      <PositionDeltaChip key="position" value={2} />,
      <TrendChip key="trend" label="7d" value={4} form="pill" />,
      <TrendChip key="zero" label="7d" value={0} />,
      <DirectionArrow key="arrow" way="down" />,
    ].flatMap(arrowClasses);
    expect(arrows).toHaveLength(5);
    for (const classes of arrows) {
      expect(classes.split(" ")).toContain("-translate-y-[0.07em]");
    }
  });

  it("keeps the change and its unit in one span beside the arrow", () => {
    expect(textOf(<DeltaChip value={-3} period="over 7 days" />)).toBe(
      "<span>3</span>",
    );
    expect(textOf(<DeltaChip value={4} unit="%" period="over 7 days" />)).toBe(
      "<span>4%</span>",
    );
  });

  it("keeps the position change in one span", () => {
    expect(textOf(<PositionDeltaChip value={2} />)).toBe("<span>2</span>");
  });

  it("keeps the signed trend, its unit and its label in one span", () => {
    expect(textOf(<TrendChip label="7d" value={4.4} />)).toBe(
      "<span>+4 7d</span>",
    );
    expect(textOf(<TrendChip label="7d" value={4} unit="%" />)).toBe(
      "<span>+4% 7d</span>",
    );
    expect(textOf(<TrendChip label="30d" value={-2} />)).toBe(
      "<span>-2 30d</span>",
    );
  });

  it("keeps the decimals a trend asks for", () => {
    expect(textOf(<TrendChip label="7d" value={3.5} digits={1} />)).toBe(
      "<span>+3.5 7d</span>",
    );
    expect(textOf(<TrendChip label="7d" value={-1.24} digits={1} />)).toBe(
      "<span>-1.2 7d</span>",
    );
    expect(textOf(<TrendChip label="7d" value={0.04} digits={1} />)).toBe(
      "<span>0.0 7d</span>",
    );
  });

  it("writes a trend without data as one text", () => {
    const markup = renderToString(<TrendChip label="30d" value={null} />);

    expect(markup).toContain(">no 30d data</span>");
    expect(markup).not.toContain("<!-- -->");
  });

  it("names the change for assistive technology as before", () => {
    expect(
      renderToString(<DeltaChip value={-3} period="over 7 days" />),
    ).toContain('aria-label="up 3 over 7 days"');
  });

  it("names the unit of the change for assistive technology", () => {
    expect(
      renderToString(<DeltaChip value={-4} unit="%" period="over 7 days" />),
    ).toContain('aria-label="up 4% over 7 days"');
  });

  it("writes a change with the decimals it asks for, seen and heard alike", () => {
    const markup = renderToString(
      <DeltaChip
        value={3}
        digits={1}
        polarity="higher-is-better"
        period="in visibility"
      />,
    );

    expect(
      textOf(
        <DeltaChip
          value={3}
          digits={1}
          polarity="higher-is-better"
          period="in visibility"
        />,
      ),
    ).toBe("<span>3.0</span>");
    expect(markup).toContain('aria-label="up 3.0 in visibility"');
  });

  it("rounds a change before it picks the direction", () => {
    expect(
      renderToString(
        <DeltaChip
          value={-6.64}
          digits={1}
          polarity="higher-is-better"
          period="in visibility"
        />,
      ),
    ).toContain('aria-label="down 6.6 in visibility"');
    expect(
      renderToString(<DeltaChip value={0.04} digits={1} period="points" />),
    ).toContain(">0.0</span>");
  });
});
