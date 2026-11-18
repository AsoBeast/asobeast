"use client";

import { useEffect } from "react";
import Image from "next/image";
import { RotateCw } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/brand";
import { errorReference } from "@/lib/error-reference";
import { reportBrowserError, worthReporting } from "@/lib/error-reporting";

const THEME_KEY = "theme";

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
  useEffect(() => {
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
    <html lang="en">
      <body>
        <title>{`Something went wrong · ${PRODUCT_NAME}`}</title>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <main>
          <Image
            src="/brand/mark.png"
            alt=""
            width={40}
            height={40}
            unoptimized
          />
          <h1>Something went wrong</h1>
          <p>
            {`${PRODUCT_NAME} could not render this page. Trying again usually clears a transient failure.`}
          </p>
          <button type="button" onClick={retry}>
            <RotateCw size={16} aria-hidden="true" />
            <span>Try again</span>
          </button>
          {reference ? (
            <p className="reference">{`Reference ${reference}`}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
