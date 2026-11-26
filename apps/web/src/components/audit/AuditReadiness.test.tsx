import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enAudit from "../../../messages/en/audit.json";
import zhAudit from "../../../messages/zh-CN/audit.json";
import type { AppAuditResult } from "@asobeast/shared";
import { AuditReadiness } from "./AuditReadiness";

const audit = (stories: number): AppAuditResult => ({
  appId: "app-1",
  store: "APP_STORE",
  overall: 74,
  coveredWeight: 95,
  totalWeight: 110,
  factors: [],
  recommendations: { quickWins: [], highImpact: [], strategic: [] },
  ai: { configured: false, model: null, generatedAt: null },
  generatedAt: "2026-11-17T00:00:00.000Z",
  readiness: {
    items: [],
    editorial: { stories, editorsChoiceBadge: false },
    extractAsOf: "2026-11-14",
  },
});

const text = (stories: number, locale: "en" | "zh-CN" = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ audit: locale === "en" ? enAudit : zhAudit }}
    >
      <AuditReadiness audit={audit(stories)} />
    </NextIntlClientProvider>,
  );

describe("AuditReadiness", () => {
  it("pluralizes the featured stories of the editorial line", () => {
    const markup = text(2);

    expect(markup).toContain("In 2 featured stories");
    expect(markup).not.toContain("storys");
  });

  it("names a single featured story", () => {
    expect(text(1)).toContain("In 1 featured story");
  });

  it("writes the editorial line in Simplified Chinese", () => {
    expect(text(2, "zh-CN")).toContain("出现在 2 个精选故事中");
  });
});
