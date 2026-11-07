import { expect, type Page } from "@playwright/test";

const SKIPPED_TEXT =
  "script, style, noscript, textarea, font, #recharts_measurement_span";

const DOM_ERROR =
  /NotFoundError|insertBefore|removeChild|#418|Hydration failed because/;

export function collectDomErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (message: string) => {
    if (DOM_ERROR.test(message)) errors.push(message);
  };
  page.on("pageerror", (error) => record(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") record(message.text());
  });
  return errors;
}

export async function translateText(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((skipped) => {
          const reactField = (node: Node, prefix: string): unknown =>
            Object.entries(node).find(([key]) => key.startsWith(prefix))?.[1];
          const ownedByReact = (text: Text) => {
            if (reactField(text, "__reactFiber")) return true;
            const props = text.parentElement
              ? (reactField(text.parentElement, "__reactProps") as
                  { children?: unknown } | undefined)
              : undefined;
            return ["string", "number", "bigint"].includes(
              typeof props?.children,
            );
          };
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
          );
          const texts: Text[] = [];
          while (walker.nextNode()) {
            const text = walker.currentNode as Text;
            if (text.data.trim() && !text.parentElement?.closest(skipped)) {
              texts.push(text);
            }
          }
          if (!texts.every(ownedByReact)) return false;
          for (const text of texts) {
            const outer = document.createElement("font");
            const inner = document.createElement("font");
            inner.textContent = text.data.toUpperCase();
            outer.append(inner);
            text.replaceWith(outer);
          }
          return true;
        }, SKIPPED_TEXT),
      { message: "every text node to translate is hydrated by React" },
    )
    .toBe(true);
}
