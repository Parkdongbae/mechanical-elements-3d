// 링크 장치 기구학 풀이 — 순수 TS(three·DOM 없음). 원–원, 원–직선 교점을 닫힌 식으로 구한다. 반복법·보간 없음.
import type { Bounds, GrashofResult, InputValue, MechanismDef, Pose, Step, Sweep, Vec2 } from './types';

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

// ───────────── 기본 도구 ─────────────
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function wrapPi(x: number): number {
  let y = x % TWO_PI;
  if (y > Math.PI) y -= TWO_PI;
  else if (y <= -Math.PI) y += TWO_PI;
  return y;
}
function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

// 기구 크기(허용 오차의 기준) — 길이·좌표 중 가장 큰 값
const scaleCache = new WeakMap<MechanismDef, number>();
function scaleOf(def: MechanismDef): number {
  const hit = scaleCache.get(def);
  if (hit !== undefined) return hit;
  let m = 1e-9;
  for (const s of def.steps) {
    if (s.k === 'fix') m = Math.max(m, Math.abs(s.at[0]), Math.abs(s.at[1]));
    else if (s.k === 'crank') m = Math.max(m, s.r);
    else if (s.k === 'push') m = Math.max(m, Math.abs(s.from[0]), Math.abs(s.from[1]));
    else if (s.k === 'rr') m = Math.max(m, s.ra, s.rb);
    else if (s.k === 'rp') m = Math.max(m, s.r, Math.abs(s.p[0]), Math.abs(s.p[1]));
    else if (s.k === 'rigid') m = Math.max(m, Math.abs(s.u), Math.abs(s.v));
  }
  scaleCache.set(def, m);
  return m;
}

export function inputStepOf(def: MechanismDef): Step | undefined {
  return def.steps.find((s) => s.k === 'crank' || s.k === 'push' || s.k === 'free');
}

// 모든 조인트가 다 들어 있는 자세인가(풀이 도중 실패한 자세는 아님)
function complete(def: MechanismDef, p: Pose): boolean {
  for (const s of def.steps) if (!p.pts[s.id]) return false;
  return true;
}

// ───────────── 한 자세 풀기 ─────────────
// 입력 q가 prev→q 로 바뀐 비율(예측 외삽용). prev2 가 없으면 0.
function extrapolation(def: MechanismDef, q: InputValue, prev: Pose, prev2: Pose): number {
  const q1 = prev.q;
  const q2 = prev2.q;
  let lam = 0;
  if (typeof q === 'number' && typeof q1 === 'number' && typeof q2 === 'number') {
    const rot = def.input.kind === 'rotate';
    const dq = rot ? wrapPi(q - q1) : q - q1;
    const dp = rot ? wrapPi(q1 - q2) : q1 - q2;
    if (Math.abs(dp) > 1e-12) lam = dq / dp;
  } else if (typeof q !== 'number' && typeof q1 !== 'number' && typeof q2 !== 'number') {
    const dx = q[0] - q1[0];
    const dy = q[1] - q1[1];
    const px = q1[0] - q2[0];
    const py = q1[1] - q2[1];
    const n2 = px * px + py * py;
    if (n2 > 1e-18) lam = (dx * px + dy * py) / n2;
  }
  return Number.isFinite(lam) ? clamp(lam, -4, 4) : 0;
}

export function solve(def: MechanismDef, q: InputValue, prev: Pose | null, prev2?: Pose | null): Pose {
  const pts: Record<string, Vec2> = {};
  const tol = 1e-9 * scaleOf(def);
  const p1 = prev && complete(def, prev) ? prev : null;
  const p2 = p1 && prev2 && complete(def, prev2) ? prev2 : null;
  const lam = p1 && p2 ? extrapolation(def, q, p1, p2) : 0;

  // 직전 두 프레임으로 예측한 조인트 위치: prev + (prev − prev2)·λ  (λ=1 이면 2·prev − prev2)
  const predict = (id: string): Vec2 | null => {
    if (!p1) return null;
    const a = p1.pts[id];
    if (!a) return null;
    const b = p2 ? p2.pts[id] : undefined;
    if (!b) return a;
    return [a[0] + (a[0] - b[0]) * lam, a[1] + (a[1] - b[1]) * lam];
  };
  const fail = (id: string): Pose => ({ ok: false, q, pts, failAt: id });
  const get = (id: string): Vec2 => pts[id] ?? [0, 0];

  for (const s of def.steps) {
    switch (s.k) {
      case 'fix':
        pts[s.id] = s.at;
        break;
      case 'crank': {
        const o = get(s.o);
        const a = typeof q === 'number' ? q : 0;
        pts[s.id] = [o[0] + s.r * Math.cos(a), o[1] + s.r * Math.sin(a)];
        break;
      }
      case 'push': {
        const a = typeof q === 'number' ? q : 0;
        pts[s.id] = [s.from[0] + a * s.dir[0], s.from[1] + a * s.dir[1]];
        break;
      }
      case 'free':
        pts[s.id] = typeof q === 'number' ? [q, 0] : q;
        break;
      case 'rr': {
        const pa = get(s.a);
        const pb = get(s.b);
        const d = dist(pa, pb);
        if (d < 1e-12 || d > s.ra + s.rb + tol || d < Math.abs(s.ra - s.rb) - tol) return fail(s.id);
        const x = (d * d + s.ra * s.ra - s.rb * s.rb) / (2 * d);
        const h = Math.sqrt(Math.max(0, s.ra * s.ra - x * x));
        const ex = (pb[0] - pa[0]) / d;
        const ey = (pb[1] - pa[1]) / d;
        const nx = -ey;
        const ny = ex;
        const left: Vec2 = [pa[0] + x * ex + h * nx, pa[1] + x * ey + h * ny]; // side=+1
        const right: Vec2 = [pa[0] + x * ex - h * nx, pa[1] + x * ey - h * ny]; // side=-1
        let side: 1 | -1 = s.side;
        const pred = predict(s.id);
        if (pred) {
          // 현재 가지(직전 프레임의 부호)
          const qa = p1?.pts[s.a];
          const qb = p1?.pts[s.b];
          const qi = p1?.pts[s.id];
          if (qa && qb && qi) {
            const cr = (qb[0] - qa[0]) * (qi[1] - qa[1]) - (qb[1] - qa[1]) * (qi[0] - qa[0]);
            if (Math.abs(cr) > 1e-9 * scaleOf(def) * scaleOf(def)) side = cr > 0 ? 1 : -1;
          }
          const dl = dist(left, pred);
          const dr = dist(right, pred);
          if (Math.abs(dl - dr) > 1e-6) side = dl < dr ? 1 : -1;
        }
        pts[s.id] = side === 1 ? left : right;
        break;
      }
      case 'rp': {
        const pa = get(s.a);
        const dl = Math.hypot(s.dir[0], s.dir[1]);
        const ux = s.dir[0] / dl;
        const uy = s.dir[1] / dl;
        const wx = pa[0] - s.p[0];
        const wy = pa[1] - s.p[1];
        const t0 = wx * ux + wy * uy; // 원 중심의 정사영
        const perp = ux * wy - uy * wx; // 중심에서 직선까지 부호 거리
        if (Math.abs(perp) > s.r + tol) return fail(s.id);
        const sq = Math.sqrt(Math.max(0, s.r * s.r - perp * perp));
        const far: Vec2 = [s.p[0] + (t0 + sq) * ux, s.p[1] + (t0 + sq) * uy]; // side=+1
        const near: Vec2 = [s.p[0] + (t0 - sq) * ux, s.p[1] + (t0 - sq) * uy]; // side=-1
        let side: 1 | -1 = s.side;
        const pred = predict(s.id);
        if (pred) {
          const qa = p1?.pts[s.a];
          const qi = p1?.pts[s.id];
          if (qa && qi) {
            const sg = (qi[0] - qa[0]) * ux + (qi[1] - qa[1]) * uy;
            if (Math.abs(sg) > 1e-9 * scaleOf(def)) side = sg > 0 ? 1 : -1;
          }
          const df = dist(far, pred);
          const dn = dist(near, pred);
          if (Math.abs(df - dn) > 1e-6) side = df < dn ? 1 : -1;
        }
        pts[s.id] = side === 1 ? far : near;
        break;
      }
      case 'rigid': {
        const pa = get(s.a);
        const pb = get(s.b);
        const d = dist(pa, pb);
        if (d < 1e-12) return fail(s.id);
        const ex = (pb[0] - pa[0]) / d;
        const ey = (pb[1] - pa[1]) / d;
        pts[s.id] = [pa[0] + s.u * ex - s.v * ey, pa[1] + s.u * ey + s.v * ex];
        break;
      }
    }
  }
  return { ok: true, q, pts };
}

// ───────────── 큰 입력 변화를 잘게 따라가기 ─────────────
function inputSize(def: MechanismDef): number {
  const sp = def.input;
  if (sp.kind === 'slide') return sp.max - sp.min;
  if (sp.kind === 'point') return sp.rMax;
  return TWO_PI;
}

export function advance(def: MechanismDef, from: Pose, toQ: InputValue, prev2?: Pose | null): Pose {
  if (!complete(def, from)) return solve(def, toQ, null);
  const q0 = from.q;
  let dist1: number; // 입력이 바뀐 양
  let at: (t: number) => InputValue;
  if (typeof toQ === 'number' && typeof q0 === 'number') {
    const dq = def.input.kind === 'rotate' ? wrapPi(toQ - q0) : toQ - q0;
    dist1 = Math.abs(dq);
    at = (t) => q0 + dq * t;
  } else if (typeof toQ !== 'number' && typeof q0 !== 'number') {
    const dx = toQ[0] - q0[0];
    const dy = toQ[1] - q0[1];
    dist1 = Math.hypot(dx, dy);
    at = (t) => [q0[0] + dx * t, q0[1] + dy * t];
  } else {
    return solve(def, toQ, null);
  }
  const sp = def.input;
  const unit = sp.kind === 'slide' ? inputSize(def) / 90 : sp.kind === 'point' ? inputSize(def) / 80 : 2 * DEG;
  const stepMax = sp.kind === 'slide' ? inputSize(def) / 180 : sp.kind === 'point' ? inputSize(def) / 160 : DEG;
  const n = dist1 <= unit ? 1 : Math.ceil(dist1 / stepMax);

  let a: Pose = from;
  let b: Pose | null = prev2 ?? null;
  for (let i = 1; i <= n; i++) {
    const qi = i === n && typeof toQ === 'number' && sp.kind !== 'rotate' ? toQ : at(i / n);
    const pose = solve(def, qi, a, b);
    if (!pose.ok) {
      // 조립이 안 되는 곳 — 직전 자세에서 이분법으로 한계까지 가서 거기서 멈춘다(그 너머로는 안 간다)
      let lo = 0;
      let hi = 1;
      let best: Pose = a;
      const t0 = (i - 1) / n;
      const t1 = i / n;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const cand = solve(def, at(t0 + (t1 - t0) * mid), a, b);
        if (cand.ok) {
          lo = mid;
          best = cand;
        } else hi = mid;
      }
      return { ok: false, q: best.q, pts: best.pts, failAt: pose.failAt ?? '' };
    }
    b = a;
    a = pose;
  }
  return a;
}

// ───────────── 한 번에 훑기 ─────────────
function emptyBounds(): Bounds {
  return { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
}
function grow(b: Bounds, p: Vec2): void {
  if (p[0] < b.minX) b.minX = p[0];
  if (p[0] > b.maxX) b.maxX = p[0];
  if (p[1] < b.minY) b.minY = p[1];
  if (p[1] > b.maxY) b.maxY = p[1];
}
function growPose(b: Bounds, p: Pose): void {
  for (const id in p.pts) {
    const v = p.pts[id];
    if (v) grow(b, v);
  }
}

// 닫힌 도형 둘레를 일정한 빠르기로 도는 점(t: 0~1). UI의 자동 재생과 sweep 이 같이 쓴다.
export function pathPoint(pts: readonly Vec2[], t: number): Vec2 {
  const n = pts.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += dist(pts[i] as Vec2, pts[(i + 1) % n] as Vec2);
  let s = (((t % 1) + 1) % 1) * total;
  for (let i = 0; i < n; i++) {
    const p = pts[i] as Vec2;
    const q = pts[(i + 1) % n] as Vec2;
    const l = dist(p, q);
    if (s <= l || i === n - 1) {
      const f = l > 0 ? s / l : 0;
      return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    }
    s -= l;
  }
  return pts[0] as Vec2;
}

export function sweep(def: MechanismDef, n = 720): Sweep {
  const sp = def.input;
  const bounds = emptyBounds();
  let poses: Pose[] = [];
  let qs: number[] = [];
  let full = false;
  let qMin = 0;
  let qMax = 0;

  if (sp.kind === 'rotate') {
    const dq = TWO_PI / n;
    const seed = solve(def, sp.q0, null);
    if (seed.ok) {
      const fw: Pose[] = [seed];
      let prev = seed;
      let prev2: Pose | null = null;
      let done = true;
      for (let i = 1; i < n; i++) {
        const p = solve(def, sp.q0 + i * dq, prev, prev2);
        if (!p.ok) {
          done = false;
          break;
        }
        fw.push(p);
        prev2 = prev;
        prev = p;
      }
      if (done) {
        full = true;
        const items = fw.map((p) => {
          const qn = (((p.q as number) % TWO_PI) + TWO_PI) % TWO_PI;
          return { p, qn };
        });
        items.sort((x, y) => x.qn - y.qn);
        poses = items.map((it) => it.p);
        qs = items.map((it) => it.qn);
        qMin = 0;
        qMax = TWO_PI;
      } else {
        const bw: Pose[] = [];
        prev = seed;
        prev2 = null;
        for (let i = 1; i < n; i++) {
          const p = solve(def, sp.q0 - i * dq, prev, prev2);
          if (!p.ok) break;
          bw.push(p);
          prev2 = prev;
          prev = p;
        }
        poses = [...bw.reverse(), ...fw];
        qs = poses.map((p) => p.q as number);
        qMin = qs[0] ?? 0;
        qMax = qs[qs.length - 1] ?? 0;
      }
    }
  } else if (sp.kind === 'swing' || sp.kind === 'slide') {
    const span = sp.max - sp.min;
    const g = (i: number): number => (n > 0 ? sp.min + (span * i) / n : sp.min);
    let i0 = span > 0 ? clamp(Math.round(((sp.q0 - sp.min) / span) * n), 0, n) : 0;
    let seed = solve(def, g(i0), null);
    if (!seed.ok) {
      // 정해진 q0 가 막혀 있으면 가장 가까운 조립 가능한 표본에서 시작
      for (let k = 1; k <= n && !seed.ok; k++) {
        for (const j of [i0 - k, i0 + k]) {
          if (j < 0 || j > n) continue;
          const t = solve(def, g(j), null);
          if (t.ok) {
            seed = t;
            i0 = j;
            break;
          }
        }
      }
    }
    if (seed.ok) {
      const fw: Pose[] = [seed];
      let prev = seed;
      let prev2: Pose | null = null;
      for (let i = i0 + 1; i <= n; i++) {
        const p = solve(def, g(i), prev, prev2);
        if (!p.ok) break;
        fw.push(p);
        prev2 = prev;
        prev = p;
      }
      const bw: Pose[] = [];
      prev = seed;
      prev2 = null;
      for (let i = i0 - 1; i >= 0; i--) {
        const p = solve(def, g(i), prev, prev2);
        if (!p.ok) break;
        bw.push(p);
        prev2 = prev;
        prev = p;
      }
      poses = [...bw.reverse(), ...fw];
      qs = poses.map((p) => p.q as number);
      qMin = qs[0] ?? sp.min;
      qMax = qs[qs.length - 1] ?? sp.max;
      full = false;
    } else {
      qMin = sp.q0;
      qMax = sp.q0;
    }
  } else {
    // point: 첫 도형으로 표본을 만들고, 모든 도형을 훑어 범위(bounds)를 만든다
    sp.paths.forEach((path, pi) => {
      let prev: Pose | null = null;
      let prev2: Pose | null = null;
      let done = true;
      const mine: Pose[] = [];
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const p = solve(def, pathPoint(path.pts, t), prev, prev2);
        if (!p.ok) {
          done = false;
          break;
        }
        mine.push(p);
        if (pi === 0) qs.push(t);
        prev2 = prev;
        prev = p;
      }
      for (const p of mine) growPose(bounds, p);
      if (pi === 0) {
        poses = mine;
        full = done;
        qMin = 0;
        qMax = 1;
      }
    });
  }

  if (sp.kind !== 'point') for (const p of poses) growPose(bounds, p);
  // 레일 끝과 바퀴 둘레도 범위에 넣는다(자동 배율용)
  for (const r of def.rails ?? []) {
    grow(bounds, [r.p[0] + r.min * r.dir[0], r.p[1] + r.min * r.dir[1]]);
    grow(bounds, [r.p[0] + r.max * r.dir[0], r.p[1] + r.max * r.dir[1]]);
  }
  const first = poses[0];
  if (first) {
    for (const dc of def.decor ?? []) {
      if (dc.kind !== 'wheel') continue;
      const c = first.pts[dc.a];
      if (c) {
        grow(bounds, [c[0] - dc.size, c[1] - dc.size]);
        grow(bounds, [c[0] + dc.size, c[1] + dc.size]);
      }
    }
  }
  const out: Bounds = Number.isFinite(bounds.minX) ? bounds : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { poses, qs, full, qMin, qMax, bounds: out };
}

// ───────────── 손으로 끌기 ─────────────
export function inputFromPoint(def: MechanismDef, pose: Pose, p: Vec2): InputValue {
  const st = inputStepOf(def);
  const sp = def.input;
  if (!st) return pose.q;
  if (st.k === 'crank') {
    const o = pose.pts[st.o] ?? ([0, 0] as Vec2);
    const ang = Math.atan2(p[1] - o[1], p[0] - o[0]);
    if (sp.kind === 'swing') {
      const c = (sp.min + sp.max) / 2;
      return clamp(c + wrapPi(ang - c), sp.min, sp.max);
    }
    const cur = typeof pose.q === 'number' ? pose.q : sp.kind === 'rotate' ? sp.q0 : 0;
    return cur + wrapPi(ang - cur); // 직전 각에서 가장 가까운 회전수
  }
  if (st.k === 'push') {
    const t = (p[0] - st.from[0]) * st.dir[0] + (p[1] - st.from[1]) * st.dir[1];
    return sp.kind === 'slide' ? clamp(t, sp.min, sp.max) : t;
  }
  // free: center 에서의 거리를 rMin~rMax 로 자른 점
  if (sp.kind === 'point') {
    const c = pose.pts[sp.center] ?? ([0, 0] as Vec2);
    const vx = p[0] - c[0];
    const vy = p[1] - c[1];
    const r = Math.hypot(vx, vy);
    if (r < 1e-12) return [c[0] + sp.rMin, c[1]];
    const rc = clamp(r, sp.rMin, sp.rMax);
    return [c[0] + (vx / r) * rc, c[1] + (vy / r) * rc];
  }
  return p;
}

// ───────────── 4절 링크 (직접 만들기) ─────────────
// a=구동 링크, b=커플러, c=따라 움직이는 링크, d=고정 링크
export function inputRange(a: number, b: number, c: number, d: number): { full: boolean; min: number; max: number } | null {
  const den = 2 * a * d;
  const lo = (a * a + d * d - (b + c) * (b + c)) / den; // cosθ 의 하한
  const hi = (a * a + d * d - (b - c) * (b - c)) / den; // cosθ 의 상한
  const e = 1e-12;
  if (lo > 1 + e || hi < -1 - e) return null;
  const loFree = lo <= -1 + e;
  const hiFree = hi >= 1 - e;
  if (loFree && hiFree) return { full: true, min: 0, max: TWO_PI };
  if (loFree) {
    const t = Math.acos(clamp(hi, -1, 1)); // 180° 둘레 한 구간
    return { full: false, min: t, max: TWO_PI - t };
  }
  if (hiFree) {
    const t = Math.acos(clamp(lo, -1, 1)); // 0° 둘레 한 구간
    return { full: false, min: -t, max: t };
  }
  // 위·아래 두 구간 중 위쪽
  return { full: false, min: Math.acos(clamp(hi, -1, 1)), max: Math.acos(clamp(lo, -1, 1)) };
}

export function grashof(a: number, b: number, c: number, d: number): GrashofResult {
  const sorted = [a, b, c, d].slice().sort((x, y) => x - y);
  const s = sorted[0] as number;
  const p = sorted[1] as number;
  const q = sorted[2] as number;
  const l = sorted[3] as number;
  const mk = (kind: GrashofResult['kind'], label: string, note: string): GrashofResult => ({ kind, s, l, p, q, label, note });
  const eps = 1e-9;
  if (l >= s + p + q - eps) {
    return mk('impossible', '조립 불가', '가장 긴 링크가 나머지 셋을 합친 것보다 길어서(또는 같아서) 이을 수 없어요.');
  }
  const diff = s + l - (p + q);
  if (Math.abs(diff) <= eps) {
    return mk('change-point', '경계', '경계 — 한 줄로 접히는 순간이 있어요. 평행 크랭크가 여기에 속해요.');
  }
  if (diff > 0) {
    return mk('non-grashof', '이중 로커', '이중 로커 — 어느 링크도 한 바퀴 돌지 못해요.');
  }
  // 가장 짧은 링크가 어느 것인지(같은 길이면 고정·구동·커플러·따라 움직이는 순)
  if (d === s) return mk('double-crank', '이중 크랭크', '가장 짧은 링크가 고정 링크예요. 두 링크가 모두 한 바퀴 돌아요.');
  if (a === s) return mk('crank-rocker', '크랭크-로커', '가장 짧은 링크가 구동 링크예요. 구동 링크는 한 바퀴 돌고 따라 움직이는 링크는 흔들려요.');
  if (b === s) return mk('double-rocker', '이중 로커', '가장 짧은 링크가 커플러예요. 두 링크 모두 한 바퀴는 돌지 못해요.');
  return mk('rocker-crank', '크랭크-로커', '크랭크-로커 — 단, 한 바퀴 도는 쪽은 따라 움직이는 링크(c)예요.');
}

// 4절 링크 형태의 기구에서 네 길이와 조인트 id 를 읽는다(아니면 null)
export interface FourbarDims { a: number; b: number; c: number; d: number; o2: string; o4: string; A: string; B: string }
export function fourbarDims(def: MechanismDef): FourbarDims | null {
  const crank = def.steps.find((s) => s.k === 'crank');
  if (!crank || crank.k !== 'crank') return null;
  const rr = def.steps.find((s) => s.k === 'rr' && s.a === crank.id);
  if (!rr || rr.k !== 'rr') return null;
  const f2 = def.steps.find((s) => s.k === 'fix' && s.id === crank.o);
  const f4 = def.steps.find((s) => s.k === 'fix' && s.id === rr.b);
  if (!f2 || f2.k !== 'fix' || !f4 || f4.k !== 'fix') return null;
  return { a: crank.r, b: rr.ra, c: rr.rb, d: dist(f2.at, f4.at), o2: crank.o, o4: rr.b, A: crank.id, B: rr.id };
}

export function fourbar(a: number, b: number, c: number, d: number, u: number, v: number): MechanismDef {
  const rg = inputRange(a, b, c, d);
  const input: MechanismDef['input'] = !rg
    ? { kind: 'swing', min: 0, max: 0, q0: 0 }
    : rg.full
      ? { kind: 'rotate', q0: 60 * DEG }
      : { kind: 'swing', min: rg.min, max: rg.max, q0: (rg.min + rg.max) / 2 };
  const flat = Math.abs(v) < 1e-9;
  return {
    id: 'custom',
    name: '직접 만들기',
    unit: 'cm',
    oneLine: '링크 길이를 바꿔 보고 그라스호프 조건을 확인해요',
    how: [
      '링크 네 개의 길이를 바꿔 가며 어떤 움직임이 되는지 살펴봐요.',
      '가장 짧은 링크와 가장 긴 링크의 합이 나머지 두 링크의 합보다 작거나 같으면(그라스호프 조건) 가장 짧은 링크가 한 바퀴 돌 수 있어요.',
      '가장 짧은 링크가 구동 링크면 크랭크-로커, 고정 링크면 이중 크랭크, 커플러면 이중 로커가 돼요.',
    ],
    uses: [
      '커플러 위의 점이 그리는 곡선(자취)은 점의 위치에 따라 완전히 달라져요. 이 곡선을 골라 쓰는 것이 링크 설계예요.',
      '크랭크-로커(3·9·7·10)와 평행 크랭크(3·8·3·8) 프리셋은 앞의 링크 장치들과 같은 길이예요.',
    ],
    watch: '가장 짧은 링크가 어느 것인지에 따라 같은 길이라도 움직임이 달라져요.',
    steps: [
      { k: 'fix', id: 'O2', at: [0, 0] },
      { k: 'fix', id: 'O4', at: [d, 0] },
      { k: 'crank', id: 'A', o: 'O2', r: a },
      { k: 'rr', id: 'B', a: 'A', ra: b, b: 'O4', rb: c, side: 1 },
      { k: 'rigid', id: 'P', a: 'A', b: 'B', u, v },
    ],
    input,
    handle: 'A',
    bars: [
      { a: 'O2', b: 'O4', role: 'ground', layer: 0 },
      { a: 'O2', b: 'A', role: 'input', layer: 1 },
      { a: 'O4', b: 'B', role: 'output', layer: 3 },
      ...(flat ? [{ a: 'A', b: 'B', role: 'coupler' as const, layer: 2, via: ['P'] }] : []),
    ],
    plates: flat ? [] : [{ pts: ['A', 'B', 'P'], role: 'coupler', layer: 2 }],
    trace: [{ id: 'P', label: '커플러 점 P' }],
  };
}
