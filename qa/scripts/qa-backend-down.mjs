import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const BASE = 'http://127.0.0.1:3001';
const ids = Object.fromEntries(
  readFileSync('/home/user/asobeast/qa/ids.env', 'utf8').trim().split('\n').map((l) => l.split('=')),
);
const OUT = '/home/user/asobeast/qa/evidence/ui';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: '/home/user/asobeast/qa/evidence/state.json' });
const page = await ctx.newPage();

const target = process.argv[2] === 'login' ? '/login' : `/apps/${ids.PRIMARY}/keywords`;
const t0 = Date.now();
const resp = await page.goto(BASE + target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
  console.log('NAV ERROR:', e.message.split('\n')[0]);
  return null;
});
await page.waitForTimeout(5000);
const ms = Date.now() - t0;
// visible text only, excluding scripts
const visible = await page.evaluate(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  let n;
  while ((n = w.nextNode())) {
    const p = n.parentElement;
    if (!p || p.tagName === 'SCRIPT' || p.tagName === 'STYLE') continue;
    if (!(p.offsetWidth || p.offsetHeight || p.getClientRects().length)) continue;
    const t = n.textContent.trim();
    if (t) out.push(t);
  }
  return out.join(' | ');
});
console.log(`status=${resp?.status()} loadMs=${ms}`);
console.log('VISIBLE TEXT:', visible.slice(0, 600));
await page.screenshot({ path: `${OUT}/backend-down-${process.argv[2] ?? 'keywords'}.png`, fullPage: false });
await browser.close();
