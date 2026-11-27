import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TestIntlProvider } from "@/test/intl-provider";
import { FunnelHelp } from "./FunnelHelp";

vi.mock("@/components/ui/info-tip", () => ({
  InfoTip: ({
    label,
    title,
    summary,
    children,
  }: {
    label: string;
    title: string;
    summary: string;
    children: React.ReactNode;
  }) => (
    <section aria-label={label}>
      <h2>{title}</h2>
      <p>{summary}</p>
      {children}
    </section>
  ),
}));

function markup(store: "APP_STORE" | "GOOGLE_PLAY"): string {
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <FunnelHelp store={store} />
    </TestIntlProvider>,
  );
}

describe("Simplified Chinese store funnel help", () => {
  it("localizes App Store metric explanations and preserves report names", () => {
    const rendered = markup("APP_STORE");

    expect(rendered).toContain("关于商店漏斗");
    expect(rendered).toContain("曝光量、应用详情页浏览量和获取点击量");
    expect(rendered).toContain("App Store Discovery and Engagement");
    expect(rendered).toContain("App Store Connect");
    expect(rendered).toContain("三天后");
    expect(rendered).toContain("了解这些数字的读取方式");
    expect(rendered).not.toContain("About the store funnel");
  });

  it("localizes Google Play explanations and preserves the counting date", () => {
    const rendered = markup("GOOGLE_PLAY");

    expect(rendered).toContain("应用详情页访客和获取量");
    expect(rendered).toContain("Google Play Console");
    expect(rendered).toContain("2026年7月10日");
    expect(rendered).not.toContain("Store listing visitors and acquisitions");
  });
});
