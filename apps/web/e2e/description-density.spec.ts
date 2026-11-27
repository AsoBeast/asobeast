import type { Page } from "@playwright/test";
import { countWords } from "@asobeast/shared";
import {
  APP_FR_METADATA_AUDIT,
  FR_DESCRIPTION,
  LONG_DESCRIPTION,
} from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const density = (page: Page) =>
  page.getByRole("region", { name: "Word density" });

const wordsTable = (page: Page) =>
  density(page).getByRole("table", {
    name: "Most repeated words in the description",
  });

const rowOf = (page: Page, text: string) =>
  density(page).getByRole("row").filter({ hasText: text });

test("counts the words of an App Store description", async ({ page }) => {
  await page.goto("/apps/app-long/metadata");

  await expect(
    density(page).getByText(`${countWords(LONG_DESCRIPTION)} words`),
  ).toBeVisible();
});

test("lists the most repeated words", async ({ page }) => {
  await page.goto("/apps/app-long/metadata");

  const first = wordsTable(page).getByRole("row").nth(1);
  await expect(first.getByRole("cell").first()).toHaveText("quiet");
  await expect(first.getByRole("cell").nth(1)).toHaveText("4");
  await expect(wordsTable(page)).not.toContainText("deep");
});

test("switches to repeated phrases", async ({ page }) => {
  await page.goto("/apps/app-long/metadata");

  await (await hydrated(page.getByRole("tab", { name: "Two words" }))).click();

  const table = density(page).getByRole("table", {
    name: "Most repeated two word phrases",
  });
  await expect(table).toContainText("productivity app");
  await expect(page).toHaveURL(/density=pairs/);
});

test("marks a tracked keyword", async ({ page }) => {
  await page.goto("/apps/app-long/metadata?density=pairs");

  await expect(rowOf(page, "productivity app")).toContainText("Tracked");
});

test("shows where a row appears in the text", async ({ page }) => {
  await page.goto("/apps/app-long/metadata?density=pairs");

  const show = rowOf(page, "productivity app").getByRole("button", {
    name: /^Show in text/,
  });
  await (await hydrated(show)).click();

  await expect(show).toHaveAttribute("aria-pressed", "true");
  await expect(show).toBeFocused();
  const marked = page.getByRole("region", {
    name: "Description with productivity app marked",
  });
  await expect(marked.locator("mark")).toHaveCount(2);

  await show.click();
  await expect(show).toHaveAttribute("aria-pressed", "false");
  await expect(marked).toHaveCount(0);
});

test("follows the text as you edit it", async ({ page }) => {
  await page.goto("/apps/app-long/metadata");

  const description = page.getByRole("textbox", { name: "Description" });
  await (await hydrated(description)).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Ledger ledger ledger ledger ledger.");

  await expect(
    density(page).getByText(`${countWords(LONG_DESCRIPTION) + 5} words`),
  ).toBeVisible();
  const first = wordsTable(page).getByRole("row").nth(1);
  await expect(first.getByRole("cell").first()).toHaveText("ledger");
  await expect(first.getByRole("cell").nth(1)).toHaveText("5");
});

test("says the description counts for search on Google Play", async ({
  page,
}) => {
  await page.goto("/apps/app-fr/metadata");

  const tracked = APP_FR_METADATA_AUDIT.coverage.length;
  const held = APP_FR_METADATA_AUDIT.coverage.filter((row) =>
    row.fields.some((field) => field.field === "description" && field.covered),
  ).length;
  await expect(page.getByText("Not searched by the store")).toHaveCount(0);
  await expect(
    density(page).getByText(
      `Google Play searches the description. The live description holds ${held} of your ${tracked} tracked keywords.`,
    ),
  ).toBeVisible();
  await expect(
    density(page).getByText(`${countWords(FR_DESCRIPTION)} words`),
  ).toBeVisible();
});

test("reads right to left text in its own direction", async ({ page }) => {
  await page.goto("/apps/app-ar/metadata");

  const first = wordsTable(page).getByRole("row").nth(1);
  await expect(first.getByRole("cell").first()).toHaveAttribute("dir", "auto");
});

type LinkSample = { top: number; rendered: boolean };

test("keeps the controls below in place when it renders", async ({ page }) => {
  test.slow();
  const cpu = await page.context().newCDPSession(page);
  await cpu.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.addInitScript(() => {
    const samples: LinkSample[] = [];
    Object.assign(window, { linkSamples: samples });
    let link: HTMLAnchorElement | undefined;
    let section: Element | null | undefined;
    let after = 0;
    const sample = () => {
      link ??= Array.from(document.querySelectorAll("a")).find(
        (anchor) => anchor.textContent?.trim() === "Edit this keyword field",
      );
      section ??= Array.from(document.querySelectorAll("h3, h4"))
        .find((element) => element.textContent === "Word density")
        ?.closest("section");
      if (link) {
        const rendered = Boolean(section?.querySelector("table"));
        samples.push({
          top: link.getBoundingClientRect().top + window.scrollY,
          rendered,
        });
        if (rendered) after += 1;
      }
      if (after < 10) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("/apps/app-1/metadata?market=pl&localization=pl");
  await expect(wordsTable(page)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { linkSamples: LinkSample[] }).linkSamples
            .length,
      ),
    )
    .toBeGreaterThan(10);

  const samples = await page.evaluate(
    () => (window as unknown as { linkSamples: LinkSample[] }).linkSamples,
  );
  const first = samples.findIndex((entry) => entry.rendered);
  expect(first).toBeGreaterThan(0);
  const before = samples[first - 1]!.top;
  for (const { top } of samples.slice(first)) {
    expect(Math.abs(top - before)).toBeLessThanOrEqual(1);
  }
});
