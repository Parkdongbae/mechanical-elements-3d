// 지시서 18 8-2 — 탐구 실험 9종의 공용 이름표 자동 점검
// 사용: node scripts/18-labels.mjs [key …] [--vp=wide|narrow] [--theme=light|dark] [--no-shots]
//   key: bike car power wind cycle engines steam pump link (없으면 9종 전부)
//   1280×800 · 390×844 × 밝음 · 다크, 장면마다 새 브라우저 컨텍스트(저장값 초기화), 실패 시 최대 3회 재시도.
// 점검: ① 토글 버튼 1개·44px·화면 안·다른 조작과 안 겹침 ② 켠 상태의 이름표 글자(4절 표와 대조)·겹침·화면 밖·버튼/패널 가림·P1 접힘(P1끼리 겹친 경우만 허용)
//       ③ 끄면 안 보임 ④ 새로고침해도 꺼진 채 → 다시 켜짐 ⑤ 움직이는 부품 이름표가 따라감 ⑥ 접힌 점을 누르면 펼쳐짐
//       ⑦ 가로 스크롤·콘솔 에러. 캡처는 shots/18/auto/ 에 저장. 실패가 있으면 목록을 찍고 exit 1.
// dev 서버(기본 http://localhost:5273/, 다르면 BASE_URL)가 떠 있어야 한다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ALL = ['bike', 'car', 'power', 'wind', 'cycle', 'engines', 'steam', 'pump', 'link'];
const keys = args.filter((a) => !a.startsWith('--'));
const labs = keys.length ? keys : ALL;
const vpOpt = flag('vp');
const themeOpt = flag('theme');
const shots = !args.includes('--no-shots');
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const OUT = 'shots/18/auto';
mkdirSync(OUT, { recursive: true });

const VPS = [
  { name: 'wide', w: 1280, h: 800 },
  { name: 'narrow', w: 390, h: 844 }
].filter((v) => !vpOpt || v.name === vpOpt);
const THEMES = ['light', 'dark'].filter((t) => !themeOpt || t === themeOpt);

/** 글자 일치: 같거나 "글자 " 로 시작(잇수·상태 글자가 뒤에 붙는 경우) */
const same = (text, exp) => text === exp || text.startsWith(exp + ' ');

// ───────── 장면표 (4절 표의 글자) ─────────
// expect: 모두 있어야 하는 글자 / sets: 이 중 한 묶음이 통째로 있으면 통과 / movers: 움직이는 부품의 글자(보이는 것 중 하나는 좌표가 바뀌어야 함)
const SCENES = {
  bike: [
    {
      name: 'default',
      query: '',
      expect: ['체인링(앞 스프로킷)', '뒤 스프로킷', '체인', '뒤 변속기', '텐션 풀리', '크랭크', '페달', '뒷바퀴', '차축(뒷바퀴 축)', '프레임'],
      movers: ['크랭크', '페달']
    }
  ],
  car: [
    {
      name: 'manual',
      query: '',
      expect: ['엔진', '변속기', '클러치', '차동기어', '구동축', '입력축', '출력축', '종감속 기어', '벨트와 풀리', '발전기', '앞바퀴(구동 바퀴)'],
      // 벨트와 풀리·발전기는 엔진의 +x 끝(기본 시점에서는 블록 뒤) — 그쪽에서 볼 때만 이름표가 붙는다(at() = false)
      seen: ['engine', 'gearbox', 'clutch', 'diff', 'halfshaft', 'wheel'],
      movers: []
    },
    {
      name: 'auto',
      query: '',
      setup: (p) => clickText(p, '자동 변속기'),
      expect: ['엔진', '변속기', '토크 컨버터', '차동기어', '구동축', '입력축', '출력축', '종감속 기어', '벨트와 풀리', '발전기', '앞바퀴(구동 바퀴)'],
      seen: ['engine', 'gearbox', 'tc', 'diff', 'halfshaft', 'wheel']
    }
  ],
  power: [
    {
      name: 'step0',
      query: '',
      expect: ['1 엔진', '2 플라이휠·클러치', '3 변속기', '4 프로펠러 샤프트', '5 종감속·차동기어', '6 차축', '7 바퀴']
    }
  ],
  wind: [
    {
      name: 'normal',
      query: '',
      expect: ['도어 손잡이', '사이드미러', 'A필러', '도어 틈새', '휠', '보닛', '앞유리', '지붕', '트렁크', '송풍 팬', '벌집 정류기', '이동 벨트', '턴테이블', '힘 측정 받침'],
      keys: ['handle', 'mirror', 'pillar', 'gap', 'wheel', 'hood', 'windshield', 'roof', 'trunk', 'fan', 'honeycomb', 'belt', 'turntable', 'balance'],
      seen: ['mirror'], // 송풍 팬·벌집 정류기는 시험 구간 6.3 m 앞(기본 시점 화면 밖) — 시점을 돌리면 보인다
      count: 14 // 스포일러 '없음'이 기본
    },
    {
      name: 'spoiler',
      query: '',
      setup: async (p) => {
        await p.locator('.wind-chip[data-item="spoiler"][data-idx="2"]').first().click();
        await p.waitForTimeout(600);
      },
      expect: ['뒤 스포일러', '도어 손잡이', '보닛', '송풍 팬'],
      keys: ['spoiler'],
      count: 15
    },
    {
      name: 'under',
      query: '',
      setup: async (p) => {
        await p.waitForTimeout(800);
        await p.locator('.wind-under-btn:visible').first().click();
        await p.waitForFunction(() => document.querySelector('.wind-under-btn')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 });
        await p.waitForTimeout(3200);
      },
      expect: ['배기관', '머플러', '연료 탱크', '서스펜션 암', '오일 팬', '스페어 타이어 자리', '울퉁불퉁 → 공기가 엉켜요'],
      keys: ['under0'],
      count: 7
    }
  ],
  cycle: [
    {
      name: 'four',
      query: '',
      expect: ['흡기 밸브', '배기 밸브', '점화 플러그', '캠축(캠)', '피스톤', '크랭크축', '커넥팅 로드', '실린더', '밸브 스프링', '캠 벨트', '흡기관·공기 청정기', '배기관·소음기', '냉각 핀'],
      movers: ['피스톤', '커넥팅 로드'],
      drive: playCycle
    },
    {
      name: 'two',
      query: '',
      setup: (p) => clickText(p, '2행정'),
      expect: ['배기 포트', '소기 포트', '흡기 포트', '점화 플러그', '크랭크실', '피스톤', '커넥팅 로드', '크랭크축', '실린더', '배기관·소음기'],
      movers: ['피스톤', '커넥팅 로드'],
      drive: playCycle
    }
  ],
  engines: [
    {
      name: 'default',
      query: '',
      expect: ['크랭크축', '피스톤', '커넥팅 로드', '실린더 블록', '실린더 헤드', '플라이휠', '크랭크 풀리', '받침대(베어링)'],
      movers: ['피스톤', '커넥팅 로드']
    }
  ],
  steam: [
    {
      name: 'default',
      query: '',
      sets: [
        ['보일러', '화로', '실린더', '피스톤', '흔들보(워킹 빔)', '사슬', '펌프 막대', '찬물 통', '증기 밸브', '찬물 밸브', '굴뚝'],
        ['보일러', '실린더', '피스톤', '크로스헤드', '흔들보', '연결봉(커넥팅 로드)', '크랭크', '플라이휠', '원심 조속기', '조절 밸브', '분리 응축기', '공기 펌프', '증기관'],
        ['화실', '보일러(연관)', '증기 돔', '굴뚝', '연기실', '실린더', '피스톤', '슬라이드 밸브', '크로스헤드', '커넥팅 로드', '커플링 로드', '동륜', '편심봉(밸브 장치)', '운전실', '레일']
      ]
    }
  ],
  pump: [
    {
      // 기본 보기 = 컷어웨이(단면) — 속 부품 이름표까지 15개
      name: 'default',
      query: '',
      expect: ['손잡이(지렛대)', '끌어 보세요', '받침점', '흔들 링크', '피스톤 로드', '몸통(실린더)', '피스톤(가죽 패킹)', '피스톤 밸브', '아래 밸브', '주둥이', '흡입관', '양동이', '지하수면', '대기압', '약 10 m 한계'],
      movers: ['손잡이(지렛대)', '흔들 링크', '피스톤 로드'],
      // 손펌프는 저절로 움직이지 않는다 — 손잡이 점을 잡고 아래로 끌어 본다
      drive: async (p, s1) => {
        const g = s1.tags.find((t) => t.key === 'grip' && t.dot);
        if (!g) return;
        const x = g.dot.x0 + 4;
        const y = g.dot.y0 + 4;
        await p.mouse.move(x, y + 6);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) await p.mouse.move(x, y + 6 + i * 14);
        await p.mouse.up();
      }
    },
    {
      name: 'outside',
      query: '',
      setup: (p) => clickText(p, '겉모습'),
      expect: ['손잡이(지렛대)', '받침점', '흔들 링크', '피스톤 로드', '몸통(실린더)', '주둥이', '흡입관'],
      absent: ['piston', 'pistonValve', 'foot']
    }
  ],
  link: [
    {
      name: 'crank-rocker',
      query: 'lk=crank-rocker&lkq=60',
      expect: ['고정 링크', '크랭크', '커플러(연결 링크)', '로커(흔들 링크)', '와이퍼 날']
    },
    {
      name: 'jansen',
      query: 'lk=jansen&lkq=0',
      expect: ['고정 링크', '크랭크', '링크', '삼각 링크', '바닥']
    }
  ]
};

// 엔진 원리는 한 행정을 돌고 멈춘다(캡처 시각에 따라 이미 멈춰 있을 수 있음) — 움직임 검사 전에 '연속 재생'을 누른다
async function playCycle(page) {
  const b = page.locator('button:visible', { hasText: '연속 재생' }).first();
  if ((await b.count()) > 0) {
    await b.click();
    await page.waitForTimeout(300);
  }
}

async function clickText(page, text) {
  const loc = page.locator('button:visible', { hasText: text }).first();
  if ((await loc.count()) === 0) throw new Error(`버튼 "${text}" 없음`);
  await loc.click();
  await page.waitForTimeout(700);
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});

// ───────── 페이지 안에서 도는 조사 함수 ─────────
function inspect() {
  const vis = (e) => {
    const b = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0;
  };
  const R = (e) => {
    const b = e.getBoundingClientRect();
    return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, w: b.width, h: b.height };
  };
  // 스크롤 영역(overflow)에 잘린 부분은 뺀 보이는 상자 — 가로 스크롤 줄 끝에서 반쯤 잘린 단계 버튼 같은 것
  const clip = (e) => {
    const r = R(e);
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const q = a.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { r.x0 = Math.max(r.x0, q.left); r.x1 = Math.min(r.x1, q.right); }
      if (cs.overflowY !== 'visible') { r.y0 = Math.max(r.y0, q.top); r.y1 = Math.min(r.y1, q.bottom); }
    }
    r.w = Math.max(0, r.x1 - r.x0);
    r.h = Math.max(0, r.y1 - r.y0);
    return r;
  };
  const btns = [...document.querySelectorAll('[data-lab="labels-toggle"]')];
  const tags = [...document.querySelectorAll('.lab-tag')].map((e) => {
    const l = e.querySelector('.lab-tag-l');
    const dot = e.querySelector('.lab-tag-dot');
    const shown = getComputedStyle(e).display !== 'none';
    return {
      key: e.dataset.key,
      text: l?.textContent ?? '',
      kind: e.dataset.kind,
      priority: Number(e.dataset.priority ?? 2),
      always: e.dataset.always === 'true',
      collapsed: e.dataset.collapsed === 'true',
      why: e.dataset.why ?? '',
      off: e.dataset.off ?? '',
      shown,
      textShown: shown,
      rect: l ? R(l) : null,
      dot: dot ? R(dot) : null
    };
  });
  const others = [...document.querySelectorAll('button, input, select, [role="tab"]')]
    .filter((e) => {
      if (!vis(e) || e.matches('[data-lab="labels-toggle"]') || e.closest('.lab-tags')) return false;
      // 스크롤 영역에 잘려 안 보이는 조작은 뺀다(가운데 점에서 자기 자신이 최상단이어야 함)
      const b = e.getBoundingClientRect();
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2)));
      return !!top && (top === e || e.contains(top));
    })
    .map((e) => ({ r: clip(e), name: (e.textContent || e.getAttribute('aria-label') || e.className || '').trim().slice(0, 24) }))
    .filter((o) => o.r.w > 1 && o.r.h > 1);
  const panels = [...document.querySelectorAll('body *')]
    .filter((e) => {
      if (e.closest('.lab-tags') || !vis(e)) return false;
      const cs = getComputedStyle(e);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      return bf && bf !== 'none' && cs.position !== 'static';
    })
    .map((e) => ({ r: R(e), name: e.className?.toString().slice(0, 30) }));
  return {
    iw: innerWidth,
    ih: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    btn: btns.map((b) => ({ r: R(b), pressed: b.getAttribute('aria-pressed'), title: b.title, inView: vis(b) })),
    tags,
    others,
    panels,
    layers: document.querySelectorAll('.lab-tags').length,
    mech: (() => {
      try {
        return JSON.parse(localStorage.getItem('mech3d-settings-v1') ?? '{}').showLabels;
      } catch {
        return null;
      }
    })()
  };
}

const hit = (a, b, pad = 0) => a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.y0 < b.y1 - pad && a.y1 > b.y0 + pad;

async function runScene(lab, sc, vp, theme, first) {
  const fails = [];
  const notes = [];
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = `${lab}-${sc.name}-${vp.name}-${theme}`;
  const shot = async (suffix) => {
    if (shots) await page.screenshot({ path: `${OUT}/${id}-${suffix}.png` });
  };
  try {
    const url = `${base}preview.html?mode=${lab}&theme=${theme}${sc.query ? '&' + sc.query : ''}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('[data-lab="labels-toggle"]', { timeout: 15000 });
    await page.waitForTimeout(2500);
    if (sc.setup) await sc.setup(page);
    await page.evaluate(() => document.querySelectorAll('.wind-sheet, [class*="-sheet"], [class*="-dock"], [class*="-panel"], [class*="-side"]').forEach((e) => { e.scrollTop = 0; }));
    await page.waitForTimeout(1200);

    // ① 토글 버튼
    let st = await page.evaluate(inspect);
    if (st.btn.length !== 1) fails.push(`토글 버튼 ${st.btn.length}개(1개여야 함)`);
    const b = st.btn[0];
    if (b) {
      if (b.r.w < 43.5 || b.r.h < 43.5) fails.push(`토글 버튼 크기 ${b.r.w.toFixed(0)}×${b.r.h.toFixed(0)} (44 이상이어야 함)`);
      if (b.r.x0 < -1 || b.r.y0 < -1 || b.r.x1 > st.iw + 1 || b.r.y1 > st.ih + 1) fails.push('토글 버튼이 화면 밖');
      for (const o of st.others) if (hit(b.r, o.r, 2)) fails.push(`토글 버튼이 "${o.name}"과 겹침`);
      if (b.pressed !== 'true') fails.push(`처음 aria-pressed=${b.pressed} (true여야 함)`);
    }
    if (st.layers !== 1) fails.push(`.lab-tags 레이어 ${st.layers}개`);
    if (st.overflow) fails.push('가로 스크롤 생김');

    // ② 켠 상태
    const tags = st.tags;
    const texts = tags.map((t) => t.text);
    notes.push(`이름표 ${tags.length}개(보임 ${tags.filter((t) => t.shown).length}, 접힘 ${tags.filter((t) => t.shown && t.collapsed).length}): ${tags.map((t) => `${t.key}=${t.text}${t.shown ? (t.collapsed ? '·' : '') : '✕' + (t.off ? `(${t.off})` : '')}`).join(' | ')}`);
    if (sc.expect) for (const e of sc.expect) if (!texts.some((t) => same(t, e))) fails.push(`글자 "${e}" 없음`);
    if (sc.absent) for (const k of sc.absent) if (tags.some((t) => t.key === k)) fails.push(`key "${k}" 는 이 보기에서 없어야 함`);
    if (sc.keys) for (const k of sc.keys) if (!tags.some((t) => t.key === k)) fails.push(`key "${k}" 없음`);
    // 기본 시점에서 화면(3D 영역) 안에 들어와야 하는 이름표 — 영역 밖(out)·홈 자리(home)·카메라 뒤(behind)면 실패
    if (sc.seen) for (const k of sc.seen) { const t = tags.find((q) => q.key === k); if (t && !t.shown) fails.push(`"${t.text}" 기준점이 기본 시점에서 안 보임(${t.off || '?'})`); }
    // 단계 이름표가 같은 기준점의 '늘 붙는 이름'을 대신한다(지시서 18 4-7) — '실린더(위가 열림)'처럼 괄호 설명이 붙어도 같은 부품
    const sameStage = (t, e) => same(t, e) || t.startsWith(e + '(');
    if (sc.sets && !sc.sets.some((set) => set.every((e) => texts.some((t) => sameStage(t, e))))) fails.push('기관별 "늘 붙는 이름" 묶음이 하나도 완전하지 않음');
    if (sc.count !== undefined && tags.filter((t) => !t.always).length !== sc.count) fails.push(`이름표 개수 ${tags.filter((t) => !t.always).length} (기대 ${sc.count})`);
    const open = tags.filter((t) => t.shown && !t.collapsed && t.rect);
    for (let i = 0; i < open.length; i++) {
      const a = open[i];
      if (a.rect.x0 < -1 || a.rect.y0 < -1 || a.rect.x1 > st.iw + 1 || a.rect.y1 > st.ih + 1) fails.push(`"${a.text}" 글자가 화면 밖`);
      if (a.rect.x0 < 240 && a.rect.y0 < 90) fails.push(`"${a.text}" 글자가 좌상단 홈 자리`);
      for (let j = i + 1; j < open.length; j++) if (hit(a.rect, open[j].rect, 0.5)) fails.push(`"${a.text}"와 "${open[j].text}" 글자 상자 겹침`);
      for (const o of st.others) if (hit(a.rect, o.r, 2)) fails.push(`"${a.text}"가 "${o.name}"을 가림`);
      for (const bb of st.btn) if (hit(a.rect, bb.r, 2)) fails.push(`"${a.text}"가 이름표 버튼을 가림`);
      for (const p of st.panels) if (hit(a.rect, p.r, 3)) fails.push(`"${a.text}"가 패널(${p.name})을 가림`);
    }
    // P1 은 접지 않는다 — 단, 지시서 18 3-2 ③ "1끼리 겹칠 때만 뒤의 것을 접는다". 헬퍼가 사유를 data-why 로 남긴다.
    // why='p1' 이면 실제로 가까이에 펼쳐진 P1 글자가 있는지(점에서 닿을 수 있는 거리) 다시 확인한다.
    const openP1 = open.filter((t) => t.priority === 1);
    for (const t of tags) {
      if (!(t.shown && t.collapsed && t.priority === 1 && !t.always)) continue;
      const cx = t.dot.x0 + t.dot.w / 2;
      const cy = t.dot.y0 + t.dot.h / 2;
      const reach = (t.rect?.w ?? 80) + 3 * ((t.rect?.h ?? 20) + 8) + 18;
      const near = openP1.some((o) => o.rect.x1 > cx - reach && o.rect.x0 < cx + reach && o.rect.y1 > cy - reach && o.rect.y0 < cy + reach);
      if (t.why === 'p1' && near) notes.push(`P1 "${t.text}" 접힘(다른 P1 과 겹침 — 규칙대로)`);
      else fails.push(`P1 "${t.text}"가 접힘(사유 ${t.why || '없음'}${t.why === 'p1' ? ', 근처에 펼친 P1 없음' : ''})`);
    }
    await shot('on0');

    // ⑤ 움직임
    if (sc.movers?.length) {
      const pos = (s) => Object.fromEntries(s.tags.filter((t) => t.shown && t.dot).map((t) => [t.text, [t.dot.x0, t.dot.y0]]));
      await page.waitForTimeout(500);
      const s1 = await page.evaluate(inspect);
      if (sc.drive) await sc.drive(page, s1);
      await page.waitForTimeout(500);
      const s2 = await page.evaluate(inspect);
      const p1 = pos(s1);
      const p2 = pos(s2);
      const seen = sc.movers.filter((m) => Object.keys(p1).some((k) => same(k, m)) && Object.keys(p2).some((k) => same(k, m)));
      if (seen.length === 0) notes.push('움직임: 보이는 대상 이름표 없음(건너뜀)');
      else {
        const moved = seen.filter((m) => {
          const k1 = Object.keys(p1).find((k) => same(k, m));
          const k2 = Object.keys(p2).find((k) => same(k, m));
          return Math.hypot(p1[k1][0] - p2[k2][0], p1[k1][1] - p2[k2][1]) > 0.8;
        });
        if (moved.length === 0) fails.push(`움직이는 부품(${seen.join(', ')}) 이름표 좌표가 0.5초 사이 안 바뀜(재생 중이 아닐 수도 있음)`);
        else notes.push(`움직임 확인: ${moved.join(', ')}`);
      }
    }

    // ⑥ 접힌 점 누르기(좁은 화면에서 접힌 것이 있을 때)
    // 움직임 검사(손잡이 끌기 등) 뒤라 점 자리가 바뀌었을 수 있다 — 새로 읽는다
    const col = (await page.evaluate(inspect)).tags.find((t) => t.shown && t.collapsed && t.dot);
    if (col) {
      await page.mouse.click(col.dot.x0 + col.dot.w / 2, col.dot.y0 + col.dot.h / 2);
      await page.waitForTimeout(450);
      const s3 = await page.evaluate(inspect);
      const after = s3.tags.find((t) => t.key === col.key);
      if (!after || after.collapsed) fails.push(`접힌 점 "${col.text}"을 눌러도 펼쳐지지 않음`);
      else notes.push(`접힌 점 펼침 확인: ${col.text}`);
      await shot('pinned');
    } else notes.push('접힌 이름표 없음(펼치기 시험 건너뜀)');

    // ③ 끄기
    await page.locator('[data-lab="labels-toggle"]').first().click();
    await page.waitForTimeout(700);
    st = await page.evaluate(inspect);
    const stillOn = st.tags.filter((t) => t.shown && !t.always);
    if (stillOn.length) fails.push(`끈 뒤에도 이름표 ${stillOn.length}개 보임: ${stillOn.map((t) => t.text).join(', ')}`);
    if (st.btn[0]?.pressed !== 'false') fails.push(`끈 뒤 aria-pressed=${st.btn[0]?.pressed}`);
    if (st.mech !== false) fails.push(`저장값 showLabels=${st.mech} (false여야 함)`);
    await shot('off');

    // ④ 새로고침
    if (first) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-lab="labels-toggle"]', { timeout: 15000 });
      await page.waitForTimeout(2200);
      st = await page.evaluate(inspect);
      const on2 = st.tags.filter((t) => t.shown && !t.always);
      if (on2.length) fails.push(`새로고침 뒤 꺼진 상태가 유지되지 않음(이름표 ${on2.length}개)`);
      if (st.btn[0]?.pressed !== 'false') fails.push(`새로고침 뒤 aria-pressed=${st.btn[0]?.pressed}`);
      await page.locator('[data-lab="labels-toggle"]').first().click();
      await page.waitForTimeout(900);
      st = await page.evaluate(inspect);
      if (!st.tags.some((t) => t.shown)) fails.push('다시 켜도 이름표가 안 보임');
      if (st.overflow) fails.push('(켠 뒤) 가로 스크롤 생김');
      await shot('on');
    }
  } catch (e) {
    await ctx.close();
    throw e;
  }
  if (errors.length) fails.push(`콘솔 에러: ${[...new Set(errors)].slice(0, 3).join(' / ')}`);
  await ctx.close();
  return { id, fails, notes };
}

const allFails = [];
for (const lab of labs) {
  const scenes = SCENES[lab];
  if (!scenes) {
    console.log(`알 수 없는 실험: ${lab}`);
    process.exitCode = 1;
    continue;
  }
  for (const vp of VPS) {
    for (const theme of THEMES) {
      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        let res = null;
        let lastErr = '';
        for (let attempt = 0; attempt < 3 && (!res || res.fails.length); attempt++) {
          try {
            res = await runScene(lab, sc, vp, theme, i === 0);
          } catch (e) {
            lastErr = String(e).split('\n')[0].slice(0, 200);
          }
        }
        if (!res) {
          console.log(`✗ ${lab}-${sc.name}-${vp.name}-${theme}: 실행 실패 — ${lastErr}`);
          allFails.push(`${lab}-${sc.name}-${vp.name}-${theme}: 실행 실패 — ${lastErr}`);
          continue;
        }
        console.log(`${res.fails.length ? '✗' : '✓'} ${res.id}`);
        for (const n of res.notes) console.log(`    · ${n}`);
        for (const f of res.fails) {
          console.log(`    ✗ ${f}`);
          allFails.push(`${res.id}: ${f}`);
        }
      }
    }
  }
}
await browser.close();
if (allFails.length) {
  console.log(`\n실패 ${allFails.length}건:\n${allFails.map((f) => ' - ' + f).join('\n')}`);
  process.exit(1);
}
console.log('\n18-labels: ALL PASS');
