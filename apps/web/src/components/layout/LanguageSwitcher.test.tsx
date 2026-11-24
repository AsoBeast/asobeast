import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadMessages } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";
import { LanguageSwitcher } from "./LanguageSwitcher";

async function markup(locale: Locale) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
    >
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );
}

describe("LanguageSwitcher", () => {
  it("renders the current language with a localized accessible name", async () => {
    const english = await markup("en");
    const chinese = await markup("zh-CN");

    expect(english).toContain('aria-label="Language"');
    expect(english).toContain("English");
    expect(chinese).toContain('aria-label="语言"');
    expect(chinese).toContain("简体中文");
  });
});
