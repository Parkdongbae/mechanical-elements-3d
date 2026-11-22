// 13-C 증기 기관 투어 캡처: node scripts/13-steam-tour.mjs [width] [height] [theme] [only]
// only: newcomen | watt | loco | "watt:5" 처럼 기관:단계 | extra
// 장면마다 새 페이지를 열어 탭·단계를 누르고 캡처한다. dev 서버가 새로고침되면 그 장면만 다시 찍는다.
// 검사: 가로 넘침, 좌상단 220×64 침범, 안내 패널 스크롤, 링크 길이 오차(window.__stm.residual), 콘솔 에러.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light', only = ''] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];
const MACH = { newcomen: [0, 6], watt: [1, 7], loco: [2, 7] };

async function scene(name, actions, wait = 4200) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    let reloaded = false;
    page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${name}: ${m.text()}`);
    });
    try {
      await page.goto(`${base}preview.html?mode=steam&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.stm-step', { timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(1200);
      await actions(page);
      await page.waitForTimeout(wait);
      if (reloaded) throw new Error('reloaded');
      await page.screenshot({ path: `shots/13-steam-${name}-${tag}.png` });
      const r = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth;
        const tl = [...document.querySelectorAll('.stm-wrap *')].filter((e) => {
          if (e.closest('.stm-tags')) return false;
          const b = e.getBoundingClientRect();
          return getComputedStyle(e).visibility !== 'hidden' && b.width > 0 && b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0;
        }).length;
        const g = document.querySelector('.stm-guide');
        const dock = document.querySelector('.stm-dock');
        const wideKids = [...document.querySelectorAll('.stm-wrap *')].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.stm-tags') && !e.closest('.stm-steps');
        }).length;
        const s = window.__stm;
        return {
          over,
          topLeft: tl,
          offscreen: wideKids,
          guideScroll: g ? g.scrollHeight > g.clientHeight + 2 : false,
          dockScroll: dock ? dock.scrollHeight > dock.clientHeight + 2 : false,
          residual: s ? s.residual() : -1,
          state: s ? s.state() : null
        };
      });
      if (reloaded) throw new Error('reloaded');
      const st = r.state;
      console.log(
        name,
        JSON.stringify({ over: r.over, topLeft: r.topLeft, offscreen: r.offscreen, guideScroll: r.guideScroll, residual: +r.residual.toExponential(2) }),
        st ? st.valves.map((v) => `${v.name}=${v.text ?? (v.open ? '열림' : '닫힘')}`).join(', ') + ' | ' + st.force : ''
      );
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${name}:`, String(e).slice(0, 100));
      await page.close();
    }
  }
}

const pick = async (p, m, s) => {
  const [tab] = MACH[m];
  await p.click(`.stm-tab >> nth=${tab}`);
  await p.waitForTimeout(600);
  await p.click(`.stm-step >> nth=${s}`);
};

for (const m of Object.keys(MACH)) {
  if (only && only !== m && !only.startsWith(m + ':')) continue;
  const [, n] = MACH[m];
  const one = only.startsWith(m + ':') ? +only.split(':')[1] : null;
  for (let s = 0; s < n; s++) {
    if (one !== null && s !== one) continue;
    await scene(`${m}-s${s}`, (p) => pick(p, m, s));
  }
}
if (!only || only === 'extra') {
  await scene('watt-gov-light-off', async (p) => {
    await pick(p, 'watt', 5);
    await p.waitForTimeout(500);
    await p.click('.stm-toggle');
    await p.click('.stm-seg-b >> nth=0');
  }, 9000);
  await scene('watt-gov-light-on', async (p) => {
    await pick(p, 'watt', 5);
    await p.waitForTimeout(500);
    await p.click('.stm-seg-b >> nth=0');
  }, 9000);
  await scene('watt-gov-heavy-on', async (p) => {
    await pick(p, 'watt', 5);
    await p.waitForTimeout(500);
    await p.click('.stm-seg-b >> nth=2');
  }, 9000);
  await scene('loco-reg0', async (p) => {
    await pick(p, 'loco', 2);
    await p.$eval('.stm-range', (e) => {
      e.value = '0';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, 6000);
  await scene('loco-reg100', async (p) => {
    await pick(p, 'loco', 6);
    await p.$eval('.stm-range', (e) => {
      e.value = '100';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, 6000);
  // 연속 재생: 단계가 저절로 넘어가는지
  await scene('newcomen-auto', async (p) => {
    await p.click('.stm-auto');
  }, 12000);
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
