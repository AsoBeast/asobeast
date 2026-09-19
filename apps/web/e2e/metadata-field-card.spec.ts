import { expect, test } from "./session.mts";

test("the metadata workbench counts the keyword field in bytes", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const field = page.getByRole("textbox", { name: "Keyword field" });
  await field.fill(
    "zażółć,gęślą,jaźń,łódź,źrebię,ćma,żółw,świeca,mąka,ślimak,pączek,żaba,źdźbło,ćwierć",
  );

  await expect(page.getByText("111/100 · 11 over")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
});
