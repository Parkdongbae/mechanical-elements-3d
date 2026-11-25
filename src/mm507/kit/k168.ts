// 168번 전용 키트 — 홈 크랭크와 타원 궤도 (169번도 이 파일의 공용 부분을 import 한다)
//  · 둘째 크랭크(고정 반지름 r2)가 피트먼(연결 막대)의 중간 점 P2 를 원으로 돌리고,
//  · 피트먼의 오른끝 P3 는 위 고정 핀 H 에 매달린 흔들이 막대(왕복 동력)에 물려 오른쪽에서 왔다갔다 하며,
//  · 피트먼의 왼끝 P1(= 연장점)은 세로로 긴 타원 궤도를 그린다.
//  · 168: P1 의 핀이 주축 크랭크의 홈 안을 미끄러지며 그 크랭크를 돌린다(홈 크랭크).
//  자세는 모두 주축 크랭크 각 alpha(= theta) 의 닫힌 식(표 뒤집기 — 한 주기 2π 로 정확히 닫힌다).
import * as THREE from 'three';
import { bronze, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;

// ───────────────────────── 층 (z) ─────────────────────────
//  크랭크 판 · 피트먼 · 흔들이 막대가 서로 다른 층에서 겹쳐 지나간다(판화의 앞뒤).
export const ZL = {
  crank: [0.06, 0.105] as const, // 홈 크랭크 · 둘째 크랭크 팔
  pitman: [0.13, 0.18] as const,
  rocker: [0.19, 0.24] as const,
  pinHead: 0.215, // 핀 머리 앞면
};

// ───────────────────────── 평면 연동 계산 ─────────────────────────
export interface Four {
  S2: V2; // 둘째 크랭크 축
  r2: number; // 둘째 크랭크 반지름
  L23: number; // P2 ~ P3
  H: V2; // 흔들이 막대 위 고정 핀
  Lr: number; // 흔들이 막대 길이
  L12: number; // P1 ~ P2 (P1 은 P3 → P2 방향의 연장선 위)
}

export interface Coupler {
  P1: V2;
  P2: V2;
  P3: V2;
  /** 피트먼 방향(P1 → P3 의 각) */
  beta: number;
  /** 흔들이 막대 각 — 로컬 −Y(아래)로 늘어진 막대의 rotation.z */
  rock: number;
}

/** 두 원의 교점(sgn ±1 로 한쪽 고름) */
export function circInt(c1: V2, r1: number, c2: V2, r2: number, sgn: 1 | -1): V2 | null {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d < 1e-9) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d;
  const my = c1[1] + (a * dy) / d;
  return [mx + (sgn * h * dy) / d, my - (sgn * h * dx) / d];
}

/** 둘째 크랭크 각 phi → 피트먼 세 점 */
export function coupler(P: Four, phi: number): Coupler {
  const P2: V2 = [P.S2[0] + P.r2 * Math.cos(phi), P.S2[1] + P.r2 * Math.sin(phi)];
  const a = circInt(P2, P.L23, P.H, P.Lr, 1);
  const b = circInt(P2, P.L23, P.H, P.Lr, -1);
  if (!a || !b) throw new Error('coupler: 연결이 닫히지 않음');
  const P3 = a[1] < b[1] ? a : b; // 아래 쪽 교점(막대가 위 핀에 매달림)
  const ux = (P2[0] - P3[0]) / P.L23;
  const uy = (P2[1] - P3[1]) / P.L23;
  const P1: V2 = [P2[0] + P.L12 * ux, P2[1] + P.L12 * uy];
  return {
    P1, P2, P3,
    beta: Math.atan2(P3[1] - P1[1], P3[0] - P1[0]),
    rock: Math.atan2(P3[1] - P.H[1], P3[0] - P.H[0]) + Math.PI / 2,
  };
}

/** 각 → 주기 정리 */
export function wrapPi(a: number): number {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x < -Math.PI) x += TAU;
  return x;
}

/**
 * 주축 각 → 둘째 크랭크 각의 거꾸로 표. alphaOf(phi) 는 phi 에 단조 증가하는 각(풀어 둔 값).
 * 두 번 쓰이면 한 번 만든 표를 쓴다.
 */
export function makeInverse(alphaOf: (phi: number) => number, n = 2048): (alpha: number) => number {
  const phis: number[] = [];
  const al: number[] = [];
  let prev = alphaOf(0);
  let acc = prev;
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * TAU;
    const cur = alphaOf(phi);
    if (i > 0) acc += wrapPi(cur - prev);
    prev = cur;
    phis.push(phi);
    al.push(i === 0 ? acc : acc);
  }
  const a0 = al[0]!;
  const span = al[n]! - a0; // 한 바퀴(2π 또는 −2π) — 단조 가정
  return (alpha: number): number => {
    const k = Math.floor((alpha - a0) / span);
    const r = alpha - a0 - k * span; // 0..span
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (al[mid]! - a0 <= r) lo = mid;
      else hi = mid;
    }
    const f = (r - (al[lo]! - a0)) / (al[hi]! - al[lo]! || 1e-12);
    return phis[lo]! + f * (phis[hi]! - phis[lo]!) + k * TAU;
  };
}

// ───────────────────────── 168 치수 ─────────────────────────
export const K168 = {
  four: { S2: [-0.1, 1.55], r2: 0.33, L23: 1.5, H: [1.45, 2.95], Lr: 1.45, L12: 1.15 } as Four,
  O1: [-1.25, 1.59] as V2, // 주축(홈 크랭크의 축)
  slot: [0.24, 0.68] as const, // 홈의 가운데선 범위(주축에서 잰 거리)
  slotHalf: 0.036,
  barLen: 0.78, // 홈 크랭크 길이
  pinR: 0.027,
  alpha0: -0.52, // alpha = theta + alpha0 → t = 1 에서 판화 자세(홈이 위로 기운 모양)
} as const;

const inv168 = ((): ((a: number) => number) => {
  const O = K168.O1;
  return makeInverse((phi) => {
    const c = coupler(K168.four, phi);
    return Math.atan2(c.P1[1] - O[1], c.P1[0] - O[0]);
  });
})();

export interface Pose168 {
  /** 주축(홈 크랭크) 각 */
  alpha: number;
  /** 둘째 크랭크 각 */
  phi: number;
  c: Coupler;
  /** 홈 속 핀의 주축에서의 거리 */
  s: number;
}

export function pose168(theta: number): Pose168 {
  const alpha = theta + K168.alpha0;
  const phi = inv168(alpha);
  const c = coupler(K168.four, phi);
  const s = Math.hypot(c.P1[0] - K168.O1[0], c.P1[1] - K168.O1[1]);
  return { alpha, phi, c, s };
}

// ───────────────────────── 공용 부분 ─────────────────────────
/** Z축 원기둥 z0~z1 */
export function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 볼록 껍질 — 원들의 볼록 껍질(막대 + 눈) */
export function hullOf(circles: Array<[number, number, number]>, n = 28): V2[] {
  const pts: V2[] = [];
  for (const [cx, cy, r] of circles) for (const p of circlePts(r, n, cx, cy)) pts.push(p);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: V2[] = [];
  for (const p of pts.slice().reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** 스타디움(홈) 점들 — x 방향 x0~x1, 반폭 hw */
export function stadiumPts(x0: number, x1: number, hw: number, n = 14): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push([x1 + Math.cos(a) * hw, Math.sin(a) * hw]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI;
    pts.push([x0 + Math.cos(a) * hw, Math.sin(a) * hw]);
  }
  return pts;
}

/** 평판 하나: 바깥 윤곽 + 구멍들, z 가운데 zc, 두께 th */
export function flatPlate(outline: V2[], holes: V2[][], z: readonly [number, number], mat: THREE.Material): THREE.Mesh {
  const sh = shapeFrom(outline);
  for (const h of holes) sh.holes.push(pathFrom(h));
  const m = mesh(extrude(sh, z[1] - z[0], 0.004, 16), mat);
  m.position.z = (z[0] + z[1]) / 2;
  return m;
}

/** 핀 표식(이름만) */
export function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/**
 * 뒤판에서 나온 고정 축(핀): 뒤판 앞면 → zFront, 앞 머리(반지름 headR, 두께 headLen).
 * 모델은 (x, y) 에 놓는다. 원점 = (x, y, 0).
 */
export function fixedPin(x: number, y: number, r: number, zFront: number, headR: number, headLen = 0.02): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  g.add(mesh(cylZ(r, STAGE.backZ, zFront - headLen, 0.002), steel()));
  g.add(mesh(cylZ(headR, zFront - headLen, zFront, 0.005, 32), darkSteel()));
  g.add(pinMark('axis', 0, 0, 0));
  setMM(g, { kind: 'shaft', axis: 'z', r, z0: STAGE.backZ, z1: zFront });
  return g;
}

/** 앞뒤로 꿴 핀(움직이는 부품에 달림): 로컬 z0~z1, 머리 반지름 headR 이 앞 끝에 */
export function throughPin(r: number, z0: number, z1: number, headR: number, headLen = 0.025): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(r, z0, z1 - headLen, 0.002), darkSteel()));
  g.add(mesh(cylZ(headR, z1 - headLen, z1, 0.005, 24), darkSteel()));
  return g;
}

/** 벽에 칠한 궤적 선(닫힌 점 목록) — 뒤판 앞면에 반쯤 붙은 가는 관 */
export function wallPath(pts: V2[], radius: number, zc: number, color: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], zc)), true, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, pts.length * 3, radius, 6, true);
  const m = new THREE.Mesh(geo, paint(color));
  m.userData.mmStandPart = true;
  return m;
}

/** P1 이 한 바퀴 그리는 궤적(타원) 점 */
export function loopPts(four: Four, n = 72): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) out.push(coupler(four, (i / n) * TAU).P1);
  return out;
}

// ───────────────────────── 168 부품 ─────────────────────────
/**
 * 홈 크랭크 — 원점 = 주축 O1, 로컬 +X 가 홈 방향. 모델은 (O1, 0) 에 놓고 rotation.z = alpha.
 * 허브 눈(구멍 0.05) + 가늘어지는 팔 + 긴 홈(가운데선 0.24~0.68). z 0.06~0.11.
 */
export function slottedCrank168(): THREE.Group {
  const g = new THREE.Group();
  const K = K168;
  const outline = hullOf([[0, 0, 0.11, ], [K.barLen, 0, 0.045]] as Array<[number, number, number]>, 36);
  const holes: V2[][] = [circlePts(0.05, 28), stadiumPts(K.slot[0], K.slot[1], K.slotHalf)];
  g.add(flatPlate(outline, holes, ZL.crank, steel()));
  g.add(pinMark('hub', 0, 0, 0.085));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [K.barLen, 0, 0], length: K.barLen });
  return g;
}

/**
 * 둘째 크랭크 — 원점 = 축 S2, 로컬 +X 가 크랭크 핀 P2 방향. 모델은 (S2, 0) 에 놓고 rotation.z = phi.
 * 허브 눈 + 팔 + 끝 눈(구멍 0.029) 에 크랭크 핀(throughPin, 머리 앞)이 박혀 같이 돈다. z 0.06~0.11, 핀 z 0.055~0.215.
 */
export function crank2(r2: number, pinTop: number = ZL.pinHead): THREE.Group {
  const g = new THREE.Group();
  const outline = hullOf([[0, 0, 0.095], [r2, 0, 0.07]], 32);
  g.add(flatPlate(outline, [circlePts(0.05, 28), circlePts(0.029, 20, r2, 0)], ZL.crank, bronze()));
  const pin = throughPin(K168.pinR, 0.055, pinTop, 0.045);
  pin.position.x = r2;
  g.add(pin);
  g.add(pinMark('pin', r2, 0, 0.155));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [r2, 0, 0], length: r2 });
  return g;
}

/**
 * 피트먼 — 원점 = P1, 로컬 +X 가 P3 쪽. 모델은 (P1, 0) 에 놓고 rotation.z = beta.
 * 눈 셋(P1 · P2 · P3, 구멍 0.029), z 0.13~0.18. 막대는 P1 에서 P3 로 가늘어진다.
 * 끝 핀 둘 — P1 핀(홈에 박힘, z 0.055~0.215) · P3 핀(흔들이 막대를 꿴다, z 0.125~0.26).
 * P2 눈은 둘째 크랭크의 핀이 꿴다(핀은 크랭크 쪽에 있다).
 * o.slotPin = false 면 P1 핀을 달지 않는다(169 — 링크가 대신 연결).
 */
export function pitman168(F: Four, o: { slotPin: boolean; linkEye?: boolean } = { slotPin: true }): THREE.Group {
  const g = new THREE.Group();
  const L = F.L12 + F.L23;
  const outline = hullOf([[0, 0, 0.085], [L, 0, 0.065]], 36);
  const holes: V2[][] = [circlePts(0.029, 20, 0, 0), circlePts(0.029, 20, F.L12, 0), circlePts(0.029, 20, L, 0)];
  g.add(flatPlate(outline, holes, ZL.pitman, steel()));
  if (o.slotPin) {
    const p1 = throughPin(K168.pinR, 0.055, ZL.pinHead, 0.045);
    g.add(p1);
  }
  const p3 = throughPin(K168.pinR, 0.125, 0.265, 0.045);
  p3.position.x = L;
  g.add(p3);
  g.add(pinMark('P1', 0, 0, 0.155));
  g.add(pinMark('P2', F.L12, 0, 0.155));
  g.add(pinMark('P3', L, 0, 0.155));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [L, 0, 0], length: L });
  return g;
}

/**
 * 흔들이 막대(왕복 동력) — 원점 = 위 고정 핀 H, 로컬 −Y 로 늘어진다. z 0.19~0.24.
 * 위 눈(구멍 0.0425 — 고정 핀 r 0.04 이 꿴다), 아래 눈(구멍 0.0295 — P3 핀이 꿴다).
 */
export function rocker168(len: number): THREE.Group {
  const g = new THREE.Group();
  const outline = hullOf([[0, 0, 0.075], [0, -len, 0.06]], 32);
  g.add(flatPlate(outline, [circlePts(0.0425, 24), circlePts(0.0295, 20, 0, -len)], ZL.rocker, darkSteel()));
  g.add(pinMark('top', 0, 0, 0.215));
  g.add(pinMark('bottom', 0, -len, 0.215));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [0, -len, 0], length: len });
  return g;
}

/** 위 고정 핀 받침(뒤판에서 나온 핀) — 흔들이 막대가 걸린다 */
export function topPin(x: number, y: number): THREE.Group {
  return fixedPin(x, y, 0.04, 0.26, 0.062, 0.02);
}

/** 판화의 점선 궤적 둘(벽에 칠함): P1 타원 + 둘째 크랭크 핀 원 (+ 주축 둘레 점선 원 반지름 rc) */
export function ghostPaths(F: Four, O: V2, rc: number): THREE.Group {
  const g = new THREE.Group();
  const col = 0xf4ead2;
  const zc = STAGE.backZ + 0.009;
  const ell = wallPath(loopPts(F, 96), 0.009, zc, col);
  ell.name = 'ellipsePath';
  g.add(ell);
  const c2 = wallPath(circlePts(F.r2, 72, F.S2[0], F.S2[1]), 0.009, zc, col);
  c2.name = 'pinCircle';
  g.add(c2);
  const c1 = wallPath(circlePts(rc, 72, O[0], O[1]), 0.006, STAGE.backZ + 0.006, col);
  c1.name = 'mainCircle';
  g.add(c1);
  return g;
}
