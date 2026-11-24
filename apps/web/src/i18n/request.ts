import type { AbstractIntlMessages } from "next-intl";
import { headers, cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "./messages";
import { LOCALE_COOKIE_NAME, resolveLocale, type Locale } from "@/lib/locale";

export default getRequestConfig(async () => {
  const store = await cookies();
  const incoming = await headers();
  const locale: Locale = resolveLocale(
    store.get(LOCALE_COOKIE_NAME)?.value,
    incoming.get("accept-language"),
  );

  return {
    locale,
    messages: (await loadMessages(locale)) as AbstractIntlMessages,
  };
});
