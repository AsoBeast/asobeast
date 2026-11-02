import type * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeltaChip, PositionDeltaChip, TrendChip } from "./delta-chip";

const textOf = (chip: React.ReactElement) =>
  renderToString(chip).replace(/^<span[^>]*><svg.*?<\/svg>|<\/span>$/g, "");

describe("delta chips", () => {
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
});
