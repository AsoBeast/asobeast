import { LOCALE_COOKIE_NAME, type Locale } from "./locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function writeLocaleCookie(locale: Locale): void {
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; SameSite=Lax${secure}; Max-Age=${ONE_YEAR_SECONDS}`;
}

export function navigateToLocale(locale: Locale): void {
  writeLocaleCookie(locale);
  window.location.reload();
}
