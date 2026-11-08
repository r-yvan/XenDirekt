// End-to-end portal check against the QA API (EMAIL_TRANSPORT=dev-inbox on :3005).
import { chromium } from 'playwright';
const API = process.env.QA_API ?? 'http://localhost:3005';
const theme = process.argv[2] ?? 'dark';
const email = `qa-${Date.now()}@example.com`;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const shot = async (name) => {
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `qa-output/portal-${name}-${theme}.png` });
};

await page.goto((process.env.QA_WEB ?? 'http://localhost:3100') + '/sign-in', {
  waitUntil: 'networkidle',
});
await shot('1-sign-in');
await page.getByLabel('Email', { exact: true }).fill(email);
await page.getByRole('button', { name: /Continue/ }).click();
await page.waitForURL('**/verify');
await shot('2-verify');
const inbox = await (await fetch(`${API}/dev/inbox`)).json();
const message = (inbox.messages ?? inbox).find((m) => m.to === email);
const code = message.text.match(/\b(\d{6})\b/)[1];
await page.getByLabel('One-time code', { exact: true }).fill(code);
await page.waitForURL('**/onboarding/profile');
await shot('3-profile');
await page.getByLabel('Full name', { exact: true }).fill('Ana Silva');
await page.getByLabel('Country you live in', { exact: true }).selectOption('PT');
await page.getByLabel('Day', { exact: true }).selectOption('12');
await page.getByLabel('Month', { exact: true }).selectOption('4');
await page.getByLabel('Year', { exact: true }).selectOption('1990');
await page.getByRole('button', { name: /Continue/ }).click();
await page.waitForURL('**/onboarding/pin');
await shot('4-pin');
await page.getByLabel('New PIN', { exact: true }).fill('482913');
await page.waitForTimeout(500);
await page.getByLabel('Confirm PIN', { exact: true }).fill('482913');
await page.waitForURL('**/app?welcome=1');
await shot('5-send-empty');

await page.goto((process.env.QA_WEB ?? 'http://localhost:3100') + '/app/cards', {
  waitUntil: 'networkidle',
});
await page.getByRole('button', { name: 'Add a card' }).first().click();
await page.waitForURL(/mock-provider\/card-setup/);
await page.locator('button[type=submit]').first().click();
await page.waitForURL('**/app/cards/return**');
await page.getByText('Card added').waitFor({ timeout: 15000 });
await shot('6-card-added');

await page.goto((process.env.QA_WEB ?? 'http://localhost:3100') + '/app', {
  waitUntil: 'networkidle',
});
await page.getByLabel('MTN MoMo number', { exact: true }).fill('0788123456');
await page.getByRole('button', { name: 'Find' }).click();
await page.getByText('Registered MTN MoMo name').waitFor();
await page.getByLabel('Amount in Rwandan francs', { exact: true }).fill('12000');
await page.getByRole('button', { name: /Review payment/ }).click();
await page.getByRole('button', { name: /^Pay / }).waitFor();
await shot('7-quote');
await page.getByRole('button', { name: /^Pay / }).click();
await page.getByLabel('PIN', { exact: true }).fill('482913');
await page.waitForURL(/\/app\/activity\/[0-9a-f-]{36}/);
const bank = page.getByRole('button', { name: 'Continue to your bank' });
await bank.waitFor({ timeout: 20000 });
await shot('8-3ds-needed');
await bank.click();
await page.waitForURL(/mock-provider\/3ds/);
await page.getByRole('button', { name: 'Approve' }).click();
await page.waitForURL(/\/app\/activity\/[0-9a-f-]{36}/);
await page
  .getByText('RECEIPT', { exact: true })
  .waitFor({ timeout: 30000 })
  .catch(async (e) => {
    await page.screenshot({ path: 'qa-output/portal-debug.png' });
    console.log('URL', page.url());
    throw e;
  });
await shot('9-receipt');
await page.goto((process.env.QA_WEB ?? 'http://localhost:3100') + '/app/activity', {
  waitUntil: 'networkidle',
});
await shot('10-activity');
await page.goto((process.env.QA_WEB ?? 'http://localhost:3100') + '/app/inbox', {
  waitUntil: 'networkidle',
});
await shot('11-inbox');
console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : `portal flow ok (${email})`);
await browser.close();
