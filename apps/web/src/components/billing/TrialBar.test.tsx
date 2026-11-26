import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalogs } from "@/i18n/messages";
import zhBilling from "../../../messages/zh-CN/billing.json";
import { trialBarParts } from "@/lib/plan-choice";
import { translationContext } from "@/test/translation-context";
import { TrialBar } from "./TrialBar";

const CLOCK = { now: new Date("2026-10-22T12:00:00.000Z"), timeZone: "UTC" };
const ZH = translationContext("zh-CN", "billing");

function markupWith(billing: typeof zhBilling): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="zh-CN"
      timeZone="UTC"
      messages={{ ...catalogs["zh-CN"], billing }}
    >
      <TrialBar parts={trialBarParts({ days: 7 }, CLOCK, ZH)} label="您的试用">
        <button type="button">开始</button>
      </TrialBar>
    </NextIntlClientProvider>,
  );
}

describe("TrialBar rich copy", () => {
  it("renders the free promise and date in tagged spans", () => {
    const markup = markupWith(zhBilling);

    expect(markup).toContain(
      '<span class="font-medium text-foreground">完全免费</span>',
    );
    expect(markup).toContain(
      '<span class="font-medium text-foreground">2026年10月29日</span>',
    );
  });

  it("lets the ICU message reorder the date and free promise", () => {
    const markup = markupWith({
      ...zhBilling,
      trial: {
        ...zhBilling.trial,
        bar: "<date>{endsOn}</date>：<free>免费</free>，共 {days, plural, one {# 天} other {# 天}}",
      },
    });

    expect(markup).toContain(
      '<span class="font-medium text-foreground">2026年10月29日</span>：<span class="font-medium text-foreground">免费</span>，共 7 天',
    );
    expect(markup.indexOf("2026年10月29日")).toBeLessThan(
      markup.indexOf("免费"),
    );
  });
});
