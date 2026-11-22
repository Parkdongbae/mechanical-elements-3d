// 13-A 엔진의 작동 원리 캡처: node scripts/13-cycle-tour.mjs [width] [height] [theme] [only]
// 장면마다 새 페이지. 다른 작업자 저장으로 dev 서버가 새로고침되면 그 장면만 다시 찍는다.
// only: four | two | quiz | play
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// dev 서버가 없을 때: CYCLE_DIST=<vite build 결과 폴더> 를 주면 서버 없이 요청을 가로채 파일로 응답한다
const DIST = process.env.CYCLE_DIST ?? '';
const ORIGIN = DIST ? 'http://cycle.test' : 'http://localhost:5273';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

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
    if (DIST) {
      await page.route(`${ORIGIN}/**`, (route) => {
        const path = new URL(route.request().url()).pathname;
        const file = join(DIST, path === '/' ? 'preview.html' : decodeURIComponent(path));
        if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, contentType: MIME[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) });
      });
    }
    try {
      await page.goto(`${ORIGIN}/preview.html?mode=cycle&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.cyc-stroke', { timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(1800);
      await actions(page);
      if (reloaded) throw new Error('reloaded');
      await page.screenshot({ path: `shots/13-cycle-${name}-${tag}.png` });
      const r = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth;
        const tl = [...document.querySelectorAll('.cyc-wrap *')].filter((e) => {
          if (e.closest('.cyc-tags')) return false;
          const b = e.getBoundingClientRect();
          return getComputedStyle(e).visibility !== 'hidden' && b.width > 0 && b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0;
        }).length;
        const wide = [...document.querySelectorAll('.cyc-wrap *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length;
        const st = [...document.querySelectorAll('.cyc-st')].map((e) => e.textContent).join(' | ');
        const title = document.querySelector('.cyc-title')?.textContent ?? '';
        const ang = document.querySelector('.cyc-angle')?.textContent ?? '';
        return { over, wide, topLeft: tl, title, ang, st };
      });
      if (reloaded) throw new Error('reloaded');
      console.log(name, JSON.stringify(r));
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${name}:`, String(e).slice(0, 100));
      await page.close();
    }
  }
}

const scrubTo = async (p, deg) => {
  await p.$eval(
    '.cyc-scrub .cyc-range',
    (e, v) => {
      e.value = String(v);
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    },
    deg
  );
  await p.waitForTimeout(900);
};
const stroke = async (p, i) => {
  await p.click(`.cyc-stroke >> nth=${i}`);
  await p.waitForTimeout(1600);
};
const two = async (p) => {
  await p.click('.cyc-seg-b >> nth=1');
  await p.waitForTimeout(1500);
};

if (!only || only === 'play') {
  await scene('enter', async (p) => p.waitForTimeout(2500));
}
if (!only || only === 'four') {
  const angles = [95, 290, 366, 630];
  for (let i = 0; i < 4; i++) {
    await scene(`4t-s${i + 1}`, async (p) => {
      await stroke(p, i);
      await scrubTo(p, angles[i]);
    });
  }
  await scene('4t-play3', async (p) => {
    await stroke(p, 2);
  });
}
if (!only || only === 'two') {
  const cases = [
    ['2t-s1', 0, 140],
    ['2t-s2-fire', 1, 196],
    ['2t-s2-ex', 1, 282],
    ['2t-s2-scav', 1, 335]
  ];
  for (const [name, i, deg] of cases) {
    await scene(name, async (p) => {
      await two(p);
      await stroke(p, i);
      await scrubTo(p, deg);
    });
  }
}
if (!only || only === 'quiz') {
  await scene('quiz-order', async (p) => {
    await p.click('.cyc-quiz-b');
    await p.waitForTimeout(500);
    // 정답 순서로 누르기: 흡입, 압축, 폭발, 배기
    for (const t of ['흡입', '압축', '폭발(팽창)', '배기']) {
      await p.click(`.cyc-chip:text-is("${t}")`);
      await p.waitForTimeout(200);
    }
    await p.waitForTimeout(600);
  });
  await scene('quiz-result', async (p) => {
    await p.click('.cyc-quiz-b');
    await p.waitForTimeout(400);
    for (const t of ['흡입', '압축', '폭발(팽창)', '배기']) await p.click(`.cyc-chip:text-is("${t}")`);
    await p.click('.cyc-next');
    await p.waitForTimeout(300);
    for (let k = 0; k < 3; k++) {
      await p.click('.cyc-chip:not([disabled]) >> nth=0');
      await p.waitForTimeout(150);
    }
    await p.click('.cyc-next');
    await p.waitForTimeout(300);
    await p.click('.cyc-choice >> nth=0');
    await p.click('.cyc-next');
    await p.waitForTimeout(700);
  });
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
