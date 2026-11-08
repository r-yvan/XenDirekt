// Prints console errors, page errors and the Next.js dev overlay's issue text for a page.
import { chromium } from 'playwright';
const path = process.argv[2] ?? '/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 300)));
page.on('response', (r) => r.status() >= 400 && console.log('http', r.status(), r.url()));
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 300)));
await page.goto(`${process.env.QA_WEB ?? 'http://localhost:3100'}${path}`, {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(3000);
const overlay = await page.evaluate(() => {
  const host = document.querySelector('nextjs-portal');
  return host?.shadowRoot?.textContent?.slice(0, 600) ?? null;
});
console.log('overlay:', overlay);
await browser.close();
