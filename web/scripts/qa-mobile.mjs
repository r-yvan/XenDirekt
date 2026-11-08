// Screenshots of the Flutter app's web build at phone size (welcome → email → code).
import { chromium } from 'playwright';
const theme = process.argv[2] ?? 'dark';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  colorScheme: theme,
  deviceScaleFactor: 2,
});
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
await page.screenshot({ path: `qa-output/mobile-welcome-${theme}.png` });
await page.mouse.click(195, 752);
await page.waitForTimeout(2500);
await page.screenshot({ path: `qa-output/mobile-step-${theme}.png` });
await browser.close();
