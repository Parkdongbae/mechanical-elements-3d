// 280 마찰로 감는 윈들러스 전용 키트 — 상수, 운동식(state280·pawlAngle280), 비원형 윤곽(턱·짧은 레버·손잡이 레버·폴).
// 설계표 docs/mm507-sheets/280.md 의 치수·식을 그대로 옮겼다. 자세는 t(초)의 절대 함수다.
import * as THREE from 'three';
import { circlePath, shapeFrom } from '../../models/parts/geom';
import { circleIntersect } from './misc';

const DEG = Math.PI / 180;
type V2 = [number, number];

export const K280 = {
  W: [-0.8, 1.1] as V2,
  R_OUT: 0.66,
  R_IN: 0.55,
  P: [0.8, 0] as V2,
  Q_OFF: [-0.04968, 0.032] as V2,
  ECC_R: 0.09,
  E_LEN: 0.565,
  LAM_FREE: -4.749 * DEG,
  SWING: 4 * DEG,
  G: [0.95, 2.775] as V2,
  CRANK_R: 0.38,
  LINK: 1.69742,
  EPS_BOT: 18.3516 * DEG,
  EPS_TOP: -18 * DEG,
  EPS_UP_END: 11.055 * DEG,
  EPS_DOWN_END: -10.736 * DEG,
  PERIOD: 2.4,
  STEP: 8 * DEG,
  PAWL_PIV: [
    [-0.0544, 1.9097],
    [0.1928, 1.6173]
  ] as V2[],
  PAWL_LEN: 0.42,
  NOSE: 0.012,
  RATCHET: { teeth: 24, rOut: 0.76, rRoot: 0.7 }
} as const;
const K = K280;

const posMod = (x: number, m: number): number => ((x % m) + m) % m;
const rot = (p: V2, a: number): V2 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

/** 두 원의 교점 가운데 x 가 큰 쪽(연결 막대가 늘 오른쪽 해) */
function pickRight(c1: V2, r1: number, c2: V2, r2: number): V2 {
  const a = circleIntersect(c1, r1, c2, r2, true);
  const b = circleIntersect(c1, r1, c2, r2, false);
  if (a === null && b === null) throw new Error('280: 원-원 교점 없음');
  if (a === null) return b as V2;
  if (b === null) return a;
  return a[0] >= b[0] ? a : b;
}

export interface State280 {
  tc: number;
  n: number;
  up: boolean;
  eps: number;
  phiC: number;
  lam: number;
  phiW: number;
  B: V2;
  E: V2;
  /** 물림(λ = 0) */
  grip: boolean;
}

export function state280(t: number): State280 {
  const tc = posMod(t, K.PERIOD);
  const n = Math.floor(t / K.PERIOD);
  const half = K.PERIOD / 2;
  const up = tc < half;
  const eps = up
    ? K.EPS_BOT + (K.EPS_TOP - K.EPS_BOT) * (1 - Math.cos((Math.PI * tc) / half)) / 2
    : K.EPS_TOP + (K.EPS_BOT - K.EPS_TOP) * (1 - Math.cos((Math.PI * (tc - half)) / half)) / 2;
  const B: V2 = [K.G[0] + K.CRANK_R * Math.cos(Math.PI + eps), K.G[1] + K.CRANK_R * Math.sin(Math.PI + eps)];
  let phiC: number;
  let lam: number;
  let phiW: number;
  let E: V2;
  const W = K.W;
  const solveLam = (pc: number): { lam: number; E: V2 } => {
    const pr = rot(K.P, pc);
    const Pw: V2 = [W[0] + pr[0], W[1] + pr[1]];
    const e = pickRight(Pw, K.E_LEN, B, K.LINK);
    return { lam: Math.atan2(e[1] - Pw[1], e[0] - Pw[0]) - pc, E: e };
  };
  if (up) {
    if (eps >= K.EPS_UP_END) {
      phiC = -K.SWING;
      const s = solveLam(phiC);
      lam = s.lam;
      E = s.E;
      phiW = n * K.STEP;
    } else {
      lam = 0;
      const rr = K.P[0] + K.E_LEN;
      E = pickRight(W, rr, B, K.LINK);
      phiC = Math.atan2(E[1] - W[1], E[0] - W[0]);
      phiW = n * K.STEP + (phiC + K.SWING);
    }
  } else {
    phiW = (n + 1) * K.STEP;
    if (eps <= K.EPS_DOWN_END) {
      phiC = K.SWING;
      const s = solveLam(phiC);
      lam = s.lam;
      E = s.E;
    } else {
      lam = K.LAM_FREE;
      const q: V2 = [K.P[0] + K.E_LEN * Math.cos(lam), K.E_LEN * Math.sin(lam)];
      const rq = Math.hypot(q[0], q[1]);
      const aq = Math.atan2(q[1], q[0]);
      E = pickRight(W, rq, B, K.LINK);
      phiC = Math.atan2(E[1] - W[1], E[0] - W[0]) - aq;
    }
  }
  return { tc, n, up, eps, phiC, lam, phiW, B, E, grip: Math.abs(lam) < 1e-9 };
}

// ───────────────────────── 래칫 윤곽과 폴 각 ─────────────────────────

/** 래칫 윤곽(래칫 로컬 좌표, 원점 = 바퀴 중심): k 마다 뿌리 → 끝(곧은 이면), 끝 → 다음 뿌리(비탈) */
export function ratchetOutline280(): V2[] {
  const { teeth, rOut, rRoot } = K.RATCHET;
  const q = (2 * Math.PI) / teeth;
  const out: V2[] = [];
  for (let k = 0; k < teeth; k++) out.push([rRoot * Math.cos(k * q), rRoot * Math.sin(k * q)], [rOut * Math.cos(k * q), rOut * Math.sin(k * q)]);
  return out;
}
const RATCHET_PTS = ratchetOutline280();

/** 점 → 윤곽 부호 거리(안쪽 음수) */
function signedDist(p: V2, poly: V2[]): number {
  let best = Infinity;
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[j]!;
    const b = poly[i]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const s = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy));
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < a[0] + ((p[1] - a[1]) / (b[1] - a[1])) * dx) inside = !inside;
  }
  return inside ? -best : best;
}

/**
 * 폴 i(0 = pawl1, 1 = pawl2)의 각(rad, 세계). 끝 코 원(반지름 NOSE)의 중심이 래칫 윤곽에서 NOSE 떨어져 닿는 첫 각 —
 * 들린 쪽(작은 각)에서 키워 가며 처음 닿는 곳(중력으로 내려와 얹힘). 후보 = 변을 NOSE 만큼 민 선·꼭짓점 둘레 NOSE 원과 코 궤도 원의 교점.
 */
export function pawlAngle280(i: 0 | 1, phiW: number): number {
  const pv = K.PAWL_PIV[i]!;
  const c = rot([pv[0] - K.W[0], pv[1] - K.W[1]], -phiW);
  const L = K.PAWL_LEN;
  const nose = K.NOSE;
  const cands: V2[] = [];
  const n = RATCHET_PTS.length;
  for (let k = 0; k < n; k++) {
    const A = RATCHET_PTS[k]!;
    const Bp = RATCHET_PTS[(k + 1) % n]!;
    const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
    const dx = (Bp[0] - A[0]) / len;
    const dy = (Bp[1] - A[1]) / len;
    const nx = dy;
    const ny = -dx;
    const ax = A[0] + nose * nx - c[0];
    const ay = A[1] + nose * ny - c[1];
    const b = dx * ax + dy * ay;
    const disc = b * b - (ax * ax + ay * ay - L * L);
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const s of [-b - sq, -b + sq]) {
        if (s >= 0 && s <= len) cands.push([c[0] + ax + s * dx, c[1] + ay + s * dy]);
      }
    }
    for (const up of [true, false]) {
      const p = circleIntersect(c, L, A, nose, up);
      if (p !== null) cands.push(p);
    }
  }
  let best = Infinity;
  for (const X of cands) {
    if (signedDist(X, RATCHET_PTS) < nose - 1e-6) continue;
    const psi = posMod(Math.atan2(X[1] - c[1], X[0] - c[0]) + phiW, 2 * Math.PI);
    if (psi < 165 * DEG || psi > 215 * DEG) continue;
    if (psi < best) best = psi;
  }
  if (!Number.isFinite(best)) throw new Error('280: 폴 각을 못 구함');
  return best;
}

// ───────────────────────── 윤곽 만들기(합집합 → 점열) ─────────────────────────

function dpClosed(pts: V2[], tol: number): V2[] {
  const n = pts.length;
  if (n < 8) return pts;
  let far = 0;
  let fd = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(pts[i]![0] - pts[0]![0], pts[i]![1] - pts[0]![1]);
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[far] = 1;
  const rec = (lo: number, hi: number, wrap: boolean): void => {
    // 점열 lo → hi(wrap 이면 끝을 넘어 0 으로 이어짐)
    const idx = (k: number): V2 => pts[k % n]!;
    const end = wrap ? hi + n : hi;
    const a = idx(lo);
    const b = idx(end);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1e-12;
    let md = -1;
    let mi = -1;
    for (let k = lo + 1; k < end; k++) {
      const p = idx(k);
      const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l;
      if (d > md) {
        md = d;
        mi = k;
      }
    }
    if (md > tol && mi >= 0) {
      keep[mi % n] = 1;
      rec(lo, mi % n, wrap && mi >= n);
      rec(mi % n, hi, wrap);
    }
  };
  rec(0, far, false);
  rec(far, 0, true);
  const out: V2[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]!);
  return out;
}

/** 부호 거리 함수(음수 = 안)의 0 등고선(marching squares)에서 가장 큰 닫힌 고리를 점열로 */
export function sdfOutline(sdf: (x: number, y: number) => number, x0: number, y0: number, x1: number, y1: number, h: number, tol = 3e-5): V2[] {
  const nx = Math.ceil((x1 - x0) / h);
  const ny = Math.ceil((y1 - y0) / h);
  const W1 = nx + 1;
  const val = new Float64Array(W1 * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) val[j * W1 + i] = sdf(x0 + i * h, y0 + j * h);
  const ptOf = (id: number): V2 => {
    const e = id >> 1;
    const vert = id & 1;
    const j = Math.floor(e / W1);
    const i = e % W1;
    const a = val[e]!;
    const b = vert ? val[e + W1]! : val[e + 1]!;
    const t = a / (a - b);
    const x = x0 + i * h;
    const y = y0 + j * h;
    return vert ? [x, y + t * h] : [x + t * h, y];
  };
  const adj = new Map<number, number[]>();
  const link = (p: number, q: number): void => {
    (adj.get(p) ?? adj.set(p, []).get(p)!).push(q);
    (adj.get(q) ?? adj.set(q, []).get(q)!).push(p);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = val[j * W1 + i]!;
      const b = val[j * W1 + i + 1]!;
      const c = val[(j + 1) * W1 + i + 1]!;
      const d = val[(j + 1) * W1 + i]!;
      const ia = a < 0;
      const ib = b < 0;
      const ic = c < 0;
      const id = d < 0;
      const eB = 2 * (j * W1 + i);
      const eR = 2 * (j * W1 + i + 1) + 1;
      const eT = 2 * ((j + 1) * W1 + i);
      const eL = 2 * (j * W1 + i) + 1;
      const cr: number[] = [];
      if (ia !== ib) cr.push(eB);
      if (ib !== ic) cr.push(eR);
      if (id !== ic) cr.push(eT);
      if (ia !== id) cr.push(eL);
      if (cr.length === 2) link(cr[0]!, cr[1]!);
      else if (cr.length === 4) {
        const centerIn = (a + b + c + d) / 4 < 0;
        if (ia === centerIn) {
          // 안쪽 모서리 a·c(또는 b·d)가 중심으로 이어짐 → 바깥 모서리를 각각 자른다
          if (ia) {
            link(eB, eR);
            link(eT, eL);
          } else {
            link(eB, eL);
            link(eR, eT);
          }
        } else if (ia) {
          link(eB, eL);
          link(eR, eT);
        } else {
          link(eB, eR);
          link(eT, eL);
        }
      }
    }
  }
  const seen = new Set<number>();
  let bestLoop: V2[] = [];
  let bestArea = 0;
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: number[] = [];
    let prev = -1;
    let cur = start;
    for (;;) {
      seen.add(cur);
      loop.push(cur);
      const nb = adj.get(cur)!;
      const next = nb[0] !== prev ? nb[0]! : nb[1]!;
      if (next === start) break;
      if (seen.has(next)) break;
      prev = cur;
      cur = next;
    }
    const pts = loop.map(ptOf);
    let area = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]!;
      const q = pts[(k + 1) % pts.length]!;
      area += p[0] * q[1] - q[0] * p[1];
    }
    area = Math.abs(area) / 2;
    if (area > bestArea) {
      bestArea = area;
      bestLoop = pts;
    }
  }
  return dpClosed(bestLoop, tol);
}

const segSdf = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const s = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - s * dx, py - ay - s * dy);
};

// ───────────────────────── 짧은 레버 · 손잡이 레버 · 폴 윤곽 ─────────────────────────

/** 짧은 레버 윤곽(레버 좌표, 원점 = 핀 P): 편심 원 ∪ 막대 ∪ 핀 둘레 원 ∪ 바깥 끝 원 */
export function shortLeverOutline280(): V2[] {
  const [qx, qy] = K.Q_OFF;
  const sdf = (x: number, y: number): number =>
    Math.min(
      Math.hypot(x - qx, y - qy) - K.ECC_R,
      segSdf(x, y, qx, qy, K.E_LEN, 0) - 0.035,
      Math.hypot(x, y) - 0.05,
      Math.hypot(x - K.E_LEN, y) - 0.045
    );
  return sdfOutline(sdf, -0.16, -0.1, 0.62, 0.14, 0.0015, 2e-5);
}

/** 짧은 레버 모양: 윤곽 + 구멍 둘(핀 0.027, 바깥 끝 0.022) */
export function shortLever280(): THREE.Shape {
  const s = shapeFrom(shortLeverOutline280());
  s.holes.push(circlePath(0, 0, 0.027), circlePath(K.E_LEN, 0, 0.022));
  return s;
}

/** 손잡이 레버 윤곽(로컬: 원점 = 피벗 G, ε = 0): 짧은 팔 · 긴 팔 · 보스 */
export function handLeverOutline280(): V2[] {
  const a = -85 * DEG;
  const lx = 2.1 * Math.cos(a);
  const ly = 2.1 * Math.sin(a);
  const sdf = (x: number, y: number): number =>
    Math.min(segSdf(x, y, 0, 0, -K.CRANK_R, 0) - 0.035, segSdf(x, y, 0, 0, lx, ly) - 0.035, Math.hypot(x, y) - 0.07);
  return sdfOutline(sdf, -0.5, -2.2, 0.3, 0.12, 0.002, 4e-5);
}

/** 손잡이 레버 모양: 윤곽 + 피벗 구멍 0.0305 + 연결 핀 구멍 0.0205 */
export function handLever280(): THREE.Shape {
  const s = shapeFrom(handLeverOutline280());
  s.holes.push(circlePath(0, 0, 0.0305), circlePath(-K.CRANK_R, 0, 0.0205));
  return s;
}

/** 폴 윤곽(폴 좌표: 원점 = 피벗, x 가 끝 쪽): 보스 0.04 ∪ 막대(0 → 0.33, 반폭 0.0225) ∪ 0.33 → 끝 원(0.42, 반지름 0.012)으로 가늘어짐 */
export function pawlOutline280(): V2[] {
  const sdf = (x: number, y: number): number => {
    let m = Math.min(Math.hypot(x, y) - 0.04, segSdf(x, y, 0, 0, 0.33, 0) - 0.0225);
    for (let k = 0; k <= 48; k++) {
      const u = k / 48;
      m = Math.min(m, Math.hypot(x - (0.33 + 0.09 * u), y) - (0.0225 - 0.0105 * u));
    }
    return m;
  };
  return sdfOutline(sdf, -0.06, -0.06, 0.45, 0.06, 0.0006, 1.5e-5);
}

/** 폴 모양: 윤곽 + 피벗 구멍 0.022 */
export function pawl280(): THREE.Shape {
  const s = shapeFrom(pawlOutline280());
  s.holes.push(circlePath(0, 0, 0.022));
  return s;
}

// ───────────────────────── 턱 판 윤곽 ─────────────────────────

const arc = (r: number, a0: number, a1: number, step = 0.5 * DEG): V2[] => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const out: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
};
const arcAround = (cx: number, cy: number, r: number, a0: number, a1: number, step = 1 * DEG): V2[] => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const out: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
};
/** 원점 둘레 반지름 R 원과 핀 둘레(0.8, 0) 반지름 0.09 원의 교점(y > 0) */
function pinCross(R: number): V2 {
  const d = K.P[0];
  const rp = 0.09;
  const x = (R * R + d * d - rp * rp) / (2 * d);
  return [x, Math.sqrt(R * R - x * x)];
}

/** 턱 판 바깥 윤곽(집게 좌표) — 부채꼴 둘 + 안쪽 띠 + 핀 보스 원의 합집합 */
export function jawOutline280(): V2[] {
  const A0 = -22 * DEG;
  const A1 = 24 * DEG;
  const o = pinCross(0.87);
  const th = Math.atan2(o[1], o[0]);
  const ph = Math.atan2(o[1], o[0] - K.P[0]);
  const pts: V2[] = [];
  pts.push(...arc(0.51, A0, A1));
  pts.push(...arc(0.87, A1, th));
  pts.push(...arcAround(K.P[0], 0, 0.09, ph, -ph));
  pts.push(...arc(0.87, -th, A0));
  return pts;
}

/** 턱 판 가운데 창 윤곽(집게 좌표): 반지름 0.548~0.725, 각 −10°~12°, 핀 보스 원이 창으로 조금 들어옴 */
export function jawWindow280(): V2[] {
  const o = pinCross(0.725);
  const th = Math.atan2(o[1], o[0]);
  const ph = Math.atan2(o[1], o[0] - K.P[0]);
  const pts: V2[] = [];
  pts.push(...arc(0.548, -10 * DEG, 12 * DEG));
  pts.push(...arc(0.725, 12 * DEG, th));
  pts.push(...arcAround(K.P[0], 0, 0.09, ph, 2 * Math.PI - ph));
  pts.push(...arc(0.725, -th, -10 * DEG));
  return pts;
}

/** 턱 판 모양(창·핀 구멍 포함). 핀 구멍은 핀 0.025 보다 0.0005 크게 */
export function jawPlate280(): THREE.Shape {
  const s = shapeFrom(jawOutline280());
  s.holes.push(shapeFrom(jawWindow280()), circlePath(K.P[0], 0, 0.0255));
  return s;
}
