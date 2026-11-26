// 163번 전용 키트 — 물레방아 조속기 2 (벨트 옮김)
//  공 조속기(162 와 같은 팔·링크 — addGovernor162) 의 슬리브 아래 홈 고리에 꺾인 지레 끝 핀이 들어가고,
//  지레의 옆 팔 → 세로 연결봉 → 벨트 포크가 벨트를 조속기 축의 풀리 셋(위·아래 고정, 가운데 헐거움) 사이로 옮긴다.
//  벨트 건너편(오른쪽)에도 같은 높이의 풀리 셋: 아래 풀리는 아래 세로축 → 아래 베벨 기어, 위 풀리는 위 세로축 → 위 베벨 기어,
//  두 베벨 기어가 수문 축의 피니언을 위·아래에서 물어 서로 반대로 돌린다(원문 "suitable gearing" — 판화 밖 보충).
//  운동식 state163(theta): v = theta/3 + V0. 속도 단계 S(v) ∈ [−1, 1](빠름 +1 · 알맞음 0 · 느림 −1, 머무름이 있는 계단).
//  벨트(포크) 높이 = yb0 − p·S 를 주인으로 두고 연결봉 → 지레 → 홈 고리 → 슬리브 → 팔 각을 거꾸로 푼다(모두 닫힌 식 + 이분법).
//  스핀들 각·벨트 흐름·수문 축 각은 한 주기 표(4096 칸)를 적분해 두고, 위·아래 물림 회전량이 같도록 aS 를 풀어 수문 축이 주기마다 닫힌다.
import * as THREE from 'three';
import { castIron, darkSteel, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { K162 } from './k162';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;

export const K163 = {
  sx: -0.7, // 조속기 스핀들 x
  zc: 0.275,
  hy: 2.3, // 팔 힌지 높이
  // 풀리 셋(양쪽 같음): 반지름·폭·간격, 가운데 높이
  rg: 0.13,
  pw: 0.075,
  p: 0.09,
  yb0: 1.0,
  bw: 0.05, // 벨트 폭(세로)
  bt: 0.012, // 벨트 두께
  xf: 1.0, // 건너편 풀리 셋 x
  // 건너편 베벨 기어(16이 × 0.025 마이터, 피치 반지름 0.2)
  gz: 16,
  gm: 0.025,
  gR: 0.2,
  // 지레: 받침점 P, 홈 고리 쪽 팔 끝(쉼 자세) C0, 옆 팔 길이 La(쉼 자세 수평), 연결봉 Lk
  P: [-0.42, 1.6] as [number, number],
  C0: [-0.7, 1.61] as [number, number],
  La: 0.28,
  Lk: 0.6,
  collarDrop: 0.22, // 슬리브 원점 → 홈 고리 가운데
  zL: 0.4, // 지레 판 가운데 z
  zK: 0.46, // 연결봉 평면 z
  // 시간
  aF: 0.3, // 빠름 머무름 반폭(rad of v) — 빠름이 세져 수문 축 닫힘에 맞게 줄임
  tau: 0.3, // 단계 사이 넘어감
  V0: 0.336, // t = 1 이 '알맞음' 머무름 한가운데((aF+tau + π−aS−tau)/2 − 1.6/3)
  kap: 0.75, // 스핀들 각 = kap·∫w dv
  // 기관 속도 인자 w = wM + wA·S — 느림 1.5 · 알맞음 4 · 빠름 6.5(빠름/느림 4.3배, 사용자 지적으로 2.5~5.5 에서 넓힘)
  wM: 4,
  wA: 2.5
} as const;

export const GX163 = K163.P[0] + K163.La; // 연결봉·포크의 세로 안내선 x
const LC = Math.hypot(K163.C0[0] - K163.P[0], K163.C0[1] - K163.P[1]);
const G0 = Math.atan2(K163.C0[1] - K163.P[1], K163.C0[0] - K163.P[0]);

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 속도 단계 S(v) — 빠름 |v| ≤ aF, 느림 |v − π| ≤ aS, 그 사이 알맞음(0) 머무름 */
function stepS(v: number, aS: number): number {
  let x = ((v % TAU) + TAU) % TAU;
  if (x > Math.PI) x -= TAU;
  const a = Math.abs(x);
  const { aF, tau } = K163;
  if (a <= aF) return 1;
  if (a <= aF + tau) return 1 - smooth((a - aF) / tau);
  const b = Math.PI - aS;
  if (a < b - tau) return 0;
  if (a < b) return -smooth((a - (b - tau)) / tau);
  return -1;
}
const engage = (s: number): -1 | 0 | 1 => (s > 0.5 ? 1 : s < -0.5 ? -1 : 0);

const NT = 4096;
interface Tables163 {
  aS: number;
  phi: Float64Array;
  belt: Float64Array;
  gate: Float64Array;
  perPhi: number;
  perBelt: number;
}
function buildTables(): Tables163 {
  const sumGate = (aS: number): number => {
    let g = 0;
    for (let i = 0; i < NT; i++) {
      const s = stepS(((i + 0.5) / NT) * TAU, aS);
      g += engage(s) * (K163.wM + K163.wA * s);
    }
    return g;
  };
  let lo = 0.3;
  let hi = 2.4;
  for (let k = 0; k < 60; k++) {
    const mdl = (lo + hi) / 2;
    if (sumGate(mdl) > 0) lo = mdl;
    else hi = mdl;
  }
  const aS = (lo + hi) / 2;
  const dv = TAU / NT;
  const phi = new Float64Array(NT + 1);
  const belt = new Float64Array(NT + 1);
  const gate = new Float64Array(NT + 1);
  for (let i = 0; i < NT; i++) {
    const s = stepS((i + 0.5) * dv, aS);
    const dphi = K163.kap * (K163.wM + K163.wA * s) * dv;
    const e = engage(s);
    phi[i + 1] = phi[i]! + dphi;
    belt[i + 1] = belt[i]! + (e !== 0 ? dphi : 0);
    gate[i + 1] = gate[i]! + e * dphi;
  }
  // 이분법 잔차를 고르게 빼 수문 축이 한 주기에 정확히 닫히게
  const res = gate[NT]!;
  for (let i = 0; i <= NT; i++) gate[i] = gate[i]! - (res * i) / NT;
  return { aS, phi, belt, gate, perPhi: phi[NT]!, perBelt: belt[NT]! };
}
export const T163 = buildTables();
/** t = 1 (θ 1.6) 의 스핀들 각 — 빼서 그때 두 팔이 판화처럼 좌우(XY 평면)에 오게 한다 */
const PHI1 = ((): number => {
  const v = 1.6 / 3 + K163.V0;
  return lookup(T163.phi, v / TAU - Math.floor(v / TAU)) + Math.floor(v / TAU) * T163.perPhi;
})();

function lookup(arr: Float64Array, f: number): number {
  const x = f * NT;
  const i = Math.min(NT - 1, Math.floor(x));
  const r = x - i;
  return arr[i]! * (1 - r) + arr[i + 1]! * r;
}

/** 팔 각 α → 슬리브 높이(162 와 같은 팔·링크) */
export function sleeveY163(alpha: number): number {
  const K = K162;
  const lugR = K.pinx + K.lug * Math.sin(alpha);
  const lugY = K163.hy - K.lug * Math.cos(alpha);
  return lugY - Math.sqrt(K.lk * K.lk - (lugR - K.sp) * (lugR - K.sp));
}

export interface State163 {
  v: number;
  S: number;
  w: number;
  /** 'low' 아래 풀리(빠름 — 수문 올림) · 'up' 위 풀리(느림 — 수문 내림) · 'loose' 헐거운 풀리 */
  belt: 'low' | 'up' | 'loose';
  phiS: number;
  /** 벨트가 흐른 누적 각(풀리 반지름 곱하면 길이) */
  beltAng: number;
  /** 수문 축 누적 각(건너편 아래 풀리 각 = gate, 위 풀리 = −gate) */
  gate: number;
  /** 포크(벨트) 높이 */
  yF: number;
  /** 지레 옆 팔 끝 A, 홈 고리 쪽 끝 C, 지레 회전 */
  A: [number, number];
  C: [number, number];
  beta: number;
  /** 연결봉 각(A → F) */
  linkAng: number;
  sy: number;
  alpha: number;
  lugR: number;
  lugY: number;
  linkG: number;
  ballR: number;
  ballY: number;
}

export function state163(theta: number): State163 {
  const K = K163;
  const v = theta / 3 + K.V0;
  const per = Math.floor(v / TAU);
  const f = v / TAU - per;
  const S = stepS(v, T163.aS);
  const yF = K.yb0 - K.p * S;
  // 연결봉: A 는 원(P, La) ∩ 원(F, Lk) 가운데 P→F 의 왼쪽 해
  const F: [number, number] = [GX163, yF];
  const dx = F[0] - K.P[0];
  const dy = F[1] - K.P[1];
  const d = Math.hypot(dx, dy);
  const x = (K.La * K.La - K.Lk * K.Lk + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, K.La * K.La - x * x));
  const A: [number, number] = [K.P[0] + (x * dx - h * dy) / d, K.P[1] + (x * dy + h * dx) / d];
  const beta = Math.atan2(A[1] - K.P[1], A[0] - K.P[0]);
  const C: [number, number] = [K.P[0] + LC * Math.cos(G0 + beta), K.P[1] + LC * Math.sin(G0 + beta)];
  const sy = C[1] + K.collarDrop;
  // 팔 각: sy(α) 단조 증가 — 이분법
  let lo = 0.2;
  let hi = 1.2;
  for (let i = 0; i < 50; i++) {
    const mdl = (lo + hi) / 2;
    if (sleeveY163(mdl) < sy) lo = mdl;
    else hi = mdl;
  }
  const alpha = (lo + hi) / 2;
  const G = K162;
  const lugR = G.pinx + G.lug * Math.sin(alpha);
  const lugY = K.hy - G.lug * Math.cos(alpha);
  const e = engage(S);
  return {
    v,
    S,
    w: K.wM + K.wA * S,
    belt: e > 0 ? 'low' : e < 0 ? 'up' : 'loose',
    phiS: per * T163.perPhi + lookup(T163.phi, f) - PHI1,
    beltAng: per * T163.perBelt + lookup(T163.belt, f),
    gate: lookup(T163.gate, f),
    yF,
    A,
    C,
    beta,
    linkAng: Math.atan2(F[1] - A[1], F[0] - A[0]),
    sy,
    alpha,
    lugR,
    lugY,
    linkG: Math.atan2(lugR - G.sp, lugY - sy),
    ballR: G.pinx + G.armL * Math.sin(alpha),
    ballY: K.hy - G.armL * Math.cos(alpha)
  };
}

// ───────── 모양 ─────────
function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function tubeY(rIn: number, rOut: number, y0: number, y1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  return lathe(tubeProfile(rIn, rOut, y0, y1, c), segs);
}
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 20): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 슬리브 아래로 이어지는 관 + 홈 고리(플랜지 둘, 홈 뿌리 반지름 0.05, 플랜지 0.085) — 슬리브 그룹에 더한다 */
export function collar163(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'collar';
  const dark = darkSteel();
  const yc = -K163.collarDrop;
  g.add(mesh(tubeY(0.032, 0.05, yc - 0.035, -0.14), dark));
  g.add(meshAt(tubeY(0.032, 0.085, -0.012, 0.012), dark, 0, yc + 0.026, 0));
  g.add(meshAt(tubeY(0.032, 0.085, -0.012, 0.012), dark, 0, yc - 0.026, 0));
  return g;
}

/**
 * 벨트 포크: 원점 = 포크 핀(연결봉 아래 눈) 자리 = 벨트 앞 가닥 가운데 높이(x = GX163).
 * 앞 가닥(z = zc + rg + bt/2)을 위·아래 막대와 앞·뒤 판으로 둘러싼다. 오른쪽 귀 고리가 세로 안내봉(x + 0.1, z 0.47)을 감싼다.
 * 모델은 (GX163, yF, 0) 에 놓는다(z 는 월드 값 그대로).
 */
export function fork163(): THREE.Group {
  const K = K163;
  const g = new THREE.Group();
  g.name = 'fork';
  const body = castIron({ roughness: 0.5 });
  const zs = K.zc + K.rg + K.bt / 2; // 앞 가닥 가운데 z
  const gapY = K.bw / 2 + 0.006;
  const zb0 = zs - K.bt / 2 - 0.01;
  const zf0 = zs + K.bt / 2 + 0.008;
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.015, zf0 + 0.012 - (zb0 - 0.012)), body, 0, gapY + 0.0075, (zf0 + zb0) / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.015, zf0 + 0.012 - (zb0 - 0.012)), body, 0, -gapY - 0.0075, (zf0 + zb0) / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 2 * gapY + 0.03, 0.012), body, 0, 0, zf0 + 0.006));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 2 * gapY + 0.03, 0.012), body, 0, 0, zb0 - 0.006));
  // 포크 핀(연결봉 평면까지)
  g.add(meshAt(cylZ(0.022, zf0 + 0.012, K.zK + 0.028), steel(), 0, 0, 0));
  const pm = new THREE.Object3D();
  pm.name = 'forkPin';
  pm.position.set(0, 0, K.zK);
  g.add(markPin(pm));
  // 귀: 앞판을 아래로 늘려(연결봉 눈 반지름 0.07 밖) 안내봉 고리까지
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.07, 0.012), body, 0, -gapY - 0.045, zf0 + 0.006));
  g.add(meshAt(new THREE.BoxGeometry(0.075, 0.025, 0.47 - zf0 + 0.01), body, 0.0375, -0.095, (0.47 + zf0) / 2));
  g.add(meshAt(tubeY(0.014, 0.028, -0.02, 0.02), body, 0.1, -0.095, 0.47));
  setMM(g, { kind: 'slider' });
  return g;
}

/** 스핀들 받침(구멍 Y) — 뒤판 팔 + 링. x 에서 높이 ys 마다 */
export function bearingsY163(x: number, ys: readonly number[]): THREE.Group {
  const g = new THREE.Group();
  for (const y of ys) {
    g.add(meshAt(new THREE.BoxGeometry(0.09, 0.06, 0.516), castIron(), x, y, -0.045));
    g.add(meshAt(tubeY(0.034, 0.062, -0.045, 0.045), darkSteel(), x, y, K163.zc));
  }
  setMM(g, { kind: 'frame' });
  return g;
}
