// 링크 장치 기구학 수치 검사 — 브라우저 없이 `node scripts/17-link-check.mjs`
// .ts 를 Node 가 직접 읽는다(Node v24 의 타입 지우기). 확장자 없는 import('./solver')를 위해 아래 작은 해석 훅을 붙인다.
import { register } from 'node:module';

async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && !/[.][a-z]+$/.test(spec)) {
    try {
      return await next(spec + '.ts', ctx);
    } catch (e) {
      /* 확장자가 이미 있거나 .ts 가 아님 — 원래대로 */
    }
  }
  return next(spec, ctx);
}
register('data:text/javascript,' + encodeURIComponent('export ' + resolve.toString()));

const S = await import('../src/labs/linkage/solver.ts');
const M = await import('../src/labs/linkage/mechanisms.ts');
const X = await import('../src/labs/linkage/metrics.ts');

const D = 180 / Math.PI;
const R = Math.PI / 180;
const STEP = 0.5 * R;

// ───────────── 결과 표 ─────────────
const rows = [];
function check(group, name, ok, measured, limit) {
  rows.push({ group, name, ok: !!ok, measured, limit });
}
const f3 = (v) => (typeof v === 'number' ? v.toFixed(3) : String(v));
function near(group, name, got, want, tol) {
  const e = Math.abs(got - want);
  check(group, name, e <= tol, `${f3(got)} (기대 ${f3(want)})`, `오차 ${e.toExponential(1)} ≤ ${tol}`);
}
function nearPt(group, name, got, want, tol) {
  const e = Math.hypot(got[0] - want[0], got[1] - want[1]);
  check(group, name, e <= tol, `(${got.map(f3).join(', ')}) (기대 ${want.join(', ')})`, `거리 ${e.toExponential(1)} ≤ ${tol}`);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const defs = M.MECHANISMS;
const byId = (id) => M.getMechanism(id);

// ───────────── 공통 도구 ─────────────
function seedOf(def) {
  const sp = def.input;
  if (sp.kind === 'point') return S.solve(def, S.pathPoint(sp.paths[0].pts, 0), null);
  return S.solve(def, sp.q0, null);
}
/** q0 에서 출발해 연속 이동(advance)으로 도달한 자세 */
function reach(def, q) {
  return S.advance(def, seedOf(def), q);
}
const deg = (p, from, to) => Math.atan2(p.pts[to][1] - p.pts[from][1], p.pts[to][0] - p.pts[from][0]) * D;

/** 선분(길이가 변하면 안 되는 것)들: bars, plates, 그리고 구속 조건 */
function constraints(def) {
  const out = [];
  for (const b of def.bars) out.push({ kind: 'len', a: b.a, b: b.b });
  for (const pl of def.plates ?? []) {
    out.push({ kind: 'len', a: pl.pts[0], b: pl.pts[1] }, { kind: 'len', a: pl.pts[1], b: pl.pts[2] }, { kind: 'len', a: pl.pts[0], b: pl.pts[2] });
  }
  for (const s of def.steps) {
    if (s.k === 'rr') out.push({ kind: 'rr', id: s.id, a: s.a, ra: s.ra, b: s.b, rb: s.rb });
    if (s.k === 'rp') out.push({ kind: 'rp', id: s.id, a: s.a, r: s.r });
    if (s.k === 'rigid') out.push({ kind: 'rigid', id: s.id, a: s.a, d: Math.hypot(s.u, s.v) });
  }
  return out;
}

/** 자세 목록의 막대 길이 변화 최댓값, 원–원 반지름 오차 최댓값, 프레임 사이 최대 이동 */
function audit(def, poses) {
  const cs = constraints(def);
  const first = poses[0];
  let lenVar = 0;
  let rad = 0;
  let jump = 0;
  const len0 = cs.map((c) => (c.kind === 'len' ? dist(first.pts[c.a], first.pts[c.b]) : 0));
  poses.forEach((p, i) => {
    cs.forEach((c, k) => {
      if (c.kind === 'len') lenVar = Math.max(lenVar, Math.abs(dist(p.pts[c.a], p.pts[c.b]) - len0[k]));
      else if (c.kind === 'rr') rad = Math.max(rad, Math.abs(dist(p.pts[c.a], p.pts[c.id]) - c.ra), Math.abs(dist(p.pts[c.b], p.pts[c.id]) - c.rb));
      else if (c.kind === 'rp') rad = Math.max(rad, Math.abs(dist(p.pts[c.a], p.pts[c.id]) - c.r));
      else rad = Math.max(rad, Math.abs(dist(p.pts[c.a], p.pts[c.id]) - c.d));
    });
    if (i > 0) {
      const q = poses[i - 1];
      for (const id in p.pts) jump = Math.max(jump, dist(p.pts[id], q.pts[id]));
    }
  });
  return { lenVar, rad, jump };
}
function sizeOf(sw) {
  const b = sw.bounds;
  return Math.max(b.maxX - b.minX, b.maxY - b.minY, 1e-9);
}

/** 한 입력 구간을 0.5° 간격(슬라이드 200등분)으로, q0 에서 양쪽으로 이어서 푼 자세 목록과 입력값 */
function walkGrid(def) {
  const sp = def.input;
  const seed = seedOf(def);
  const res = { poses: [seed], qs: [sp.q0 ?? 0], failed: !seed.ok };
  const run = (qList) => {
    const out = [];
    let prev = seed;
    let prev2 = null;
    for (const q of qList) {
      const p = S.solve(def, q, prev, prev2);
      if (!p.ok) {
        res.failed = true;
        break;
      }
      out.push(p);
      prev2 = prev;
      prev = p;
    }
    return out;
  };
  if (sp.kind === 'rotate') {
    const n = Math.round(TWO(1) / STEP);
    const fw = run(Array.from({ length: n - 1 }, (_, i) => sp.q0 + (i + 1) * STEP));
    res.poses = [seed, ...fw];
    res.qs = res.poses.map((_, i) => sp.q0 + i * STEP);
    res.step = STEP;
  } else {
    const step = sp.kind === 'slide' ? (sp.max - sp.min) / 200 : STEP;
    const nUp = Math.floor((sp.max - sp.q0) / step + 1e-9);
    const nDn = Math.floor((sp.q0 - sp.min) / step + 1e-9);
    const up = run(Array.from({ length: nUp }, (_, i) => sp.q0 + (i + 1) * step));
    const dn = run(Array.from({ length: nDn }, (_, i) => sp.q0 - (i + 1) * step));
    res.poses = [...dn.reverse(), seed, ...up];
    res.qs = res.poses.map((_, i) => sp.q0 + (i - dn.length) * step);
    res.step = step;
    res.i0 = dn.length;
  }
  return res;
}
function TWO(k) {
  return Math.PI * 2 * k;
}

// ───────────── 1. 전 구간: 길이·반지름·가지 뒤집힘 ─────────────
const grids = new Map();
for (const def of defs) {
  const g = def.input.kind === 'point' ? null : walkGrid(def);
  const groups = [];
  if (g) {
    grids.set(def.id, g);
    groups.push({ tag: def.input.kind === 'rotate' ? '한 바퀴 0.5°' : def.input.kind === 'slide' ? '왕복 200등분' : '왕복 0.5°', poses: g.poses, failed: g.failed });
  } else {
    def.input.paths.forEach((path) => {
      const poses = [];
      let prev = null;
      let prev2 = null;
      let failed = false;
      for (let i = 0; i < 200; i++) {
        const p = S.solve(def, S.pathPoint(path.pts, i / 200), prev, prev2);
        if (!p.ok) {
          failed = true;
          break;
        }
        poses.push(p);
        prev2 = prev;
        prev = p;
      }
      groups.push({ tag: `도형 ${path.name} 200등분`, poses, failed });
    });
  }
  const sw = S.sweep(def);
  const scale = sizeOf(sw);
  for (const gp of groups) {
    const a = audit(def, gp.poses);
    check('1 전 구간', `${def.id} · ${gp.tag} · 모두 조립됨(${gp.poses.length}개)`, !gp.failed && gp.poses.length > 100, gp.failed ? '막힘 있음' : `${gp.poses.length}개`, '전부 ok');
    check('1 전 구간', `${def.id} · ${gp.tag} · 막대 길이 변화`, a.lenVar <= 1e-6, a.lenVar.toExponential(2), '≤ 1e-6');
    check('1 전 구간', `${def.id} · ${gp.tag} · 반지름·강체 오차`, a.rad <= 1e-9, a.rad.toExponential(2), '≤ 1e-9');
    check('1 전 구간', `${def.id} · ${gp.tag} · 가지 뒤집힘 없음`, a.jump <= 0.05 * scale, `최대 이동 ${a.jump.toFixed(4)} / 크기 ${scale.toFixed(1)}`, `≤ 크기의 5%`);
  }
  check('1 전 구간', `${def.id} · sweep 표본·full`, sw.poses.length > 0 && sw.poses.every((p) => p.ok), `${sw.poses.length}개, full=${sw.full}`, '표본 있음, 전부 ok');
}

// ───────────── 2. 정방향·역방향 3바퀴(왕복 3번), 7° advance ─────────────
for (const def of defs) {
  const sp = def.input;
  if (sp.kind === 'point') continue;
  const g = grids.get(def.id);
  const base = g.poses;
  const idxOf = (q) => {
    const k = Math.round((q - sp.q0) / g.step);
    return sp.kind === 'rotate' ? ((k % base.length) + base.length) % base.length : k + g.i0;
  };
  const seed = seedOf(def);
  const maxDiff = (a, b) => {
    let m = 0;
    for (const id in a.pts) m = Math.max(m, dist(a.pts[id], b.pts[id]));
    return m;
  };
  // 정방향 / 역방향
  for (const dir of [1, -1]) {
    let prev = seed;
    let prev2 = null;
    let worst = 0;
    let bad = 0;
    if (sp.kind === 'rotate') {
      for (let i = 1; i <= 3 * base.length; i++) {
        const q = sp.q0 + dir * i * STEP;
        const p = S.solve(def, q, prev, prev2);
        if (!p.ok) { bad++; break; }
        worst = Math.max(worst, maxDiff(p, base[idxOf(q)]));
        prev2 = prev;
        prev = p;
      }
    } else {
      // 왕복 3번: q0 → 끝 → 반대 끝 → ... (삼각파)
      const lo = sp.min;
      const hi = sp.max;
      const stepN = g.step;
      let q = sp.q0;
      let d = dir;
      for (let trips = 0; trips < 6; trips++) {
        const target = d > 0 ? hi : lo;
        const n = Math.floor(Math.abs(target - q) / stepN + 1e-9);
        for (let i = 1; i <= n; i++) {
          const qq = q + d * i * stepN;
          const p = S.solve(def, qq, prev, prev2);
          if (!p.ok) { bad++; break; }
          worst = Math.max(worst, maxDiff(p, base[idxOf(qq)]));
          prev2 = prev;
          prev = p;
        }
        q = q + d * n * stepN;
        d = -d;
      }
    }
    check('2 반복·advance', `${def.id} · ${dir > 0 ? '정방향' : '역방향'} ${sp.kind === 'rotate' ? '3바퀴' : '왕복 3번'} 같은 자리 같은 자세`, bad === 0 && worst <= 1e-6, `막힘 ${bad}, 최대 차이 ${worst.toExponential(2)}`, '≤ 1e-6');
  }
  // 큰 간격 advance (회전/스윙 7°, 슬라이드 범위의 1/20)
  {
    const big = sp.kind === 'slide' ? (sp.max - sp.min) / 20 : 7 * R;
    let cur = seed;
    let prev2 = null;
    let worst = 0;
    let bad = 0;
    let n = 0;
    const loops = sp.kind === 'rotate' ? Math.round(TWO(3) / big) : 0;
    if (sp.kind === 'rotate') {
      for (let i = 1; i <= loops; i++) {
        const q = sp.q0 + i * big;
        const p = S.advance(def, cur, q, prev2);
        if (!p.ok) { bad++; break; }
        worst = Math.max(worst, maxDiff(p, base[idxOf(q)]));
        prev2 = cur;
        cur = p;
        n++;
      }
    } else {
      let q = sp.q0;
      let d = 1;
      for (let trips = 0; trips < 4; trips++) {
        const target = d > 0 ? sp.max : sp.min;
        const k = Math.floor(Math.abs(target - q) / big + 1e-9);
        for (let i = 1; i <= k; i++) {
          const qq = q + d * i * big;
          const p = S.advance(def, cur, qq, prev2);
          if (!p.ok) { bad++; break; }
          worst = Math.max(worst, maxDiff(p, base[idxOf(qq)]));
          prev2 = cur;
          cur = p;
          n++;
        }
        q = q + d * k * big;
        d = -d;
      }
    }
    check('2 반복·advance', `${def.id} · 큰 간격 advance(${sp.kind === 'slide' ? '범위의 1/20' : '7°'}) ${n}번 = 0.5° 연속 풀이`, bad === 0 && n > 0 && worst <= 1e-6, `막힘 ${bad}, 최대 차이 ${worst.toExponential(2)}`, '≤ 1e-6');
  }
}
// 팬터그래프: 도형 3개 3바퀴 + 7칸 간격 advance, 모든 자세 Q = 2P
{
  const def = byId('pantograph');
  let worstQ = 0;
  let worstRound = 0;
  let worstAdv = 0;
  let bad = 0;
  def.input.paths.forEach((path) => {
    const base = [];
    let prev = null;
    let prev2 = null;
    for (let i = 0; i < 200; i++) {
      const p = S.solve(def, S.pathPoint(path.pts, i / 200), prev, prev2);
      if (!p.ok) { bad++; return; }
      base.push(p);
      prev2 = prev;
      prev = p;
    }
    for (const p of base) worstQ = Math.max(worstQ, dist(p.pts.Q, [2 * p.pts.P[0], 2 * p.pts.P[1]]));
    // 3바퀴(역방향 포함)
    for (const dir of [1, -1]) {
      let a = base[0];
      let b = null;
      for (let i = 1; i <= 600; i++) {
        const k = (((dir * i) % 200) + 200) % 200;
        const p = S.solve(def, S.pathPoint(path.pts, k / 200), a, b);
        if (!p.ok) { bad++; break; }
        worstRound = Math.max(worstRound, dist(p.pts.A, base[k].pts.A), dist(p.pts.D, base[k].pts.D));
        b = a;
        a = p;
      }
    }
    // 7칸 간격 advance
    let cur = base[0];
    let b2 = null;
    for (let i = 7; i <= 600; i += 7) {
      const k = i % 200;
      const p = S.advance(def, cur, S.pathPoint(path.pts, k / 200), b2);
      if (!p.ok) { bad++; break; }
      worstAdv = Math.max(worstAdv, dist(p.pts.A, base[k].pts.A), dist(p.pts.D, base[k].pts.D));
      b2 = cur;
      cur = p;
    }
  });
  check('2 반복·advance', 'pantograph · 모든 자세에서 Q = 2P', bad === 0 && worstQ <= 1e-9, worstQ.toExponential(2), '≤ 1e-9');
  check('2 반복·advance', 'pantograph · 도형 3개 정·역 3바퀴 같은 자세', bad === 0 && worstRound <= 1e-6, worstRound.toExponential(2), '≤ 1e-6');
  check('2 반복·advance', 'pantograph · 7칸 간격 advance = 연속 풀이', bad === 0 && worstAdv <= 1e-6, worstAdv.toExponential(2), '≤ 1e-6');
}

// ───────────── 3. 6절 검산값 ─────────────
const ANG = 0.05;
const LEN = 0.005;
const JAN = 0.1;
{
  // 6-1 크랭크-로커
  const def = byId('crank-rocker');
  const g = 'crank-rocker';
  const sw = S.sweep(def);
  const psi = sw.poses.map((p) => Math.atan2(p.pts.B[1], p.pts.B[0] - 10) * D);
  const mu = sw.poses.map((p) => {
    const aO4 = dist(p.pts.A, [10, 0]);
    return Math.acos((81 + 49 - aO4 * aO4) / (2 * 9 * 7)) * D;
  });
  near(g, 'ψ 최소', Math.min(...psi), 92.05, ANG);
  near(g, 'ψ 최대', Math.max(...psi), 143.82, ANG);
  near(g, '흔들리는 범위', Math.max(...psi) - Math.min(...psi), 51.77, ANG);
  near(g, '전달각 최소', Math.min(...mu), 49.99, ANG);
  near(g, '전달각 최대', Math.max(...mu), 108.03, ANG);
  for (const [th, B, ps, mm] of [[60, [9.366, 6.971], 95.2, 66.12], [240, [4.399, 4.199], 143.14, 94.1]]) {
    const p = reach(def, th * R);
    nearPt(g, `θ=${th}° B`, p.pts.B, B, LEN);
    near(g, `θ=${th}° ψ`, deg(p, 'O4', 'B'), ps, ANG);
    const aO4 = dist(p.pts.A, [10, 0]);
    near(g, `θ=${th}° 전달각`, Math.acos((130 - aO4 * aO4) / 126) * D, mm, ANG);
  }
  // 로커가 한쪽으로 가는 데 걸리는 크랭크 각(0.01° 간격으로 촘촘히)
  let pMax = -1e9, pMin = 1e9, tMax = 0, tMin = 0;
  {
    let prev = seedOf(def), prev2 = null;
    for (let i = 0; i <= 36000; i++) {
      const th = 60 * R + i * 0.01 * R;
      const p = S.solve(def, th, prev, prev2);
      const ps = deg(p, 'O4', 'B');
      if (ps > pMax) { pMax = ps; tMax = th * D; }
      if (ps < pMin) { pMin = ps; tMin = th * D; }
      prev2 = prev; prev = p;
    }
  }
  const fwd = (((tMax - tMin) % 360) + 360) % 360;
  const a1 = Math.max(fwd, 360 - fwd);
  near(g, '로커가 한쪽으로 가는 데 크랭크', a1, 187.87, 0.05);
  near(g, '로커가 돌아오는 데 크랭크', 360 - a1, 172.13, 0.05);
}
{
  // 6-2 평행 크랭크
  const def = byId('parallel');
  const g = 'parallel';
  const p180 = reach(def, Math.PI);
  nearPt(g, 'θ=180° A', p180.pts.A, [-3, 0], LEN);
  nearPt(g, 'θ=180° B (네 조인트가 한 줄)', p180.pts.B, [5, 0], LEN);
  const p200 = reach(def, 200 * R);
  nearPt(g, 'θ=200° B = A + (8,0)', p200.pts.B, [p200.pts.A[0] + 8, p200.pts.A[1]], 1e-6);
  // 3바퀴 내내 |B − A − (8,0)|
  for (const dir of [1, -1]) {
    let prev = seedOf(def), prev2 = null, worst = 0;
    for (let i = 1; i <= 3 * 720; i++) {
      const p = S.solve(def, def.input.q0 + dir * i * STEP, prev, prev2);
      worst = Math.max(worst, Math.hypot(p.pts.B[0] - p.pts.A[0] - 8, p.pts.B[1] - p.pts.A[1]));
      prev2 = prev; prev = p;
    }
    check(g, `3바퀴 ${dir > 0 ? '정방향' : '역방향'} 내내 |B − A − (8,0)|`, worst < 1e-6, worst.toExponential(2), '< 1e-6');
  }
  let worst = 0, cur = seedOf(def), b2 = null;
  for (let i = 1; i <= Math.round(TWO(3) / (7 * R)); i++) {
    const p = S.advance(def, cur, def.input.q0 + i * 7 * R, b2);
    worst = Math.max(worst, Math.hypot(p.pts.B[0] - p.pts.A[0] - 8, p.pts.B[1] - p.pts.A[1]));
    b2 = cur; cur = p;
  }
  check(g, '7° advance 3바퀴 내내 |B − A − (8,0)|', worst < 1e-6, worst.toExponential(2), '< 1e-6');
  // M 자취는 중심 (4,0) 반지름 3 인 원
  const sw = S.sweep(def);
  const dev = Math.max(...sw.poses.map((p) => Math.abs(dist(p.pts.M, [4, 0]) - 3)));
  check(g, 'M 자취 = 중심 (4,0) 반지름 3 인 원', dev < 1e-9, dev.toExponential(2), '< 1e-9');
}
{
  // 6-3 조향
  const def = byId('steering');
  const g = 'steering';
  const t0 = -90 + Math.asin(0.8 / 3) * D;
  near(g, '중립 θ0', t0, -74.53, 0.005);
  const want = { 10: 9.45, 20: 17.8, 30: 24.96, '-10': -10.62, '-20': -22.88, '-30': -38.68 };
  for (const dL of [10, 20, 30, -10, -20, -30]) {
    const p = reach(def, (t0 + dL) * R);
    const dR = deg(p, 'O4', 'B') - (-180 - t0);
    near(g, `δL=${dL > 0 ? '+' : ''}${dL}° → δR`, dR, want[dL], ANG);
  }
  // 조립 가능한 한계 ±110.4° (A–O4 가 b+c = 11.4 일 때)
  const rg = S.inputRange(3, 8.4, 3, 10);
  near(g, '조립 한계 각(θ 절댓값)', rg.max * D, Math.acos((9 + 100 - 11.4 * 11.4) / 60) * D, 0.05);
}
{
  // 6-4 슬라이더-크랭크
  const def = byId('slider-crank');
  const g = 'slider-crank';
  for (const [th, x, s] of [[0, 12, 6], [90, 8.485, 2.485], [180, 6, 0]]) {
    const p = reach(def, th * R);
    near(g, `θ=${th}° 피스톤 x`, p.pts.C[0], x, LEN);
    near(g, `θ=${th}° s = x − (l − r)`, p.pts.C[0] - 6, s, LEN);
  }
  const sw = S.sweep(def);
  near(g, '연결봉 기울기 최대', Math.max(...sw.poses.map((p) => Math.abs(Math.atan2(p.pts.A[1] - p.pts.C[1], p.pts.C[0] - p.pts.A[0]) * D))), 19.47, ANG);
  const xs = sw.poses.map((p) => p.pts.C[0]);
  near(g, '행정', Math.max(...xs) - Math.min(...xs), 6, LEN);
  const p90 = reach(def, 90 * R);
  check(g, 's(90°) 가 3 이 아니라 2.485(위아래 비대칭)', Math.abs(p90.pts.C[0] - 6 - 3) > 0.4, f3(p90.pts.C[0] - 6), '3 과 다름');
}
{
  // 6-5 빠른 귀환
  const def = byId('quick-return');
  const g = 'quick-return';
  const sw = S.sweep(def);
  const xs = sw.poses.map((p) => p.pts.R[0]);
  near(g, '램 x 최소', Math.min(...xs), -4.33, LEN);
  near(g, '램 x 최대', Math.max(...xs), 8.67, LEN);
  near(g, '행정', Math.max(...xs) - Math.min(...xs), 13, LEN);
  near(g, 'θ=210° 램', reach(def, 210 * R).pts.R[0], -4.33, LEN);
  near(g, 'θ=330° 램', reach(def, 330 * R).pts.R[0], 8.67, LEN);
  for (const th of [90, 270]) {
    const p = reach(def, th * R);
    nearPt(g, `θ=${th}° B`, p.pts.B, [0, 13], LEN);
    near(g, `θ=${th}° 램`, p.pts.R[0], 2.449, LEN);
  }
  // 반시계로 돌 때 램이 −x 로 가는(천천히) 각도 / +x 로 가는(빨리) 각도
  const n = sw.poses.length;
  let slow = 0, fast = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[(i + 1) % n] - xs[i];
    if (dx < 0) slow++; else fast++;
  }
  near(g, '천천히(−x) 구간 크랭크 각', (slow * 360) / n, 240, 0.6);
  near(g, '빨리(+x) 구간 크랭크 각', (fast * 360) / n, 120, 0.6);
  const beta = Math.asin(3 / 6) * D;
  near(g, '시간 비 (180°+2β) : (180°−2β)', (180 + 2 * beta) / (180 - 2 * beta), 2, 1e-9);
  // 지렛대의 좌우 끝 ±30° (지렛대 각 = atan2(B))
  const la = sw.poses.map((p) => Math.atan2(p.pts.B[1], p.pts.B[0]) * D);
  near(g, '지렛대 왼쪽 끝(90°에서 +30°)', Math.max(...la), 120, 0.05);
  near(g, '지렛대 오른쪽 끝(90°에서 −30°)', Math.min(...la), 60, 0.05);
}
{
  // 6-6 체비쇼프
  const def = byId('chebyshev');
  const g = 'chebyshev';
  const p0 = reach(def, 53.13010235415598 * R);
  nearPt(g, 'q0 A', p0.pts.A, [3, 4], LEN);
  nearPt(g, 'q0 B', p0.pts.B, [1, 4], LEN);
  nearPt(g, 'q0 P', p0.pts.P, [2, 4], LEN);
  nearPt(g, 'θ=45° P', reach(def, 45 * R).pts.P, [2.653, 4.005], LEN);
  nearPt(g, 'θ=85° P', reach(def, 85 * R).pts.P, [0.227, 4.003], LEN);
  const sw = S.sweep(def);
  const zone = sw.poses.filter((p, i) => sw.qs[i] * D >= 40 - 1e-6 && sw.qs[i] * D <= 90 + 1e-6);
  const px = zone.map((p) => p.pts.P[0]);
  const py = zone.map((p) => p.pts.P[1]);
  near(g, 'θ 40°~90° x 최소', Math.min(...px), 0.0, 0.01);
  near(g, 'θ 40°~90° x 최대', Math.max(...px), 3.22, 0.01);
  near(g, 'θ 40°~90° y 최소', Math.min(...py), 4.0, 0.005);
  near(g, 'θ 40°~90° y 최대', Math.max(...py), 4.01, 0.005);
  near(g, 'θ 40°~90° 최대 벗어남', Math.max(...py.map((y) => Math.abs(y - 4))), 0.01, 0.005);
  near(g, 'θ=100° y', reach(def, 100 * R).pts.P[1], 4.07, 0.01);
  // 두 흔들 링크가 X자로 엇갈림(서로 다른 layer)
  const lay = def.bars.filter((b) => b.a === 'O2' && b.b === 'A' || b.a === 'O4' && b.b === 'B').map((b) => b.layer);
  check(g, '엇갈린 두 흔들 링크가 서로 다른 층', lay.length === 2 && lay[0] !== lay[1], lay.join(', '), '층이 다름');
}
{
  // 6-7 와트
  const def = byId('watt');
  const g = 'watt';
  const p0 = reach(def, 0);
  nearPt(g, 'θ=0° A', p0.pts.A, [6, 0], LEN);
  nearPt(g, 'θ=0° B', p0.pts.B, [6, 3], LEN);
  nearPt(g, 'θ=0° P', p0.pts.P, [6, 1.5], LEN);
  nearPt(g, 'θ=−15° P', reach(def, -15 * R).pts.P, [6.004, -0.068], LEN);
  nearPt(g, 'θ=+15° P', reach(def, 15 * R).pts.P, [5.996, 3.039], LEN);
  nearPt(g, 'θ=+26° P', reach(def, 26 * R).pts.P, [5.95, 4.023], LEN);
  nearPt(g, 'θ=−26° P', reach(def, -26 * R).pts.P, [6.091, -1.303], LEN);
  const sw = S.sweep(def);
  const dev = Math.max(...sw.poses.filter((p) => Math.abs(p.pts.P[1] - 1.5) <= 2).map((p) => Math.abs(p.pts.P[0] - 6)));
  near(g, '|y−1.5| ≤ 2 구간 최대 |x−6|', dev, 0.014, 0.003);
  near(g, '받침 사이 거리', Math.hypot(12, 3), 12.37, 0.005);
}
{
  // 6-8 팬터그래프
  const def = byId('pantograph');
  const g = 'pantograph';
  const p = reach(def, [4, -3.5]);
  nearPt(g, 'P=(4,−3.5) A', p.pts.A, [3.969, 0.5], LEN);
  nearPt(g, 'P=(4,−3.5) E', p.pts.E, [7.937, 1.0], LEN);
  nearPt(g, 'P=(4,−3.5) Q', p.pts.Q, [8, -7], LEN);
  const sw = S.sweep(def);
  check(g, 'sweep 첫 도형 200표본·full', sw.poses.length === 720 && sw.full, `${sw.poses.length}개, full=${sw.full}`, '720개, full');
}
{
  // 6-9 얀센
  const def = byId('jansen');
  const g = 'jansen';
  const exp = {
    0: { M: [53, 7.8], U: [13.99, 39.07], W: [11.05, -37.72], L: [-36.79, 15.94], K: [-21.23, -20.25], F: [-5.16, -83.96] },
    90: { F: [30.31, -82.59] },
    180: { F: [4.27, -65.72] },
    270: { F: [-32.67, -81.84] },
  };
  for (const th of [0, 90, 180, 270]) {
    const p = reach(def, th * R);
    for (const id in exp[th]) nearPt(g, `θ=${th}° ${id}`, p.pts[id], exp[th][id], JAN);
  }
  const sw = S.sweep(def);
  check(g, '한 바퀴 내내 조립 가능', sw.full && sw.poses.length === 720, `full=${sw.full}, ${sw.poses.length}개`, 'full');
  const ys = sw.poses.map((p) => p.pts.F[1]);
  const xs = sw.poses.map((p) => p.pts.F[0]);
  near(g, '발끝 y 최소', Math.min(...ys), -84.03, JAN);
  near(g, '발끝 y 최대', Math.max(...ys), -61.58, JAN);
  near(g, '발 드는 높이', Math.max(...ys) - Math.min(...ys), 22.4, JAN);
  near(g, '발끝 x 최소', Math.min(...xs), -33.5, JAN);
  near(g, '발끝 x 최대', Math.max(...xs), 34.4, JAN);
  const floor = def.decor.find((d) => d.kind === 'floor').size;
  near(g, '바닥 선 y = 발끝 최저', floor, Math.min(...ys), 0.05);
  // 땅에 닿은 구간(높이 ≤ 1): 286.5° → 81° 약 155°, 43%, 보폭 약 57.3
  const minY = Math.min(...ys);
  const on = ys.map((y) => y - minY <= 1);
  const n = on.length;
  let start = -1, len = 0;
  for (let s = 0; s < n; s++) {
    if (!on[s] || on[(s - 1 + n) % n]) continue;
    let k = 0;
    while (k < n && on[(s + k) % n]) k++;
    if (k > len) { len = k; start = s; }
  }
  near(g, '땅에 닿은 구간 시작 각', (start * 360) / n, 286.5, 1);
  near(g, '땅에 닿은 구간 끝 각', ((start + len - 1) % n) * 360 / n, 81, 1);
  near(g, '땅에 닿은 구간 크기(°)', (len * 360) / n, 155, 1);
  near(g, '땅에 닿은 비율(%)', (len / n) * 100, 43, 0.6);
  const sx = [];
  for (let k = 0; k < len; k++) sx.push(xs[(start + k) % n]);
  near(g, '보폭', Math.max(...sx) - Math.min(...sx), 57.3, 0.6);
  // 삼각 링크 두 개가 형태를 유지: 1번 항목의 audit 가 plates 변을 이미 포함
  check(g, '삼각 링크 2개(plates)', def.plates.length === 2, String(def.plates.length), '2개');
}
{
  // 6-10 집게
  const def = byId('gripper');
  const g = 'gripper';
  const p15 = reach(def, 1.5);
  nearPt(g, 'q=1.5 J1', p15.pts.J1, [3.78, 1.02], 0.01);
  nearPt(g, 'q=1.5 T1', p15.pts.T1, [9.0, 0.1], LEN);
  near(g, 'q=1.5 폭', p15.pts.T1[1] - p15.pts.T2[1], 0.2, LEN);
  nearPt(g, 'q=2.0 T1', reach(def, 2.0).pts.T1, [9.51, 1.86], LEN);
  const p25 = reach(def, 2.5);
  nearPt(g, 'q=2.5 T1', p25.pts.T1, [9.45, 3.53], LEN);
  near(g, 'q=2.5 폭', p25.pts.T1[1] - p25.pts.T2[1], 7.06, LEN);
  near(g, '팔 길이 비', Math.hypot(1.657, 5.293) / 1.5, 3.7, 0.005);
  // 위아래 대칭
  const sym = Math.max(...S.sweep(def).poses.map((p) => Math.abs(p.pts.T1[1] + p.pts.T2[1])));
  check(g, '위아래 대칭 (T1.y + T2.y = 0)', sym < 1e-9, sym.toExponential(2), '< 1e-9');
}

// ───────────── 5. 그라스호프·입력 범위 프리셋 ─────────────
{
  const g = '직접 만들기';
  const cases = [
    { d: [3, 9, 7, 10], kind: 'crank-rocker', full: true },
    { d: [5, 6, 7, 3], kind: 'double-crank', full: true },
    { d: [7, 3, 6, 8], kind: 'double-rocker', full: false, min: 21.8, max: 73.4 },
    { d: [3, 8, 3, 8], kind: 'change-point', full: true },
    { d: [5, 4, 6, 10], kind: 'non-grashof', full: false, min: -75.5, max: 75.5 },
    { d: [2, 3, 3, 10], kind: 'impossible', none: true },
    { d: [7, 9, 3, 10], kind: 'rocker-crank', full: false, min: 36.2, max: 88.0 },
  ];
  for (const c of cases) {
    const gr = S.grashof(...c.d);
    const rg = S.inputRange(...c.d);
    const tag = c.d.join('·');
    check(g, `${tag} 판정`, gr.kind === c.kind, `${gr.kind} (${gr.label})`, c.kind);
    if (c.none) check(g, `${tag} inputRange = null`, rg === null, String(rg), 'null');
    else if (!rg) check(g, `${tag} inputRange`, false, 'null', '범위 있음');
    else if (c.full) check(g, `${tag} 한 바퀴`, rg.full === true, `full=${rg.full}`, 'full');
    else {
      near(g, `${tag} 범위 시작`, rg.min * D, c.min, 0.1);
      near(g, `${tag} 범위 끝`, rg.max * D, c.max, 0.1);
      check(g, `${tag} 한 바퀴 아님`, rg.full === false, `full=${rg.full}`, 'not full');
    }
  }
  // 프리셋 6개로 만든 기구가 정말 그 범위 안에서 조립되는지(범위 양 끝 + 가운데)
  for (const c of cases.filter((x) => !x.none)) {
    const def = S.fourbar(...c.d, 4.5, 3);
    const sw = S.sweep(def);
    const ok = sw.poses.length > 0 && sw.poses.every((p) => p.ok);
    check(g, `${c.d.join('·')} fourbar sweep 조립됨`, ok && sw.full === (c.full ?? false), `표본 ${sw.poses.length}, full=${sw.full}`, c.full ? '한 바퀴 전부' : '범위만');
    const a = audit(def, sw.poses);
    check(g, `${c.d.join('·')} 길이 변화·반지름`, a.lenVar <= 1e-6 && a.rad <= 1e-9, `${a.lenVar.toExponential(1)} / ${a.rad.toExponential(1)}`, '≤ 1e-6 / 1e-9');
    if (!sw.full && sw.poses.length > 1) {
      // 범위 끝의 바깥은 정말 조립이 안 됨
      const rg = S.inputRange(...c.d);
      const out = S.solve(def, rg.max + 0.01 * R, sw.poses[sw.poses.length - 1]);
      check(g, `${c.d.join('·')} 범위 끝 너머는 조립 불가`, !out.ok && !!out.failAt, `ok=${out.ok}, failAt=${out.failAt}`, 'ok=false');
    }
  }
}

// ───────────── 6. 조립 불가 ─────────────
{
  const g = '조립 불가';
  const bad = S.fourbar(2, 3, 3, 10, 4.5, 3);
  const sw = S.sweep(bad);
  check(g, 'fourbar(2,3,3,10) sweep 표본 0개', sw.poses.length === 0, `${sw.poses.length}개`, '0개');
  const p = S.solve(bad, 0, null);
  check(g, 'fourbar(2,3,3,10) solve → ok:false, failAt', !p.ok && p.failAt === 'B', `ok=${p.ok}, failAt=${p.failAt}`, 'ok:false, failAt=B');
  const f = S.fourbar(5, 4, 6, 10, 4.5, 3);
  const from = S.solve(f, 60 * R, null);
  const stop = S.advance(f, from, 120 * R);
  check(g, 'fourbar(5,4,6,10) θ=120° advance → ok:false', !stop.ok, `ok=${stop.ok}, failAt=${stop.failAt}`, 'ok:false');
  near(g, '멈춘 각', stop.q * D, 75.5, 0.1);
  check(g, '멈춘 자세는 유효(막대 길이 일정)', Math.abs(dist(stop.pts.A, stop.pts.B) - 4) < 1e-7 && Math.abs(dist(stop.pts.B, [10, 0]) - 6) < 1e-7, `|AB|=${dist(stop.pts.A, stop.pts.B).toFixed(9)}`, '4, 6 (허용 1e-7: 한계에서는 해의 허용 오차 1e-9×크기 안)');
  // 해가 없는 곳을 가짜로 그리지 않는다: 한계 너머 직접 풀면 ok:false
  const direct = S.solve(f, 100 * R, null);
  check(g, '한계 너머 solve → ok:false (가짜 자세 없음)', !direct.ok && direct.failAt === 'B', `ok=${direct.ok}, failAt=${direct.failAt}`, 'ok:false');
  // 슬라이더가 닿지 않는 곳(원–직선): 연결봉 길이 < 크랭크 높이
  const sc = JSON.parse(JSON.stringify(byId('slider-crank')));
  sc.steps[2].r = 2;
  const q = S.solve(sc, Math.PI / 2, null);
  check(g, '슬라이더-크랭크 연결봉이 모자라면 rp 에서 ok:false', !q.ok && q.failAt === 'C', `ok=${q.ok}, failAt=${q.failAt}`, 'ok:false, failAt=C');
}

// ───────────── 손으로 끌기(inputFromPoint) ─────────────
{
  const g = '끌기';
  const cr = byId('crank-rocker');
  const p0 = seedOf(cr);
  const q1 = S.inputFromPoint(cr, p0, [0, 5]);
  near(g, '크랭크: 위쪽 점 → 90°', q1 * D, 90, 1e-9);
  // 반 바퀴 끌고 가면 회전수를 이어서(−170°는 190° 가 아니라 직전 각에서 가장 가까운 값)
  const p170 = reach(cr, 170 * R);
  const q2 = S.inputFromPoint(cr, p170, [-5 * Math.cos(10 * R), -5 * Math.sin(10 * R)]);
  near(g, '크랭크: 170° 에서 190° 쪽 점', q2 * D, 190, 1e-6);
  const st = byId('steering');
  const hi = S.inputFromPoint(st, seedOf(st), [0, 5]);
  near(g, '로커 입력: 범위 끝에서 멈춤(max)', hi * D, st.input.max * D, 1e-9);
  const gr = byId('gripper');
  near(g, '슬라이드: 범위 밖은 끝으로', S.inputFromPoint(gr, seedOf(gr), [9, 3]), 2.5, 1e-12);
  near(g, '슬라이드: 정사영', S.inputFromPoint(gr, seedOf(gr), [1.8, 7]), 1.8, 1e-12);
  const pg = byId('pantograph');
  const v = S.inputFromPoint(pg, seedOf(pg), [20, 0]);
  near(g, '팬터그래프: 멀리 끌면 rMax 에서 멈춤', Math.hypot(v[0], v[1]), 7.2, 1e-9);
}

// ───────────── 숫자판(metrics) 대조 ─────────────
{
  const g = '숫자판';
  const read = (id, q) => {
    const def = byId(id);
    const sw = S.sweep(def);
    const pose = reach(def, q);
    const map = {};
    for (const r of X.readouts(def, pose, sw)) map[r.key] = r;
    return map;
  };
  const eq = (name, got, want) => check(g, name, got === want, got, want);
  const cr = read('crank-rocker', 60 * R);
  eq('크랭크-로커 ψ', cr.psi.value, '95.2°');
  eq('크랭크-로커 μ', cr.mu.value, '66.1°');
  eq('크랭크-로커 흔들리는 범위', cr.swing.value, '51.8°');
  eq('크랭크-로커 그라스호프', cr.grashof.value, '3 + 10 = 13 ≤ 7 + 9 = 16 → 만족, 가장 짧은 링크가 구동 링크 → 크랭크-로커');
  const pa = read('parallel', 45 * R);
  eq('평행 크랭크 두 각의 차', pa.diff.value, '0.0°');
  eq('평행 크랭크 연결봉 기울기', pa.slope.value, '0.0°');
  eq('평행 크랭크 그라스호프', pa.grashof.value, '3 + 8 = 3 + 8 = 11 → 경계');
  const t0 = -90 + Math.asin(0.8 / 3) * D;
  const sr = read('steering', (t0 + 20) * R);
  eq('조향 δR (δL=+20)', sr.dR.value, '+17.8°');
  eq('조향 커브 문구', sr.curve.value, '지금은 왼쪽 커브 — 안쪽 바퀴가 2.2° 더 꺾였어요');
  eq('조향 그라스호프', sr.grashof.value, '3 + 10 = 13 > 3 + 8.4 = 11.4 → 불만족 → 이중 로커(어느 링크도 한 바퀴 돌지 못해요)');
  const sc = read('slider-crank', 90 * R);
  eq('슬라이더-크랭크 x', sc.x.value, '8.49 cm');
  eq('슬라이더-크랭크 s', sc.s.value, '2.49 cm');
  eq('슬라이더-크랭크 행정', sc.stroke.value, '6.00 cm');
  const qr = read('quick-return', 330 * R);
  eq('빠른 귀환 램', qr.ram.value, '8.67 cm');
  eq('빠른 귀환 행정', qr.stroke.value, '13.00 cm');
  eq('빠른 귀환 시간 비', qr.ratio.value, '2 : 1');
  eq('빠른 귀환 구간(330°)', read('quick-return', 330 * R).phase.value, '빨리 돌아오는 중'); // 경계 근처 값은 아래 보조 검사로 확인
  eq('빠른 귀환 구간(90°)', read('quick-return', 90 * R).phase.value, '천천히 가는 중');
  eq('빠른 귀환 구간(270°)', read('quick-return', 270 * R).phase.value, '빨리 돌아오는 중');
  const ch = read('chebyshev', 45 * R);
  eq('체비쇼프 벗어남', ch.dev.value, '0.005 cm');
  eq('체비쇼프 그라스호프', ch.grashof.value, '2 + 5 = 7 ≤ 4 + 5 = 9 → 만족, 가장 짧은 링크가 커플러 → 이중 로커');
  const wa = read('watt', -15 * R);
  eq('와트 그라스호프', wa.grashof.value, '3 + 12.37 = 15.37 > 6 + 6 = 12 → 불만족 → 이중 로커(어느 링크도 한 바퀴 돌지 못해요)');
  const pn = read('pantograph', [4, -3.5]);
  eq('팬터그래프 배율', pn.scale.basis, '배율 = OE ÷ OA = 8 ÷ 4 = 2');
  eq('팬터그래프 |OQ|÷|OP|', pn.oRatio.value, '2.00');
  const jn = read('jansen', 180 * R);
  eq('얀센 발끝 높이(180°)', jn.h.value, '18.3 단위');
  const jn0 = read('jansen', 0);
  eq('얀센 발끝 높이(0°)', jn0.h.value, '0.1 단위');
  const gp = read('gripper', 2.5);
  eq('집게 폭', gp.width.value, '7.06 cm');
  eq('집게 팔 길이 비', gp.ratio.value, '3.70');
  const cu = S.fourbar(5, 4, 6, 10, 4.5, 3);
  const cuSw = S.sweep(cu);
  const cuMap = {};
  for (const r of X.readouts(cu, S.solve(cu, 60 * R, null), cuSw)) cuMap[r.key] = r;
  eq('직접 만들기 5·4·6·10 그라스호프', cuMap.grashof.value, '4 + 10 = 14 > 5 + 6 = 11 → 불만족 → 이중 로커(어느 링크도 한 바퀴 돌지 못해요)');
  eq('직접 만들기 2·3·3·10 그라스호프', X.grashofText(2, 3, 3, 10), '10 ≥ 2 + 3 + 3 = 8 → 조립 불가');
  // series
  const s1 = X.series(byId('steering'), S.sweep(byId('steering')));
  check(g, '조향 그래프(δR, 기준선 δL)', !!s1 && !!s1.ref && s1.ys.length === s1.ref.ys.length && s1.ys.length > 100, s1 ? `${s1.ys.length}점` : 'null', '둘 다 있음');
  const s2 = X.series(byId('pantograph'), S.sweep(byId('pantograph')));
  check(g, '팬터그래프 그래프 = null', s2 === null, String(s2), 'null');
  const s3 = X.series(byId('quick-return'), S.sweep(byId('quick-return')));
  check(g, '빠른 귀환 그래프 색 띠 2종', !!s3 && s3.bands.length >= 2, s3 ? s3.bands.map((b) => `${(b.from * D).toFixed(0)}~${(b.to * D).toFixed(0)}`).join(' ') : 'null', '띠 있음');
}

// ───────────── 출력 ─────────────
let lastGroup = '';
let fail = 0;
for (const r of rows) {
  if (r.group !== lastGroup) {
    console.log(`\n== ${r.group} ==`);
    lastGroup = r.group;
  }
  if (!r.ok) fail++;
  console.log(`${r.ok ? ' ok ' : 'FAIL'}  ${r.name}  |  ${r.measured}  |  ${r.limit}`);
}
const groups = {};
for (const r of rows) {
  groups[r.group] ??= { ok: 0, bad: 0 };
  if (r.ok) groups[r.group].ok++;
  else groups[r.group].bad++;
}
console.log('\n==== 요약 ====');
for (const [k, v] of Object.entries(groups)) console.log(`${v.bad === 0 ? 'PASS' : 'FAIL'}  ${k.padEnd(14)} ${v.ok}/${v.ok + v.bad}`);
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: 검사 ${rows.length}개 중 실패 ${fail}개`);
process.exit(fail === 0 ? 0 : 1);
