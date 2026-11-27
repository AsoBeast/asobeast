import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppDetail } from "@asobeast/shared";
import { TestIntlProvider } from "@/test/intl-provider";
import { DelistedNotice } from "./DelistedNotice";

const SINCE = "2026-10-20T23:59:00.000Z";

const detail = (over: Partial<AppDetail> = {}): AppDetail => ({
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "471112395",
  country: "de",
  name: "Gone",
  iconUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  searchable: true,
  latestSnapshot: null,
  competitors: [],
  group: null,
  isCompetitor: false,
  delistedAt: SINCE,
  ...over,
});

const text = (app: AppDetail) =>
  renderToStaticMarkup(
    <TestIntlProvider locale="en">
      <DelistedNotice detail={app} since={SINCE} />
    </TestIntlProvider>,
  );

const chineseText = (app: AppDetail) =>
  renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <DelistedNotice detail={app} since={SINCE} />
    </TestIntlProvider>,
  );

describe("DelistedNotice", () => {
  it("names the store, the store id, the storefront and the UTC day", () => {
    const markup = text(detail());

    expect(markup).toContain("No longer listed on App Store");
    expect(markup).toContain(
      "Since Oct 20, 2026, App Store answers that it has no app 471112395 in Germany.",
    );
  });

  it("names Google Play for a Play app", () => {
    expect(
      text(detail({ store: "GOOGLE_PLAY", storeAppId: "com.example.gone" })),
    ).toContain("Google Play answers that it has no app com.example.gone");
  });

  it("sends an app to the dashboard and a competitor to its app", () => {
    expect(text(detail())).toContain(
      "If it is gone for good, delete it from the dashboard.",
    );
    expect(text(detail({ isCompetitor: true }))).toContain(
      "If it is gone for good, remove it from the competitors of the app that tracks it.",
    );
  });

  it("renders the delisting notice in Chinese without translating store data", () => {
    const markup = chineseText(detail());

    expect(markup).toContain("App Store 上已下架");
    expect(markup).toContain(
      "自 2026年10月20日 起，App Store 表示在德国找不到应用 471112395。",
    );
    expect(markup).toContain("如果应用已永久下架，请从仪表盘中删除。");
    expect(markup).not.toContain("No longer listed on App Store");
  });
});
