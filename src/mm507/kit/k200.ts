// 200번 한 바퀴로 두 속도 전용 키트 — 마주 보는 큰·작은 이판(크라운)과 비스듬히 미끄러지는 평기어의 닫힌 시간표, 안내판, 축 받침
import * as THREE from 'three';
import { castIron, darkSteel } from '../../models/materials';
import { extrude, lathe, mesh, roundedRect, stadiumShape, tubeProfile } from '../../models/parts/geom';
import { STAGE } from './stand';

export const K200 = {
  m: 0.036,
  Np: 10,
  Nu: 24,
  Nl: 16,
  XC: -0.45, // 세로축 x
  ZC: 0.27, // 기구 평면 z
  yPu: 2.05, // 위 이판 피치 평면 높이(이가 아래)
  D: 0.52, // 위·아래 피치 평면 간격
  slotX: 1.15 // 미끄럼 안내판 x
} as const;

const K = K200;
export const RP200 = (K.Np * K.m) / 2; // 평기어 피치 반지름 0.18
export const RM_U = (K.Nu * K.m) / 2; // 위 이판 맞물림 반지름 0.432
export const RM_L = (K.Nl * K.m) / 2; // 아래 이판 0.288
export const YPL = K.yPu - K.D; // 아래 이판 피치 평면
export const Y_U = K.yPu - RP200; // 위 이판에 물릴 때 평기어 축 높이
export const Y_L = YPL + RP200; // 아래 이판에 물릴 때

const ss = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const invSs = (y: number): number => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ss(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const S_OUT = 0.36; // 이 미끄러짐이 이만큼 가면 위 이판 이에서 벗어난다(1.5·m / 이동 높이 = 0.34 + 여유)
const U_A = invSs(S_OUT);
const W_SL = 2.4; // 미끄러짐 창(평기어 각, rad)
/** 어느 이판에도 안 물리는 구간(평기어 각) */
export const WF200 = (1 - 2 * U_A) * W_SL;
/** 위 이판에 물려 있는 평기어 각 길이 */
export const TH_U = 3 * Math.PI;
/** 아래 이판에 물려 있는 길이 — 한 주기가 닫히도록 정한다: Np(2Wf + θL) + (Nu·Np/Nl)θL ≡ 0 (mod 2π) */
export const TH_L = (() => {
  const a = K.Np * (1 + K.Nu / K.Nl);
  for (let k = 1; k < 100; k++) {
    const x = (2 * Math.PI * k - 2 * K.Np * WF200) / a;
    if (x > 2) return x;
  }
  return 2.2;
})();
export const PERIOD200 = TH_U + TH_L + 2 * WF200;
const PSI_A = (K.Np * Math.PI) / (2 * K.Nu);
const PSI_1 = PSI_A - (K.Np / K.Nu) * TH_U;
const PSI_END = PSI_1 + (K.Np / K.Nl) * TH_L;
const DPSI = PSI_END - PSI_A;
/** 아래 이판을 위 이판에 대해 돌려 놓는 각 — 아래 이판이 처음 물리는 순간 이 위상이 맞게 */
export const EPS200 = (() => {
  const rhoB = TH_U + WF200;
  const e = (K.Np * (rhoB + Math.PI / 2)) / K.Nl - PSI_1;
  const p = (2 * Math.PI) / K.Nl;
  return ((e % p) + p) % p;
})();

export interface State200 {
  /** 세로축(이판 둘) 각, +Y 둘레 반시계 + */
  psi: number;
  /** 평기어 미끄러짐 0 = 위 이판 쪽 ~ 1 = 아래 이판 쪽 */
  s: number;
  mode: 'U' | 'L' | 'F';
  /** 세로축 각속도 방향(−1 위 이판 물림, +1 아래 이판 물림, 0 정지) */
  dir: -1 | 0 | 1;
  /** 평기어 중심 위치 */
  x: number;
  y: number;
}

/** 평기어 각 rho(+X 둘레 반시계)에서 모든 자세 */
export function state200(rho: number): State200 {
  const T = PERIOD200;
  const n = Math.floor(rho / T);
  const q = rho - n * T;
  const nU = TH_U;
  const nF = WF200;
  let psi: number;
  let mode: State200['mode'];
  let dir: State200['dir'];
  if (q < nU) {
    psi = PSI_A - (K.Np / K.Nu) * q;
    mode = 'U';
    dir = -1;
  } else if (q < nU + nF) {
    psi = PSI_1;
    mode = 'F';
    dir = 0;
  } else if (q < nU + nF + TH_L) {
    psi = PSI_1 + (K.Np / K.Nl) * (q - nU - nF);
    mode = 'L';
    dir = 1;
  } else {
    psi = PSI_END;
    mode = 'F';
    dir = 0;
  }
  psi += n * DPSI;
  const c1 = nU + nF / 2;
  const c2 = nU + nF + TH_L + nF / 2;
  let s: number;
  if (q >= c2 - W_SL / 2) s = 1 - ss((q - c2) / W_SL + 0.5);
  else if (q < c2 + W_SL / 2 - T) s = 1 - ss((q + T - c2) / W_SL + 0.5);
  else s = ss((q - c1) / W_SL + 0.5);
  const x = K.XC + RM_U + s * (RM_L - RM_U);
  const y = Y_U + s * (Y_L - Y_U);
  return { psi, s, mode, dir, x, y };
}

/** 미끄럼 안내판(고정): 평기어 축이 지나는 비스듬한 이동 높이만큼 세로 홈이 난 판. 뒤판에서 앞으로, x = slotX 에 얇게 선다 */
export function slotPlate200(): THREE.Group {
  const g = new THREE.Group();
  const yc = (Y_U + Y_L) / 2;
  const a0 = -(K.ZC + 0.1);
  const a1 = -STAGE.backZ; // z = −a → 뒤판 앞면
  const shape = roundedRect(a0, yc - 0.45, a1, yc + 0.45, 0.03);
  const hole = stadiumShape(-K.ZC, Y_L, -K.ZC, Y_U, 0.04);
  shape.holes.push(new THREE.Path(hole.getPoints(24)));
  const plate = mesh(extrude(shape, 0.08, 0.005), castIron());
  plate.rotation.y = Math.PI / 2; // 로컬 z → 세계 +x, 로컬 x → 세계 −z
  plate.position.x = K.slotX;
  g.add(plate);
  return g;
}

/** 세로축 받침(고정): 뒤판에서 나온 팔 + 고리. 위치 (x, y), 축은 Y */
export function wallRing200(x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const arm = mesh(new THREE.BoxGeometry(0.16, 0.1, K.ZC - 0.065 - STAGE.backZ), castIron());
  arm.position.set(x, y, (K.ZC - 0.065 + STAGE.backZ) / 2);
  g.add(arm);
  const ring = mesh(lathe(tubeProfile(0.04, 0.065, -0.05, 0.05, 0.008), 36), darkSteel());
  ring.position.set(x, y, K.ZC);
  g.add(ring);
  return g;
}
