import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const BASE = 'http://127.0.0.1:3001';
const ids = Object.fromEntries(
  readFileSync('/home/user/asobeast/qa/ids.env', 'utf8').trim().split('\n').map((l) => l.split('=')),
);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'qa-owner@asobeast.test');
await page.fill('input[type="password"]', 'QaOwnerPass123!');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
await page.goto(BASE + `/apps/${ids.PRIMARY}/keywords`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const table = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('thead th')].map((h) => h.innerText.trim().replace(/\s+/g, ' '));
  const rows = [...document.querySelectorAll('tbody tr')].slice(0, 5).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ')),
  );
  return { headers, rows };
});
console.log('HEADERS:', JSON.stringify(table.headers));
table.rows.forEach((r) => console.log('ROW    :', JSON.stringify(r)));

// sidebar "tracked" counter
const sidebar = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) =>
    /tracked$/i.test(e.textContent.trim()) && e.children.length === 0,
  );
  return el ? el.textContent.trim() : 'not found';
});
console.log('\nSIDEBAR tracked counter text:', JSON.stringify(sidebar));

await page.screenshot({ path: '/home/user/asobeast/qa/evidence/ui/keywords-table-wide.png' });
await browser.close();
