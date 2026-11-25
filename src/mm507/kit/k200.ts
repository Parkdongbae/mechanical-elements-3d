// 200번 한 바퀴로 두 속도 전용 키트 — 세로축의 마주 보는 큰·작은 베벨(헐거움)과 비스듬한 구동 베벨 피니언,
// 두 베벨 사이 클러치 슬리브의 닫힌 시간표, 시프트 포크·안내, 축 받침
// 기하: 세 원뿔(위 베벨 γU · 아래 베벨 γL · 피니언 β)이 세로축 위 한 점 P 를 꼭짓점으로 공유하고, 피니언 피치 원뿔의
// 위 모선이 위 베벨에, 아래 모선이 아래 베벨에 동시에 닿는다(판화 그대로) — γU + γL + 2β = π, 피니언 축 기울기 δ = (γU − γL)/2.
import * as THREE from 'three';
import { castIron, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { STAGE } from './stand';

export const K200 = {
  m: 0.032,
  Nu: 24, // 위 큰 베벨
  Nl: 14, // 아래 작은 베벨
  Np: 14, // 구동 베벨 피니언
  XC: -0.5, // 세로축 x
  YP: 1.75, // 세 원뿔의 공통 꼭짓점 P 높이
  ZC: 0.27, // 기구 평면 z
  face: 0.15, // 이 폭(모선 방향)
  shaftR: 0.04
} as const;
const K = K200;

/** γU + γL + 2β = π 를 만족하는 K = 2L/m 을 푼다(sinγ = N/K) */
const KK = (() => {
  const f = (k: number): number => Math.asin(K.Nu / k) + Math.asin(K.Nl / k) + 2 * Math.asin(K.Np / k) - Math.PI;
  let lo = Math.max(K.Nu, K.Nl, K.Np) + 1e-9;
  let hi = 500;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return lo;
})();
export const GU200 = Math.asin(K.Nu / KK); // 위 베벨 피치 원뿔 반각 ≈ 76.4°
export const GL200 = Math.asin(K.Nl / KK); // 아래 베벨 ≈ 34.5°
export const B200 = Math.asin(K.Np / KK); // 피니언 ≈ 34.5°
export const DELTA200 = (GU200 - GL200) / 2; // 피니언 축이 수평 아래로 기운 각 ≈ 20.9°
export const L200 = (KK * K.m) / 2; // 원뿔 거리(꼭짓점 → 큰 쪽 피치원) ≈ 0.395

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
/** 공통 꼭짓점 P(세계) */
export const P200 = V(K.XC, K.YP, K.ZC);
/** 피니언 축 방향(꼭짓점에서 멀어지는 쪽, 오른쪽 아래) */
export const A200 = V(Math.cos(DELTA200), -Math.sin(DELTA200), 0);
const gU = V(Math.sin(GU200), Math.cos(GU200), 0);
const gL = V(Math.sin(GL200), -Math.cos(GL200), 0);

const qZ = (d: THREE.Vector3): THREE.Quaternion => new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().normalize());

export interface Frame200 {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}
/** coneBevelGear 를 담는 틀: 로컬 원점 = 큰 쪽 피치원 중심, 로컬 +Z = 꼭짓점 P 쪽 */
export const FR_U: Frame200 = { pos: P200.clone().add(V(0, L200 * Math.cos(GU200), 0)), quat: qZ(V(0, -1, 0)) };
export const FR_L: Frame200 = { pos: P200.clone().add(V(0, -L200 * Math.cos(GL200), 0)), quat: qZ(V(0, 1, 0)) };
export const FR_P: Frame200 = { pos: P200.clone().addScaledVector(A200, L200 * Math.cos(B200)), quat: qZ(A200.clone().negate()) };
/** 물림점(큰 쪽 피치원 위) */
export const C_U = P200.clone().addScaledVector(gU, L200);
export const C_L = P200.clone().addScaledVector(gL, L200);

const localAngle = (fr: Frame200, c: THREE.Vector3): number => {
  const l = c.clone().sub(fr.pos).applyQuaternion(fr.quat.clone().invert());
  return Math.atan2(l.y, l.x);
};
/** 양(+)의 로컬 회전이 물림점에서 만드는 속도 방향 */
const spinVel = (fr: Frame200, c: THREE.Vector3): THREE.Vector3 =>
  V(0, 0, 1).applyQuaternion(fr.quat).cross(c.clone().sub(fr.pos)).normalize();

/** 피니언 각 φp 에 대해 물린 베벨의 각: φg = αg + σ(Rp(φp − αp) + πm/2)/Rg — 이 사이에 이가 들어가는 위상 */
function phaseFn(fr: Frame200, c: THREE.Vector3, Ng: number): { k: number; at: (phiP: number) => number } {
  const t = spinVel(FR_P, c);
  const sigma = spinVel(fr, c).dot(t) > 0 ? 1 : -1;
  const ap = localAngle(FR_P, c);
  const ag = localAngle(fr, c);
  const Rp = (K.Np * K.m) / 2;
  const Rg = (Ng * K.m) / 2;
  return { k: (sigma * Rp) / Rg, at: (phiP) => ag + (sigma * (Rp * (phiP - ap) + (Math.PI * K.m) / 2)) / Rg };
}
const PH_U = phaseFn(FR_U, C_U, K.Nu);
const PH_L = phaseFn(FR_L, C_L, K.Nl);
/** 세로축(+Y 둘레) 각속도 비 — 위 베벨은 로컬 Z = −Y 라 부호가 뒤집힌다 */
export const KU200 = -PH_U.k; // 크기 14/24
export const KL200 = PH_L.k; // 크기 14/14, 부호 반대

// ── 클러치 시간표(피니언 각) ──
export const TH_U = 3 * Math.PI; // 위 베벨에 클러치가 붙어 있는 길이
export const TH_L = 3 * Math.PI; // 아래 베벨
export const W200 = 1.6; // 옮기는 사이(세로축 멈춤)
export const PERIOD200 = TH_U + TH_L + 2 * W200;
/** 클러치 슬리브 높이: 위 붙음 / 아래 붙음 */
export const CL_HALF = 0.03; // 슬리브 반높이
export const Y_HUB_U = FR_U.pos.y - K.face * Math.cos(GU200) - 0.05; // 위 베벨 꼭짓점 쪽 허브 끝
export const Y_HUB_L = FR_L.pos.y + K.face * Math.cos(GL200) + 0.05; // 아래 베벨 허브 끝
export const Y_CLU = Y_HUB_U - CL_HALF - 0.001;
export const Y_CLL = Y_HUB_L + CL_HALF + 0.001;

const ss = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface State200 {
  /** 세로축 각(+Y 둘레) */
  psi: number;
  /** 위·아래 베벨 로컬 회전(헐거워 늘 돈다), 피니언 = theta */
  phiU: number;
  phiL: number;
  mode: 'U' | 'L' | 'F';
  /** 세로축 각속도 부호 */
  dir: -1 | 0 | 1;
  /** 클러치 슬리브 중심 높이 */
  yc: number;
}

export function state200(theta: number): State200 {
  const T = PERIOD200;
  const n = Math.floor(theta / T);
  const q = theta - n * T;
  const dPsi = KU200 * TH_U + KL200 * TH_L;
  let psi: number;
  let mode: State200['mode'];
  let s: number; // 0 위 붙음 ~ 1 아래 붙음
  if (q < TH_U) {
    psi = KU200 * q;
    mode = 'U';
    s = 0;
  } else if (q < TH_U + W200) {
    psi = KU200 * TH_U;
    mode = 'F';
    s = ss((q - TH_U) / W200);
  } else if (q < TH_U + W200 + TH_L) {
    psi = KU200 * TH_U + KL200 * (q - TH_U - W200);
    mode = 'L';
    s = 1;
  } else {
    psi = dPsi;
    mode = 'F';
    s = 1 - ss((q - TH_U - W200 - TH_L) / W200);
  }
  psi += n * dPsi;
  const rate = mode === 'U' ? KU200 : mode === 'L' ? KL200 : 0;
  const dir = (rate > 0 ? 1 : rate < 0 ? -1 : 0) as State200['dir'];
  return { psi, phiU: PH_U.at(theta), phiL: PH_L.at(theta), mode, dir, yc: Y_CLU + s * (Y_CLL - Y_CLU) };
}

/** 클러치 슬리브(세로축에 키로 끼워 함께 돈다, 위아래로 미끄러짐): 로컬 Y = 축, 가운데 포크 홈. 위·아래 끝면이 베벨 허브에 붙는 마찰면 */
export function clutch200(): THREE.Group {
  const g = new THREE.Group();
  const r0 = K.shaftR + 0.004;
  const prof: [number, number][] = [
    [r0, -CL_HALF], [0.085, -CL_HALF], [0.085, -0.01], [0.062, -0.01], [0.062, 0.01], [0.085, 0.01], [0.085, CL_HALF], [r0, CL_HALF], [r0, -CL_HALF]
  ];
  g.add(mesh(lathe(prof, 40), darkSteel()));
  const mk = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.012), paint(0xf2b619));
  mk.position.set(0, 0, 0.088);
  g.add(mk);
  return g;
}

/** 시프트 포크(위아래로 움직임): 원점 = 슬리브 홈 중심. 홈 뒤쪽 반고리 + 뒤판 쪽으로 가는 팔 + 미끄럼 쐐기 */
export function fork200(): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(lathe(tubeProfile(0.064, 0.1, -0.009, 0.009, 0.003), 32, Math.PI / 2, Math.PI), castIron());
  g.add(ring); // φ ∈ [π/2, 3π/2] → 뒤(−z) 반원
  const back = STAGE.backZ - K.ZC; // 뒤판 앞면(로컬 z)
  const armLen = -back - 0.1 - 0.02;
  const arm = mesh(new THREE.BoxGeometry(0.04, 0.018, armLen), castIron());
  arm.position.set(0, 0, -0.098 - armLen / 2);
  g.add(arm);
  const slide = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), castIron());
  slide.position.set(0, 0, back + 0.02 + 0.001);
  g.add(slide);
  return g;
}

/** 포크 안내(고정): 뒤판 위 두 레일 사이로 포크 쐐기가 위아래로 미끄러진다 */
export function forkGuide200(): THREE.Group {
  const g = new THREE.Group();
  const yc = (Y_CLU + Y_CLL) / 2;
  for (const sx of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.05), castIron());
    r.position.set(K.XC + sx * 0.071, yc, STAGE.backZ + 0.025);
    g.add(r);
  }
  return g;
}
