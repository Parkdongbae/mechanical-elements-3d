// 17 링크 장치 캡처 묶음: node scripts/17-link-shots.mjs [width] [height] [theme] [only]
// 9-1 수용 기준표의 장면을 찍고 장면마다 넘침·좌상단 침범·화면 밖·44px 미만·글자 잘림·숫자판 값을 출력한다.
// 장면마다 새 페이지, dev 서버 새로고침(HMR) 시 그 장면만 재시도(최대 6회).
// only: 기구 id(예 crank-rocker) | extra | overflow(탭 3개 x 기구 전부 넘침만 검사, 캡처 없음)
// 환경 변수: BASE_URL(기본 http://localhost:5273/), LK_ENTRY(기본 preview.html?mode=link&)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light', only = ''] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const entry = process.env.LK_ENTRY ?? 'preview.html?mode=link&';
const narrow = Number(w) < 820;
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });

// [기구, 장면 이름, 쿼리]
const SCENES = [
  ['crank-rocker', 's1', 'lkq=60'],
  ['crank-rocker', 's2', 'lkq=240'],
  ['parallel', 's1', 'lkq=45'],
  ['parallel', 's2', 'lkq=200'],
  ['steering', 's1', 'lkq=-54.53'],
  ['steering', 's2', 'lkq=-104.53'],
  ['slider-crank', 's1', 'lkq=0'],
  ['slider-crank', 's2', 'lkq=90'],
  ['quick-return', 's1', 'lkq=330'],
  ['quick-return', 's2', 'lkq=210'],
  ['chebyshev', 's1', 'lkq=45'],
  ['chebyshev', 's2', 'lkq=85'],
  ['watt', 's1', 'lkq=-15'],
  ['watt', 's2', 'lkq=15'],
  ['pantograph', 's1', 'lkq=0:0.25'],
  ['pantograph', 's2', 'lkq=1:0.6'],
  ['jansen', 's1', 'lkq=0'],
  ['jansen', 's2', 'lkq=180'],
  ['gripper', 's1', 'lkq=1.5'],
  ['gripper', 's2', 'lkq=2.5'],
  ['custom', 's1', 'lkdim=5,4,6,10&lkq=75'],
  ['custom', 's2', 'lkdim=2,3,3,10'],
  ['custom', 'p1', 'lkdim=3,9,7,10'],
  ['custom', 'p2', 'lkdim=5,6,7,3'],
  ['custom', 'p3', 'lkdim=7,3,6,8'],
  ['custom', 'p4', 'lkdim=3,8,3,8'],
  ['extra', 'tilt', 'lk=crank-rocker&lkq=60&lktilt=1&lkfull=1&lklabel=1'],
  ['extra', 'watt26', 'lk=watt&lkq=26&lkfull=1'],
  ['extra', 'uses', 'lk=quick-return&lkq=330&lktab=uses'],
  ['extra', 'list', 'lk=jansen&lkq=180&lktab=list']
];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];

async function check(page) {
  return page.evaluate(() => {
    const vis = (e) => {
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && b.width > 0 && b.height > 0;
    };
    const wrap = document.querySelector('.lk-wrap');
    const all = wrap ? [...wrap.querySelectorAll('*')] : [];
    const over = document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth;
    // 좌상단 220x64: 패널·시트·이름표 글자가 들어오면 센다(스크롤 안쪽 요소는 바깥 상자로만 본다)
    const topLeft = all.filter((e) => {
      if (!vis(e) || !e.matches('.lk-list, .lk-side, .lk-ctl, .lk-dock, .lk-topchip, .lk-tag-l')) return false;
      const b = e.getBoundingClientRect();
      return b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0;
    }).length;
    const tops = [...document.querySelectorAll('.lk-panel, .lk-dock, .lk-topchip')].filter((e) => vis(e) && !e.closest('.lk-side, .lk-list, .lk-dock') || e.matches('.lk-side, .lk-list, .lk-dock'));
    const outside = tops.filter((e) => {
      const b = e.getBoundingClientRect();
      return b.right > innerWidth + 1 || b.left < -1 || b.bottom > innerHeight + 1 || b.top < -1;
    }).length;
    const small = [...document.querySelectorAll('.lk-wrap button')]
      .filter((e) => {
        if (!vis(e)) return false;
        const b = e.getBoundingClientRect();
        return b.width < 43.5 || b.height < 43.5;
      })
      .map((e) => (e.textContent || e.dataset.lk || '?').trim().slice(0, 8));
    const smallRange = [...document.querySelectorAll('.lk-range')].filter((e) => vis(e) && e.getBoundingClientRect().height < 35).length;
    const clipped = all
      .filter((e) => {
        if (!vis(e) || e.closest('svg') || e.closest('.lk-tags')) return false;
        const o = getComputedStyle(e).overflowX;
        if (o === 'auto' || o === 'scroll') return false;
        return e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && getComputedStyle(e).display !== 'inline';
      })
      .map((e) => (e.className || e.tagName).toString().slice(0, 24));
    const st = window.__lk ? window.__lk.state() : null;
    const reads = st ? st.readouts.map((r) => `${r.label}=${r.value}`).join(' | ') : '(no __lk)';
    return { over, topLeft, outside, small: small.length, smallNames: small.slice(0, 4).join(','), smallRange, clipped: clipped.slice(0, 3).join(','), id: st?.id, q: st?.q, ok: st?.ok, gr: st?.grashof?.kind, reads };
  });
}

async function scene(mech, name, query, tab) {
  if (only && only !== mech && only !== 'overflow') return;
  if (only === 'overflow' && name !== 'ov') return;
  for (let attempt = 0; attempt < 6; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    let reloaded = false;
    page.on('pageerror', (e) => errors.push(`${mech}-${name}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${mech}-${name}: ${m.text()}`);
    });
    try {
      const id = mech === 'extra' ? '' : `lk=${mech}&`;
      const tabQ = narrow && !/lktab=/.test(query) ? `&lktab=${tab ?? 'nums'}` : '';
      await page.goto(`${base}${entry}${id}${query}${tabQ}&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.lk-item', { state: 'attached', timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(2600);
      const r = await check(page);
      const file = `shots/17-${mech}-${name}-${tag}.png`;
      if (name !== 'ov') await page.screenshot({ path: file });
      if (reloaded) throw new Error('reloaded');
      console.log(`${name === 'ov' ? `[${mech} ${tab}]` : file} ${JSON.stringify(r)}`);
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${mech}-${name}:`, String(e).slice(0, 100));
      await page.close();
    }
  }
}

if (only === 'overflow') {
  const ids = ['crank-rocker', 'parallel', 'steering', 'slider-crank', 'quick-return', 'chebyshev', 'watt', 'pantograph', 'jansen', 'gripper', 'custom'];
  for (const id of ids) for (const t of ['list', 'nums', 'uses']) await scene(id, 'ov', id === 'custom' ? 'lkdim=5,4,6,10&lkq=75' : '', t);
} else {
  for (const [m, n, q] of SCENES) await scene(m, n, q);
}
await browser.close();
if (errors.length) {
  console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].join('\n'));
  process.exitCode = 1;
} else console.log('콘솔 에러 0');
