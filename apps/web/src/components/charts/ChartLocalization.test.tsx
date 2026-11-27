import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartImageButtons } from "./ChartImageButtons";
import { SeriesLegend } from "./SeriesLegend";

const messages = {
  charts: {
    copyImage: "复制图表",
    downloadPng: "下载 PNG",
    chartedSeries: "图表系列",
  },
  ui: {
    subjectOf: "，对象：{subject}",
  },
};

describe("chart localization", () => {
  it("renders Chinese chart image labels", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="zh-CN" timeZone="UTC" messages={messages}>
        <ChartImageButtons subject="关键词排名" makeJob={() => null} />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("复制图表");
    expect(html).toContain("下载 PNG");
  });

  it("names the chart legend in Chinese", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="zh-CN" timeZone="UTC" messages={messages}>
        <SeriesLegend
          payload={[
            { dataKey: "a", color: "#000", type: "line", value: "当前" },
          ]}
          labels={{ a: "当前" }}
          order={["a"]}
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain('aria-label="图表系列"');
  });
});
