import type * as React from "react";
import { NextIntlClientProvider } from "next-intl";
import enFormat from "../../../messages/en/format.json";
import zhFormat from "../../../messages/zh-CN/format.json";
import type { Locale } from "@/lib/locale";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DeltaChip,
  DirectionArrow,
  PositionDeltaChip,
  TrendChip,
} from "./delta-chip";

const messages = { en: enFormat, "zh-CN": zhFormat };

const renderChip = (chip: React.ReactElement, locale: Locale = "en") =>
  renderToString(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ format: messages[locale] }}
    >
      {chip}
    </NextIntlClientProvider>,
  );

const textOf = (chip: React.ReactElement) =>
  renderChip(chip).replace(/^<span[^>]*><svg.*?<\/svg>|<\/span>$/g, "");

const arrowClasses = (chip: React.ReactElement) =>
  [...renderChip(chip).matchAll(/<svg[^>]*class="([^"]*)"/g)].map(
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
    const markup = renderChip(<TrendChip label="30d" value={null} />);

    expect(markup).toContain(">no 30d data</span>");
    expect(markup).not.toContain("<!-- -->");
  });

  it("names the change for assistive technology as before", () => {
    expect(renderChip(<DeltaChip value={-3} period="over 7 days" />)).toContain(
      'aria-label="up 3 over 7 days"',
    );
  });

  it("names the unit of the change for assistive technology", () => {
    expect(
      renderChip(<DeltaChip value={-4} unit="%" period="over 7 days" />),
    ).toContain('aria-label="up 4% over 7 days"');
  });

  it("writes a change with the decimals it asks for, seen and heard alike", () => {
    const markup = renderChip(
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
      renderChip(
        <DeltaChip
          value={-6.64}
          digits={1}
          polarity="higher-is-better"
          period="in visibility"
        />,
      ),
    ).toContain('aria-label="down 6.6 in visibility"');
    expect(
      renderChip(<DeltaChip value={0.04} digits={1} period="points" />),
    ).toContain(">0.0</span>");
  });

  it.each([
    [1.25, "up 1.3"],
    [-1.25, "down 1.3"],
    [1.15, "up 1.2"],
    [-1.15, "down 1.2"],
    [2.55, "up 2.6"],
    [-0.05, "down 0.1"],
    [0.04, null],
  ])(
    "rounds %s half away from zero like the fixed formatter",
    (value, label) => {
      const markup = renderChip(
        <DeltaChip
          value={value}
          digits={1}
          polarity="higher-is-better"
          period="in visibility"
        />,
      );

      if (label === null) {
        expect(markup).toContain(">0.0</span>");
        expect(markup).not.toContain("aria-label");
      } else {
        expect(markup).toContain(`aria-label="${label} in visibility"`);
      }
    },
  );

  it("names changes and missing data in Chinese", () => {
    expect(
      renderChip(<DeltaChip value={-3} period="过去 7 天" />, "zh-CN"),
    ).toContain('aria-label="过去 7 天上升 3"');
    expect(
      renderChip(<TrendChip label="30d" value={null} />, "zh-CN"),
    ).toContain("暂无30d数据");
  });
});
