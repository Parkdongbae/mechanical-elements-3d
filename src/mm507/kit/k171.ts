// 171번 전용 키트 — 선박용 밸브 장치와 역전 장치(oscillating marine engine valve motion)
//  주축(편심륜 둘) → 편심 막대 둘 → 홈 달린 링크(두 끝에 막대가 걸림) → 가운데 핀에 걸린 밸브 막대(세로) →
//  밸브 막대 아래 끝 핀이 트러니언 둘레로 흔들리는 실린더의 곡선 미끄럼판 홈 속에서 움직인다.
//  곡선 홈은 트러니언 중심의 원호라서 실린더가 흔들려도 밸브 막대의 왕복에 간섭하지 않는다(원문).
//  모든 자세는 주축 각 theta 의 닫힌 식(링크 위치는 매 프레임 같은 어림값에서 뉴턴법으로 푼다).
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { circlePts, mesh } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { cylZ, flatPlate, hullOf, pinMark, stadiumPts, throughPin } from './k168';
import { setMM } from './mm';

const DEG = Math.PI / 180;

export const K171 = {
  C: [0, 2.85] as V2, // 주축
  e: 0.1, // 편심 거리
  re: 0.13, // 편심륜 반지름
  delta: 60 * DEG, // 편심륜 위상 ±
  Lr: 1.2, // 편심 막대(편심 중심 ~ 링크 끝 핀)
  h: 0.3, // 링크 반폭(끝 핀 x)
  Rl: 1.1, // 링크 곡률 반지름(오목 위쪽)
  T0: [0, 0.8] as V2, // 트러니언
  slotR: [0.4, 0.58] as const, // 곡선 홈 반지름 범위
  pinOff: 0.36, // 링크 가운데 핀 ↔ 밸브 막대 아래 핀(밸브 막대 로컬 −y)
  stud: [0, 2.3] as V2, // 밸브 막대 위 안내 핀(뒤판)
  swing: 0.14, // 실린더 흔들림 진폭(rad)
  // 층(z)
  z1: [0.07, 0.115] as const, // 편심륜 1 · 편심 막대 1
  zL: [0.12, 0.16] as const, // 링크 · 곡선 미끄럼판
  z2: [0.165, 0.21] as const, // 편심륜 2 · 편심 막대 2
  zR: [0.225, 0.27] as const, // 밸브 막대
};

const sag = (): number => K171.Rl - Math.sqrt(K171.Rl * K171.Rl - K171.h * K171.h);

export interface Pose171 {
  phi: number;
  /** 링크 가운데(= 밸브 막대 핀) 높이, 링크 기울기 */
  ym: number;
  gamma: number;
  E1: V2;
  E2: V2;
  A: V2;
  B: V2;
  /** 편심 막대의 rotation.z (로컬 −Y 가 링크 끝 쪽) */
  rot1: number;
  rot2: number;
  /** 실린더 흔들림 */
  eps: number;
}

export function pose171(theta: number): Pose171 {
  const K = K171;
  const phi = theta;
  const s0 = sag();
  const E1: V2 = [K.C[0] + K.e * Math.cos(phi + K.delta), K.C[1] + K.e * Math.sin(phi + K.delta)];
  const E2: V2 = [K.C[0] + K.e * Math.cos(phi - K.delta), K.C[1] + K.e * Math.sin(phi - K.delta)];
  const ends = (ym: number, g: number): [V2, V2] => {
    const c = Math.cos(g);
    const s = Math.sin(g);
    return [
      [-K.h * c - s0 * s, ym - K.h * s + s0 * c],
      [K.h * c - s0 * s, ym + K.h * s + s0 * c],
    ];
  };
  const F = (ym: number, g: number): [number, number] => {
    const [a, b] = ends(ym, g);
    return [Math.hypot(a[0] - E1[0], a[1] - E1[1]) - K.Lr, Math.hypot(b[0] - E2[0], b[1] - E2[1]) - K.Lr];
  };
  let ym = 1.65;
  let g = 0;
  for (let k = 0; k < 30; k++) {
    const f = F(ym, g);
    const d = 1e-6;
    const fy = F(ym + d, g);
    const fg = F(ym, g + d);
    const j00 = (fy[0] - f[0]) / d;
    const j01 = (fg[0] - f[0]) / d;
    const j10 = (fy[1] - f[1]) / d;
    const j11 = (fg[1] - f[1]) / d;
    const det = j00 * j11 - j01 * j10;
    const dy = (f[0] * j11 - f[1] * j01) / det;
    const dg = (j00 * f[1] - j10 * f[0]) / det;
    ym -= dy;
    g -= dg;
    if (Math.abs(dy) + Math.abs(dg) < 1e-12) break;
  }
  const [A, B] = ends(ym, g);
  return {
    phi, ym, gamma: g, E1, E2, A, B,
    rot1: Math.atan2(A[1] - E1[1], A[0] - E1[0]) + Math.PI / 2,
    rot2: Math.atan2(B[1] - E2[1], B[0] - E2[0]) + Math.PI / 2,
    eps: K.swing * Math.sin(theta + 1.0),
  };
}

/** 호 띠 다각형 — 중심 c, 반지름 r0~r1, 각 a0~a1 (rad) */
function ringPts(c: V2, r0: number, r1: number, a0: number, a1: number, n = 36): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([c[0] + r1 * Math.cos(a), c[1] + r1 * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([c[0] + r0 * Math.cos(a), c[1] + r0 * Math.sin(a)]);
  }
  return pts;
}

/**
 * 주축(회전 한 몸) — 원점 = 주축 중심 C. 모델은 (C, 0) 에 놓고 rotation.z = phi.
 * 축 r 0.04(뒤판 → z 0.22) + 앞 머리, 편심륜 둘(반지름 0.13, 중심이 축에서 0.1 떨어짐, 위상 ±60°, 서로 다른 층).
 * 표식 child `axis`.
 */
export function shaft171(): THREE.Group {
  const K = K171;
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.04, STAGE.backZ, 0.22, 0.002), steel()));
  g.add(mesh(cylZ(0.062, 0.22, 0.24, 0.004, 28), darkSteel()));
  const mk = (ang: number, z: readonly [number, number], name: string): void => {
    const ex = K.e * Math.cos(ang);
    const ey = K.e * Math.sin(ang);
    const d = flatPlate(circlePts(K.re, 48, ex, ey), [circlePts(0.0405, 24)], z, brass());
    d.name = name;
    g.add(d);
  };
  mk(K.delta, K.z1, 'ecc1');
  mk(-K.delta, K.z2, 'ecc2');
  g.add(pinMark('axis', 0, 0, 0.15));
  setMM(g, { kind: 'shaft', axis: 'z', r: 0.04, z0: STAGE.backZ, z1: 0.24 });
  return g;
}

/**
 * 편심 막대 — 원점 = 편심 중심 E, 로컬 −Y 가 링크 끝 쪽. 띠(편심륜을 감싼 고리, 구멍 0.1325) + 가는 막대 + 끝 눈(구멍 0.029).
 * which = 1 이면 z1 층, 2 면 z2 층.
 */
export function eccRod171(which: 1 | 2): THREE.Group {
  const K = K171;
  const z = which === 1 ? K.z1 : K.z2;
  const g = new THREE.Group();
  g.add(flatPlate(circlePts(0.17, 44), [circlePts(0.1325, 44)], [z[0] - 0.002, z[1] + 0.002], steel()));
  g.add(flatPlate(hullOf([[0, -0.165, 0.03], [0, -K.Lr, 0.045]], 24), [circlePts(0.029, 20, 0, -K.Lr)], z, steel()));
  g.add(pinMark('strap', 0, 0, (z[0] + z[1]) / 2));
  g.add(pinMark('end', 0, -K.Lr, (z[0] + z[1]) / 2));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [0, -K.Lr, 0], length: K.Lr });
  return g;
}

/**
 * 홈 달린 링크 — 원점 = 링크 가운데 M(밸브 막대 핀 자리). 위가 오목한 호(반지름 1.1, 폭 ±0.065)에 긴 홈(가운데 ±0.2)과
 * 끝 눈 둘(구멍 0.029). z 0.12~0.16. 끝 핀 A(편심 막대 1 의 눈을 꿴다)·B(편심 막대 2) 가 자식으로 달려 있다.
 */
export function link171(): THREE.Group {
  const K = K171;
  const g = new THREE.Group();
  const tm = Math.asin(0.36 / K.Rl);
  const pts: V2[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = -tm + (2 * tm * i) / N;
    pts.push([(K.Rl + 0.065) * Math.sin(t), K.Rl - (K.Rl + 0.065) * Math.cos(t)]);
  }
  for (let i = N; i >= 0; i--) {
    const t = -tm + (2 * tm * i) / N;
    pts.push([(K.Rl - 0.065) * Math.sin(t), K.Rl - (K.Rl - 0.065) * Math.cos(t)]);
  }
  const ts = Math.asin(0.2 / K.Rl);
  const slot: V2[] = [];
  const M = 16;
  for (let i = 0; i <= M; i++) {
    const t = -ts + (2 * ts * i) / M;
    slot.push([(K.Rl + 0.03) * Math.sin(t), K.Rl - (K.Rl + 0.03) * Math.cos(t)]);
  }
  for (let i = M; i >= 0; i--) {
    const t = -ts + (2 * ts * i) / M;
    slot.push([(K.Rl - 0.03) * Math.sin(t), K.Rl - (K.Rl - 0.03) * Math.cos(t)]);
  }
  const s0 = sag();
  g.add(flatPlate(pts, [slot, circlePts(0.029, 20, -K.h, s0), circlePts(0.029, 20, K.h, s0)], K.zL, castIron()));
  const pa = throughPin(0.027, 0.065, 0.17, 0.045, 0.01);
  pa.position.set(-K.h, s0, 0);
  const pb = throughPin(0.027, 0.115, 0.22, 0.045, 0.01);
  pb.position.set(K.h, s0, 0);
  g.add(pa, pb);
  g.add(pinMark('endA', -K.h, s0, 0.115));
  g.add(pinMark('endB', K.h, s0, 0.115));
  g.add(pinMark('center', 0, 0, 0.14));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [K.h, s0, 0], length: 2 * K.h });
  return g;
}

/**
 * 밸브 막대 — 원점 = 링크 가운데 핀 M, 세로. 위 끝 0.95, 아래 핀(M 아래 0.36)이 곡선 홈 속에 든다.
 * 위쪽의 세로 홈(중심 y 0.65, 길이 0.2)에 뒤판 안내 핀이 꿰어 있다. z 0.225~0.27.
 */
export function valveRod171(): THREE.Group {
  const K = K171;
  const g = new THREE.Group();
  const slot = stadiumPts(0.55, 0.75, 0.03).map(([a, b]) => [b, a] as V2);
  g.add(flatPlate(hullOf([[0, -K.pinOff, 0.06], [0, 0.95, 0.04]], 28), [circlePts(0.0275, 20), circlePts(0.0275, 20, 0, -K.pinOff), slot], K.zR, steel()));
  const p0 = throughPin(0.027, 0.115, 0.28, 0.04, 0.01);
  g.add(p0);
  const p1 = throughPin(0.025, 0.115, 0.28, 0.04, 0.01);
  p1.position.y = -K.pinOff;
  g.add(p1);
  g.add(pinMark('top', 0, 0.95, 0.25));
  g.add(pinMark('center', 0, 0, 0.25));
  setMM(g, { kind: 'rod', length: 0.95 + K.pinOff });
  return g;
}

/**
 * 흔들리는 실린더 쪽 곡선 미끄럼판 — 원점 = 트러니언 T0. 모델은 (T0, 0) 에 놓고 rotation.z = eps.
 * 트러니언 허브(구멍 0.042) + 두 살 + 호 판(반지름 0.32~0.66, 20°~160°)의 곡선 홈(반지름 0.40~0.58, 35°~145°).
 * 홈은 트러니언 중심의 원호 — 실린더가 흔들려도 홈이 있는 원은 변하지 않는다. z 0.12~0.16.
 */
export function slide171(): THREE.Group {
  const K = K171;
  const g = new THREE.Group();
  const a0 = 20 * DEG;
  const a1 = 160 * DEG;
  g.add(flatPlate(ringPts([0, 0], 0.32, 0.66, a0, a1, 40), [ringPts([0, 0], K.slotR[0], K.slotR[1], 35 * DEG, 145 * DEG, 30)], K.zL, castIron()));
  g.add(flatPlate(circlePts(0.13, 36), [circlePts(0.042, 24)], [K.zL[0] + 0.002, K.zL[1] - 0.002], castIron()));
  for (const a of [a0, a1]) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    g.add(flatPlate(hullOf([[0.115 * c, 0.115 * s, 0.04], [0.31 * c, 0.31 * s, 0.035]], 20), [], [K.zL[0] + 0.005, K.zL[1] - 0.005], castIron()));
  }
  g.add(pinMark('hub', 0, 0, 0.14));
  setMM(g, { kind: 'frame' });
  return g;
}

/** 뒤판에 칠한 점선(밸브 막대 홈 원: 트러니언 중심 원호) */
export function guideArc171(): THREE.Mesh {
  const K = K171;
  const mid = (K.slotR[0] + K.slotR[1]) / 2;
  const pts: V2[] = circlePts(mid, 90, K.T0[0], K.T0[1]);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], STAGE.backZ + 0.009)), true, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 270, 0.007, 6, true), new THREE.MeshStandardMaterial({ color: 0xf4ead2 }));
  m.userData.mmStandPart = true;
  m.name = 'guideArc';
  return m;
}
