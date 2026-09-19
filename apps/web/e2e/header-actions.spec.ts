import { expect, test } from "./session.mts";

const ROUTES = [
  ["app audit", "/apps/app-1/audit"],
  ["app keywords", "/apps/app-1/keywords"],
  ["long app overview", "/apps/app-long"],
  ["long app audit", "/apps/app-long/audit"],
] as const;

for (const [name, path] of ROUTES) {
  test(`${name} keeps header actions clear of the breadcrumb on phones`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const header = page.getByRole("banner");
    await expect(header.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(
      header.getByRole("navigation", { name: "breadcrumb" }).locator("ol"),
    ).toBeVisible();

    const overlaps = await header.evaluate((node) => {
      const list = node.querySelector("nav[aria-label='breadcrumb'] ol");
      if (!list) return ["breadcrumb list missing"];
      const crumbs = Array.from(list.querySelectorAll("li")).map((item) =>
        item.getBoundingClientRect(),
      );
      const boxes = [list.getBoundingClientRect(), ...crumbs];

      return Array.from(node.querySelectorAll("button"))
        .filter(
          (button) =>
            list.compareDocumentPosition(button) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
        .filter((button) => {
          const box = button.getBoundingClientRect();
          return boxes.some(
            (crumb) =>
              crumb.width > 0 &&
              crumb.left < box.right &&
              box.left < crumb.right &&
              crumb.top < box.bottom &&
              box.top < crumb.bottom,
          );
        })
        .map((button) => button.getAttribute("aria-label") ?? button.innerText);
    });

    expect(overlaps).toEqual([]);
  });
}
