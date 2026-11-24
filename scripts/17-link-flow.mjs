// 17 링크 장치 조작 흐름 검사: node scripts/17-link-flow.mjs [width] [height] [theme]
// 목록 클릭 11개 전환, 재생/멈춤, 방향, 스크러버, 손잡이 드래그(page.mouse), 토글 4개, 직접 만들기 슬라이더·프리셋 6개, 키보드, 전환 누수.
// 항목마다 ok/FAIL을 출력하고 하나라도 FAIL이면 종료 코드 1. 장면마다 새 페이지(HMR 새로고침 시 재시도).
// 환경 변수: BASE_URL(기본 http://localhost:5273/), LK_ENTRY(기본 preview.html?mode=link&)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const entry = process.env.LK_ENTRY ?? 'preview.html?mode=link&';
const narrow = Number(w) < 820;
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];
let fails = 0;
const say = (ok, name, info = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`);
};
const IDS = ['crank-rocker', 'parallel', 'steering', 'slider-crank', 'quick-return', 'chebyshev', 'watt', 'pantograph', 'jansen', 'gripper', 'custom'];

async function scene(name, query, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    let reloaded = false;
    const local = [];
    page.on('pageerror', (e) => local.push(`${name}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load')) local.push(`${name}: ${m.text()}`);
    });
    try {
      await page.goto(`${base}${entry}${query}&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.lk-item', { state: 'attached', timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(1800);
      const out = [];
      const say2 = (...a) => out.push(a);
      await body(page, say2);
      if (reloaded) throw new Error('reloaded');
      for (const a of out) say(...a);
      errors.push(...local);
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${name}:`, String(e).slice(0, 120));
      await page.close();
    }
  }
}

const st = (page) => page.evaluate(() => window.__lk.state());
const tabTo = async (page, t) => {
  if (narrow) await page.click(`[data-lk="tab-${t}"]`);
};

// 1) 목록 클릭으로 11개 전환
await scene('list', 'lkq=60', async (page, say2) => {
  for (const id of IDS) {
    if (narrow) await tabTo(page, 'list');
    await page.click(`[data-lk-id="${id}"]`);
    await page.waitForTimeout(500);
    const s = await st(page);
    say2(s.id === id && s.readouts.length > 0 || id === 'custom', `목록 전환 ${id}`, `readouts ${s.readouts.length}`);
  }
});

// 2) 재생/멈춤·방향·스크러버
await scene('play', 'lk=crank-rocker&lkq=60', async (page, say2) => {
  const q0 = (await st(page)).q;
  await page.click('[data-lk="play"]');
  await page.waitForTimeout(800);
  const q1 = (await st(page)).q;
  say2(q1 !== q0, '재생: 입력이 움직인다', `${((q1 - q0) * 57.2958).toFixed(1)}°`);
  await page.click('[data-lk="play"]');
  await page.waitForTimeout(200);
  const qa = (await st(page)).q;
  await page.waitForTimeout(400);
  const qb = (await st(page)).q;
  say2(qa === qb, '멈춤: 입력이 멈춘다');
  await page.click('[data-lk="play"]');
  await page.waitForTimeout(500);
  const f0 = (await st(page)).q;
  await page.waitForTimeout(500);
  const f1 = (await st(page)).q;
  await page.click('[data-lk="reverse"]');
  await page.waitForTimeout(100);
  const r0 = (await st(page)).q;
  await page.waitForTimeout(500);
  const r1 = (await st(page)).q;
  say2((f1 - f0) * (r1 - r0) < 0, '방향 바꾸기: 반대로 돈다', `${((f1 - f0) * 57.2958).toFixed(1)}° / ${((r1 - r0) * 57.2958).toFixed(1)}°`);
  await page.click('[data-lk="play"]');
  await page.evaluate(() => {
    const el = document.querySelector('[data-lk="scrub"]');
    el.value = '180';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const s = await st(page);
  const d = ((s.deg % 360) + 360) % 360;
  say2(Math.abs(d - 180) < 1 && !s.playing, '스크러버 180° (재생 멈춤)', `deg=${d.toFixed(2)}`);
  const sp = await page.evaluate(() => {
    const el = document.querySelector('[data-lk="speed"]');
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  });
  say2(sp === '30', '빠르기 슬라이더');
});

// 3) 손잡이 끌기: 반 바퀴
await scene('drag', 'lk=crank-rocker&lkq=60', async (page, say2) => {
  const s0 = await st(page);
  const O = s0.screen['O2'];
  const A = s0.screen[s0.handle];
  const cam0 = s0.camPos;
  const rx = A.x - O.x;
  const ry = A.y - O.y;
  const q0 = s0.q;
  await page.mouse.move(A.x, A.y);
  await page.mouse.down();
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const th = (Math.PI * i) / steps;
    // 화면 y는 아래가 +라서 반시계 회전은 y 부호가 반대
    const x = O.x + rx * Math.cos(th) + ry * Math.sin(th);
    const y = O.y - rx * Math.sin(th) + ry * Math.cos(th);
    await page.mouse.move(x, y);
    await page.waitForTimeout(30);
  }
  const mid = await st(page);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const s1 = await st(page);
  const dq = ((s1.q - q0) * 180) / Math.PI;
  say2(Math.abs(Math.abs(dq) - 180) < 12, '손잡이 반 바퀴 끌기', `Δθ=${dq.toFixed(1)}°`);
  say2(mid.dragging === true && s1.dragging === false && !s1.playing, '끄는 중 dragging, 놓으면 해제·재생 멈춤');
  const dc = Math.hypot(...s1.camPos.map((v, i) => v - cam0[i]));
  say2(dc < 1e-3, '드래그 중 카메라가 돌지 않는다', `Δcam=${dc.toExponential(1)}`);
});

// 4) 토글 4개
await scene('toggles', 'lk=crank-rocker&lkq=60', async (page, say2) => {
  for (const k of ['trace', 'full', 'label', 'tilt']) {
    const sel = `[data-lk="toggle-${k}"]`;
    const a0 = await page.getAttribute(sel, 'aria-pressed');
    await page.click(sel);
    await page.waitForTimeout(200);
    const a1 = await page.getAttribute(sel, 'aria-pressed');
    say2(a0 !== a1, `토글 ${k}`, `${a0} → ${a1}`);
  }
  const s = await st(page);
  say2(s.tilt === true, '3D로 보기 켜짐');
  const tagCount = await page.evaluate(() => document.querySelectorAll('.lk-tag').length);
  say2(tagCount > 0, '이름표가 생긴다', `${tagCount}개`);
  await page.click('[data-lk="clear"]');
  await page.click('[data-lk="reset"]');
  await page.waitForTimeout(300);
  say2(Math.abs(((await st(page)).deg ?? 0) - 60) < 0.5, '처음으로: 입력이 q0(60°)로');
});

// 5) 직접 만들기: 슬라이더·프리셋 6개
await scene('custom', 'lk=custom', async (page, say2) => {
  await tabTo(page, 'nums');
  const presets = [
    ['크랭크-로커', 'crank-rocker'],
    ['이중 크랭크', 'double-crank'],
    ['이중 로커', 'double-rocker'],
    ['평행 크랭크', 'change-point'],
    ['조건 불만족', 'non-grashof'],
    ['조립 불가', 'impossible']
  ];
  const btns = await page.$$('[data-lk="preset"]');
  say2(btns.length === 6, '프리셋 버튼 6개', `${btns.length}`);
  for (let i = 0; i < Math.min(6, btns.length); i++) {
    await btns[i].click();
    await page.waitForTimeout(500);
    const s = await st(page);
    const badge = await page.textContent('.lk-badge');
    const formula = await page.textContent('.lk-gformula');
    say2(s.grashof?.kind === presets[i][1], `프리셋 ${presets[i][0]}`, `kind=${s.grashof?.kind} 배지="${badge}" 식="${formula}" ok=${s.ok}`);
  }
  // 슬라이더를 하나씩 움직인다
  await btns[0].click();
  for (const [k, v] of [['a', '4'], ['b', '8'], ['c', '6'], ['d', '9'], ['u', '3'], ['v', '-2']]) {
    await page.evaluate(([kk, vv]) => {
      const el = document.querySelector(`[data-lk="dim-${kk}"]`);
      el.value = vv;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, [k, v]);
    await page.waitForTimeout(150);
  }
  const s = await st(page);
  say2(s.id === 'custom' && s.readouts.length > 0, '슬라이더 6개 조작 뒤에도 숫자판 갱신', `readouts ${s.readouts.length} grashof=${s.grashof?.kind}`);
  await btns[5].click();
  await page.waitForTimeout(400);
  const playDisabled = await page.$eval('[data-lk="play"]', (e) => e.disabled);
  say2(playDisabled, '조립 불가: 재생 버튼이 꺼진다');
});

// 6) 키보드
await scene('keys', 'lk=crank-rocker&lkq=60&lkplay=1', async (page, say2) => {
  await page.mouse.click(5, 300); // 캔버스에 포커스 (입력 요소 밖)
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  let s = await st(page);
  say2(s.playing === false, 'Space 멈춤');
  const d0 = s.deg;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  s = await st(page);
  say2(Math.abs(s.deg - d0 - 1) < 0.05, '→ 1°', `${(s.deg - d0).toFixed(2)}`);
  await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(100);
  const s2 = await st(page);
  say2(Math.abs(s2.deg - s.deg + 10) < 0.05, 'Shift+← 10°', `${(s2.deg - s.deg).toFixed(2)}`);
  const before = await page.getAttribute('[data-lk="toggle-trace"]', 'aria-pressed');
  await page.keyboard.press('t');
  say2((await page.getAttribute('[data-lk="toggle-trace"]', 'aria-pressed')) !== before, 'T 자취');
  await page.keyboard.press(']');
  await page.waitForTimeout(300);
  say2((await st(page)).id === 'parallel', '] 다음 기구');
  await page.keyboard.press('[');
  await page.waitForTimeout(300);
  say2((await st(page)).id === 'crank-rocker', '[ 이전 기구');
  await page.keyboard.press('r');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const a = (await st(page)).deg;
  await page.waitForTimeout(400);
  const b = (await st(page)).deg;
  say2(b < a || Math.abs(b - a) > 100, 'R 방향 바꾸기 후 재생', `${a.toFixed(1)} → ${b.toFixed(1)}`);
});

// 7) 팬터그래프: 도형 선택·진행도
await scene('pantograph', 'lk=pantograph&lkq=0:0.25', async (page, say2) => {
  const shapes = await page.$$('[data-lk="shape"]');
  say2(shapes.length === 3, '도형 선택 3개', `${shapes.length}`);
  if (shapes.length === 3) {
    await shapes[1].click();
    await page.waitForTimeout(400);
    const s = await st(page);
    say2(s.ok, '사각형으로 바꿔도 조립됨');
  }
  await page.click('[data-lk="play"]');
  await page.waitForTimeout(1200);
  say2((await st(page)).ok, '자동 재생 중 조립 유지');
});

// 8) 전환 누수: 20회 전환 뒤 지오메트리 수가 늘지 않는다 + enter/exit 반복
await scene('leak', 'lk=crank-rocker&lkq=60', async (page, say2) => {
  const cycle = async () => {
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press(']');
      await page.waitForTimeout(60);
    }
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('[');
      await page.waitForTimeout(60);
    }
  };
  await page.mouse.click(5, 300);
  await cycle();
  const g1 = await page.evaluate(() => window.__lk.selfLeak());
  await cycle();
  const g2 = await page.evaluate(() => window.__lk.selfLeak());
  say2(g2 <= g1, '기구 22회 전환 뒤 지오메트리 수가 늘지 않는다', `${g1} → ${g2}`);
  const r = await page.evaluate(() => (window.__reenterLk ? window.__reenterLk(20) : null));
  if (r) say2(r.left === 0 && r.after <= r.before + 2, 'enter/exit 20회: 패널·지오메트리 남지 않음', `패널 ${r.left}, 지오메트리 ${r.before} → ${r.after}`);
  else console.log('skip enter/exit 반복(진입점에 __reenterLk 없음)');
});

await browser.close();
if (errors.length) {
  fails++;
  console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].join('\n'));
} else console.log('콘솔 에러 0');
console.log(fails ? `FAIL ${fails}건` : '전부 통과');
process.exitCode = fails ? 1 : 0;
