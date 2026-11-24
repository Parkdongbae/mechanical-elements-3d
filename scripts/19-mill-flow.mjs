// 19-C 물레방아 조작 흐름 검사: node scripts/19-mill-flow.mjs [width] [height] [theme]
//  물길 열기 → 20초(시뮬레이션) 뒤 rpm, 물의 양 3단계, 수문 닫기 → 멈춤, 손으로 돌리기(바퀴 드래그·거꾸로 끌기·놓아도 떨어짐),
//  단계 5개, 시점 4개, 이름표·천천히 토글, 키보드, enter/exit 20회 누수. 항목마다 ok/FAIL, 하나라도 FAIL 이면 종료 코드 1.
//  WM_ENTRY(기본 "preview.html?mode=mill&"), BASE_URL 로 바꾼다. 누수 검사는 dev.html 이면 __wmCycle, 아니면 실제 앱 해시 경로로 오간다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const entry = process.env.WM_ENTRY ?? 'preview.html?mode=mill&';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];
// 오래 걸리는 검사 중에 다른 작업자의 파일 저장으로 HMR 새로고침이 일어나지 않게 Vite 클라이언트를 조용한 것으로 바꾼다(WM_HMR=1 이면 그대로 둔다)
const VITE_STUB = `
const sheets = new Map();
export function updateStyle(id, content) { let s = sheets.get(id); if (!s) { s = document.createElement('style'); s.setAttribute('data-vite-dev-id', id); document.head.appendChild(s); sheets.set(id, s); } s.textContent = content; }
export function removeStyle(id) { const s = sheets.get(id); if (s) { s.remove(); sheets.delete(id); } }
export function createHotContext() { return { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; }
export function injectQuery(u) { return u; }
`;
let fails = 0;
let buf = [];
let curFails = 0;
let reloaded = false;
const check = (name, ok, info = '') => {
  if (!ok) curFails++;
  buf.push(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`);
};
/** dev 서버가 HMR 로 새로고침하면(다른 작업자가 파일을 고치는 중) 그 구역만 처음부터 다시 */
async function section(name, fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    buf = [];
    curFails = 0;
    reloaded = false;
    try {
      await fn();
      if (reloaded) throw new Error('reloaded');
      for (const l of buf) console.log(l);
      fails += curFails;
      return;
    } catch (e) {
      console.log(`retry ${name}: ${String(e).slice(0, 100)}`);
    }
  }
  fails++;
  console.log(`FAIL ${name} 구역을 끝내지 못함`);
}
const near = (v, c, tol) => Math.abs(v - c) <= tol;

async function open(query) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
    });
    if (!process.env.WM_HMR) await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'text/javascript', body: VITE_STUB }));
    try {
      await page.goto(`${base}${entry}${query}${query ? '&' : ''}theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__wm, null, { timeout: 40000 });
      await page.waitForTimeout(800);
      page.on('framenavigated', (fr) => {
        if (fr === page.mainFrame()) reloaded = true;
      });
      return page;
    } catch (e) {
      console.log('retry open:', String(e).slice(0, 100));
      await page.close();
    }
  }
  throw new Error('open failed');
}
const st = (p) => p.evaluate(() => window.__wm.state());
/** 시뮬레이션 시간이 sec 만큼 지나기를 기다린다 */
async function simWait(p, sec, limitMs = 150000) {
  const t0 = (await st(p)).t;
  const start = Date.now();
  for (;;) {
    const s = await st(p);
    if (s.t - t0 >= sec) return s;
    if (Date.now() - start > limitMs) return s;
    await p.waitForTimeout(250);
  }
}
const rd = (s, key) => s.readouts.find((r) => r.key === key)?.value;

// ───────────── 1) 물로 돌리기 ─────────────
await section('water', async () => {
  const p = await open('');
  let s = await st(p);
  check('처음: 수문 닫힘, 정지', !s.gate && s.omega === 0 && s.waterMass === 0, `gate=${s.gate} rpm=${s.rpm}`);
  await p.click('.wm-gate');
  await p.screenshot({ path: `shots/19-flow-open-${w}-${theme}.png` });
  s = await simWait(p, 24);
  check('물길 열기 후 24초: 21.5±1.5회/분', near(s.rpm, 21.5, 1.5), `rpm=${s.rpm.toFixed(2)} 실린 물=${s.waterMass.toFixed(0)} 찧음=${s.strikes}`);
  check('두 방아채가 번갈아 찧음(횟수 차 1 이하)', Math.abs(s.strikes[0] - s.strikes[1]) <= 1 && s.strikes[0] > 5, `strikes=${s.strikes}`);
  await p.screenshot({ path: `shots/19-flow-run320-${w}-${theme}.png` });
  await p.fill('.wm-flow .wm-range', '160');
  s = await simWait(p, 22);
  check('160 L/s로 바꾼 22초 뒤: 15.0±2회/분', near(s.rpm, 15.0, 2), `rpm=${s.rpm.toFixed(2)} 물=${s.waterMass.toFixed(0)}`);
  await p.fill('.wm-flow .wm-range', '320');
  // 수문 닫기 → 멈춤 (60초 안)
  await p.click('.wm-gate');
  const t0 = s.t;
  for (;;) {
    s = await st(p);
    if (s.omega < 1e-3 || s.t - t0 > 60) break;
    await p.waitForTimeout(300);
  }
  check('수문 닫기: 60초 안에 멈춤', s.omega < 1e-3, `멈추기까지 ${(s.t - t0).toFixed(1)}초(시뮬레이션)`);
  await p.close();
});
await section('water-levels', async () => {
  for (const [lps, rpm, tol] of [[50, 8.1, 1.2], [480, 26.5, 1.5]]) {
    const p = await open(`wmq=${lps}&wmt=45`);
    const s = await st(p);
    check(`${lps} L/s(미리 계산 45초): ${rpm}±${tol}회/분`, near(s.rpm, rpm, tol), `rpm=${s.rpm.toFixed(2)} 물=${s.waterMass.toFixed(0)}`);
    if (lps === 480) check('물이 많아도 누름대가 들어 올리는 높이 그대로(0.47 m)', rd(s, 'camLift') === '0.47 m', `camLift=${rd(s, 'camLift')} 최고=${s.last[0]?.peakLift?.toFixed(3)}`);
    await p.close();
  }
});

// ───────────── 2) 손으로 돌리기 ─────────────
await section('hand', async () => {
  const p = await open('wmth=100');
  let s = await st(p);
  check('wmth=100 → 손 모드, 두 공이 0', s.mode === 'hand' && s.lift[0] === 0 && s.lift[1] === 0, `lift=${s.lift}`);
  await p.screenshot({ path: `shots/19-flow-hand0-${w}-${theme}.png` });
  // 바퀴 반 바퀴 앞으로 끌기(둘레 근처)
  const a0 = s.theta;
  const pt = (deg) => p.evaluate((d) => window.__wm.screenOf(d, 1.45), deg);
  let from = await pt(a0);
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  const steps = 36;
  for (let k = 1; k <= steps; k++) {
    const q = await pt(a0 + (180 * k) / steps);
    await p.mouse.move(q.x, q.y);
    await p.waitForTimeout(70);
  }
  await p.screenshot({ path: `shots/19-flow-drag-${w}-${theme}.png` });
  await p.mouse.up();
  await p.waitForTimeout(500);
  s = await st(p);
  const adv = (s.theta - a0 + 360) % 360;
  check('바퀴 드래그로 반 바퀴 앞으로', near(adv, 180, 20), `advance=${adv.toFixed(1)}`);
  check('드래그로 찧음(공이가 하나 이상 찧음)', s.strikes[0] + s.strikes[1] >= 1, `strikes=${s.strikes} lift=${s.lift}`);
  // 거꾸로 끌기: 움직이지 않고 안내
  const a1 = s.theta;
  from = await pt(a1);
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  for (let k = 1; k <= 12; k++) {
    const q = await pt(a1 - (40 * k) / 12);
    await p.mouse.move(q.x, q.y);
    await p.waitForTimeout(60);
  }
  const note = await p.evaluate(() => document.querySelector('.wm-note')?.classList.contains('is-on') ?? false);
  await p.screenshot({ path: `shots/19-flow-back-${w}-${theme}.png` });
  await p.mouse.up();
  await p.waitForTimeout(300);
  s = await st(p);
  check('거꾸로 끌면 바퀴가 뒤로 가지 않음', ((s.theta - a1 + 540) % 360) - 180 > -1, `theta ${a1.toFixed(1)} -> ${s.theta.toFixed(1)}`);
  check('거꾸로 끌면 안내 한 줄', note);
  await p.close();
});
await section('release', async () => {
  // 누름대가 빠지는 순간 — 드래그를 멈춰도 공이가 스스로 떨어진다
  const p = await open('wmth=140&wmview=pestle');
  let s = await st(p);
  check('140도: 방아채 1 눌림(0.4 m 안팎)', s.lift[0] > 0.38 && s.engaged[0], `lift=${s.lift} engaged=${s.engaged}`);
  const pt = (deg) => p.evaluate((d) => window.__wm.screenOf(d, 1.45), deg);
  const from = await pt(140);
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  for (let k = 1; k <= 10; k++) {
    const q = await pt(140 + k * 1.5);
    await p.mouse.move(q.x, q.y);
    await p.waitForTimeout(60);
  }
  await p.mouse.up(); // 155도 근처(누름 끝 147.6도를 지남) — 여기서 손을 뗀다
  s = await st(p);
  const released = !s.engaged[0];
  await p.waitForTimeout(1800);
  s = await st(p);
  check('손을 떼도 공이가 스스로 떨어져 찧음', released && s.lift[0] === 0 && s.strikes[0] === 1, `풀림=${released} strikes=${s.strikes} lift=${s.lift}`);
  check('찧은 기록: 닿는 빠르기 3 m/s 안팎', s.last[0] && near(s.last[0].speed, 3.0, 0.5), `speed=${s.last[0]?.speed?.toFixed(2)} fall=${s.last[0]?.fallTime?.toFixed(3)}`);
  await p.close();
});

// ───────────── 3) 단계·시점·토글·키보드 ─────────────
await section('ui', async () => {
  const p = await open('wmq=320&wmt=6');
  for (let i = 1; i <= 5; i++) {
    await p.click(`.wm-step >> nth=${i - 1}`);
    await p.waitForTimeout(1600);
    const s = await st(p);
    const title = await p.evaluate(() => document.querySelector('.wm-gtitle')?.textContent ?? '');
    const want = { 1: 'all', 2: 'wheel', 3: 'all', 4: 'cam', 5: 'pestle' }[i];
    const slow = i >= 4;
    check(`${i}단계: 시점 ${want}, 천천히 ${slow ? '켬' : '끔'}, 설명`, s.stage === i && s.view === want && s.slow === slow && title.length > 3, `view=${s.view} slow=${s.slow} "${title}" labels=${s.labels}`);
    await p.screenshot({ path: `shots/19-flow-stage${i}-${w}-${theme}.png` });
  }
  await p.click('.wm-nav .wm-btn >> nth=0');
  check('이전 버튼', (await st(p)).stage === 4);
  for (const v of ['all', 'wheel', 'cam', 'pestle']) {
    await p.click(`.wm-seg-b[data-v="${v}"]`);
    await p.waitForTimeout(1300);
    check(`시점 ${v}`, (await st(p)).view === v);
  }
  // 이름표 토글
  await p.click('.wm-seg-b[data-v="all"]');
  await p.waitForTimeout(1200);
  const n0 = (await st(p)).labels;
  await p.click('.lab-tag-btn');
  await p.waitForTimeout(400);
  const n1 = (await st(p)).labels;
  const pressed1 = await p.getAttribute('.lab-tag-btn', 'aria-pressed');
  await p.click('.lab-tag-btn');
  await p.waitForTimeout(400);
  const n2 = (await st(p)).labels;
  check('이름표 토글(켬, 끔, 켬)', n1 === 0 && n0 > 0 && n2 > 0 && pressed1 === 'false', `${n0} -> ${n1} -> ${n2}`);
  // 천천히 보기
  await p.click('.wm-chips .wm-chip:has-text("천천히 보기")');
  let s = await st(p);
  const slowA = s.slow;
  await p.click('.wm-chips .wm-chip:has-text("천천히 보기")');
  s = await st(p);
  check('천천히 보기 토글', slowA !== s.slow);
  // 키보드
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  const g0 = (await st(p)).gate; // wmq 로 열었으므로 열려 있다
  await p.keyboard.press(' ');
  const g1 = (await st(p)).gate;
  await p.keyboard.press(' ');
  const g2 = (await st(p)).gate;
  check('Space: 수문 닫힘, 다시 누르면 열림', g0 === true && g1 === false && g2 === true, `${g0} -> ${g1} -> ${g2}`);
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowLeft');
  const lps = await p.inputValue('.wm-flow .wm-range');
  check('왼쪽 화살표 두 번: 물의 양 300', lps === '300', `value=${lps}`);
  await p.keyboard.press('ArrowRight');
  check('오른쪽 화살표: 물의 양 310', (await p.inputValue('.wm-flow .wm-range')) === '310');
  await p.keyboard.press('s');
  const sl = (await st(p)).slow;
  await p.keyboard.press('s');
  check('S: 천천히', sl !== (await st(p)).slow);
  await p.keyboard.press('l');
  const lab1 = await p.getAttribute('.lab-tag-btn', 'aria-pressed');
  await p.keyboard.press('l');
  check('L: 이름표', lab1 === 'false');
  await p.keyboard.press('3');
  check('3: 3단계', (await st(p)).stage === 3);
  // 손으로 돌리기 전환 + 방향키
  await p.click('.wm-seg-b[data-v="hand"]');
  const th0 = (await st(p)).theta;
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(300);
  const th1 = (await st(p)).theta;
  check('손 모드 오른쪽 화살표: 굴통 2도 앞으로', near((th1 - th0 + 360) % 360, 2, 0.6), `${th0.toFixed(1)} -> ${th1.toFixed(1)}`);
  const goal = Math.round((th1 + 40) % 360);
  await p.fill('.wm-scrub .wm-range', String(goal));
  await p.waitForTimeout(500);
  const th2 = (await st(p)).theta;
  check(`스크러버로 ${goal}도(앞으로 40도)`, near(th2, goal, 2), `theta=${th2.toFixed(1)}`);
  await p.fill('.wm-scrub .wm-range', String(Math.round((th2 - 30 + 360) % 360)));
  await p.waitForTimeout(400);
  const th3 = (await st(p)).theta;
  check('스크러버로 거꾸로는 안 됨', near(th3, th2, 1), `theta=${th3.toFixed(1)}`);
  await p.click('.wm-chips .wm-chip:has-text("처음으로")');
  s = await st(p);
  check('처음으로', s.mode === 'water' && s.stage === 0 && !s.gate && s.omega === 0 && s.strikes[0] === 0, `mode=${s.mode} stage=${s.stage}`);
  // 이름표 점을 눌러 설명 카드
  await p.waitForTimeout(1800);
  const box = await p.evaluate(() => {
    const e = document.querySelector('.lab-tag[data-key="shaft"] .lab-tag-l');
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  if (box) {
    await p.mouse.click(box.x, box.y);
    await p.waitForTimeout(300);
    const card = await p.evaluate(() => document.querySelector('.wm-partcard')?.textContent ?? '');
    check('이름표 글자를 누르면 설명 카드', card.includes('굴통'), card.slice(0, 50));
  } else check('이름표 글자를 누르면 설명 카드', false, '굴통 이름표 없음');
  await p.close();
});

// ───────────── 4) enter/exit 20회 ─────────────
await section('leak', async () => {
  let p;
  if (entry.includes('dev.html')) {
    // 개발용 진입점: dev.ts 의 __wmCycle 로 enter/exit 를 직접 되풀이
    p = await open('');
    const r = await p.evaluate(() => window.__wmCycle(20));
    check('enter/exit 20회: 지오메트리, 텍스처, DOM, selfLeak 증가 없음', r.geo1 <= r.geo0 && r.tex1 <= r.tex0 && r.dom1 === r.dom0 && r.leak1 <= r.leak0, JSON.stringify(r));
  } else {
    // 연결 뒤(preview.html?mode=mill): 실제 앱(index.html)의 해시 경로로 홈 ↔ #/lab/mill 을 20번 오간다
    p = await browser.newPage({ viewport: { width: +w, height: +h } });
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
    });
    if (!process.env.WM_HMR) await p.route('**/@vite/client', (r) => r.fulfill({ contentType: 'text/javascript', body: VITE_STUB }));
    await p.goto(`${base}#/lab/mill`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForFunction(() => window.__wm, null, { timeout: 40000 });
    // 해시 이동도 framenavigated 를 내므로, 새로고침은 창에 남긴 표시가 사라졌는지로 판단한다
    await p.evaluate(() => { window.__wmFlowMark = 1; });
    const cycle = async () => {
      await p.evaluate(() => { location.hash = '#/'; });
      await p.waitForFunction(() => !window.__wm, null, { timeout: 20000 });
      await p.waitForTimeout(150);
      await p.evaluate(() => { location.hash = '#/lab/mill'; });
      await p.waitForFunction(() => window.__wm, null, { timeout: 20000 });
      await p.waitForTimeout(250);
      return p.evaluate(() => ({ leak: window.__wm.selfLeak(), tags: document.querySelectorAll('.lab-tags').length, wraps: document.querySelectorAll('.wm-wrap').length, dom: document.querySelectorAll('*').length }));
    };
    const a = await cycle();
    let b = a;
    for (let i = 0; i < 20; i++) b = await cycle();
    check('홈 ↔ #/lab/mill 20회: selfLeak·DOM 증가 없음, 이름표 층·패널 1개', b.leak <= a.leak && b.dom <= a.dom && b.tags === 1 && b.wraps === 1, `${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    // 다른 실험으로 갔을 때 카메라 offset·controls 가 남지 않는다
    await p.evaluate(() => { location.hash = '#/lab/pump'; });
    await p.waitForTimeout(1200);
    const lean = await p.evaluate(() => ({ mill: !!window.__wm, wraps: document.querySelectorAll('.wm-wrap').length }));
    check('#/lab/pump 로 옮기면 물레방아 DOM·__wm 없음', !lean.mill && lean.wraps === 0, JSON.stringify(lean));
    if (!(await p.evaluate(() => window.__wmFlowMark === 1))) reloaded = true;
  }
  const fps = await p.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          if (++n === 120) res((n * 1000) / (performance.now() - t0));
          else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      })
  );
  console.log(`info fps=${fps.toFixed(0)} (헤드리스 소프트웨어 렌더라 참고용)`);
  await p.close();
});

await browser.close();
check('콘솔, 페이지 에러 0', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(fails ? `\n${fails}개 FAIL` : '\n전부 통과');
process.exitCode = fails ? 1 : 0;
