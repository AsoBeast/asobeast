import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import zhDatePicker from "../../../messages/zh-CN/datePicker.json";
import { CapturedDayPicker } from "./CapturedDayPicker";

describe("CapturedDayPicker", () => {
  it("renders Chinese date picker controls and UTC dates", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="zh-CN"
        timeZone="UTC"
        messages={{ datePicker: zhDatePicker }}
      >
        <CapturedDayPicker
          dates={["2026-11-05", "2026-11-06"]}
          value="2026-11-06"
          onSelect={() => undefined}
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain('aria-label="采集日期：2026年11月6日"');
    expect(html).toContain('aria-label="上一个采集日期"');
    expect(html).toContain('aria-label="下一个采集日期"');
    expect(html).toContain("2026年11月6日");
  });
});
