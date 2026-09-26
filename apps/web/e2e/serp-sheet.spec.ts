import { readFileSync } from "node:fs";
import { expect, test } from "./session.mts";

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
    sheet.getByRole("button", { name: "Export top 10 to CSV" }).click(),
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
