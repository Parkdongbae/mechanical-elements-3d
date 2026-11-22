// 도감·퀴즈 상호작용 캡처: node scripts/06-modes.mjs [width] [height] [theme]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light'] = process.argv;
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];
async function open(mode) {
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
  await page.goto(`http://localhost:5173/preview.html?mode=${mode}&theme=${theme}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return page;
}

// 도감: 전동용 탭 → 마지막 부품
{
  const p = await open('enc');
  await p.click('.enc-tab:nth-child(4)');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots/06-enc-power-${tag}.png` });
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('enc horizontal overflow:', over);
  await p.close();
}

// 퀴즈 전체 흐름 (dev 서버 HMR 리로드로 끊기면 처음부터 재시도)
for (let attempt = 0; attempt < 4; attempt++) {
  const p = await open('quiz');
  try {
  const p = await open('quiz');
  await p.screenshot({ path: `shots/06-quiz-start-${tag}.png` });
  await p.click('text=시작하기');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/06-quiz-q1-${tag}.png` });
  await p.click('.quiz-choice >> nth=0');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `shots/06-quiz-fb1-${tag}.png` });
  for (let i = 1; i < 10; i++) {
    await p.click('.quiz-next');
    await p.waitForTimeout(500);
    if (i === 4) await p.screenshot({ path: `shots/06-quiz-q${i + 1}-${tag}.png` });
    await p.click(`.quiz-choice >> nth=${i % 2}`);
    await p.waitForTimeout(500);
    if (i === 8) await p.screenshot({ path: `shots/06-quiz-fb${i + 1}-${tag}.png` });
  }
  await p.click('.quiz-next');
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `shots/06-quiz-result-${tag}.png` });
  console.log('stored', await p.evaluate(() => localStorage.getItem('mech3d-quiz-v1')));
  const reviewBtn = p.locator('.quiz-review-item .quiz-btn').first();
  if (await reviewBtn.count()) { await reviewBtn.click(); await p.waitForTimeout(1500); await p.screenshot({ path: `shots/06-quiz-review-${tag}.png` }); }

    break;
  } catch (e) {
    console.log('retry quiz flow:', String(e).slice(0, 80));
    await p.close();
  }
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
