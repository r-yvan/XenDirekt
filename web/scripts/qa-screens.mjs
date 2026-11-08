// Usage: node scripts/qa-screens.mjs <path> <name> [theme=dark|light] [width] [fullPage=1] [scrollTo] [height]
import { chromium } from 'playwright';

const [
  path = '/',
  name = 'home',
  theme = 'dark',
  width = '1440',
  full = '1',
  scrollTo = '',
  height = '',
] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) || (Number(width) < 600 ? 844 : 900) },
  colorScheme: theme,
  deviceScaleFactor: 1,
});
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.QA_WEB ?? 'http://localhost:3100'}${path}`, {
  waitUntil: 'networkidle',
  timeout: 120000,
});
if (full === '1') {
  // Scroll through so whileInView reveals fire, then return to the top.
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
if (scrollTo) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView(), scrollTo);
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `qa-output/${name}-${theme}-${width}.png`, fullPage: full === '1' });
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
