import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:3001';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// Render the page with JavaScript disabled -> pure server output, no hydration.
const ssrCtx = await browser.newContext({ javaScriptEnabled: false });
const ssrPage = await ssrCtx.newPage();
await ssrPage.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
const ssrNodes = await ssrPage.evaluate(() => {
  const out = [];
  const walk = (el, path) => {
    out.push(
      `${path} <${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? ' class="' + el.className + '"' : ''}> :: ${
        [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join('|')
      }`,
    );
    [...el.children].forEach((c, i) => walk(c, `${path}/${c.tagName.toLowerCase()}[${i}]`));
  };
  walk(document.body, 'body');
  return out;
});
await ssrCtx.close();

const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const cliNodes = await page.evaluate(() => {
  const out = [];
  const walk = (el, path) => {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    out.push(
      `${path} <${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? ' class="' + el.className + '"' : ''}> :: ${
        [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join('|')
      }`,
    );
    [...el.children].forEach((c, i) => walk(c, `${path}/${c.tagName.toLowerCase()}[${i}]`));
  };
  walk(document.body, 'body');
  return out;
});

const ssrSet = new Set(ssrNodes);
const cliSet = new Set(cliNodes);
console.log('--- present in SSR (JS off) but NOT after hydration ---');
ssrNodes.filter((n) => !cliSet.has(n) && !/script|style/.test(n)).slice(0, 25).forEach((n) => console.log('  SSR :', n.slice(0, 220)));
console.log('--- present after hydration but NOT in SSR ---');
cliNodes.filter((n) => !ssrSet.has(n)).slice(0, 25).forEach((n) => console.log('  CLI :', n.slice(0, 220)));

await browser.close();
