import type { Page, Request } from "@playwright/test";
import {
  COVERAGE_PREVIEW_FAIL_COOKIE,
  COVERAGE_PREVIEW_MARKETS_COOKIE,
} from "./coverage-preview.mts";
import { APP_DRAFT_LOCALES_ID } from "./fixtures.mts";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { fieldRequests, seedLocalizations } from "./localizations.mts";
import { expect, test } from "./session.mts";

const PREVIEW_ROUTE = /\/metadata\/coverage-preview$/;

const panel = (page: Page) =>
  page.getByRole("region", { name: "Draft coverage" });
const section = (page: Page, name: string) =>
  panel(page).getByRole("list", { name });

async function withCookie(page: Page, name: string, value: string) {
  await page
    .context()
    .addCookies([{ name, value, domain: "localhost", path: "/" }]);
}

function previewRequests(page: Page): Request[] {
  const sent: Request[] = [];
  page.on("request", (request) => {
    if (PREVIEW_ROUTE.test(request.url()) && request.method() === "POST") {
      sent.push(request);
    }
  });
  return sent;
}

const editor = (page: Page) =>
  page.getByRole("region", { name: "Draft listing" });
const field = (page: Page, name: string) =>
  editor(page).getByRole("textbox", { name, exact: true });
const modes = (page: Page) =>
  page.getByRole("tablist", { name: "Listing mode" });

test("opens draft mode with the live listing in its fields", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?mode=draft");

  await expect(field(page, "Title")).toHaveValue("Focus Timer");
  await expect(field(page, "Subtitle")).toHaveValue(
    "Pomodoro sessions that stick",
  );
  await expect(field(page, "Keyword field")).toHaveValue(
    "study timer,deep work",
  );
  await expect(editor(page).getByText("11/30", { exact: true })).toBeVisible();
  await expect(field(page, "Description")).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Description" }).click();
  await expect(field(page, "Description")).toBeVisible();
});

test("switches between the live listing and the draft without losing either", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await modes(page).getByRole("tab", { name: "Live listing" }).click();
  await expect(page).not.toHaveURL(/mode=draft/);
  await expect(editor(page)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Listing fields" }),
  ).toBeVisible();

  await modes(page).getByRole("tab", { name: "Draft" }).click();
  await expect(page).toHaveURL(/mode=draft/);
  await expect(field(page, "Title")).toHaveValue("Habit Tracker");

  await page.goBack();
  await expect(page).not.toHaveURL(/mode=draft/);
});

test("keeps the draft across a reload", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await page.reload();

  await expect(field(page, "Title")).toHaveValue("Habit Tracker");
});

test("keeps a separate draft per localization", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await page.goto("/apps/app-1/metadata?market=pl&localization=pl&mode=draft");
  await expect(field(page, "Title")).toHaveValue("Skupienie: Minutnik Pracy");

  await page.goto("/apps/app-1/metadata?mode=draft");
  await expect(field(page, "Title")).toHaveValue("Habit Tracker");
});

test("counts characters the way the store does", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const title = await hydrated(field(page, "Title"));

  await title.fill("Focus ⏱ Timer");
  await expect(editor(page).getByText("13/30", { exact: true })).toBeVisible();

  await title.fill("A".repeat(35));
  await expect(
    editor(page).getByText("35/30 · 5 over", { exact: true }),
  ).toBeVisible();
  await expect(title).toHaveAttribute("aria-invalid", "true");
});

test("resets the draft to the live listing", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const reset = editor(page).getByRole("button", {
    name: "Reset to live listing",
  });
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");
  await expect(reset).not.toHaveAttribute("aria-disabled", "true");

  await reset.click();

  await expect(field(page, "Title")).toHaveValue("Focus Timer");
  await expect(reset).toBeFocused();
  await expect(reset).toHaveAttribute("aria-disabled", "true");
});

test("shows short description and no subtitle or keyword field on Google Play", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/metadata?mode=draft");

  await expect(field(page, "Title")).toBeVisible();
  await expect(field(page, "Short description")).toBeVisible();
  await expect(field(page, "Subtitle")).toHaveCount(0);
  await expect(field(page, "Keyword field")).toHaveCount(0);
});

test("opens on the live listing for a competitor", async ({ page }) => {
  await page.goto("/apps/app-rival/metadata?mode=draft");

  await expect(
    page.getByRole("region", { name: "Listing fields" }),
  ).toBeVisible();
  await expect(modes(page)).toHaveCount(0);
  await expect(editor(page)).toHaveCount(0);
});

test("lists the keywords a new title covers and loses", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const request = page.waitForRequest(
    (sent) => PREVIEW_ROUTE.test(sent.url()) && sent.method() === "POST",
  );

  await (await hydrated(field(page, "Title"))).fill("Productivity App");

  expect((await request).postDataJSON()).toEqual({
    localization: "en-US",
    title: "Productivity App",
    subtitle: "Pomodoro sessions that stick",
    keywordField: "study timer,deep work",
    description: expect.any(String),
  });
  await expect(section(page, "Newly covered")).toContainText(
    "productivity app",
  );
  await expect(section(page, "Newly covered")).toContainText("Germany");
  await expect(section(page, "No longer covered")).toContainText("focus timer");
  await expect(
    panel(page).getByText("1 newly covered · 1 no longer covered", {
      exact: true,
    }),
  ).toBeVisible();
});

test("judges a comma in the title as a space", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Focus,Timer");

  await panel(page)
    .getByRole("button", { name: /^Show all \d+ still covered$/ })
    .click();

  await expect(
    section(page, "Still covered")
      .getByRole("listitem")
      .filter({ hasText: "focus timer" }),
  ).toContainText("Title");
});

test("keeps a market row inside the panel on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Productivity App");
  await field(page, "Subtitle").fill("Productivity app sessions");
  await field(page, "Keyword field").fill("productivity app,deep work");
  const row = section(page, "Newly covered")
    .getByRole("listitem")
    .filter({ hasText: "Germany" });
  await expect(row).toBeVisible();

  const layout = await row.evaluate((item) => {
    const keyword = [...item.querySelectorAll("span")].find(
      (span) => span.textContent === "productivity app",
    );
    const panelBox = item.closest("section")?.getBoundingClientRect();
    const fields = item.lastElementChild?.getBoundingClientRect();
    return {
      readable:
        !!keyword && keyword.clientWidth >= Math.min(keyword.scrollWidth, 80),
      escapes:
        !panelBox ||
        !fields ||
        fields.right > panelBox.right + 0.5 ||
        item.scrollWidth > item.clientWidth,
    };
  });
  expect(layout).toEqual({ readable: true, escapes: false });
});

test("waits for typing to settle before asking", async ({ page }) => {
  const sent = previewRequests(page);
  await page.goto("/apps/app-1/metadata?mode=draft");
  const title = await hydrated(field(page, "Title"));

  await title.fill("");
  await title.pressSequentially("Habits", { delay: 40 });
  await expect(section(page, "No longer covered")).toBeVisible();
  await page.waitForTimeout(600);

  expect(sent).toHaveLength(1);
  expect(sent[0].postDataJSON()).toMatchObject({ title: "Habits" });
});

test("keeps the last answer while the next loads", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const title = await hydrated(field(page, "Title"));
  await title.fill("Productivity App");
  await expect(section(page, "Newly covered")).toBeVisible();

  const held = await holdRequest(page, PREVIEW_ROUTE, "POST");
  await title.fill("Productivity App Pro");

  await expect(panel(page).locator("[aria-busy=true]")).toHaveCount(1);
  await expect(section(page, "Newly covered")).toContainText(
    "productivity app",
  );
  held.release();
  await expect(panel(page).locator("[aria-busy=true]")).toHaveCount(0);
});

test("shows wasted words and the lint of each field", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");

  await (await hydrated(field(page, "Subtitle"))).fill("Focus sessions");

  await expect(section(page, "Wasted words")).toContainText("focus");
  await expect(section(page, "Wasted words")).toContainText(
    "Repeated in title and subtitle",
  );
  await expect(
    editor(page).getByText('"focus" already appears in the title.'),
  ).toBeVisible();
});

test("says which markets wait for their own listing", async ({ page }) => {
  await withCookie(page, COVERAGE_PREVIEW_MARKETS_COOKIE, "waiting");
  await page.goto("/apps/app-1/metadata?mode=draft");

  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await expect(
    panel(page).getByText(
      "United Kingdom is judged on your home listing until its own listing is captured, so no keyword is judged here yet.",
    ),
  ).toBeVisible();
});

test("says when no market reads the localization", async ({ page }) => {
  await withCookie(page, COVERAGE_PREVIEW_MARKETS_COOKIE, "none");
  await page.goto("/apps/app-1/metadata?mode=draft");

  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await expect(
    panel(page).getByText("No market you track reads this localization yet."),
  ).toBeVisible();
});

test("fails alone", async ({ page }) => {
  await withCookie(page, COVERAGE_PREVIEW_FAIL_COOKIE, "1");
  await page.goto("/apps/app-1/metadata?mode=draft");
  const title = await hydrated(field(page, "Title"));

  await title.fill("Productivity App");

  await expect(
    panel(page).getByText("Could not load what this draft covers."),
  ).toBeVisible();
  await title.fill("Productivity App!");
  await expect(title).toHaveValue("Productivity App!");

  await page.context().clearCookies({ name: COVERAGE_PREVIEW_FAIL_COOKIE });
  await panel(page).getByRole("button", { name: "Retry" }).click();

  await expect(section(page, "Newly covered")).toBeVisible();
  await expect(panel(page).locator(":focus")).toHaveCount(1);
});

test("keeps focus in the panel when the list it was on leaves", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Focus Timer Pro");
  const showKept = panel(page).getByRole("button", {
    name: /^Show all \d+ still covered$/,
  });
  await showKept.focus();

  await page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((each) =>
      each.startsWith("asobeast.listingDraft.app-1."),
    );
    if (!key) throw new Error("no stored draft");
    window.localStorage.setItem(
      key,
      '{"v":1,"title":"Zzz","subtitle":"Zzz","keywordField":"zzz"}',
    );
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });

  await expect(showKept).toHaveCount(0);
  await expect(
    panel(page).getByRole("button", { name: "About draft coverage" }),
  ).toBeFocused();
});

test("sends nothing for an untouched draft of a localization without targets", async ({
  page,
}) => {
  const sent = previewRequests(page);
  await page.goto("/apps/app-1/metadata?mode=draft");
  await hydrated(field(page, "Title"));

  await expect(
    panel(page).getByText("Change a field to see what it would cover."),
  ).toBeVisible();
  await page.waitForTimeout(600);
  expect(sent).toHaveLength(0);
});

test.describe("the keyword field hand off", () => {
  test.describe.configure({ mode: "serial" });

  const DRAFT_PAGE = `/apps/${APP_DRAFT_LOCALES_ID}/metadata?mode=draft`;
  const fieldEditor = (page: Page) =>
    page.getByRole("textbox", { name: "English (U.S.) keyword field" });
  const handOff = (page: Page) =>
    editor(page).getByRole("button", {
      name: "Review in the keyword field editor",
    });

  test.beforeEach(async ({ page }) => {
    await seedLocalizations(page.request, APP_DRAFT_LOCALES_ID, {
      fields: { "en-US": ["timer", "focus"] },
    });
  });

  test("hands the drafted keyword field to its editor", async ({ page }) => {
    await page.goto(DRAFT_PAGE);
    await (
      await hydrated(field(page, "Keyword field"))
    ).fill("timer,focus,habit");

    await handOff(page).click();

    await expect(page).toHaveURL(/fieldLocale=en-US/);
    await expect(page).toHaveURL(/fieldFromDraft=true/);
    expect(page.url()).not.toContain("habit");
    await expect(fieldEditor(page)).toHaveValue("timer,focus,habit");
    await expect(fieldEditor(page)).toBeFocused();
    await expect(
      page.getByText("Your drafted keyword field is ready to review and save."),
    ).toBeVisible();
  });

  test("saves the drafted field through the editor", async ({ page }) => {
    await page.goto(DRAFT_PAGE);
    await (
      await hydrated(field(page, "Keyword field"))
    ).fill("timer,focus,habit");
    await handOff(page).click();
    await expect(fieldEditor(page)).toHaveValue("timer,focus,habit");

    await page.getByRole("button", { name: "Save keyword field" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and track" })
      .click();

    await expect(page).not.toHaveURL(/fieldFromDraft/);
    await expect(fieldEditor(page)).toHaveValue("timer,focus,habit");
    expect(await fieldRequests(page.request, APP_DRAFT_LOCALES_ID)).toContain(
      "PUT /apps/app-draft-locales/keyword-fields/en-US",
    );
  });

  test("keeps focus off the page after saving the handed field from the keyboard", async ({
    page,
  }) => {
    await page.goto(DRAFT_PAGE);
    await (
      await hydrated(field(page, "Keyword field"))
    ).fill("timer,focus,habit");
    await handOff(page).press("Enter");
    await expect(fieldEditor(page)).toBeFocused();

    await page
      .getByRole("button", { name: "Save keyword field" })
      .press("Enter");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and track" })
      .press("Enter");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/fieldFromDraft/);
    await expect
      .poll(() => page.evaluate(() => document.activeElement === document.body))
      .toBe(false);
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => document.activeElement === document.body),
    ).toBe(false);
  });

  test("keeps the drafted field read only while App Store Connect manages it", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP_DRAFT_LOCALES_ID, {
      fields: { "en-US": ["timer", "focus"] },
      storeImport: "following",
    });
    await page.goto(DRAFT_PAGE);

    await expect(field(page, "Keyword field")).toHaveAttribute("readonly", "");
    await expect(
      editor(page).getByText(/^Imported from App Store Connect/),
    ).toBeVisible();
    await expect(handOff(page)).toHaveCount(0);

    await page.goto(`${DRAFT_PAGE}&fieldLocale=en-US&fieldFromDraft=true`);
    await expect(fieldEditor(page)).toHaveValue("timer,focus");
  });

  test("ignores a drafted keyword field while App Store Connect manages it", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP_DRAFT_LOCALES_ID, {
      fields: { "en-US": ["timer", "focus"] },
      storeImport: "following",
    });
    await page.goto(DRAFT_PAGE);
    await page.evaluate(
      (key) =>
        window.localStorage.setItem(key, '{"v":1,"keywordField":"habit"}'),
      `asobeast.listingDraft.${APP_DRAFT_LOCALES_ID}.en-US`,
    );
    await page.reload();

    await expect(field(page, "Keyword field")).toHaveValue(
      "study timer,deep work",
    );
    await expect(
      editor(page).getByRole("button", { name: "Reset to live listing" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("keeps the drafted field read only until it is known who manages it", async ({
    page,
  }) => {
    await withCookie(page, "e2e-localizations-error", "1");
    await page.goto(DRAFT_PAGE);

    await expect(field(page, "Keyword field")).toHaveAttribute("readonly", "");
    await expect(
      editor(page).getByText(
        "Could not read whether App Store Connect manages this keyword field.",
      ),
    ).toBeVisible();
    await expect(handOff(page)).toHaveCount(0);
  });

  test("keeps typing in the draft after the hand off", async ({ page }) => {
    await page.goto(DRAFT_PAGE);
    const drafted = await hydrated(field(page, "Keyword field"));
    await drafted.fill("timer,focus,habit");
    await handOff(page).click();
    await expect(fieldEditor(page)).toBeFocused();

    await drafted.click();
    await drafted.pressSequentially(",goals");

    await expect(drafted).toBeFocused();
    await expect(drafted).toHaveValue("timer,focus,habit,goals");
    await expect(fieldEditor(page)).toHaveValue("timer,focus,habit");
  });

  test("hands the newer draft over on a second press", async ({ page }) => {
    await page.goto(DRAFT_PAGE);
    const drafted = await hydrated(field(page, "Keyword field"));
    await drafted.fill("timer,focus,habit");
    await handOff(page).click();
    await expect(fieldEditor(page)).toHaveValue("timer,focus,habit");

    await drafted.fill("timer,focus,goals");
    await handOff(page).click();

    await expect(fieldEditor(page)).toHaveValue("timer,focus,goals");
    await expect(fieldEditor(page)).toBeFocused();
  });

  test("drops a phrase the draft removed", async ({ page }) => {
    await page.goto(DRAFT_PAGE);
    await (await hydrated(field(page, "Keyword field"))).fill("timer");

    await handOff(page).click();

    await expect(fieldEditor(page)).toHaveValue("timer");
  });
});

test("copies one field", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await editor(page).getByRole("button", { name: "Copy title" }).click();

  await expect(page.getByText("Title copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Habit Tracker",
  );
});

test("copies the whole draft for App Store Connect", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await editor(page)
    .getByRole("button", { name: "Copy for App Store Connect" })
    .click();

  await expect(
    page.getByText("Draft copied for App Store Connect"),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Name\nHabit Tracker\n\nSubtitle\nPomodoro sessions that stick\n\nKeywords\nstudy timer,deep work",
  );
});

test("names Play Console on Google Play", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/apps/app-gp/metadata?mode=draft");
  await hydrated(field(page, "Title"));

  await editor(page)
    .getByRole("button", { name: "Copy for Play Console" })
    .click();

  await expect(page.getByText("Draft copied for Play Console")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^App name\n/,
  );
});

test("shows the words search reads and marks a repeat", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");
  await field(page, "Subtitle").fill("habit goals daily");

  const words = (name: string) =>
    editor(page).getByRole("list", {
      name: `Words search reads in the ${name}`,
    });
  const subtitleWords = words("subtitle");
  await expect(subtitleWords.getByRole("listitem")).toHaveText([
    /^habit/,
    "goals",
    "daily",
  ]);
  await expect(subtitleWords.getByRole("listitem").first()).toHaveText(
    "habitrepeat",
  );
  await expect(words("title").getByRole("listitem").first()).toHaveText(
    "habitrepeat",
  );
  await expect(words("keyword field")).toBeVisible();
  await expect(words("promotional text")).toHaveCount(0);
  await expect(
    editor(page).getByRole("list", { name: /^Words search reads/ }),
  ).toHaveCount(3);
});
