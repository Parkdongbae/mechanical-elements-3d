// 77·78·79번 전용 키트 — 번갈아 작용하는 두 폴(걸쇠) 래칫 세 가지
//   77: 핀 바퀴 + 흔들 레버 + 미는 폴 2개(핀을 번갈아 밂, 반시계)
//   78: 톱니(래칫) 바퀴 + A 자 틀 + 손잡이 레버 + 당기는 갈고리 폴 2개(시계)
//   79: 면 래칫(테 앞면에 톱니) 바퀴 + 축에 헐겁게 낀 팔 2개 + 왕복 막대(시계)
// 모든 자세는 구동 각 theta 의 닫힌 식(주기마다 바퀴가 정확히 정수 칸) — state77/78/79.
// 좌표는 모두 **바퀴 중심 기준**(2D, x 오른쪽·y 위), 각은 rad(반시계 +).
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, annularSector, circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape } from '../../models/parts/geom';
import type { V2 } from './belt';
import { setMM } from './mm';

const MARK = 0xf2b619;

// ───────────────────────── 공통 도우미 ─────────────────────────

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z 축 원기둥(z0→z1), 양끝 모따기 */
function zCyl(r: number, z0: number, z1: number, mat: THREE.Material, x = 0, y = 0): THREE.Mesh {
  const c = Math.min(r * 0.25, 0.01);
  const geo = lathe(rodProfile(r, 0, z1 - z0, c, c), 28);
  geo.rotateX(Math.PI / 2);
  return meshAt(geo, mat, x, y, z0);
}

/** 구멍 뚫린 고리(보스): 바깥 rOut, 안 rIn, z0→z1 */
function zRing(rOut: number, rIn: number, z0: number, z1: number, mat: THREE.Material, x = 0, y = 0): THREE.Mesh {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, TAU, false);
  s.holes.push(circlePath(0, 0, rIn));
  return meshAt(extrude(s, z1 - z0, 0.006), mat, x, y, (z0 + z1) / 2);
}

const frac = (x: number): number => x - Math.floor(x);
/** x 를 (−0.5, 0.5] 로 접는다 */
const wrapHalf = (x: number): number => x - Math.round(x);

/**
 * 두 원의 교점 가운데 **c2 가 c1 에서 본 방향의 반시계 쪽** 것(side = +1) 또는 시계 쪽 것(−1).
 * c1 = 원점. 만나지 않으면 가장 가까운 점(선 위)으로 접는다.
 */
function meet(r1: number, c2: V2, r2: number, side: 1 | -1): V2 {
  const d = Math.hypot(c2[0], c2[1]);
  const base = Math.atan2(c2[1], c2[0]);
  const cs = Math.max(-1, Math.min(1, (d * d + r1 * r1 - r2 * r2) / (2 * d * r1)));
  const a = base + side * Math.acos(cs);
  return [r1 * Math.cos(a), r1 * Math.sin(a)];
}
const angOf = (p: V2): number => Math.atan2(p[1], p[0]);

/** 단조 함수 f 의 근(lo, hi 사이, f(lo)·f(hi) ≤ 0) */
function bisect(f: (x: number) => number, lo: number, hi: number, n = 70): number {
  let a = lo;
  let b = hi;
  const fa = f(a);
  for (let i = 0; i < n; i++) {
    const m = (a + b) / 2;
    if (f(m) * fa > 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/**
 * 두 폴이 번갈아 작용해 한 주기에 정확히 cycle(rad) 만큼 돌게 하는 (진폭, 길이) 풀이.
 *   span(amp, len)  = 두 폴의 한 행정 이동각의 합(rad)       → cycle + 2·lost 가 되어야 한다
 *   phase(amp, len) = 행정이 바뀔 때 두 폴 끝의 각 차(rad)   → lost (mod pitch) 가 되어야 한다
 * len0 부근에서 가장 가까운 풀이를 고른다.
 */
function solvePair(
  span: (amp: number, len: number) => number,
  phase: (amp: number, len: number) => number,
  cycle: number,
  lost: number,
  pitch: number,
  ampRange: [number, number],
  len0: number,
  lenHalf: number
): { amp: number; len: number } {
  const ampFor = (len: number): number => bisect((a) => span(a, len) - (cycle + 2 * lost), ampRange[0], ampRange[1]);
  const res = (len: number): number => wrapHalf((phase(ampFor(len), len) - lost) / pitch);
  // len0 에서 양쪽으로 훑어 부호가 바뀌는(감김 점프가 아닌) 첫 구간
  const STEP = lenHalf / 200;
  let best: number | null = null;
  for (let i = 0; i < 200 && best === null; i++) {
    for (const s of [1, -1] as const) {
      const a = len0 + s * i * STEP;
      const b = a + s * STEP;
      const ra = res(a);
      const rb = res(b);
      if (ra * rb <= 0 && Math.abs(ra - rb) < 0.3) {
        best = bisect(res, Math.min(a, b), Math.max(a, b), 60);
        break;
      }
    }
  }
  const len = best ?? len0;
  return { amp: ampFor(len), len };
}

/**
 * 떨어짐 속도 제한(기억 없이): 폴이 핀·톱니에서 떨어질 때 한 프레임에 툭 내려앉지 않게,
 * 지난 구동각 LAG_N·LAG_H 동안의 기하 자세 f(θ − τ) 에서 rate·τ 만큼만 내려온 값들 가운데 가장 들린 것을 쓴다.
 * dir = +1 이면 값이 클수록 들린 것(최댓값), −1 이면 작을수록 들린 것(최솟값). 결과는 언제나 기하 자세보다 들려 있거나 같다(파고들지 않음).
 */
const LAG_N = 24;
const LAG_H = 0.01;
function eased2(f: (theta: number) => [number, number], theta: number, rate: number, dir: 1 | -1): [number, number] {
  const best = f(theta);
  for (let j = 1; j <= LAG_N; j++) {
    const v = f(theta - j * LAG_H);
    const drop = dir * rate * j * LAG_H;
    if (dir * (v[0] - drop) > dir * best[0]) best[0] = v[0] - drop;
    if (dir * (v[1] - drop) > dir * best[1]) best[1] = v[1] - drop;
  }
  return best;
}

/** 얇은 판(로컬 xy 윤곽, z 가운데 0). userData.outline 에 윤곽 */
function plate(outline: V2[], thick: number, mat: THREE.Material, holes: { x: number; y: number; r: number }[] = []): THREE.Mesh {
  const shape = shapeFrom(outline);
  for (const h of holes) shape.holes.push(circlePath(h.x, h.y, h.r));
  const m = mesh(extrude(shape, thick, Math.min(0.006, thick * 0.14)), mat);
  m.userData.outline = outline;
  return m;
}

/** 수학 좌표(y = 바퀴 반대쪽) 윤곽을 three 로컬(y 뒤집음, 반시계 유지)로 */
function flipY(pts: V2[]): V2[] {
  return pts.map(([x, y]): V2 => [x, -y]).reverse();
}

// ═════════════════════════ 77번: 핀 바퀴와 미는 폴 2개 ═════════════════════════

export const K77 = {
  /** 핀 수(판화에서 셈) */
  N: 24,
  /** 핀 원 반지름 */
  RP: 0.86,
  /** 핀 반지름 */
  PR: 0.04,
  /** 테 바깥·안 반지름 */
  ROUT: 0.95,
  RIN: 0.73,
  /** 레버 받침점 A(바퀴 중심 기준) */
  A: [1.59, 0.475] as V2,
  /** 받침점에서 위·아래 폴 핀까지 */
  AU: 0.305,
  AL: 0.34,
  /** 위 폴 길이(피벗 → 핀 자리 중심). 아래 폴 길이는 풀이로 정한다(초깃값 LL0) */
  LU: 1.132,
  LL0: 0.87,
  /** 핀 자리 지붕이 핀 중심 너머로 뻗은 길이 */
  ROOF: 0.05,
  /** 헛걸음(핀 간격에 대한 비) — 폴이 핀 뒤로 조금 더 물러났다가 다시 닿는다 */
  LOST: 0.1,
  /** 한 주기에 도는 핀 칸 수(폴마다 한 칸씩) */
  STEP: 2
} as const;

const P77 = TAU / K77.N;

function pivots77(phi: number): { U: V2; L: V2 } {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return {
    U: [K77.A[0] - K77.AU * s, K77.A[1] + K77.AU * c],
    L: [K77.A[0] + K77.AL * s, K77.A[1] - K77.AL * c]
  };
}
/** 폴(피벗 P, 길이 L)이 핀을 자리에 품었을 때 그 핀의 각(바퀴 중심 기준) */
const seat77 = (P: V2, L: number): number => angOf(meet(K77.RP, P, L, 1));

let solved77: { PHI: number; LL: number; aU0: number; aL1: number; AU: number } | null = null;
/** 77번 풀이값: 레버 진폭 PHI(rad), 아래 폴 길이 LL, 그 밖의 위상 상수 */
export function solve77(): { PHI: number; LL: number; aU0: number; aL1: number; AU: number } {
  if (solved77) return solved77;
  const dU = (amp: number): number => seat77(pivots77(amp).U, K77.LU) - seat77(pivots77(-amp).U, K77.LU);
  const dL = (amp: number, len: number): number => seat77(pivots77(-amp).L, len) - seat77(pivots77(amp).L, len);
  const lost = K77.LOST * P77;
  const r = solvePair(
    (amp, len) => dU(amp) + dL(amp, len),
    (amp, len) => seat77(pivots77(amp).U, K77.LU) - seat77(pivots77(amp).L, len),
    K77.STEP * P77,
    lost,
    P77,
    [0.05, 0.6],
    K77.LL0,
    0.12
  );
  solved77 = {
    PHI: r.amp,
    LL: r.len,
    aU0: seat77(pivots77(-r.amp).U, K77.LU),
    aL1: seat77(pivots77(r.amp).L, r.len),
    AU: dU(r.amp) - lost
  };
  return solved77;
}

/**
 * 미는 폴이 핀 하나(피벗에서 거리 d) 때문에 들려야 하는 각 δ(rad, 수학 좌표에서 핀 중심의 극각 — 0 이하이면 축선 아래).
 * 폴 자세 ψ = min(β_i + δ_i) (β = 피벗에서 핀을 본 각). 그 핀이 폴에 닿을 수 없으면 null.
 *   폴 윤곽(수학 좌표): 밑면 y = 0, 미는 면 = 중심 (L, 0)·반지름 rp 의 오목한 1/4 원((L − rp, 0) → (L, rp)), 지붕 y = rp 가 x = L + roof 까지.
 */
export function notchLift(d: number, L: number, rp: number, roof: number): number | null {
  const c = L - rp;
  if (d < c - 0.32) return null;
  if (d <= Math.hypot(c, rp)) return -Math.asin(rp / d); // 밑면 아래로 미끄러짐
  if (d <= L) return -Math.acos(Math.min(1, (d * d + c * c - rp * rp) / (2 * d * c))); // 모서리를 돌아 자리로
  const xe = L + roof;
  if (d <= xe) return 0; // 지붕 밑(자리)
  const E = Math.hypot(xe, rp);
  if (d >= E + rp) return null;
  return Math.atan2(rp, xe) - Math.acos(Math.min(1, (d * d + E * E - rp * rp) / (2 * d * E))); // 지붕 끝을 돌아 빠져나감
}

export interface State77 {
  /** 레버 각(rad, 반시계 +, 0 = 수직) */
  phi: number;
  /** 바퀴 rotation.z (핀 0 의 각, 반시계로 쌓임) */
  wheel: number;
  /** 폴 핀(피벗) 자리 — 바퀴 중심 기준 */
  pivotU: V2;
  pivotL: V2;
  /** 폴 rotation.z */
  psiU: number;
  psiL: number;
  /** 지금 미는 폴 */
  pushing: 'U' | 'L' | null;
  /** 지금까지 넘긴 핀 칸 수(실수) */
  steps: number;
}

function pawlAngle77(P: V2, L: number, wheel: number): number {
  let psi = Infinity;
  for (let i = 0; i < K77.N; i++) {
    const a = wheel + i * P77;
    const dx = K77.RP * Math.cos(a) - P[0];
    const dy = K77.RP * Math.sin(a) - P[1];
    const lift = notchLift(Math.hypot(dx, dy), L, K77.PR, K77.ROOF);
    if (lift === null) continue;
    let beta = Math.atan2(dy, dx);
    if (beta < 0) beta += TAU;
    psi = Math.min(psi, beta + lift);
  }
  return Number.isFinite(psi) ? psi : Math.PI;
}

/** 77번 전체 자세. theta = 구동 누적각(레버 한 번 왕복 = 2π). 폴이 핀에서 떨어지는 순간만 떨어짐 속도를 제한한다 */
export function state77(theta: number): State77 {
  const s = geo77(theta);
  const e = eased2((t) => {
    const g = geo77(t);
    return [g.psiU, g.psiL];
  }, theta, 0.6, -1);
  s.psiU = e[0];
  s.psiL = e[1];
  return s;
}

/** 77번 기하 자세(폴이 핀 위에 그대로 얹힌 자세) */
export function geo77(theta: number): State77 {
  const k = solve77();
  const lost = K77.LOST * P77;
  const u = theta + Math.PI / 2;
  const cyc = Math.floor(u / TAU);
  const v = u - cyc * TAU;
  const phi = -k.PHI * Math.cos(v);
  const pv = pivots77(phi);
  let adv: number;
  let pushing: 'U' | 'L' | null = null;
  if (v < Math.PI) {
    const tr = seat77(pv.U, K77.LU) - k.aU0 - lost;
    adv = Math.max(0, tr);
    if (tr > 0) pushing = 'U';
  } else {
    const tr = seat77(pv.L, k.LL) - k.aL1 - lost;
    adv = k.AU + Math.max(0, tr);
    if (tr > 0) pushing = 'L';
  }
  const W = cyc * K77.STEP * P77 + adv;
  const wheel = k.aU0 + lost + W;
  return {
    phi,
    wheel,
    pivotU: pv.U,
    pivotL: pv.L,
    psiU: pawlAngle77(pv.U, K77.LU, wheel),
    psiL: pawlAngle77(pv.L, k.LL, wheel),
    pushing,
    steps: W / P77
  };
}

/** 핀 바퀴 B: 테 + 십자 살 4개 + 허브 + 테 앞면의 핀 N 개(로컬 각 i·2π/N). 축 = 로컬 Z, 테 두께 가운데 z = 0, 핀은 z 0.03 → pinTop */
export function pinWheel77(pinTop = 0.2): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Shape();
  rim.absarc(0, 0, K77.ROUT, 0, TAU, false);
  rim.holes.push(circlePath(0, 0, K77.RIN));
  g.add(mesh(extrude(rim, 0.08, 0.008, 64), brass()));
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4;
    const sp = mesh(extrude(stadiumShape(0.1, 0, K77.RIN + 0.02, 0, 0.045), 0.05, 0.008), brass());
    sp.rotation.z = a;
    g.add(sp);
  }
  g.add(zRing(0.15, 0.055, -0.06, 0.07, darkSteel()));
  const outlines: Record<string, V2[]> = {};
  for (let i = 0; i < K77.N; i++) {
    const a = i * P77;
    const x = K77.RP * Math.cos(a);
    const y = K77.RP * Math.sin(a);
    g.add(zCyl(K77.PR, 0.03, pinTop, steel(), x, y));
    if (i % 6 === 0) g.add(meshAt(new THREE.CylinderGeometry(K77.PR * 0.6, K77.PR * 0.6, 0.008, 16).rotateX(Math.PI / 2), paint(MARK), x, y, pinTop + 0.002));
    outlines[`pin${i}`] = circlePts(K77.PR, 20, x, y);
  }
  g.userData.outlines = outlines;
  setMM(g, { kind: 'pinWheel', fn: 'pinWheel77', pins: K77.N, ringR: K77.RP, pinR: K77.PR, r: K77.ROUT, axis: 'z' });
  return g;
}

/** 미는 폴 윤곽(수학 좌표: 원점 = 피벗, +x = 끝 쪽, +y = 바퀴 반대쪽) */
export function notchPawlOutline(L: number, rp: number = K77.PR, roof: number = K77.ROOF): V2[] {
  const c = L - rp;
  const pts: V2[] = [
    [0, -0.035],
    [c - 0.32, 0],
    [c, 0]
  ];
  for (let i = 1; i <= 8; i++) {
    const a = Math.PI - (i * Math.PI) / 16;
    pts.push([L + rp * Math.cos(a), rp * Math.sin(a)]);
  }
  pts.push([L + roof, rp], [L + roof - 0.006, rp + 0.045], [L - rp * 0.4, rp + 0.055], [c - 0.1, 0.07], [0, 0.035]);
  return pts;
}

/**
 * 미는 폴(77번): 원점 = 피벗 구멍, 로컬 +X 로 길이 L 인 곳이 핀 자리 중심. 핀은 로컬 −Y 쪽(뒤집힌 수학 좌표)에서 들어온다
 * — rotation.z = state77().psiU/psiL 을 그대로 넣으면 핀 자리가 바퀴 쪽을 향한다. 두께 thick, z 가운데 0.
 */
export function notchPawl77(L: number, thick = 0.04): THREE.Group {
  const g = new THREE.Group();
  const outline = flipY(notchPawlOutline(L));
  const body = plate(outline, thick, steel());
  g.add(body);
  g.add(zRing(0.05, 0.02, -thick / 2 - 0.006, thick / 2 + 0.006, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.012, 0.008), paint(MARK), L * 0.5, -0.03, thick / 2 + 0.003));
  g.userData.outline = outline;
  body.userData.outline = undefined;
  setMM(g, { kind: 'pawl', fn: 'notchPawl77', length: L, pivot: [0, 0, 0], tip: [L, 0, 0] });
  return g;
}

/**
 * 흔들 레버 C(77번): 원점 = 받침점 A, 로컬 +Y 로 위 폴 핀(AU), −Y 로 아래 폴 핀(AL), 그 아래로 손잡이(down 까지).
 * 폴 핀 두 개는 앞(+z)으로 studTop 까지 나온다. 막대 두께 가운데 z = 0.
 */
export function rockLever77(down = 1.25, studTop = 0.11): THREE.Group {
  const g = new THREE.Group();
  const bar = stadiumShape(0, K77.AU + 0.02, 0, -down + 0.2, 0.05);
  bar.holes.push(circlePath(0, 0, 0.03));
  g.add(mesh(extrude(bar, 0.04, 0.008), bronze({ roughness: 0.34 })));
  g.add(zCyl(0.022, 0, studTop, steel(), 0, K77.AU));
  g.add(zCyl(0.022, 0, studTop, steel(), 0, -K77.AL));
  g.add(zRing(0.07, 0.03, -0.03, 0.03, darkSteel()));
  const grip = lathe(rodProfile(0.045, -down, -down + 0.26, 0.012, 0.012), 24);
  g.add(mesh(grip, wood()));
  setMM(g, { kind: 'lever', fn: 'rockLever77', pivot: [0, 0, 0], pinU: [0, K77.AU, 0], pinL: [0, -K77.AL, 0] });
  return g;
}

// ═════════════════════════ 78번: 톱니 바퀴와 당기는 갈고리 폴 2개 ═════════════════════════

export const K78 = {
  /** 톱니 수(판화의 이끝 간격 약 13° 에서) */
  N: 28,
  /** 이끝·이뿌리 반지름 */
  RT: 0.86,
  RR: 0.775,
  /** 레버 받침점(A 자 틀 꼭대기) — 바퀴 중심 기준 */
  F: [0, 1.07] as V2,
  /** 받침점에서 왼쪽 핀(폴 1)·오른쪽 핀(폴 2)까지 */
  AL: 0.385,
  AR: 0.4,
  /** 폴 1(왼쪽에 매달린 것) 길이. 폴 2 길이는 풀이(초깃값 L20) */
  L1: 0.723,
  L20: 0.752,
  /** 레버 가운데 각(rad) */
  PHI0: 0,
  LOST: 0.15,
  /** 한 주기에 도는 톱니 수 */
  STEP: 2,
  /** 바닥 높이(바퀴 중심 기준) */
  FLOOR: -0.96,
  /** 갈고리 손가락 높이 */
  HOOK: 0.155
} as const;

const P78 = TAU / K78.N;

function pins78(phi: number): { P1: V2; P2: V2 } {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return { P1: [K78.F[0] - K78.AL * c, K78.F[1] - K78.AL * s], P2: [K78.F[0] + K78.AR * c, K78.F[1] + K78.AR * s] };
}
/** 갈고리 끝이 이뿌리(반지름 rho)에 있을 때 그 각 */
const tip78 = (P: V2, L: number, rho: number = K78.RR): number => angOf(meet(rho, P, L, 1));

let solved78: { PHI: number; L2: number; a2min: number; a1max: number; A2: number; f0: number } | null = null;
/** 78번 풀이값: 레버 진폭 PHI, 폴 2 길이 L2, 위상 상수 */
export function solve78(): { PHI: number; L2: number; a2min: number; a1max: number; A2: number; f0: number } {
  if (solved78) return solved78;
  const lost = K78.LOST * P78;
  const d1 = (amp: number): number => tip78(pins78(K78.PHI0 + amp).P1, K78.L1) - tip78(pins78(K78.PHI0 - amp).P1, K78.L1);
  const d2 = (amp: number, len: number): number => tip78(pins78(K78.PHI0 - amp).P2, len) - tip78(pins78(K78.PHI0 + amp).P2, len);
  const r = solvePair(
    (amp, len) => d1(amp) + d2(amp, len),
    (amp, len) => tip78(pins78(K78.PHI0 + amp).P1, K78.L1) - tip78(pins78(K78.PHI0 + amp).P2, len),
    K78.STEP * P78,
    lost,
    P78,
    [0.03, 0.7],
    K78.L20,
    0.1
  );
  const a2min = tip78(pins78(K78.PHI0 - r.amp).P2, r.len);
  solved78 = {
    PHI: r.amp,
    L2: r.len,
    a2min,
    a1max: tip78(pins78(K78.PHI0 + r.amp).P1, K78.L1),
    A2: d2(r.amp, r.len) - lost,
    f0: a2min - lost
  };
  return solved78;
}

/** 톱니 바퀴 윤곽 반지름: 로컬 각 a(반시계). 곧은 면이 a = k·p, 그 반시계 쪽이 골(이뿌리), 거기서 반시계로 가며 비스듬히 올라 다음 곧은 면에서 이끝 */
export function sawRadius78(a: number): number {
  return K78.RR + (K78.RT - K78.RR) * frac(a / P78);
}

export interface State78 {
  /** 레버 각(rad, 반시계 + = 손잡이가 올라감) */
  phi: number;
  /** 바퀴 rotation.z (시계로 쌓이므로 줄어든다) */
  wheel: number;
  /** 폴 핀 자리(바퀴 중심 기준): 1 = 왼쪽, 2 = 오른쪽 */
  pin1: V2;
  pin2: V2;
  /** 폴 rotation.z */
  psi1: number;
  psi2: number;
  /** 갈고리 끝의 반지름(바퀴 중심에서) */
  rho1: number;
  rho2: number;
  /** 지금 당기는 폴 */
  pulling: 1 | 2 | null;
  /** 지금까지 넘긴 톱니 수(실수) */
  steps: number;
}

/**
 * 갈고리 끝이 바퀴 윤곽 위에 얹힌 자세(끝 반지름).
 *   inner = false(물러나는 행정): 바깥에서 안으로 훑어 처음 닿는 곳 — 이끝 위에 올라타 있다가 끝이 곧은 면을 넘으면 골로 떨어진다.
 *   inner = true(당기는 행정의 헛걸음 구간): 이뿌리에서 밖으로 훑어 처음 닿는 곳 — 이미 골 안에 든 끝이 비탈을 타고 곧은 면 쪽으로 내려온다.
 */
function rest78(P: V2, L: number, wheelRot: number, pullStroke: boolean, startLocal: number): number {
  const g = (rho: number): number => rho - sawRadius78(tip78(P, L, rho) - wheelRot);
  // 물러나는 행정의 첫머리: 끝이 방금 당기던 곧은 면 옆 골에 아직 들어 있다(이끝 높이의 자리가 그 면을 지나기 전)
  const inner = pullStroke || tip78(P, L, K78.RT) - wheelRot < startLocal + 1e-9;
  const out = K78.RT + 0.02;
  const NS = 48;
  if (inner) {
    let prev: number = K78.RR;
    for (let i = 1; i <= NS; i++) {
      const rho = K78.RR + ((K78.RT - K78.RR) * i) / NS;
      const gv = g(rho);
      if (gv >= 0) {
        let a = prev;
        let b = rho;
        for (let k = 0; k < 26; k++) {
          const m = (a + b) / 2;
          if (g(m) >= 0) b = m;
          else a = m;
        }
        return b;
      }
      if (gv < -(K78.RT - K78.RR) * 0.6) return prev; // 곧은 면을 넘어 이 속으로 — 그 직전(면에 닿은 자리)
      prev = rho;
    }
    return K78.RT;
  }
  let prev = out;
  for (let i = 1; i <= NS; i++) {
    const rho = out + ((K78.RR - out) * i) / NS;
    if (g(rho) <= 0) {
      let a = prev;
      let b = rho;
      for (let k = 0; k < 26; k++) {
        const m = (a + b) / 2;
        if (g(m) <= 0) b = m;
        else a = m;
      }
      return a;
    }
    prev = rho;
  }
  return K78.RR;
}
function psiAt78(P: V2, L: number, rho: number): number {
  const t = meet(rho, P, L, 1);
  return Math.atan2(t[1] - P[1], t[0] - P[0]);
}

/** 78번 전체 자세. theta = 구동 누적각(레버 한 번 왕복 = 2π). 갈고리가 이끝에서 골로 떨어지는 순간만 떨어짐 속도를 제한한다 */
export function state78(theta: number): State78 {
  const k = solve78();
  const s = geo78(theta);
  const e = eased2((t) => {
    const g = geo78(t);
    return [g.rho1, g.rho2];
  }, theta, 0.6, 1);
  s.rho1 = e[0];
  s.rho2 = e[1];
  s.psi1 = psiAt78(s.pin1, K78.L1, e[0]);
  s.psi2 = psiAt78(s.pin2, k.L2, e[1]);
  return s;
}

/** 78번 기하 자세(갈고리 끝이 바퀴 윤곽에 그대로 얹힌 자세) */
export function geo78(theta: number): State78 {
  const k = solve78();
  const lost = K78.LOST * P78;
  const u = theta + Math.PI / 2;
  const cyc = Math.floor(u / TAU);
  const v = u - cyc * TAU;
  const phi = K78.PHI0 - k.PHI * Math.cos(v);
  const pn = pins78(phi);
  let adv: number;
  let pulling: 1 | 2 | null = null;
  if (v < Math.PI) {
    const tr = k.a2min - tip78(pn.P2, k.L2) - lost;
    adv = Math.max(0, tr);
    if (tr > 0) pulling = 2;
  } else {
    const tr = k.a1max - tip78(pn.P1, K78.L1) - lost;
    adv = k.A2 + Math.max(0, tr);
    if (tr > 0) pulling = 1;
  }
  const W = cyc * K78.STEP * P78 + adv;
  const wheel = k.f0 - W;
  // 물러나기 시작한 순간(자기 당김 행정의 끝)에 끝이 있던 곧은 면의 바퀴 로컬 각
  const base = cyc * K78.STEP * P78;
  const start1 = tip78(pins78(K78.PHI0 - k.PHI).P1, K78.L1) - (k.f0 - base);
  const start2 = k.a2min - k.A2 - lost - (k.f0 - base - k.A2);
  const rho1 = pulling === 1 ? K78.RR : rest78(pn.P1, K78.L1, wheel, v >= Math.PI, start1);
  const rho2 = pulling === 2 ? K78.RR : rest78(pn.P2, k.L2, wheel, v < Math.PI, start2);
  return {
    phi,
    wheel,
    pin1: pn.P1,
    pin2: pn.P2,
    psi1: psiAt78(pn.P1, K78.L1, rho1),
    psi2: psiAt78(pn.P2, k.L2, rho2),
    rho1,
    rho2,
    pulling,
    steps: W / P78
  };
}

/** 톱니 바퀴 윤곽(로컬, 반시계 다각형) */
export function sawOutline78(): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < K78.N; i++) {
    const a = i * P78;
    // 곧은 면: 이끝(시계 쪽에서 올라온 끝) → 이뿌리
    pts.push([K78.RT * Math.cos(a), K78.RT * Math.sin(a)], [K78.RR * Math.cos(a), K78.RR * Math.sin(a)]);
  }
  return pts;
}

/** 톱니(래칫) 바퀴 A(78번): 톱니 테 + 살 4개 + 허브. 축 = 로컬 Z, 두께 width(가운데 z = 0). 시계 방향으로 끌려 돈다 */
export function sawWheel78(width = 0.08): THREE.Group {
  const g = new THREE.Group();
  const outline = sawOutline78();
  const shape = shapeFrom(outline);
  const rimIn = K78.RR - 0.09;
  for (let i = 0; i < 4; i++) {
    const a0 = (i * TAU) / 4 + 0.09;
    const a1 = ((i + 1) * TAU) / 4 - 0.09;
    shape.holes.push(annularSector(0.16, rimIn, a0, a1));
  }
  shape.holes.push(circlePath(0, 0, 0.05));
  g.add(mesh(extrude(shape, width, 0.006, 32), brass()));
  g.add(zRing(0.13, 0.05, -width / 2 - 0.02, width / 2 + 0.02, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.16, 0.016, 0.01), paint(MARK), rimIn * 0.6, 0, width / 2 + 0.004));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'sawWheel78', teeth: K78.N, rTip: K78.RT, rRoot: K78.RR, r: K78.RT, width, axis: 'z' });
  return g;
}

/** 갈고리 폴 윤곽(수학 좌표: 원점 = 피벗, 갈고리 끝 = (L, 0), +y = 바퀴 반대쪽) */
export function hookPawlOutline(L: number, hook: number = K78.HOOK): V2[] {
  // 당기는 면은 끝에서 위로 가며 14° 뒤(+x)로 눕는다 — 톱니의 곧은 면(폴 좌표에서 5~9° 누움)에는 끝만 닿는다.
  // 막대 밑면은 피벗 가까이에서 꺾여 올라가 이끝들(축선 위 0.08 까지 올라옴)을 0.02 넘게 비킨다.
  const hf = hook - 0.035;
  return [
    [0, -0.03],
    [0.15, hf * 0.5],
    [L + 0.25 * hf, hf], // 당기는 면 위 끝
    [L, 0], // 갈고리 끝(뾰족)
    [L + 0.115, hf - 0.005], // 등
    [L + 0.12, hf + 0.05],
    [L - 0.02, hf + 0.06],
    [0.13, hf * 0.5 + 0.065],
    [0, 0.035]
  ];
}

/**
 * 당기는 갈고리 폴(78번): 원점 = 피벗 구멍, 갈고리 끝 = 로컬 (L, 0). 갈고리 손가락은 로컬 −Y 쪽 막대에서 축선으로 내려온다
 * (뒤집힌 수학 좌표) — rotation.z = state78().psi1/psi2. 두께 thick, z 가운데 0.
 */
export function hookPawl78(L: number, thick = 0.04): THREE.Group {
  const g = new THREE.Group();
  const outline = flipY(hookPawlOutline(L));
  const body = plate(outline, thick, steel());
  g.add(body);
  g.add(zRing(0.05, 0.02, -thick / 2 - 0.006, thick / 2 + 0.006, darkSteel()));
  g.userData.outline = outline;
  body.userData.outline = undefined;
  setMM(g, { kind: 'pawl', fn: 'hookPawl78', length: L, pivot: [0, 0, 0], tip: [L, 0, 0] });
  return g;
}

/**
 * A 자 틀(78번): 원점 = 바퀴 중심. 꼭대기 = K78.F, 두 다리가 바닥(K78.FLOOR)의 x = ±spread 로 벌어짐, 바퀴 축 높이에 가로대와 베어링 보스, 발판.
 * 두께 thick(가운데 z = 0).
 */
export function aFrame78(spread = 0.6, thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const mat = castIron();
  const top = K78.F;
  for (const s of [-1, 1] as const) {
    g.add(mesh(extrude(stadiumShape(top[0], top[1], s * spread, K78.FLOOR + 0.05, 0.055), thick, 0.01), mat));
    g.add(meshAt(new THREE.BoxGeometry(0.3, 0.05, thick + 0.1), mat, s * spread, K78.FLOOR + 0.025, 0));
  }
  // 가로대: 축 높이에서 두 다리 사이
  const t = (top[1] - 0) / (top[1] - (K78.FLOOR + 0.05));
  const xl = spread * t;
  g.add(mesh(extrude(stadiumShape(-xl, 0, xl, 0, 0.05), thick, 0.01), mat));
  g.add(zRing(0.1, 0.048, -thick / 2 - 0.015, thick / 2 + 0.02, darkSteel()));
  g.add(zRing(0.085, 0.03, -thick / 2 - 0.01, thick / 2 + 0.012, darkSteel(), top[0], top[1]));
  setMM(g, { kind: 'frame', fn: 'aFrame78', apex: [top[0], top[1], 0], axle: [0, 0, 0] });
  return g;
}

/**
 * 손잡이 레버 B(78번): 원점 = 받침점, 로컬 −X 로 AL 에 폴 1 핀, +X 로 AR 에 폴 2 핀, 그 너머 handle 까지 손잡이.
 * 두 폴 핀은 뒤(−z)로 studBack 만큼 뻗어 바퀴 평면의 폴을 꿴다. 막대 두께 가운데 z = 0.
 */
export function handLever78(handle = 1.3, studBack = 0.32): THREE.Group {
  const g = new THREE.Group();
  const bar = stadiumShape(-K78.AL, 0, handle - 0.24, 0, 0.05);
  bar.holes.push(circlePath(0, 0, 0.03));
  g.add(mesh(extrude(bar, 0.045, 0.008), bronze({ roughness: 0.34 })));
  g.add(zCyl(0.022, -studBack, 0.035, steel(), -K78.AL, 0));
  g.add(zCyl(0.022, -studBack, 0.035, steel(), K78.AR, 0));
  g.add(zCyl(0.03, -0.12, 0.05, steel()));
  const grip = lathe(rodProfile(0.045, handle - 0.28, handle, 0.012, 0.012), 24);
  grip.rotateZ(-Math.PI / 2);
  g.add(mesh(grip, wood()));
  setMM(g, { kind: 'lever', fn: 'handLever78', pivot: [0, 0, 0], pin1: [-K78.AL, 0, 0], pin2: [K78.AR, 0, 0] });
  return g;
}

// ═════════════════════════ 79번: 면 래칫과 왕복 막대 ═════════════════════════

export const K79 = {
  /** 면 톱니 수 */
  N: 36,
  /** 테 바깥·안 반지름, 폴이 닿는 가운데 반지름 */
  ROUT: 0.8,
  RIN: 0.67,
  RM: 0.735,
  /** 톱니 높이(테 앞면에서 +z) */
  H: 0.035,
  /** 팔 C 길이(축 → 끝 핀), 이음 막대 길이(끝 핀 → 막대 B 의 핀) */
  ARM: 0.94,
  LINK: 1.2,
  /** 폴: 경첩이 테 앞면에서 떠 있는 높이, 판 길이 */
  HINGE: 0.07,
  LP: 0.15,
  LOST: 0.15,
  /** 한 행정(팔 하나)에 넘기는 톱니 수 */
  STEP: 2
} as const;

const P79 = TAU / K79.N;
/** 팔의 최소·최대 벌림각(rad): γmin + γmax = 90°, γmax − γmin = (STEP + LOST)·p */
const G79 = (() => {
  const d = (K79.STEP + K79.LOST) * P79;
  return { min: Math.PI / 4 - d / 2, max: Math.PI / 4 + d / 2 };
})();
/** 팔 벌림각 γ 일 때 막대 B 핀의 x(바퀴 중심 기준, 축선 y = 0 위) */
const xB79 = (g: number): number => K79.ARM * Math.cos(g) + Math.sqrt(K79.LINK * K79.LINK - K79.ARM * K79.ARM * Math.sin(g) * Math.sin(g));
/** 폴이 골 바닥에 닿았을 때 기울기와, 경첩에서 끝까지의 각 거리 */
const TILT0_79 = Math.asin(K79.HINGE / K79.LP);
const KAPPA79 = Math.atan((K79.LP * Math.cos(TILT0_79)) / K79.RM);

/** 79번 치수에서 나오는 값: 막대 B 의 x 범위, 팔 벌림각 범위 */
export const RANGE79 = { xMin: xB79(G79.max), xMax: xB79(G79.min), gMin: G79.min, gMax: G79.max } as const;

/** 면 톱니 높이(테 앞면 기준): 바퀴 로컬 각 a(반시계). 곧은 면이 a = k·p, 그 반시계 쪽이 골(0), 반시계로 가며 올라 다음 곧은 면에서 H */
export function faceHeight79(a: number): number {
  return K79.H * frac(a / P79);
}

export interface State79 {
  /** 막대 B 핀의 x(바퀴 중심 기준, y = 0) */
  xB: number;
  /** 팔 벌림각: 위 팔 rotation.z = +gamma, 아래 팔 = −gamma */
  gamma: number;
  /** 바퀴 rotation.z (시계로 쌓여 줄어든다) */
  wheel: number;
  /** 폴 기울기(rad, 끝이 −z 로 내려간 각): placeFlapPawl79 에 넣는다 */
  tiltU: number;
  tiltL: number;
  /** 지금 미는 팔 */
  pushing: 'U' | 'L' | null;
  steps: number;
}

/** 폴 끝이 톱니 면에 얹힌 기울기. inner = true(미는 행정의 헛걸음 구간)면 골 바닥에서 위로, false(물러나는 행정)면 위에서 아래로 훑는다 */
function tilt79(armAngle: number, wheelRot: number, pushStroke: boolean, startLocal: number): number {
  // 판 끝: 경첩에서 시계 쪽으로 atan(LP·cos τ / RM)(판이 접선 방향으로 곧게 뻗으므로), 높이 HINGE − LP·sin τ
  const f = (tau: number): number => K79.HINGE - K79.LP * Math.sin(tau) - faceHeight79(armAngle - Math.atan((K79.LP * Math.cos(tau)) / K79.RM) - wheelRot);
  const top = Math.asin((K79.HINGE - K79.H - 0.004) / K79.LP);
  const deep = TILT0_79;
  const inner = pushStroke || armAngle - Math.atan((K79.LP * Math.cos(top)) / K79.RM) - wheelRot < startLocal + 1e-9;
  const NS = 60;
  if (inner) {
    let prev = deep;
    for (let i = 1; i <= NS; i++) {
      const tau = deep + ((top - deep) * i) / NS;
      const fv = f(tau);
      if (fv >= 0) {
        let a = prev;
        let b = tau;
        for (let k = 0; k < 26; k++) {
          const m = (a + b) / 2;
          if (f(m) >= 0) b = m;
          else a = m;
        }
        return b;
      }
      if (fv < -K79.H * 0.6) return prev;
      prev = tau;
    }
    return top;
  }
  let prev = top;
  for (let i = 1; i <= NS; i++) {
    const tau = top + ((deep - top) * i) / NS;
    if (f(tau) <= 0) {
      let a = prev;
      let b = tau;
      for (let k = 0; k < 26; k++) {
        const m = (a + b) / 2;
        if (f(m) <= 0) b = m;
        else a = m;
      }
      return a;
    }
    prev = tau;
  }
  return deep;
}

/** 79번 전체 자세. theta = 구동 누적각(막대 한 번 왕복 = 2π). 막대는 사인 왕복. 폴이 톱니 끝에서 골로 떨어지는 순간만 떨어짐 속도를 제한한다 */
export function state79(theta: number): State79 {
  const s = geo79(theta);
  const e = eased2((t) => {
    const g = geo79(t);
    return [g.tiltU, g.tiltL];
  }, theta, 1.2, -1);
  s.tiltU = e[0];
  s.tiltL = e[1];
  return s;
}

/** 79번 기하 자세(폴 끝이 톱니 면에 그대로 얹힌 자세) */
export function geo79(theta: number): State79 {
  const lost = K79.LOST * P79;
  const cyc = Math.floor(theta / TAU);
  const v = theta - cyc * TAU;
  const xm = (RANGE79.xMin + RANGE79.xMax) / 2;
  const xa = (RANGE79.xMax - RANGE79.xMin) / 2;
  const xB = xm - xa * Math.cos(v); // v 0 → π: 오른쪽으로(팔이 오므라듦, 위 팔이 민다)
  const cs = (K79.ARM * K79.ARM + xB * xB - K79.LINK * K79.LINK) / (2 * K79.ARM * xB);
  const gamma = Math.acos(Math.max(-1, Math.min(1, cs)));
  let adv: number;
  let pushing: 'U' | 'L' | null = null;
  if (v < Math.PI) {
    const tr = G79.max - gamma - lost;
    adv = Math.max(0, tr);
    if (tr > 0) pushing = 'U';
  } else {
    const tr = gamma - G79.min - lost;
    adv = K79.STEP * P79 + Math.max(0, tr);
    if (tr > 0) pushing = 'L';
  }
  const base = cyc * 2 * K79.STEP * P79;
  const W = base + adv;
  const rot0 = G79.max - KAPPA79 - lost;
  const wheel = rot0 - W;
  return {
    xB,
    gamma,
    wheel,
    tiltU: pushing === 'U' ? TILT0_79 : tilt79(gamma, wheel, v < Math.PI, G79.min - KAPPA79 - (rot0 - base - K79.STEP * P79)),
    tiltL: pushing === 'L' ? TILT0_79 : tilt79(-gamma, wheel, v >= Math.PI, -G79.max - KAPPA79 - (rot0 - base)),
    pushing,
    steps: W / P79
  };
}

/**
 * 면 래칫 바퀴 A(79번): 테(앞면 z = +0.05 에 톱니 N 개, 높이 H) + 얇은 원판(구멍 6개) + 허브. 축 = 로컬 Z, 테 두께 0.1(가운데 z = 0).
 * 톱니의 곧은 면은 로컬 각 k·2π/N, 시계 방향으로 밀려 돈다.
 */
export function faceRatchetWheel79(): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Shape();
  rim.absarc(0, 0, K79.ROUT, 0, TAU, false);
  rim.holes.push(circlePath(0, 0, K79.RIN));
  g.add(mesh(extrude(rim, 0.1, 0.008, 64), brass()));
  const web = new THREE.Shape();
  web.absarc(0, 0, K79.RIN + 0.01, 0, TAU, false);
  for (let i = 0; i < 6; i++) web.holes.push(circlePath(0.42 * Math.cos((i * TAU) / 6), 0.42 * Math.sin((i * TAU) / 6), 0.11));
  web.holes.push(circlePath(0, 0, 0.05));
  g.add(meshAt(extrude(web, 0.03, 0.004, 48), brass(), 0, 0, -0.02));
  g.add(zRing(0.16, 0.05, -0.06, 0.06, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.16, 0.016, 0.01), paint(MARK), 0.25, 0, -0.002));
  // 톱니: 한 칸 = 삼각 쐐기(골 → 비탈 → 곧은 면)
  const pos: number[] = [];
  const z0 = 0.05;
  const SUB = 3;
  const P = (r: number, a: number, z: number): [number, number, number] => [r * Math.cos(a), r * Math.sin(a), z];
  const quad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): void => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  const r0 = K79.RIN + 0.004;
  const r1 = K79.ROUT - 0.004;
  for (let k = 0; k < K79.N; k++) {
    const a0 = k * P79;
    for (let s = 0; s < SUB; s++) {
      const u0 = s / SUB;
      const u1 = (s + 1) / SUB;
      const b0 = a0 + u0 * P79;
      const b1 = a0 + u1 * P79;
      // 비탈(위쪽 면)
      quad(P(r0, b0, z0 + K79.H * u0), P(r1, b0, z0 + K79.H * u0), P(r1, b1, z0 + K79.H * u1), P(r0, b1, z0 + K79.H * u1));
      // 바깥·안 옆면
      quad(P(r1, b0, z0), P(r1, b1, z0), P(r1, b1, z0 + K79.H * u1), P(r1, b0, z0 + K79.H * u0));
      quad(P(r0, b1, z0), P(r0, b0, z0), P(r0, b0, z0 + K79.H * u0), P(r0, b1, z0 + K79.H * u1));
    }
    // 곧은 면(다음 칸의 골을 본다)
    const a1 = a0 + P79;
    quad(P(r1, a1, z0), P(r0, a1, z0), P(r0, a1, z0 + K79.H), P(r1, a1, z0 + K79.H));
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tg.computeVertexNormals();
  g.add(mesh(tg, steel()));
  setMM(g, { kind: 'ratchet', fn: 'faceRatchetWheel79', teeth: K79.N, r: K79.ROUT, rIn: K79.RIN, toothH: K79.H, faceZ: z0, axis: 'z' });
  return g;
}

/**
 * 방사형 팔 C(79번): 원점 = 바퀴 축(헐겁게 낀 허브 고리), 로컬 +X 로 K79.ARM 에 끝 핀 구멍. 두께 0.03(가운데 z = 0).
 * 반지름 K79.RM 자리에 폴 경첩 받침이 뒤(−z)로 drop 만큼 내려온다(경첩 축 = 로컬 X, z = −drop).
 */
export function radialArm79(drop: number, forkHinge = false): THREE.Group {
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, K79.ARM, 0, 0.045);
  bar.holes.push(circlePath(0, 0, 0.05));
  bar.holes.push(circlePath(K79.ARM, 0, 0.022));
  g.add(mesh(extrude(bar, 0.03, 0.006), bronze({ roughness: 0.34 })));
  g.add(zRing(0.11, 0.05, -0.015, 0.015, bronze({ roughness: 0.34 })));
  g.add(zRing(0.06, 0.022, -0.02, 0.02, darkSteel(), K79.ARM, 0));
  // 경첩 받침(팔 밑면 → 경첩 축)
  const h = Math.max(0.012, drop - 0.003);
  if (forkHinge) {
    // 갈래 받침: 폴 통(길이 0.11)의 양 끝 바깥에 볼 두 장 — 통과 판이 받침 속으로 들어가지 않는다
    const lo = drop + 0.018;
    for (const sx of [-1, 1]) {
      g.add(meshAt(new THREE.BoxGeometry(0.012, 0.04, lo - 0.015), darkSteel(), K79.RM + sx * 0.062, 0, -(0.015 + lo) / 2));
    }
  } else {
    g.add(meshAt(new THREE.BoxGeometry(0.05, 0.05, h), darkSteel(), K79.RM, 0, -0.015 - h / 2));
  }
  setMM(g, { kind: 'arm', fn: 'radialArm79', pivot: [0, 0, 0], pin: [K79.ARM, 0, 0], hinge: [K79.RM, 0, -drop] });
  return g;
}

/**
 * 폴(79번): 경첩으로 달린 작은 판. 원점 = 경첩 축 가운데, 로컬 +X 로 길이 K79.LP(끝이 톱니에 닿음), 로컬 Y = 경첩 축(반지름 방향).
 * 자세는 placeFlapPawl79 로 잡는다.
 */
export function flapPawl79(radialTip = false): THREE.Group {
  const g = new THREE.Group();
  const w = 0.09;
  if (radialTip) {
    // 끝 모서리를 바퀴의 반지름 방향(톱니 곧은 면과 나란히)으로 비스듬히 자른다: 로컬 y 에서 끝 x = LP·(1 + y/RM)
    const t = (y: number): number => K79.LP * (1 + y / K79.RM);
    const sh = shapeFrom([[0, -w / 2], [t(-w / 2), -w / 2], [t(w / 2), w / 2], [0, w / 2]]);
    const pg = extrude(sh, 0.012);
    pg.translate(0, 0, 0.006);
    g.add(mesh(pg, steel()));
  } else {
    g.add(meshAt(new THREE.BoxGeometry(K79.LP, w, 0.012), steel(), K79.LP / 2, 0, 0.006));
  }
  const barrel = new THREE.CylinderGeometry(0.014, 0.014, w + 0.02, 16);
  g.add(meshAt(barrel, darkSteel(), 0, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.03, w * 0.6, 0.004), paint(MARK), K79.LP - 0.02, 0, 0.014));
  setMM(g, { kind: 'pawl', fn: 'flapPawl79', length: K79.LP, pivot: [0, 0, 0], tip: [K79.LP, 0, 0] });
  return g;
}

/**
 * 폴을 팔에 맞춰 놓는다(폴은 바퀴 중심을 원점으로 하는 그룹의 자식이어야 한다).
 * armAngle = 팔 rotation.z, tilt = state79().tiltU/tiltL, hingeZ = 경첩 높이(그 그룹 좌표: 테 앞면 z + K79.HINGE).
 * 판은 팔에서 시계 방향으로 뻗고 끝이 −z 로 tilt 만큼 내려간다.
 */
export function placeFlapPawl79(pawl: THREE.Object3D, armAngle: number, tilt: number, hingeZ: number): void {
  const c = Math.cos(armAngle);
  const s = Math.sin(armAngle);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const X = new THREE.Vector3(s * ct, -c * ct, -st);
  const Y = new THREE.Vector3(c, s, 0);
  const Z = new THREE.Vector3().crossVectors(X, Y);
  pawl.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  pawl.position.set(K79.RM * c, K79.RM * s, hingeZ);
}

/** 이음 막대(79번): 원점 = 한쪽 핀 구멍, 로컬 +X 로 len 에 다른 핀 구멍. 납작한 막대, 두께 0.03(가운데 z = 0) */
export function linkBar79(len: number = K79.LINK): THREE.Group {
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, len, 0, 0.032);
  bar.holes.push(circlePath(0, 0, 0.022));
  bar.holes.push(circlePath(len, 0, 0.022));
  g.add(mesh(extrude(bar, 0.03, 0.006), steel()));
  setMM(g, { kind: 'link', fn: 'linkBar79', length: len, a: [0, 0, 0], b: [len, 0, 0] });
  return g;
}

/**
 * 왕복 막대 B(79번): 원점 = 핀 구멍(갈래 끝), 로컬 +X 로 len 까지 둥근 막대. 핀은 z0 → z1 로 이음 막대 둘과 갈래를 꿴다.
 */
export function forkRod79(len = 1.0, z0 = -0.08, z1 = 0.08): THREE.Group {
  const g = new THREE.Group();
  g.add(zRing(0.06, 0.022, -0.02, 0.02, bronze({ roughness: 0.34 })));
  g.add(zCyl(0.022, z0, z1, steel()));
  const rodGeo = lathe(rodProfile(0.035, 0.05, len, 0.008, 0.008), 24);
  rodGeo.rotateZ(-Math.PI / 2);
  g.add(mesh(rodGeo, bronze({ roughness: 0.34 })));
  g.add(meshAt(new THREE.CylinderGeometry(0.0362, 0.0362, 0.014, 24).rotateZ(Math.PI / 2), paint(MARK), len * 0.45, 0, 0));
  setMM(g, { kind: 'rod', fn: 'forkRod79', pin: [0, 0, 0], length: len });
  return g;
}

/**
 * 막대 안내(79번, 판화에 없음): 원점 = 막대 중심선이 지나는 구멍 가운데. 구멍(로컬 X 방향) 뚫린 블록 + 뒤판(z = backZ)까지 가는 기둥.
 * zc = 블록 가운데의 세계 z(기둥 길이 계산용).
 */
export function rodGuide79(zc: number, backZ = -0.3): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.09, -0.09);
  s.lineTo(0.09, -0.09);
  s.lineTo(0.09, 0.09);
  s.lineTo(-0.09, 0.09);
  s.closePath();
  s.holes.push(circlePath(0, 0, 0.038));
  const block = extrude(s, 0.16, 0.008);
  block.rotateY(Math.PI / 2);
  g.add(mesh(block, castIron()));
  g.add(zCyl(0.045, backZ - zc, -0.085, castIron(), 0, 0));
  setMM(g, { kind: 'guide', fn: 'rodGuide79', axis: 'x' });
  return g;
}
