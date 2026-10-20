import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const SERP_PATH = "/api/backend/keywords/kw-1/serp";

const isSerpRead = (url: URL) => url.pathname === SERP_PATH;

const serpSheet = (page: Page) =>
  page.getByRole("dialog", { name: "Top 10 search results" });

const failureIn = (page: Page) =>
  serpSheet(page)
    .getByRole("alert")
    .filter({ hasText: "The top 10 could not be loaded." });

async function failTopTenReads(page: Page): Promise<() => void> {
  let failing = true;
  await page.route(isSerpRead, (route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback(),
  );
  return () => {
    failing = false;
  };
}

async function openTopTen(page: Page): Promise<void> {
  const opener = page.getByRole("button", {
    name: "View top 10 for focus timer",
    exact: true,
  });
  await (await hydrated(opener)).click();
}

test("exporting the top 10 downloads the snapshot the sheet shows", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("button", { name: "View top 10 for focus timer", exact: true })
    .click();
  await expect(page).toHaveURL(/serp=kw-1/);
  const sheet = page.getByRole("dialog", { name: "Top 10 search results" });
  await expect(sheet.getByText("Rival Focus")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet.getByRole("button", { name: "Export CSV of the top 10" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^serp-app-1-kw-1-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const lines = readFileSync(await download.path(), "utf8").split("\r\n");
  expect(lines[0]).toBe(
    "﻿keyword,capturedOn,position,app,developer,rating,ratings,role,storeAppId",
  );
  expect(lines).toHaveLength(6);
  expect(lines[3]).toMatch(
    /^focus timer,\d{4}-\d{2}-\d{2},3,Focus Timer,Focus Labs,4\.8,24000,you,123456789$/,
  );
  expect(lines[4]).toMatch(
    /,4,Rival Focus,Rival Labs,4\.5,12000,competitor,comp-store$/,
  );
  expect(lines[5]).toMatch(/,5,Newcomer Timer,,,,other,stranger-store$/);
});

test("a top 10 read that fails stays inside the sheet and retry loads it", async ({
  page,
}) => {
  const recover = await failTopTenReads(page);
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await openTopTen(page);

  await expect(failureIn(page)).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/serp=kw-1/);
  await expect(page.getByText("Keywords could not be loaded")).toHaveCount(0);
  await expect(
    page
      .getByRole("row", { includeHidden: true })
      .filter({ hasText: "focus timer" }),
  ).toBeVisible();

  recover();
  const reads: string[] = [];
  page.on("request", (request) => {
    if (isSerpRead(new URL(request.url()))) reads.push(request.url());
  });
  await serpSheet(page).getByRole("button", { name: "Retry" }).click();

  await expect(serpSheet(page).getByText("Rival Focus")).toBeVisible();
  await expect(failureIn(page)).toHaveCount(0);
  await expect(page).toHaveURL(/serp=kw-1/);
  await expect(page.getByText("Keywords could not be loaded")).toHaveCount(0);
  expect(reads).toHaveLength(1);
});

test("a top 10 that failed loads when the sheet is opened again", async ({
  page,
}) => {
  const recover = await failTopTenReads(page);
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");
  await openTopTen(page);
  await expect(failureIn(page)).toBeVisible({ timeout: 20_000 });

  recover();
  await page.keyboard.press("Escape");
  await expect(serpSheet(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/serp=/);
  await openTopTen(page);

  await expect(serpSheet(page).getByText("Rival Focus")).toBeVisible();
  await expect(failureIn(page)).toHaveCount(0);
});
