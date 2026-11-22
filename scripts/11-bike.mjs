// 자전거 기어 변속 실험 캡처: node scripts/11-bike.mjs [width] [height] [theme] [only]
//  only: all | states | detail  (detail = UI를 숨기고 구동계 근접 촬영)
// dev 서버가 자주 새로고침되므로(다른 작업자 HMR) 각 흐름을 재시도한다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light', only = 'all'] = process.argv;
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];

async function open(extra = '') {
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text());
  });
  await page.goto(`http://localhost:5273/preview.html?mode=bike&theme=${theme}${extra}`, { waitUntil: 'load' });
  await page.waitForSelector('.bike-wrap', { timeout: 15000 });
  await page.waitForTimeout(2500);
  return page;
}

async function retry(name, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let p = null;
    try {
      await fn((page) => (p = page));
      return;
    } catch (e) {
      console.log(`retry ${name}:`, String(e).slice(0, 120));
    } finally {
      if (p) await p.close().catch(() => {});
    }
  }
  console.log(`FAILED ${name}`);
}

const state = (p) => p.evaluate(() => {
  const wEl = document.querySelector('.bike-wrap');
  return {
    front: wEl?.dataset.front,
    rear: wEl?.dataset.rear,
    speed: wEl?.dataset.speed,
    gear: document.querySelector('.bike-gear')?.textContent,
    shown: document.querySelector('.bike-speed')?.textContent,
    ratio: document.querySelectorAll('.bike-stat-val')[0]?.textContent,
    dev: document.querySelectorAll('.bike-stat-val')[1]?.textContent,
    formula: document.querySelector('.bike-formula-num')?.textContent,
    warn: document.querySelector('.bike-warn')?.hidden ? '' : document.querySelector('.bike-warn')?.textContent
  };
});

const overflow = (p) => p.evaluate(() => {
  const over = document.documentElement.scrollWidth > innerWidth;
  // 좌상단 220×64(홈 버튼·제목) 영역을 가리는 패널이 있는지
  const hit = [...document.querySelectorAll('.bike-panel, .bike-sheet')].some((e) => {
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    if (st.display === 'contents' || r.width === 0) return false;
    return r.left < 220 && r.top < 64 && r.right > 0 && r.bottom > 0;
  });
  return { horizontalOverflow: over, coversTopLeft: hit };
});

if (only === 'all' || only === 'states') {
  await retry('states', async (keep) => {
    const p = keep(await open());
    console.log('initial', await state(p), await overflow(p));
    await p.screenshot({ path: `shots/11-bike-0-${tag}.png` });
    // 뒤 변속 2번 올림(작은 스프로킷), 앞 1번 올림(큰 체인링) → 48T × 16T
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(1500);
    console.log('after keys', await state(p));
    await p.screenshot({ path: `shots/11-bike-1-keys-${tag}.png` });
    // 버튼: 가장 가벼운 기어(앞 작은 × 뒤 큰)
    // 비활성화되면(끝 단) 멈춘다 — 비활성 버튼 클릭은 playwright가 무한 대기한다
    for (const sel of ['.bike-shifter-front .bike-shift-btn >> nth=0', '.bike-shifter-rear .bike-shift-btn >> nth=0']) {
      for (let i = 0; i < 12 && (await p.locator(sel).isEnabled()); i++) await p.click(sel);
    }
    await p.waitForTimeout(1500);
    console.log('lowest', await state(p));
    await p.screenshot({ path: `shots/11-bike-2-low-${tag}.png` });
    // 표에서 비스듬한 조합(앞 3단 48T × 뒤 1단 28T) 선택 + 케이던스 90
    await p.click('.bike-cell >> nth=2');
    await p.fill('#bike-cadence-input', '90');
    await p.dispatchEvent('#bike-cadence-input', 'input');
    await p.waitForTimeout(1500);
    console.log('cross 90rpm', await state(p));
    await p.screenshot({ path: `shots/11-bike-3-cross-${tag}.png` });
    // 로드 자전거, 가장 무거운 기어
    await p.click('.bike-type >> nth=1');
    await p.waitForTimeout(1200);
    console.log('road default', await state(p));
    for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(1500);
    console.log('road top', await state(p));
    await p.screenshot({ path: `shots/11-bike-4-road-${tag}.png` });
    // MTB + 지형 과제 탭
    await p.click('.bike-type >> nth=2');
    await p.waitForTimeout(1200);
    console.log('mtb default', await state(p));
    await p.click('.bike-tab >> nth=1');
    for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(1500);
    console.log('mtb lowest', await state(p), await overflow(p));
    await p.screenshot({ path: `shots/11-bike-5-mtb-task-${tag}.png` });
  });
}

if (only === 'all' || only === 'detail') {
  const views = [
    ['side', '-0.9,1.6,6.2,-0.9,1.5,0.15'],
    ['rear', '-2.2,1.4,2.6,-1.75,1.4,0.2'],
    ['front', '0.3,2.0,2.8,-0.1,1.5,0.2'],
    ['top', '-1.0,4.2,2.6,-1.0,1.4,0.15']
  ];
  for (const bike of [0, 1, 2]) {
    await retry(`detail-${bike}`, async (keep) => {
      const p = keep(await open());
      if (bike) await p.click(`.bike-type >> nth=${bike}`);
      await p.addStyleTag({ content: '.bike-sheet{display:none!important}' });
      await p.waitForTimeout(800);
      for (const [name, cam] of views) {
        await p.evaluate((c) => {
          const v = c.split(',').map(Number);
          window.__bikeCam?.(v);
        }, cam);
        await p.waitForTimeout(900);
        // HMR 새로고침으로 상태가 초기화됐으면 다시 시도
        const ok = await p.evaluate((n) => {
          const sheet = document.querySelector('.bike-sheet');
          const act = [...document.querySelectorAll('.bike-type')].findIndex((e) => e.classList.contains('is-active'));
          return !!sheet && getComputedStyle(sheet).display === 'none' && act === n && typeof window.__bikeCam === 'function';
        }, bike);
        if (!ok) throw new Error('page reloaded');
        await p.screenshot({ path: `shots/11-bike-d${bike}-${name}-${theme}.png` });
      }
    });
  }
}

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
