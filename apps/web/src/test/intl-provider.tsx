import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { catalogs } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";

export function TestIntlProvider({
  children,
  locale = "en",
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={catalogs[locale]}
    >
      {children}
    </NextIntlClientProvider>
  );
}
