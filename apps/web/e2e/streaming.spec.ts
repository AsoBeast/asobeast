import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./session.mts";

const SERVED_RUNTIME = readFileSync(
  join(
    __dirname,
    "../node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",
  ),
  "utf8",
);

function instruction(pattern: RegExp): string {
  const found = SERVED_RUNTIME.match(pattern)?.[0];
  if (!found) {
    throw new Error(`the served runtime no longer ships ${pattern.source}`);
  }
  return found.replaceAll("\\n", "\n");
}

const REVEAL_BOUNDARY = instruction(
  /\$RB=\[\];\$RV=function.*?\$RC=function\([^)]*\)\{.*?\};/,
);
const COMPLETE_SEGMENT = instruction(/\$RS=function\([^)]*\)\{.*?\};/);

async function openStreamingPage(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const thrown: string[] = [];
    Object.assign(window, { streamingErrors: thrown });
    window.addEventListener("error", (event) => thrown.push(event.message));
  });
}

function stream(page: Page, markup: string, script: string) {
  return page.evaluate(
    ([html, source]) => {
      document.body.insertAdjacentHTML("beforeend", html);
      const element = document.createElement("script");
      element.textContent = source;
      document.body.append(element);
    },
    [markup, script],
  );
}

function streamingErrors(page: Page) {
  return page.evaluate(
    () => (window as unknown as { streamingErrors: string[] }).streamingErrors,
  );
}

test("a segment streamed after its boundary revealed away the fallback is dropped without an error", async ({
  page,
}) => {
  await openStreamingPage(page);

  await stream(
    page,
    '<div id="race"><!--$?--><template id="B:race"></template><ul><template id="P:race"></template></ul><!--/$--></div><div hidden id="S:content"><p>revealed content</p></div>',
    `${REVEAL_BOUNDARY}$RC("B:race","S:content")`,
  );
  await expect(page.locator("#race")).toHaveText("revealed content");
  await expect(page.locator('[id="P:race"]')).toHaveCount(0);

  await stream(
    page,
    '<div hidden id="S:race"><li>skeleton row</li></div>',
    `${COMPLETE_SEGMENT}$RS("S:race","P:race")`,
  );

  expect(await streamingErrors(page)).toEqual([]);
  await expect(page.locator('[id="S:race"]')).toHaveCount(0);
  await expect(page.locator("#race")).toHaveText("revealed content");
});

test("a segment whose placeholder is still in place is moved into it", async ({
  page,
}) => {
  await openStreamingPage(page);

  await stream(
    page,
    '<ul id="host"><template id="P:ok"></template></ul><div hidden id="S:ok"><li>streamed row</li></div>',
    `${COMPLETE_SEGMENT}$RS("S:ok","P:ok")`,
  );

  expect(await streamingErrors(page)).toEqual([]);
  await expect(page.locator("#host > li")).toHaveText("streamed row");
  await expect(page.locator('[id="S:ok"], [id="P:ok"]')).toHaveCount(0);
});
