// Usage: node scripts/qa-scrolled.mjs <path> <scrollY> <name> [theme] [width] [height]
// Screenshot of the viewport after scrolling to an offset (scroll-linked effects settle).
import { chromium } from 'playwright';

const [
  path = '/',
  scrollY = '0',
  name = 'scrolled',
  theme = 'dark',
  width = '1904',
  height = '968',
] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  colorScheme: theme,
});
await page.goto(`${process.env.QA_WEB ?? 'http://localhost:3100'}${path}`, {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(1500);
await page.mouse.wheel(0, Number(scrollY));
await page.waitForTimeout(3000);
await page.screenshot({ path: `qa-output/${name}-${theme}.png` });
await browser.close();
