// Usage: node scripts/qa-element.mjs <path> <css selector> <name> [theme] [scale]
// Screenshots one element at high density (typography and detail checks).
import { chromium } from 'playwright';

const [path = '/', selector = 'h1', name = 'element', theme = 'light', scale = '2'] =
  process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  colorScheme: theme,
  deviceScaleFactor: Number(scale),
});
await page.goto(`${process.env.QA_WEB ?? 'http://localhost:3100'}${path}`, {
  waitUntil: 'networkidle',
});
const target = page.locator(selector).first();
await target.scrollIntoViewIfNeeded();
await page.waitForTimeout(3500);
await target.screenshot({ path: `qa-output/${name}-${theme}.png` });
await browser.close();
