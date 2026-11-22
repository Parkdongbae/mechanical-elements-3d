// 11-C 동력 전달 투어 캡처: node scripts/11-power-tour.mjs [width] [height] [theme] [only]
// 단계마다 새 페이지를 열어 버튼을 눌러 캡처한다. 다른 작업자 파일 저장으로 dev 서버가 새로고침되면
// 그 장면만 다시 찍는다(장면별 재시도 — 전체 흐름이 길어 한 번에 끝까지 가기 어렵기 때문).
// only: stages | extra | quiz | 단계 번호(예: 3)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light', only = ''] = process.argv;
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];

async function scene(name, actions) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    let reloaded = false;
    page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${name}: ${m.text()}`);
    });
    try {
      await page.goto(`http://localhost:5273/preview.html?mode=power&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.pf-step', { timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(1500);
      await actions(page);
      if (reloaded) throw new Error('reloaded');
      await page.screenshot({ path: `shots/11-power-${name}-${tag}.png` });
      const r = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth > innerWidth;
        const tl = [...document.querySelectorAll('.pf-wrap *')].filter((e) => {
          if (e.closest('.pf-tags')) return false;
          const b = e.getBoundingClientRect();
          return getComputedStyle(e).visibility !== 'hidden' && b.width > 0 && b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0;
        }).length;
        const g = document.querySelector('.pf-guide');
        return { over, topLeft: tl, guideScroll: g ? g.scrollHeight > g.clientHeight + 2 : false };
      });
      if (reloaded) throw new Error('reloaded');
      console.log(name, JSON.stringify(r));
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${name}:`, String(e).slice(0, 80));
      await page.close();
    }
  }
}

const step = async (p, i) => {
  await p.click(`.pf-step >> nth=${i}`);
  // 헤드리스 렌더가 느려(프레임당 dt 상한 0.05s) 카메라 이동이 실제 시간보다 오래 걸린다
  await p.waitForTimeout(4500);
};

if (!only || only === 'stages') {
  for (let i = 0; i <= 7; i++) await scene(`s${i}`, (p) => step(p, i));
}
if (/^\d$/.test(only)) await scene(`s${only}`, (p) => step(p, +only));
if (!only || only === 'extra') {
  await scene('s2-clutch', async (p) => {
    await step(p, 2);
    await p.click('.pf-toggle');
    await p.waitForTimeout(2200);
  });
  await scene('s3-gear1', async (p) => {
    await step(p, 3);
    await p.click('.pf-gears .pf-seg-b >> nth=0');
    await p.waitForTimeout(1200);
  });
  await scene('s3-gear4', async (p) => {
    await step(p, 3);
    await p.click('.pf-gears .pf-seg-b >> nth=3');
    await p.waitForTimeout(1200);
  });
  await scene('s5-left', async (p) => {
    await step(p, 5);
    await p.click('.pf-curve .pf-seg-b >> nth=0');
    await p.waitForTimeout(1500);
  });
  await scene('s6-6000', async (p) => {
    await step(p, 6);
    await p.$eval('.pf-range', (e) => {
      e.value = '6000';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(1200);
  });
}
if (!only || only === 'quiz') {
  await scene('quiz1-fb', async (p) => {
    await step(p, 8);
    await p.click('.pf-choice >> nth=0');
    await p.waitForTimeout(1500);
  });
  await scene('quiz-result', async (p) => {
    await step(p, 8);
    for (let q = 0; q < 4; q++) {
      await p.click(`.pf-choice >> nth=1`);
      await p.waitForTimeout(400);
      await p.click('.pf-nav .pf-btn.is-primary');
      await p.waitForTimeout(400);
    }
    await p.waitForTimeout(800);
  });
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
