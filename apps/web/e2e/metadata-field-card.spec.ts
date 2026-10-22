import { expect, test } from "./session.mts";
import { typeInto } from "./type.mts";

test("the metadata workbench counts the keyword field in characters", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const field = page.getByRole("textbox", { name: "Keyword field" });
  await typeInto(
    field,
    "geoguessr,geoguess,zgadywanka,stolice,miasto,lokalizacja,państwo,podróże,zabytki,odkrywca,kontynenty",
  );
  await expect(page.getByText("100/100", { exact: true })).toBeVisible();
  await expect(field).not.toHaveAttribute("aria-invalid", "true");

  await typeInto(field, "ą".repeat(101));
  await expect(page.getByText("101/100 · 1 over")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
});

test("the metadata workbench counts a character outside the BMP once", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");
  const text = "𠮷野家,𪚥𪚥𪚥";

  await typeInto(page.getByRole("textbox", { name: "Keyword field" }), text);
  await expect(page.getByText("7/100", { exact: true })).toBeVisible();

  await typeInto(
    page.getByRole("textbox", { name: "Title", exact: true }),
    text,
  );
  await expect(page.getByText("7/30", { exact: true })).toBeVisible();
});
