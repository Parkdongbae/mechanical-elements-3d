// 171번 전용 키트 — 진동식(요동) 선박 기관의 밸브 장치와 역전 장치(판화 171, 설계표 docs/mm507-sheets/171.md)
//  주축의 편심 둘 → 편심 막대 둘(아래로 벌어짐) → 가로로 굽은 홈 링크(스티븐슨 링크) → 링크 홈 속 다이 블록 →
//  세로 막대(위는 고정 부시, 아래 끝 눈) → 트러니언 위 아치 모양 굽은 슬라이드(좌우 세로 안내봉을 따라 오르내림) →
//  슬라이드의 굽은 홈(트러니언 중심 원호) 속 핀 → 로커 축 팔(밸브를 움직임).
//  링크 왼쪽 끝의 역전 손잡이(가로 막대)를 역전 레버로 밀고 당기면 다이 블록이 링크의 이쪽 끝·저쪽 끝으로 가서 밸브 운동이 뒤집힌다.
//  로커 축은 실린더(트러니언과 함께 흔들림) 쪽 받침에 달려 있다 — 홈이 트러니언 중심 원호라서 실린더가 흔들려도 밸브가 거의 움직이지 않는다.
//  모든 자세는 theta 의 닫힌 식(링크는 매 프레임 같은 어림값에서 뉴턴법으로 푼다 — theta 만의 함수). 역전은 주축 4바퀴(8π) 주기.
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { circlePts, mesh } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { cylZ, flatPlate, hullOf, pinMark, throughPin } from './k168';
import { circleIntersect } from './misc';
import { setMM } from './mm';

const DEG = Math.PI / 180;

export const K171 = {
  C: [0, 2.98] as V2, // 주축(편심 둘)
  e: 0.09, // 편심 거리
  re: 0.17, // 편심 원판 반지름
  rs: 0.055, // 주축 반지름
  adv: 100 * DEG, // 편심 위상(주축 각 ± 100°)
  Lr: 1.4, // 편심 막대(편심 중심 ~ 링크 귀 핀)
  Rl: 1.5, // 링크 홈 곡률 반지름(곡률 중심이 위 = 위가 오목)
  lugX: 0.28, // 링크 귀 핀 x(로컬)
  lugDy: 0.14, // 링크 귀 핀이 홈 가운데선 위로 솟은 높이
  hX: 0.4, // 역전 손잡이 핀 x(링크 왼쪽 끝, 로컬 −)
  linkHW: 0.065, // 링크 띠 반폭
  slotX: 0.3, // 링크 홈 끝(±)
  slotHW: 0.028, // 링크 홈 반폭
  Lp: [-1.45, 1.17] as V2, // 역전 레버 고정 축
  Lq: 0.4, // 역전 레버: 축 ~ 손잡이 핀
  Lh: 1.05, // 역전 손잡이(가로 막대) 길이
  lamF: 0.45, // 역전 레버 각 — 앞으로(다이가 링크 왼쪽 = 편심 1 쪽)
  lamB: -0.36, // 뒤로(다이가 링크 오른쪽 = 편심 2 쪽)
  dieUp: 0.93, // 다이 핀 ~ 슬라이드 원점(아치 중심)
  rodTop: 1.1, // 세로 막대 위 끝(다이 핀 위)
  rodEye: 0.34, // 세로 막대 아래 눈(다이 핀 아래)
  bushUp: 0.93, // 세로 막대 부시(다이 평균 높이 위)
  T: [0, 0.51] as V2, // 트러니언
  dieMean: 1.44, // 다이 핀 평균 높이(= T.y + dieUp)
  arch: [0.39, 0.53] as const, // 아치 안·바깥 반지름
  rho: 0.46, // 슬라이드 홈 반지름(트러니언 중심 원호)
  rhoHW: 0.028, // 슬라이드 홈 반폭
  lugY: 0.59, // 슬라이드 꼭대기 눈(세로 막대 아래 눈과 핀)
  gx: 0.58, // 세로 안내봉 x(±)
  gy: [0.25, 1.2] as const, // 안내봉 아래·위 끝
  gr: 0.025, // 안내봉 반지름
  blk: [-0.02, 0.28] as const, // 슬라이드 끝 네모 블록 y(로컬)
  R0: [-0.95, 0.2] as V2, // 로커 축(실린더 받침 위, 트러니언 기준)
  pin0: 95 * DEG, // 로커 핀 기준 자리(홈 위의 각)
  epsA: 0.07, // 실린더 흔들림 진폭(rad)
  // 층(z)
  z1: [0.0, 0.05] as const, // 편심 1 · 편심 막대 1
  z2: [0.06, 0.11] as const, // 편심 2 · 편심 막대 2
  zL: [0.12, 0.17] as const, // 링크 · 다이(안) · 역전 레버(0.13~0.17)
  zS: [0.12, 0.18] as const, // 굽은 슬라이드
  zH: [0.18, 0.22] as const, // 역전 손잡이 막대
  zV: 0.22, // 세로 막대 가운데(반지름 0.022)
  zA: [0.03, 0.08] as const, // 로커 팔
  zC: [-0.05, 0.0] as const, // 실린더 받침(트러니언과 한 몸)
  zg: 0.15, // 안내봉 가운데
};

const K = K171;
export const arcY171 = (x: number): number => K.Rl - Math.sqrt(K.Rl * K.Rl - x * x);
const LUG_A: V2 = [-K.lugX, arcY171(K.lugX) + K.lugDy];
const LUG_B: V2 = [K.lugX, arcY171(K.lugX) + K.lugDy];
const LUG_H: V2 = [-K.hX, arcY171(K.hX)];
export const LINK_PTS171 = { A: LUG_A, B: LUG_B, H: LUG_H };

const rot = (g: number, p: V2): V2 => [p[0] * Math.cos(g) - p[1] * Math.sin(g), p[0] * Math.sin(g) + p[1] * Math.cos(g)];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** 역전 일정: 주축 4바퀴 주기 — 1.5바퀴 앞으로, 0.5바퀴 동안 옮김, 1.5바퀴 뒤로, 0.5바퀴 동안 되돌림. f = +1 앞, −1 뒤 */
export function reverse171(theta: number): { f: number; lam: number; state: string } {
  const P = 8 * Math.PI;
  const u = (((theta % P) + P) % P) / P;
  let f: number;
  if (u < 0.375) f = 1;
  else if (u < 0.5) f = 1 - 2 * smooth((u - 0.375) / 0.125);
  else if (u < 0.875) f = -1;
  else f = -1 + 2 * smooth((u - 0.875) / 0.125);
  const lam = f >= 0 ? K.lamF * f : -K.lamB * f;
  const state = f > 0.999 ? '앞으로' : f < -0.999 ? '뒤로' : '역전 중(레버를 옮기는 중)';
  return { f, lam, state };
}

export interface Pose171 {
  phi: number;
  E1: V2;
  E2: V2;
  /** 링크 원점(홈 가운데선의 가운데) · 기울기 */
  M: V2;
  gamma: number;
  A: V2;
  B: V2;
  H: V2;
  Q: V2;
  lam: number;
  f: number;
  state: string;
  rot1: number;
  rot2: number;
  /** 역전 손잡이 막대 방향(H → Q) */
  barAng: number;
  /** 다이 핀 높이(세로 막대), 다이의 링크 홈 속 자리(로컬 x), 다이 기울기 */
  yD: number;
  s: number;
  dieAng: number;
  /** 슬라이드 원점(아치 중심) 높이, 기준에서의 변위 */
  yS: number;
  ys: number;
  /** 실린더 흔들림, 로커 축 자리, 로커 핀 자리, 로커 팔 각(월드), 밸브 각(실린더 기준) */
  eps: number;
  R: V2;
  P: V2;
  armAng: number;
  psi: number;
}

const ARM0 = Math.atan2(K.rho * Math.sin(K.pin0) - K.R0[1], K.rho * Math.cos(K.pin0) - K.R0[0]);
export const ARM_LEN171 = Math.hypot(K.rho * Math.cos(K.pin0) - K.R0[0], K.rho * Math.sin(K.pin0) - K.R0[1]);

export function pose171(theta: number): Pose171 {
  const phi = theta;
  const E1: V2 = [K.C[0] + K.e * Math.cos(phi + K.adv), K.C[1] + K.e * Math.sin(phi + K.adv)];
  const E2: V2 = [K.C[0] + K.e * Math.cos(phi - K.adv), K.C[1] + K.e * Math.sin(phi - K.adv)];
  const rv = reverse171(theta);
  const Q: V2 = [K.Lp[0] + K.Lq * Math.sin(rv.lam), K.Lp[1] + K.Lq * Math.cos(rv.lam)];
  const F = (v: [number, number, number]): [number, number, number] => {
    const m: V2 = [v[0], v[1]];
    const a = add(m, rot(v[2], LUG_A));
    const b = add(m, rot(v[2], LUG_B));
    const h = add(m, rot(v[2], LUG_H));
    return [
      Math.hypot(a[0] - E1[0], a[1] - E1[1]) - K.Lr,
      Math.hypot(b[0] - E2[0], b[1] - E2[1]) - K.Lr,
      Math.hypot(h[0] - Q[0], h[1] - Q[1]) - K.Lh,
    ];
  };
  let v: [number, number, number] = [Q[0] + K.Lh + K.hX, 1.5, 0];
  for (let k = 0; k < 40; k++) {
    const f0 = F(v);
    const d = 1e-7;
    const M: number[][] = [[], [], []];
    for (let j = 0; j < 3; j++) {
      const w: [number, number, number] = [v[0], v[1], v[2]];
      w[j] = w[j]! + d;
      const fw = F(w);
      for (let i = 0; i < 3; i++) M[i]![j] = (fw[i]! - f0[i]!) / d;
    }
    for (let i = 0; i < 3; i++) M[i]![3] = f0[i]!;
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
      const tmp = M[c]!;
      M[c] = M[p]!;
      M[p] = tmp;
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const q = M[r]![c]! / M[c]![c]!;
        for (let kk = c; kk < 4; kk++) M[r]![kk]! -= q * M[c]![kk]!;
      }
    }
    const dv = [M[0]![3]! / M[0]![0]!, M[1]![3]! / M[1]![1]!, M[2]![3]! / M[2]![2]!];
    v = [v[0] - dv[0]!, v[1] - dv[1]!, v[2] - dv[2]!];
    if (Math.abs(dv[0]!) + Math.abs(dv[1]!) + Math.abs(dv[2]!) < 1e-13) break;
  }
  const Mp: V2 = [v[0], v[1]];
  const gamma = v[2];
  const A = add(Mp, rot(gamma, LUG_A));
  const B = add(Mp, rot(gamma, LUG_B));
  const H = add(Mp, rot(gamma, LUG_H));
  // 다이: 세로선 x = 0 과 링크 홈 원호(곡률 중심 Cw, 반지름 Rl)의 아래 교점
  const Cw = add(Mp, rot(gamma, [0, K.Rl]));
  const yD = Cw[1] - Math.sqrt(K.Rl * K.Rl - Cw[0] * Cw[0]);
  const loc = rot(-gamma, [-Mp[0], yD - Mp[1]]);
  const s = loc[0];
  const dieAng = gamma + Math.asin(s / K.Rl);
  // 슬라이드(세로 막대와 한 줄로 오르내림)
  const yS = yD - K.dieUp;
  const ys = yS - K.T[1];
  // 실린더 흔들림 · 로커
  const eps = K.epsA * Math.sin(phi + 0.6);
  const R = add(K.T, rot(eps, K.R0));
  const S: V2 = [0, yS];
  const P = circleIntersect(R, ARM_LEN171, S, K.rho, true) ?? [0, yS + K.rho];
  const armAng = Math.atan2(P[1] - R[1], P[0] - R[0]);
  return {
    phi, E1, E2, M: Mp, gamma, A, B, H, Q, lam: rv.lam, f: rv.f, state: rv.state,
    rot1: Math.atan2(A[1] - E1[1], A[0] - E1[0]) + Math.PI / 2,
    rot2: Math.atan2(B[1] - E2[1], B[0] - E2[0]) + Math.PI / 2,
    barAng: Math.atan2(Q[1] - H[1], Q[0] - H[0]),
    yD, s, dieAng, yS, ys, eps, R, P, armAng,
    psi: armAng - eps - ARM0,
  };
}

// ───────────────────────── 모양 도우미 ─────────────────────────
/** 링크 홈 원호(곡률 중심 (0, Rl), 원점을 지남)를 따라 x0~x1, 반폭 hw 인 띠 + 둥근 끝 */
function arcBand(x0: number, x1: number, hw: number, n = 32): V2[] {
  const t0 = Math.asin(x0 / K.Rl);
  const t1 = Math.asin(x1 / K.Rl);
  const p = (t: number, r: number): V2 => [r * Math.sin(t), K.Rl - r * Math.cos(t)];
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) pts.push(p(t0 + ((t1 - t0) * i) / n, K.Rl + hw)); // 아래 가장자리 왼→오
  const cap = (t: number, from: number, to: number): void => {
    const c = p(t, K.Rl);
    const td: V2 = [Math.cos(t), Math.sin(t)];
    const nd: V2 = [-Math.sin(t), Math.cos(t)];
    for (let i = 1; i < 12; i++) {
      const a = from + ((to - from) * i) / 12;
      pts.push([c[0] + hw * (Math.cos(a) * td[0] + Math.sin(a) * nd[0]), c[1] + hw * (Math.cos(a) * td[1] + Math.sin(a) * nd[1])]);
    }
  };
  cap(t1, -Math.PI / 2, Math.PI / 2);
  for (let i = n; i >= 0; i--) pts.push(p(t0 + ((t1 - t0) * i) / n, K.Rl - hw)); // 위 가장자리 오→왼
  cap(t0, Math.PI / 2, (3 * Math.PI) / 2);
  return pts;
}

/** 중심 c, 반지름 r0~r1, 각 a0~a1 의 호 띠 */
function ringPts(c: V2, r0: number, r1: number, a0: number, a1: number, n = 40): V2[] {
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

/** y 방향으로 뽑은 판: 윤곽은 (x, z) 평면 점, y0~y1 로 압출(세로 구멍이 난 블록·부시용) */
function yPlate(outlineXZ: V2[], holesXZ: V2[][], y: readonly [number, number], mat: THREE.Material): THREE.Group {
  const flip = (pts: V2[]): V2[] => pts.map(([x, z]) => [x, -z] as V2);
  const m = flatPlate(flip(outlineXZ), holesXZ.map(flip), y, mat);
  const g = new THREE.Group();
  g.rotation.x = -Math.PI / 2;
  g.add(m);
  return g;
}

/** y 축 둥근 막대 y0~y1, (x, z) 에 */
function rodY(r: number, y0: number, y1: number, x: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 20), mat);
  m.position.set(x, (y0 + y1) / 2, z);
  return m;
}

const rectPts = (x0: number, x1: number, y0: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ───────────────────────── 부품 ─────────────────────────
/** 주축 + 편심 둘(회전 한 몸) — 원점 = 주축 C, rotation.z = phi. 편심 1(위상 +100°) z1, 편심 2(−100°) z2. */
export function shaft171(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(K.rs, STAGE.backZ, 0.15, 0.003), steel()));
  g.add(mesh(cylZ(0.08, 0.12, 0.15, 0.005, 6), darkSteel())); // 앞 너트(육각)
  const mk = (ang: number, z: readonly [number, number], name: string): void => {
    const d = flatPlate(circlePts(K.re, 56, K.e * Math.cos(ang), K.e * Math.sin(ang)), [circlePts(K.rs + 0.0005, 24)], z, brass());
    d.name = name;
    g.add(d);
  };
  mk(K.adv, K.z1, 'ecc1');
  mk(-K.adv, K.z2, 'ecc2');
  g.add(pinMark('axis', 0, 0, 0.1));
  setMM(g, { kind: 'shaft', axis: 'z', r: K.rs, z0: STAGE.backZ, z1: 0.15 });
  return g;
}

/** 편심 막대 — 원점 = 편심 중심 E, 로컬 −Y 가 링크 귀 핀 쪽. 편심 띠(볼트 귀 둘) + 막대 + 끝 눈. */
export function eccRod171(which: 1 | 2): THREE.Group {
  const z = which === 1 ? K.z1 : K.z2;
  const zs: [number, number] = [z[0] - 0.002, z[1] + 0.002];
  const g = new THREE.Group();
  const ri = K.re + 0.0025;
  g.add(flatPlate(circlePts(0.215, 56), [circlePts(ri, 56)], zs, steel()));
  for (const sx of [-1, 1]) {
    g.add(flatPlate(rectPts(sx > 0 ? 0.205 : -0.29, sx > 0 ? 0.29 : -0.205, -0.04, 0.04), [], [zs[0] + 0.002, zs[1] - 0.002], steel()));
    const bolt = mesh(cylZ(0.022, zs[1] - 0.002, zs[1] + (which === 1 ? 0.004 : 0.012), 0.003, 6), darkSteel());
    bolt.position.x = sx * 0.255;
    g.add(bolt);
  }
  g.add(flatPlate(hullOf([[0, -0.24, 0.032], [0, -K.Lr, 0.045]], 24), [circlePts(0.0215, 20, 0, -K.Lr)], z, steel()));
  g.add(pinMark('strap', 0, 0, (z[0] + z[1]) / 2));
  g.add(pinMark('end', 0, -K.Lr, (z[0] + z[1]) / 2));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [0, -K.Lr, 0], length: K.Lr });
  return g;
}

/**
 * 홈 링크 — 원점 = 홈 가운데선의 가운데. 위가 오목한 호(반지름 1.5) 띠(반폭 0.065, x ±0.40 + 둥근 끝), 긴 홈(±0.30, 반폭 0.028),
 * 위로 솟은 귀 둘(편심 막대 핀 A·B, 홈 위 0.14), 왼쪽 끝 눈(역전 손잡이 핀 H). 귀 핀 둘이 자식으로 달린다.
 */
export function link171(): THREE.Group {
  const g = new THREE.Group();
  g.add(flatPlate(arcBand(-K.hX, K.hX, K.linkHW), [arcBand(-K.slotX, K.slotX, K.slotHW), circlePts(0.0215, 20, LUG_H[0], LUG_H[1])], K.zL, castIron()));
  const zi: [number, number] = [K.zL[0] + 0.002, K.zL[1] - 0.002];
  for (const [p, zf] of [[LUG_A, K.z1[0] - 0.005], [LUG_B, K.z2[0] - 0.005]] as Array<[V2, number]>) {
    const yb = arcY171(p[0]) + 0.05;
    g.add(flatPlate(hullOf([[p[0], p[1], 0.045], [p[0] - 0.075, yb, 0.018], [p[0] + 0.075, yb, 0.018]], 24), [circlePts(0.0215, 20, p[0], p[1])], zi, castIron()));
    const pin = throughPin(0.02, zf, 0.19, 0.035, 0.016);
    pin.position.set(p[0], p[1], 0);
    g.add(pin);
  }
  g.add(pinMark('lugA', LUG_A[0], LUG_A[1], 0.145));
  g.add(pinMark('lugB', LUG_B[0], LUG_B[1], 0.145));
  g.add(pinMark('handlePin', LUG_H[0], LUG_H[1], 0.145));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [LUG_B[0], LUG_B[1], 0], length: 2 * K.lugX });
  return g;
}

/** 다이 블록 — 원점 = 다이 핀, 링크 홈 속(홈 방향 로컬 X). 길이 0.10, 폭 0.048, z 0.124~0.166. */
export function dieBlock171(): THREE.Group {
  const g = new THREE.Group();
  g.add(flatPlate(rectPts(-0.05, 0.05, -0.024, 0.024), [circlePts(0.0205, 20)], [K.zL[0] + 0.004, K.zL[1] - 0.004], brass()));
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 세로 막대 — 원점 = 다이 핀. 둥근 막대(반지름 0.022, z 0.22) 위 끝 +1.10(고정 부시를 지남), 아래 눈 −0.34(슬라이드 꼭대기 눈과 핀).
 * 다이 핀(링크 홈 속 다이 블록까지)이 자식.
 */
export function valveRod171(): THREE.Group {
  const g = new THREE.Group();
  const z0 = K.zV - 0.022;
  const z1 = K.zV + 0.022;
  g.add(rodY(0.022, 0.044, K.rodTop, 0, K.zV, steel()));
  g.add(rodY(0.022, -K.rodEye + 0.048, -0.044, 0, K.zV, steel()));
  g.add(flatPlate(circlePts(0.046, 28), [circlePts(0.0205, 20)], [z0, z1], steel()));
  g.add(flatPlate(circlePts(0.05, 28, 0, -K.rodEye), [circlePts(0.0205, 20, 0, -K.rodEye)], [z0, z1], steel()));
  g.add(throughPin(0.02, K.zL[0] + 0.004, 0.255, 0.034, 0.013));
  g.add(pinMark('die', 0, 0, K.zV));
  g.add(pinMark('eye', 0, -K.rodEye, K.zV));
  g.add(pinMark('top', 0, K.rodTop, K.zV));
  setMM(g, { kind: 'rod', length: K.rodTop + K.rodEye });
  return g;
}

/** 세로 막대 위 고정 부시 + 오른쪽으로 뻗은 받침 팔 + 뒤판 기둥 — 원점 = 부시 중심 (0, y) */
export function rodBush171(): THREE.Group {
  const g = new THREE.Group();
  const bz = K.zV;
  g.add(yPlate(circlePts(0.046, 28, 0, bz), [circlePts(0.0235, 20, 0, bz)], [-0.05, 0.05], darkSteel()));
  g.add(flatPlate(rectPts(0.036, 0.75, -0.025, 0.025), [], [bz - 0.02, bz + 0.02], castIron()));
  const post = mesh(cylZ(0.04, STAGE.backZ, bz + 0.02, 0.004), castIron());
  post.position.x = 0.75;
  g.add(post);
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 굽은 슬라이드 — 원점 = 아치 중심(가운데 자세에서 트러니언 중심). 아치(반지름 0.39~0.53, 0°~180°)에 굽은 홈(반지름 0.46, 25°~155°,
 * 트러니언 중심 원호), 꼭대기 눈(0, 0.59), 양 끝 네모 블록(세로 구멍으로 안내봉을 꿴다). 꼭대기 핀(세로 막대 눈)이 자식.
 */
export function slide171(): THREE.Group {
  const g = new THREE.Group();
  g.add(flatPlate(ringPts([0, 0], K.arch[0], K.arch[1], 0, Math.PI, 48), [ringPts([0, 0], K.rho - K.rhoHW, K.rho + K.rhoHW, 25 * DEG, 155 * DEG, 40)], K.zS, steel()));
  const zi: [number, number] = [K.zS[0] + 0.002, K.zS[1] - 0.002];
  g.add(flatPlate(hullOf([[0, K.lugY, 0.06], [-0.07, 0.515, 0.02], [0.07, 0.515, 0.02]], 28), [circlePts(0.0205, 20, 0, K.lugY)], zi, steel()));
  const pin = throughPin(0.02, K.zS[0] + 0.002, 0.255, 0.036, 0.013);
  pin.position.set(0, K.lugY, 0);
  g.add(pin);
  for (const sx of [-1, 1]) {
    const b = yPlate(rectPts(-0.1, 0.1, K.zg - 0.06, K.zg + 0.06), [circlePts(K.gr + 0.003, 24, 0, K.zg)], K.blk, steel());
    b.position.x = sx * K.gx;
    g.add(b);
  }
  g.add(pinMark('lug', 0, K.lugY, 0.15));
  setMM(g, { kind: 'frame' });
  return g;
}

/** 세로 안내봉(고정) — x = ±0.58, y 0.25~1.20, 위·아래 끝은 뒤판에서 나온 받침 기둥에 박힘 */
export function guideRod171(sx: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const x = sx * K.gx;
  g.add(rodY(K.gr, K.gy[0], K.gy[1], x, K.zg, steel()));
  for (const y of K.gy) {
    const st = mesh(cylZ(0.032, STAGE.backZ, K.zg + 0.032, 0.004), darkSteel());
    st.position.set(x, y, 0);
    g.add(st);
  }
  setMM(g, { kind: 'frame' });
  return g;
}

/** 트러니언 베어링(고정) — 뒤판에 붙은 고리, 원점 = 트러니언 */
export function trunnionBearing171(): THREE.Group {
  const g = new THREE.Group();
  g.add(flatPlate(circlePts(0.2, 40), [circlePts(0.112, 32)], [STAGE.backZ, -0.06], castIron()));
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 실린더 받침(트러니언 저널과 한 몸, 트러니언 둘레로 eps 흔들림) — 원점 = 트러니언. 저널(반지름 0.11) + 판(트러니언 → 로커 축 R0)
 * + 로커 축 핀. 앞 마구리 child `journalCap`.
 */
export function cylCarrier171(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.11, STAGE.backZ + 0.02, K.zC[0], 0.003, 40), steel()));
  g.add(flatPlate(hullOf([[0, 0, 0.16], [K.R0[0], K.R0[1], 0.07]], 32), [], K.zC, castIron()));
  const cap = mesh(cylZ(0.1, K.zC[1], 0.025, 0.004, 40), darkSteel());
  cap.name = 'journalCap';
  g.add(cap);
  const rs = new THREE.Group();
  rs.add(mesh(cylZ(0.026, K.zC[1], 0.1, 0.002), steel()));
  rs.add(mesh(cylZ(0.042, 0.088, 0.104, 0.004, 24), darkSteel()));
  rs.position.set(K.R0[0], K.R0[1], 0);
  rs.name = 'rockShaft';
  g.add(rs);
  g.add(pinMark('rock', K.R0[0], K.R0[1], 0.05));
  setMM(g, { kind: 'frame' });
  return g;
}

/** 로커 팔 — 원점 = 로커 축, 로컬 +X 끝(길이 ARM_LEN171)에 핀(슬라이드 홈 속). 아래로 휜 팔(판화의 굽은 팔). */
export function rockerArm171(): THREE.Group {
  const g = new THREE.Group();
  const L = ARM_LEN171;
  const bulge = -0.1;
  const N = 28;
  const c = (t: number): V2 => [L * t, 4 * bulge * t * (1 - t)];
  const hw = (t: number): number => 0.03 - 0.008 * t;
  const up: V2[] = [];
  const dn: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const t = 0.05 + (0.905 * i) / N;
    const p = c(t);
    const dx = L;
    const dy = 4 * bulge * (1 - 2 * t);
    const n = Math.hypot(dx, dy);
    const nx = -dy / n;
    const ny = dx / n;
    up.push([p[0] + nx * hw(t), p[1] + ny * hw(t)]);
    dn.push([p[0] - nx * hw(t), p[1] - ny * hw(t)]);
  }
  g.add(flatPlate(up.concat(dn.reverse()), [], [K.zA[0] + 0.004, K.zA[1] - 0.004], steel()));
  g.add(flatPlate(circlePts(0.065, 32), [circlePts(0.0265, 20)], K.zA, steel()));
  g.add(flatPlate(circlePts(0.05, 28, L, 0), [circlePts(0.0215, 20, L, 0)], K.zA, steel()));
  const pin = throughPin(0.021, K.zA[0], 0.197, 0.038, 0.014);
  pin.position.set(L, 0, 0);
  g.add(pin);
  g.add(pinMark('hub', 0, 0, 0.055));
  g.add(pinMark('pin', L, 0, 0.15));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [L, 0, 0], length: L });
  return g;
}

/** 역전 손잡이(가로 막대) — 원점 = 링크 쪽 핀 H, 로컬 +X 끝(길이 Lh)이 역전 레버 핀 Q. 두 끝 핀이 자식. */
export function reachBar171(): THREE.Group {
  const g = new THREE.Group();
  g.add(flatPlate(hullOf([[0, 0, 0.034], [K.Lh, 0, 0.034]], 24), [circlePts(0.0205, 20), circlePts(0.0205, 20, K.Lh, 0)], K.zH, darkSteel()));
  const p1 = throughPin(0.02, K.zL[0], 0.235, 0.032, 0.013);
  const p2 = throughPin(0.02, K.zL[0] + 0.01, 0.235, 0.032, 0.013);
  p2.position.x = K.Lh;
  g.add(p1, p2);
  g.add(pinMark('h', 0, 0, 0.2));
  g.add(pinMark('q', K.Lh, 0, 0.2));
  setMM(g, { kind: 'rod', length: K.Lh });
  return g;
}

/** 역전 레버 — 원점 = 고정 축 Lp, 로컬 +Y 로 0.40 에 손잡이 핀, 0.66 까지 손잡이와 손잡이 공. rotation.z = −lam. */
export function reverseLever171(): THREE.Group {
  const g = new THREE.Group();
  const z: [number, number] = [K.zL[0] + 0.01, K.zL[1]];
  g.add(flatPlate(hullOf([[0, 0, 0.055], [0, K.Lq, 0.036]], 28), [circlePts(0.0265, 20), circlePts(0.0205, 20, 0, K.Lq)], z, castIron()));
  g.add(flatPlate(hullOf([[0, K.Lq + 0.065, 0.024], [0, 0.64, 0.02]], 20), [], [z[0] + 0.004, z[1] - 0.004], castIron()));
  const knob = mesh(new THREE.SphereGeometry(0.045, 20, 14), brass());
  knob.position.set(0, 0.67, (z[0] + z[1]) / 2);
  g.add(knob);
  g.add(pinMark('pivot', 0, 0, 0.15));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [0, K.Lq, 0], length: K.Lq });
  return g;
}

/** 역전 레버 고정 축 — 뒤판에서 레버 앞까지 */
export function leverPivot171(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.026, STAGE.backZ, 0.19, 0.002), steel()));
  g.add(mesh(cylZ(0.045, 0.172, 0.19, 0.004, 24), darkSteel()));
  g.position.set(K.Lp[0], K.Lp[1], 0);
  setMM(g, { kind: 'shaft', axis: 'z', r: 0.026, z0: STAGE.backZ, z1: 0.19 });
  return g;
}
