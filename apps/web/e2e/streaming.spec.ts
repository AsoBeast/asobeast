import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./session.mts";

const REACT_DOM_SERVER = join(
  process.cwd(),
  "node_modules/next/dist/compiled/react-dom/cjs/react-dom-server.node.production.js",
);

const COMPLETE_SEGMENT = readFileSync(REACT_DOM_SERVER, "utf8").match(
  /\$RS=function\(a,b\)\{.*?\};/,
)?.[0];

test("a segment streamed after its fallback was revealed away is dropped without an error", async ({
  page,
}) => {
  expect(COMPLETE_SEGMENT, "react no longer ships $RS").toBeDefined();
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const thrown = await page.evaluate((instruction) => {
    const caught: string[] = [];
    window.addEventListener("error", (event) => caught.push(event.message));

    const revealedFallback = document.createElement("ul");
    revealedFallback.innerHTML = '<template id="P:late"></template>';
    document.body.append(revealedFallback);
    revealedFallback.remove();

    const lateSegment = document.createElement("div");
    lateSegment.hidden = true;
    lateSegment.id = "S:late";
    lateSegment.innerHTML = "<li>skeleton row</li>";
    document.body.append(lateSegment);

    const script = document.createElement("script");
    script.textContent = `${instruction}$RS("S:late","P:late")`;
    document.body.append(script);
    return caught;
  }, COMPLETE_SEGMENT);

  expect(thrown).toEqual([]);
  await expect(page.locator('[id="S:late"]')).toHaveCount(0);
});
