// 239번 기어의 멈추개 전용 키트 — 14이 평기어(사다리꼴 이 윤곽), 두 멈추개(점열), 손 각과 이에 얹힌 각의 max/min 운동
// 설계표 docs/mm507-sheets/239.md 의 수치·점열·표 그대로.
import * as THREE from 'three';
import { brass, darkSteel, steel } from '../../models/materials';
import { circlePath, extrude, mesh, shapeFrom, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const D2R = Math.PI / 180;
const PIT = 360 / 14;

/** 239번 배치 상수(세계 좌표) */
export const K239 = {
  W: [-0.2, 1.45] as V2,
  PL: [-1.373, 1.865] as V2,
  PR: [1.398, 2.042] as V2,
  teeth: 14,
  rTip: 0.94,
  rRoot: 0.72,
  tipHalf: 3.54,
  rootHalf: 8.08,
  a0: 92,
  pit: PIT,
  Tc: 9.6,
  handR: 20,
  handL: 16,
  fall: 25.65
} as const;
const K = K239;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 기어 윤곽 70 점(로컬, θ = 0, 반시계) */
export function gearOutline239(): V2[] {
  const out: V2[] = [];
  const pol = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
  for (let k = 0; k < K.teeth; k++) {
    const a = K.a0 + PIT * k;
    out.push(pol(K.rRoot, a - K.rootHalf), pol(K.rTip, a - K.tipHalf), pol(K.rTip, a + K.tipHalf), pol(K.rRoot, a + K.rootHalf), pol(K.rRoot, a + PIT / 2));
  }
  return out;
}

/** 평기어: 원점 = 중심, z −0.05~0.05, 구멍 0.06, 허브 두 겹 원 표시 */
export function gear239(): THREE.Group {
  const g = new THREE.Group();
  const outline = gearOutline239();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.06));
  g.add(meshAt(extrude(shape, 0.1, 0.004, 8), brass(), 0, 0, 0));
  g.add(meshAt(new THREE.TorusGeometry(0.3, 0.008, 8, 72), darkSteel(), 0, 0, 0.051));
  g.add(meshAt(new THREE.TorusGeometry(0.2, 0.008, 8, 72), darkSteel(), 0, 0, 0.051));
  g.userData.outline = outline;
  return g;
}

export const LEVER_L239: V2[] = [[-0.0748,-0.0040],[-0.0722,-0.0201],[-0.0651,-0.0372],[-0.0535,-0.0525],[-0.0395,-0.0636],[-0.0284,-0.0694],[-0.0105,-0.0742],[0.0040,-0.0748],[0.0191,-0.0725],[0.0324,-0.0676],[0.2551,0.0372],[0.3533,0.1048],[0.3672,0.1172],[0.5290,0.3026],[0.7125,0.4311],[0.7183,0.4337],[0.8178,0.4544],[0.8269,0.4535],[0.9929,0.2891],[1.0042,0.2861],[1.0390,0.2948],[1.0447,0.2998],[1.0475,0.3069],[1.0912,0.5877],[1.0895,0.5977],[1.0831,0.6042],[1.0740,0.6062],[1.0041,0.5914],[0.9967,0.5952],[0.9851,0.6088],[0.9731,0.6182],[0.9614,0.6243],[0.9479,0.6284],[0.9312,0.6299],[0.9171,0.6283],[0.6700,0.5768],[0.6540,0.5716],[0.6413,0.5644],[0.4336,0.4189],[0.4201,0.4066],[0.2586,0.2215],[0.1842,0.1696],[-0.0381,0.0646],[-0.0528,0.0532],[-0.0640,0.0390],[-0.0707,0.0250],[-0.0743,0.0102]];

export const LEVER_R239: V2[] = [[-0.9594,0.0825],[-0.9530,0.0840],[-0.9443,0.0815],[-0.8426,0.0139],[-0.8305,0.0075],[-0.8170,0.0032],[-0.6019,-0.0069],[-0.3071,-0.0266],[-0.0091,-0.0744],[0.0101,-0.0743],[0.0281,-0.0695],[0.0381,-0.0646],[0.0525,-0.0535],[0.0636,-0.0397],[0.0691,-0.0290],[0.0739,-0.0123],[0.0750,0.0003],[0.0730,0.0169],[0.0695,0.0281],[0.0590,0.0462],[0.0507,0.0552],[0.0377,0.0648],[0.0257,0.0704],[0.0114,0.0741],[-0.2929,0.1228],[-0.5930,0.1428],[-0.7760,0.1508],[-0.9811,0.2860],[-0.9942,0.2930],[-1.0097,0.2976],[-1.0237,0.2988],[-1.0375,0.2974],[-1.0529,0.2926],[-1.0769,0.2768],[-1.0853,0.2753],[-1.1461,0.3095],[-1.1510,0.3062],[-1.1551,0.2909],[-1.1755,0.1930],[-1.1855,0.1162],[-1.1905,0.0386],[-1.1892,0.0321],[-1.1854,0.0267],[-1.1501,-0.0053],[-1.1435,-0.0063]];

/** 멈추개: 원점 = 받침점, 두께 0.08(z −0.04~0.04), 구멍 0.032, outline, 재질은 레버마다 따로(userData.mat) */
export function lever239(side: 'L' | 'R'): THREE.Group {
  const g = new THREE.Group();
  const outline = side === 'L' ? LEVER_L239 : LEVER_R239;
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.032));
  const mat = steel();
  g.add(meshAt(extrude(shape, 0.08, 0.004, 16), mat, 0, 0, 0));
  g.userData.mat = mat;
  g.userData.outline = outline;
  setMM(g, { kind: 'pawl', fn: 'lever239' });
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

const TAB_L = [-0.052, -0.045, -0.035, 0.004, 0.108, 0.538, 2.027, 3.391, 4.635, 5.779, 6.839, 7.827, 8.753, 9.623, 10.443, 11.218, 11.933, 12.162, 12.148, 12.124, 12.104, 12.089, 12.077, 12.070, 12.066, 12.067, 12.072, 12.081, 12.094, 12.111, 12.133, 12.158, 12.132, 12.051, 11.967, 11.881, 11.764, 11.438, 10.671, 9.824, 8.983, 8.148, 7.320, 6.499, 5.685, 4.879, 4.080, 3.289, 2.507, 1.732, 0.967, 0.211];
const TAB_RT = [0.259, 0.136, 0.020, -0.089, -0.207, -0.461, -0.896, -1.416, -1.928, -2.432, -2.926, -3.412, -3.889, -4.358, -4.818, -5.270, -5.713, -6.147, -6.574, -6.992, -7.401, -7.803, -8.196, -8.582, -8.959, -9.329, -9.691, -10.045, -10.391, -10.730, -11.061, -11.383, -11.460, -11.436, -11.416, -11.400, -11.389, -11.380, -11.376, -11.376, -11.379, -11.386, -11.397, -11.411, -11.430, -11.451, -11.450, -11.229, -11.006, -10.783, -10.561, -10.287];

const mod = (a: number, n: number): number => ((a % n) + n) % n;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const sm = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** 왼쪽 레버가 이에 얹힌 각(도), φ 0 ≤ φ < PIT — 25.5 이후는 표 첫값으로 이어짐(주기) */
export function cL239(phi: number): number {
  const f = phi / 0.5;
  const i = Math.floor(f);
  if (i >= 51) {
    const x = (phi - 25.5) / (PIT - 25.5);
    return TAB_L[51]! + (TAB_L[0]! - TAB_L[51]!) * Math.min(1, x);
  }
  return TAB_L[i]! + (TAB_L[i + 1]! - TAB_L[i]!) * (f - i);
}
/** 오른쪽 레버(음수 = 들림). φ > 25.65 이면 표 첫값(툭 떨어짐) */
export function cR239(phi: number): number {
  if (phi > K.fall) return TAB_RT[0]!;
  const f = phi / 0.5;
  const i = Math.floor(f);
  if (i >= 51) return TAB_RT[51]! + (-9.978 - TAB_RT[51]!) * ((phi - 25.5) / (K.fall - 25.5));
  return TAB_RT[i]! + (TAB_RT[i + 1]! - TAB_RT[i]!) * (f - i);
}

export interface State239 {
  tau: number;
  theta: number;
  lamL: number;
  lamR: number;
  hL: number;
  hR: number;
  /** 기어 방향: 1 반시계, −1 시계, 0 섬 */
  dir: -1 | 0 | 1;
  stopSide: 'L' | 'R' | 'both' | null;
  text: string;
}

/** 239번 운동식(t = 장면 시간 초) */
export function state239(t: number): State239 {
  const tau = mod(t, K.Tc);
  const P2 = 2 * PIT;
  const SW = P2 + 2.5;
  let theta: number;
  let dir: -1 | 0 | 1 = 0;
  if (tau < 0.6) theta = 0;
  else if (tau < 2.6) {
    theta = -SW * sm((tau - 0.6) / 2);
    dir = -1;
  } else if (tau < 3.0) {
    theta = -SW + 2.5 * sm((tau - 2.6) / 0.4);
    dir = 1;
  } else if (tau < 5.4) theta = -P2;
  else if (tau < 7.4) {
    theta = -P2 + SW * sm((tau - 5.4) / 2);
    dir = 1;
  } else if (tau < 7.8) {
    theta = 2.5 - 2.5 * sm((tau - 7.4) / 0.4);
    dir = -1;
  } else theta = 0;
  let hR = 0;
  if (tau < 0.6) hR = -K.handR * sm(tau / 0.6);
  else if (tau < 3.0) hR = -K.handR;
  else if (tau < 3.6) hR = -K.handR + K.handR * sm((tau - 3.0) / 0.6);
  let hL = 0;
  if (tau >= 4.8 && tau < 5.4) hL = K.handL * sm((tau - 4.8) / 0.6);
  else if (tau >= 5.4 && tau < 7.8) hL = K.handL;
  else if (tau >= 7.8 && tau < 8.4) hL = K.handL - K.handL * sm((tau - 7.8) / 0.6);
  const phiL = mod(-theta, PIT);
  const phiR = mod(theta, PIT);
  const lamL = Math.max(hL, cL239(phiL));
  const lamR = Math.min(hR, cR239(phiR));
  let stopSide: 'L' | 'R' | 'both' | null = null;
  if (tau >= 2.6 && tau < 3.6) stopSide = 'L';
  else if (tau >= 7.4 && tau < 8.4) stopSide = 'R';
  else if ((tau >= 3.6 && tau < 4.8) || tau >= 8.4) stopSide = 'both';
  const text =
    tau < 0.6 ? '오른쪽 레버를 듦'
    : tau < 2.6 ? '시계로 돌림 — 왼쪽 레버가 이를 타고 넘음'
    : tau < 3.6 ? '손을 놓음 — 왼쪽 코에 걸려 멈춤'
    : tau < 4.8 ? '양쪽 잠금 — 어느 쪽으로도 못 돎'
    : tau < 5.4 ? '왼쪽 레버를 듦'
    : tau < 7.4 ? '반시계로 돌림 — 오른쪽 레버가 넘음'
    : tau < 8.4 ? '오른쪽 코에 걸려 멈춤'
    : '양쪽 잠금 — 어느 쪽으로도 못 돎';
  return { tau, theta, lamL, lamR, hL, hR, dir, stopSide, text };
}
