import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto((process.env.QA_WEB ?? 'http://localhost:3100') + '/?ref=ABCDEFGH', {
  waitUntil: 'networkidle',
});
await page.locator('#check').scrollIntoViewIfNeeded();
for (const label of [
  'A Rwandan living abroad',
  'Card declined, plan B needed',
  'One to three days',
  'No idea, and that’s the problem',
  'Most times',
]) {
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(500);
}
await page.getByText('HUSTLE SCORE').waitFor();
await page.waitForTimeout(1600);
await page.locator('#check').screenshot({ path: 'qa-output/flow-check-result.png' });
await page.locator('#files').scrollIntoViewIfNeeded();
await page.waitForTimeout(1800);
await page.locator('#files').screenshot({ path: 'qa-output/flow-files-open.png' });
const form = page.locator('#join');
await form.scrollIntoViewIfNeeded();
await form.getByPlaceholder('you@example.com').fill(`qa-visitor-${Date.now()}@example.com`);
await form.getByRole('checkbox').check();
await form.getByRole('button', { name: /Join the waitlist/ }).click();
await form.getByText(/on the list/).waitFor({ timeout: 15000 });
await page.waitForTimeout(1200);
await form.screenshot({ path: 'qa-output/flow-joined.png' });
await page
  .locator('#wall textarea')
  .fill('My card was declined at a market stall in Musanze and I had to find an ATM.');
await page.getByRole('button', { name: 'Add to the wall' }).click();
await page.getByText('We read every one').waitFor();
console.log(errors.length ? errors.join('\n') : 'flow ok, no page errors');
await browser.close();
