import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const nums = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5273/#/mm/' + nums[0]);
const out = {};
for (const n of nums) {
  await page.evaluate((n) => { location.hash = '#/mm/' + n; }, n);
  await page.waitForTimeout(2500);
  out[n] = await page.evaluate(() => (window.__mm507 ? window.__mm507() : null));
  await page.screenshot({ path: `shots/leaders/${n}.png` });
}
writeFileSync(process.env.OUT || 'shots/leaders/out.json', JSON.stringify(out, null, 1));
await browser.close();
