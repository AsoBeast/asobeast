import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE_NAME, type Locale } from "./locale";
import { navigateToLocale, writeLocaleCookie } from "./locale-cookie";

function browserWith(
  currentUrl = "http://localhost:3000/apps/one?tab=keywords#top",
) {
  let cookie = "";
  const assign = vi.fn();
  vi.stubGlobal("document", {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
  });
  vi.stubGlobal("window", {
    location: { href: currentUrl, assign },
  });
  return { assign, currentUrl, readCookie: () => cookie };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("locale preference cookie", () => {
  it.each<Locale>(["en", "zh-CN"])(
    "stores %s for one year on the whole site",
    (locale) => {
      const browser = browserWith();

      writeLocaleCookie(locale);

      expect(browser.readCookie()).toBe(
        `${LOCALE_COOKIE_NAME}=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`,
      );
    },
  );

  it("reloads the exact current URL after storing the choice", () => {
    const browser = browserWith();

    navigateToLocale("zh-CN");

    expect(browser.readCookie()).toContain("asobeast_locale=zh-CN");
    expect(browser.assign).toHaveBeenCalledOnce();
    expect(browser.assign).toHaveBeenCalledWith(browser.currentUrl);
  });
});
