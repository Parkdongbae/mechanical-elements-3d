// 헤드리스 Chrome으로 화면을 캡처한다 (모델·UI 시각 검증용).
// 사용: node scripts/shot.mjs "<경로+쿼리>" <출력.png> [대기ms=2500] [너비=1280] [높이=800]
// 예:   node scripts/shot.mjs "preview.html?part=spurGear" shots/spur.png
//       node scripts/shot.mjs "preview.html?machine=bicycle&steps=all&t=2" shots/bike.png 5000
// dev 서버(http://localhost:5173)가 떠 있어야 한다. 캡처 후 콘솔 에러가 있으면 출력한다.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , target = 'preview.html?parts=all', out = 'shots/out.png', wait = '2500', w = '1280', h = '800'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173/';
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(r.status() + ' ' + r.url());
});
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + target, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
if (errors.length) {
  console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
}
