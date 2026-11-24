// 13-B 엔진의 종류 캡처: node scripts/13-engines.mjs [width] [height] [theme] [only]
// 장면마다 새 페이지를 열어 버튼을 눌러 캡처한다. 다른 작업자 저장으로 dev 서버가 새로고침되면 그 장면만 다시 찍는다.
// only: engines | views | extra | 장면 이름 일부
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light', only = ''] = process.argv;
const tag = `${w}-${theme}`;
// dev 서버가 꺼져 있을 때는 빌드본을 띄운 다른 주소를 BASE_URL로 준다
const BASE = process.env.BASE_URL ?? 'http://localhost:5273/';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];
const IDS = ['i4', 'i6', 'v6', 'v8', 'b4', 'v12', 'w16'];

async function scene(name, actions) {
  if (only && !['engines', 'views', 'extra'].includes(only) && !name.includes(only)) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    let reloaded = false;
    page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${name}: ${m.text()}`);
    });
    try {
      await page.goto(`${BASE}preview.html?mode=engines&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.eng-card', { timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(1200);
      await actions(page);
      if (reloaded) throw new Error('reloaded');
      await page.screenshot({ path: `shots/13-engines-${name}-${tag}.png` });
      const r = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth > innerWidth;
        const tl = [...document.querySelectorAll('.eng-wrap *')].filter((e) => {
          if (e.closest('.lab-tags')) return false;
          const b = e.getBoundingClientRect();
          return getComputedStyle(e).visibility !== 'hidden' && b.width > 0 && b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0;
        }).length;
        const info = document.querySelector('.eng-info');
        const tags = [...document.querySelectorAll('.lab-tag')].filter((t) => {
          const cs = getComputedStyle(t);
          return cs.display !== 'none' && cs.visibility !== 'hidden';
        }).length;
        return { over, topLeft: tl, infoScroll: info ? info.scrollHeight > info.clientHeight + 2 : false, tags };
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

const pick = async (p, i) => {
  await p.click(`.eng-card >> nth=${i}`);
  await p.waitForTimeout(2600);
};
const view = async (p, v) => {
  await p.click(`.eng-view[data-view="${v}"]`);
  await p.waitForTimeout(2600);
};

if (!only || only === 'engines' || !['views', 'extra'].includes(only)) {
  for (let i = 0; i < IDS.length; i++) await scene(`${IDS[i]}-iso`, (p) => (i === 0 ? p.waitForTimeout(2000) : pick(p, i)));
}
if (!only || only === 'views' || !['engines', 'extra'].includes(only)) {
  for (let i = 0; i < IDS.length; i++) {
    for (const v of ['front', 'top', 'side']) {
      await scene(`${IDS[i]}-${v}`, async (p) => {
        if (i > 0) await pick(p, i);
        await view(p, v);
      });
    }
  }
}
if (!only || only === 'extra' || !['engines', 'views'].includes(only)) {
  await scene('w16-hidden-front', async (p) => {
    await pick(p, 6);
    await p.click('.eng-opts .eng-seg-b >> nth=0');
    await view(p, 'front');
  });
  await scene('v8-solid', async (p) => {
    await pick(p, 3);
    await p.click('.eng-opts .eng-seg-b >> nth=2');
    await p.waitForTimeout(800);
  });
  await scene('i4-step', async (p) => {
    await p.click('.eng-play .eng-btn >> nth=1');
    await p.waitForTimeout(150);
    await p.click('.eng-play .eng-btn >> nth=1');
    await p.waitForTimeout(600);
  });
  await scene('cmp-i4-w16', async (p) => {
    await p.click('.eng-toggle');
    await p.waitForTimeout(2600);
  });
  await scene('cmp-v8-v12-front', async (p) => {
    await pick(p, 3);
    await p.click('.eng-toggle');
    await p.waitForTimeout(800);
    await p.click('.eng-info .eng-seg-b >> nth=5');
    await view(p, 'front');
  });
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
