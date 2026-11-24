// 19-C 물레방아 장면 캡처 묶음: node scripts/19-mill-shots.mjs [width] [height] [theme] [only]
//  인자 없음 = 1280×800 밝음·다크, 390×844 밝음, 360×740 밝음(넘침 검사)을 차례로.
//  WM_ENTRY(기본 "preview.html?mode=mill&"), BASE_URL(기본 http://localhost:5273/) 환경 변수로 바꾼다.
// 장면마다 새 페이지, HMR 새로고침이면 그 장면만 재시도(최대 6회). 출력: 가로 넘침·좌상단 침범·화면 밖·44px 미만·__wm.state().
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const entry = process.env.WM_ENTRY ?? 'preview.html?mode=mill&';
const [, , aw, ah, atheme, only = ''] = process.argv;
mkdirSync('shots', { recursive: true });

const SCENES = [
  ['th100', 'wmth=100'],
  ['th120cam', 'wmth=120&wmview=cam'],
  ['th132cam', 'wmth=132&wmview=cam&wmlabel=1'],
  ['th147pestle', 'wmth=147&wmview=pestle'],
  ['th42all', 'wmth=42&wmview=all'],
  ['run320', 'wmq=320&wmt=20&wmpause=1'],
  ['run160', 'wmq=160&wmt=20&wmpause=1'],
  ['run480', 'wmq=480&wmt=20&wmpause=1'],
  ['q0', 'wmq=0&wmt=5'],
  ['stage1', 'wmstage=1&wmq=320&wmt=10&wmpause=1'],
  ['stage2', 'wmstage=2&wmq=320&wmt=10&wmpause=1'],
  ['stage3', 'wmstage=3&wmq=320&wmt=10&wmpause=1'],
  ['stage4', 'wmstage=4&wmq=320&wmt=10&wmpause=1'],
  ['stage5', 'wmstage=5&wmq=320&wmt=10&wmpause=1'],
  ['labels320', 'wmq=320&wmt=20&wmlabel=1&wmview=all&wmpause=1'],
  ['labelsoff', 'wmq=320&wmt=20&wmlabel=0&wmview=all&wmpause=1'],
  ['nums', 'wmq=320&wmt=20&wmtab=nums&wmpause=1'],
  ['info', 'wmq=320&wmt=20&wmtab=info&wmpause=1'],
  ['hand', 'wmth=132&wmtab=stage']
];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];
const flagged = [];

function inspect(page) {
  return page.evaluate(() => {
    const vis = (e) => {
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const own = [...document.querySelectorAll('.wm-wrap *')].filter((e) => !e.closest('.lab-tags') && vis(e));
    const over = document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1;
    const topLeft = own.filter((e) => {
      const b = e.getBoundingClientRect();
      return b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0 && !e.classList.contains('wm-wrap');
    }).length;
    const tagTl = [...document.querySelectorAll('.lab-tag-l')].filter((e) => {
      const b = e.getBoundingClientRect();
      return vis(e) && b.left < 220 && b.top < 64;
    }).length;
    const skip = (e) => e.closest('.wm-side') || e.closest('.wm-chips');
    const off = own.filter((e) => {
      if (skip(e) && !e.classList.contains('wm-side') && !e.classList.contains('wm-chips')) return false;
      const b = e.getBoundingClientRect();
      return b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1;
    }).length;
    const small = [...document.querySelectorAll('.wm-wrap button, .wm-wrap input[type=range], .wm-wrap summary')].filter((e) => {
      if (!vis(e)) return false;
      const b = e.getBoundingClientRect();
      return b.height < 43.5 || b.width < 43.5;
    }).map((e) => `${e.tagName}.${(e.className || '').toString().split(' ')[0]}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    const clip = own.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.children.length === 0 && e.clientWidth > 0 && e.tagName !== 'svg').length;
    const st = window.__wm ? window.__wm.state() : null;
    const dock = document.querySelector('.wm-dock')?.getBoundingClientRect();
    return {
      over, topLeft: topLeft + tagTl, off, small, clip,
      dockTop: dock ? Math.round(dock.top) : null,
      state: st ? {
        th: Math.round(st.theta * 10) / 10, rpm: Math.round(st.rpm * 10) / 10, flow: Math.round(st.flow * 1000), water: Math.round(st.waterMass),
        lift: st.lift.map((v) => Math.round(v * 1000) / 1000), strikes: st.strikes, labels: st.labels, stage: st.stage, view: st.view, slow: st.slow,
        spm: st.readouts.find((r) => r.key === 'strikes')?.value, power: st.readouts.find((r) => r.key === 'waterPower')?.value,
        speed: st.readouts.find((r) => r.key === 'impactSpeed')?.value, energy: st.readouts.find((r) => r.key === 'energy')?.value
      } : null
    };
  });
}

async function scene(w, h, theme, name, query) {
  const tag = `${w}-${theme}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    let reloaded = false;
    page.on('pageerror', (e) => errors.push(`${name}@${tag}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`${name}@${tag}: ${m.text()}`);
    });
    try {
      await page.goto(`${base}${entry}${query}&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__ready === true || window.__wm, null, { timeout: 40000 });
      page.on('framenavigated', (f) => { if (f === page.mainFrame()) reloaded = true; });
      await page.waitForTimeout(/stage/.test(name) ? 3200 : 2200);
      const file = `shots/19-${name}-${tag}.png`;
      await page.screenshot({ path: file });
      const r = await inspect(page);
      if (reloaded) throw new Error('reloaded');
      const bad = r.over || r.topLeft || r.off || r.small.length || r.clip;
      console.log(`${bad ? '!! ' : 'ok '}${file} over=${r.over} tl=${r.topLeft} off=${r.off} small=${r.small.length}${r.small.length ? ' ' + r.small.slice(0, 4).join(',') : ''} clip=${r.clip} dockTop=${r.dockTop} ${JSON.stringify(r.state)}`);
      if (bad) flagged.push(`${name}@${tag}`);
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${name}@${tag}:`, String(e).slice(0, 120));
      await page.close();
    }
  }
  flagged.push(`${name}@${tag}: 실패`);
}

const combos = aw
  ? [[+aw, +(ah ?? 800), atheme ?? 'light']]
  : [[1280, 800, 'light'], [1280, 800, 'dark'], [390, 844, 'light'], [360, 740, 'light']];
for (const [w, h, theme] of combos) {
  for (const [name, q] of SCENES) {
    if (only && only !== name && !name.startsWith(only)) continue;
    let query = q;
    // 좁은 화면: 숫자·알아보기 탭이 따로 있다
    if (w < 820 && name === 'run320') query += '&wmtab=nums';
    await scene(w, h, theme, name, query);
  }
}
await browser.close();
console.log(`\n콘솔·페이지 에러 ${errors.length}건`);
for (const e of errors.slice(0, 20)) console.log('  ' + e);
console.log(`표시할 문제 ${flagged.length}건: ${flagged.join(' ; ')}`);
if (errors.length) process.exitCode = 1;
