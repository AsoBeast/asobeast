import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DailyBudget } from "@asobeast/shared";
import { catalogs } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";
import { budgetOptions } from "@/lib/queries";
import { KeywordLimitNotice } from "./KeywordLimitNotice";

const SINCE = "2026-09-30T03:00:00.000Z";

function budgetOf(limit: number | null): DailyBudget {
  return {
    apps: 1,
    keywords: 20,
    categories: 0,
    reviews: 0,
    total: 21,
    capacityPerDay: 100,
    utilization: 21,
    stores: [],
    quota: {
      plan: "indie",
      apps: { used: 1, limit: 5 },
      keywordMarkets: { used: 2, limit },
      overLimitSince: SINCE,
    },
    completion: { startsAt: null, completesAt: null, hours: null },
  };
}

function noticeMarkup(limit: number | null, locale: Locale): string {
  const client = new QueryClient();
  client.setQueryData(budgetOptions.queryKey, budgetOf(limit));
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={catalogs[locale]}
    >
      <QueryClientProvider client={client}>
        <KeywordLimitNotice />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("KeywordLimitNotice plural copy", () => {
  it("uses the singular English keyword-market noun", () => {
    expect(noticeMarkup(1, "en")).toContain(
      "Daily checks cover the first 1 keyword market in a stable order;",
    );
  });

  it("uses the plural English keyword-market noun", () => {
    expect(noticeMarkup(2, "en")).toContain(
      "Daily checks cover the first 2 keyword markets in a stable order;",
    );
  });

  it("keeps the Chinese classifier and localized date", () => {
    expect(noticeMarkup(1, "zh-CN")).toContain(
      "每日检查会按稳定顺序覆盖前 1 个关键词市场；",
    );
  });

  it("does not format an unlimited limit as a number", () => {
    expect(noticeMarkup(null, "en")).toContain(
      "Daily checks cover keyword markets in a stable order;",
    );
    expect(noticeMarkup(null, "en")).not.toContain("Unlimited keyword markets");
  });
});
