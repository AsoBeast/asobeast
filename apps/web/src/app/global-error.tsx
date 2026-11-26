"use client";

import { useEffect, useLayoutEffect } from "react";
import Image from "next/image";
import { RotateCw } from "lucide-react";
import enCommon from "../../messages/en/common.json";
import enSeo from "../../messages/en/seo.json";
import zhCommon from "../../messages/zh-CN/common.json";
import zhSeo from "../../messages/zh-CN/seo.json";
import { PRODUCT_NAME } from "@/lib/brand";
import { errorReference } from "@/lib/error-reference";
import { reportBrowserError, worthReporting } from "@/lib/error-reporting";
import { formatMessage } from "@/i18n/format-message";
import {
  LOCALE_COOKIE_NAME,
  LOCALES,
  localeForTag,
  type Locale,
} from "@/lib/locale";

const THEME_KEY = "theme";

function errorCopy(locale: Locale) {
  const seo = locale === "zh-CN" ? zhSeo : enSeo;
  const common = locale === "zh-CN" ? zhCommon : enCommon;
  return {
    title: formatMessage(seo.errorTitle, locale),
    body: formatMessage(seo.errorBody, locale, { product: PRODUCT_NAME }),
    retry: formatMessage(common.retry, locale),
    reference: seo.errorReference,
  };
}

const ERROR_COPY: Record<Locale, ReturnType<typeof errorCopy>> = {
  en: errorCopy("en"),
  "zh-CN": errorCopy("zh-CN"),
};

const ERROR_TITLES = {
  en: `${ERROR_COPY.en.title} · ${PRODUCT_NAME}`,
  "zh-CN": `${ERROR_COPY["zh-CN"].title} · ${PRODUCT_NAME}`,
};

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const GLOBAL_ERROR_LOCALE_SCRIPT = `
(function () {
  var supported = ${scriptJson(LOCALES)};
  var localeForTag = ${localeForTag.toString()};
  var root = document.documentElement;
  var locale = supported.indexOf(root.lang) !== -1 ? root.lang : null;
  if (!locale) {
    var cookies = document.cookie.split(";");
    for (var index = 0; index < cookies.length; index += 1) {
      var entry = cookies[index].trim();
      var separator = entry.indexOf("=");
      if (separator === -1 || entry.slice(0, separator) !== ${scriptJson(LOCALE_COOKIE_NAME)}) continue;
      var value = entry.slice(separator + 1);
      if (supported.indexOf(value) !== -1) {
        locale = value;
        break;
      }
    }
  }
  if (!locale && typeof navigator !== "undefined") {
    var languages = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ""];
    for (var languageIndex = 0; languageIndex < languages.length; languageIndex += 1) {
      var candidate = localeForTag(languages[languageIndex]);
      if (candidate) {
        locale = candidate;
        break;
      }
    }
  }
  locale = locale || "en";
  root.lang = locale;
  root.dataset.errorLocale = locale;
  document.title = ${scriptJson(ERROR_TITLES)}[locale];
})();
`;

const DARK = `
  --page: #0c0b0a;
  --surface: #141311;
  --surface-2: #1c1a17;
  --line: #2a2724;
  --ink: #efece7;
  --ink-2: #a39d94;
  --ink-3: #8a847b;
`;

const STYLES = `
:root {
  color-scheme: light dark;
  --page: #faf9f7;
  --surface: #ffffff;
  --surface-2: #f4f2ee;
  --line: #e7e4df;
  --ink: #1c1917;
  --ink-2: #6b665f;
  --ink-3: #716b64;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${DARK}}
}
:root[data-theme="dark"] {${DARK}}
:root[data-error-locale="en"] [data-error-locale="zh-CN"],
:root[data-error-locale="zh-CN"] [data-error-locale="en"],
:root:not([data-error-locale]) [data-error-locale="zh-CN"] { display: none !important; }
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 48px;
  background: var(--page);
  color: var(--ink);
  font-family: "Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
main {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  text-wrap: balance;
}
img { border-radius: 10px; }
h1 {
  margin: 20px 0 8px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
p { margin: 0; color: var(--ink-2); }
button {
  margin-top: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms ease-out;
}
button:hover { background: var(--surface-2); }
button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.reference {
  margin-top: 16px;
  color: var(--ink-3);
  font-size: 13px;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
}
`;

function storedTheme(): "light" | "dark" | null {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function useStoredTheme(): void {
  useLayoutEffect(() => {
    const theme = storedTheme();
    if (!theme) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    return () => {
      delete root.dataset.theme;
    };
  }, []);
}

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const reference = errorReference(error);

  useEffect(() => {
    if (worthReporting(error)) void reportBrowserError(error);
  }, [error]);

  useStoredTheme();

  return (
    <html suppressHydrationWarning>
      <head suppressHydrationWarning>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <script
          dangerouslySetInnerHTML={{ __html: GLOBAL_ERROR_LOCALE_SCRIPT }}
        />
      </head>
      <body>
        <main>
          <Image
            src="/brand/mark.png"
            alt=""
            width={40}
            height={40}
            unoptimized
          />
          <h1 data-error-locale="en">{ERROR_COPY.en.title}</h1>
          <h1 data-error-locale="zh-CN">{ERROR_COPY["zh-CN"].title}</h1>
          <p data-error-locale="en">{ERROR_COPY.en.body}</p>
          <p data-error-locale="zh-CN">{ERROR_COPY["zh-CN"].body}</p>
          <button type="button" onClick={retry}>
            <RotateCw size={16} aria-hidden="true" />
            <span data-error-locale="en">{ERROR_COPY.en.retry}</span>
            <span data-error-locale="zh-CN">{ERROR_COPY["zh-CN"].retry}</span>
          </button>
          {reference ? (
            <>
              <p className="reference" data-error-locale="en">
                {formatMessage(ERROR_COPY.en.reference, "en", { reference })}
              </p>
              <p className="reference" data-error-locale="zh-CN">
                {formatMessage(ERROR_COPY["zh-CN"].reference, "zh-CN", {
                  reference,
                })}
              </p>
            </>
          ) : null}
        </main>
      </body>
    </html>
  );
}
