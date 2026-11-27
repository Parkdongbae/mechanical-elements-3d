// 238번 탈진기 전용 키트 — 6각 별 바퀴 D, 팔레트 틀(B·C·진자), 한 주기 표. 설계표 docs/mm507-sheets/238.md
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, tubeProfile, circlePath, shapeFrom } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/** 바퀴 한 주기 f(τ) 표(도) — 0.02 초 간격 100 값 */
const F238: number[] = [-10.851, -10.361, -9.779, 16.198, 15.701, 15.182, 14.640, 14.075, 13.488, 12.885, 12.268, 11.641, 11.010, 10.379, 9.754, 9.142, 8.551, 7.988, 7.462, 6.983, 6.558, 6.197, 5.903, 5.688, 5.557, 5.513, 5.557, 5.688, 5.903, 6.197, 6.558, 6.983, 7.462, 7.988, 8.551, 9.142, 9.754, 10.379, 11.010, 11.641, 12.268, 12.885, 13.488, 14.075, 14.640, 15.182, 15.701, 16.198, 16.671, 17.119, 17.542, 17.941, 18.555, 47.602, 47.066, 46.521, 45.971, 45.417, 44.862, 44.307, 43.757, 43.214, 42.682, 42.165, 41.665, 41.189, 40.739, 40.321, 39.938, 39.596, 39.298, 39.048, 38.851, 38.707, 38.620, 38.591, 38.620, 38.707, 38.851, 39.048, 39.298, 39.596, 39.938, 40.321, 40.739, 41.189, 41.665, 42.165, 42.682, 43.214, 43.757, 44.307, 44.862, 45.417, 45.971, 46.521, 47.066, 47.602, 48.129, 48.646];

/** 팔레트 틀 판 윤곽(A 기준, 41 점) */
export const FRAME238: V2[] = [[-0.669, -0.055], [-0.629, -0.254], [-0.551, -0.387], [-0.413, -0.469], [-0.215, -0.509], [-0.015, -0.486], [0.188, -0.396], [0.363, -0.253], [0.547, -0.037], [0.746, 0.250], [0.906, 0.523], [0.986, 0.746], [0.971, 0.904], [0.906, 1.066], [0.810, 1.210], [0.682, 1.306], [0.560, 1.338], [0.482, 1.322], [0.284, 1.227], [0.223, 1.173], [0.220, 1.165], [0.226, 1.157], [0.364, 1.106], [0.504, 1.028], [0.604, 0.920], [0.656, 0.816], [0.658, 0.805], [0.650, 0.692], [0.584, 0.611], [0.425, 0.570], [0.186, 0.554], [-0.014, 0.530], [-0.174, 0.523], [-0.269, 0.552], [-0.279, 0.558], [-0.325, 0.649], [-0.358, 0.746], [-0.376, 0.761], [-0.726, 0.653], [-0.732, 0.648], [-0.686, 0.187]];

/** 팔레트 B 윤곽(A 기준, 15 점) */
export const PALLET_B238: V2[] = [[-0.7482, 0.5516], [-0.7476, 0.5471], [-0.7447, 0.5437], [-0.7403, 0.5424], [-0.5850, 0.5424], [-0.5807, 0.5437], [-0.5785, 0.5457], [-0.5771, 0.5515], [-0.5946, 0.6782], [-0.5956, 0.6811], [-0.5988, 0.6842], [-0.6046, 0.6849], [-0.7285, 0.6518], [-0.7324, 0.6494], [-0.7344, 0.6452]];

/** 팔레트 C 윤곽(A 기준, 13 점) */
export const PALLET_C238: V2[] = [[0.3940, 1.1394], [0.3981, 1.1416], [0.4002, 1.1456], [0.4002, 1.2028], [0.3968, 1.2079], [0.3924, 1.2092], [0.0416, 1.2090], [0.0374, 1.2067], [0.0353, 1.2023], [0.0276, 1.1483], [0.0277, 1.1453], [0.0300, 1.1414], [0.0355, 1.1392]];

export const K238 = {
  D: [-0.3496, 2.45] as [number, number],
  A: [0, 1.4476] as [number, number],
  R_TIP: 0.424,
  R_VAL: 0.288,
  N: 6,
  TIP_ROUND: 0.012,
  STAR_T: 0.06,
  PSI_AMP: 5,
  PERIOD: 2,
  F: F238,
  DROP_DIFF: 3,
  /** B 놓음 / C 놓음 (τ) */
  SWAP_A: 0.0575,
  SWAP_B: 1.0475,
  /** 떨어짐 칸 가운데 (τ) — 이 뒤 0.1 초 동안 별이 빛남 */
  DROP_A: 0.05,
  DROP_B: 1.05,
  BAR: [0.03, 0.89, 0.02] as [number, number, number]
} as const;
const K = K238;

function fOf(tau: number): number {
  const f = K.F;
  const n = f.length;
  const u = tau / 0.02;
  let i = Math.floor(u + 1e-9);
  if (i >= n) i = n - 1;
  const frac = u - i;
  const a = f[i]!;
  const b = i + 1 < n ? f[i + 1]! : f[0]! + 60;
  if (Math.abs(b - a) > K.DROP_DIFF) return frac < 0.5 ? a : b;
  return a + (b - a) * frac;
}

export interface State238 {
  psi: number;
  phi: number;
  holder: 'B' | 'C';
  justDropped: boolean;
}

export function state238(t: number): State238 {
  const psi = K.PSI_AMP * Math.sin(Math.PI * t);
  const k = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - k * K.PERIOD;
  const phi = fOf(tau) + 60 * k;
  const holder = tau >= K.SWAP_A && tau < K.SWAP_B ? 'C' : 'B';
  const justDropped = (tau >= K.DROP_A && tau < K.DROP_A + 0.1) || (tau >= K.DROP_B && tau < K.DROP_B + 0.1);
  return { psi, phi, holder, justDropped };
}

// ───────────────────────── 별 바퀴 ─────────────────────────

/** 별 윤곽(로컬, 반시계): 끝(0.424∠60k) → 골(0.288∠60k+30) 12 점 다각형, 바깥(볼록) 모서리만 반지름 0.012 로 둥글림(끝마다 원호 6 점) */
export function starOutline238(): V2[] {
  const pol = (r: number, a: number): V2 => [r * Math.cos(a * D2R), r * Math.sin(a * D2R)];
  const pts: V2[] = [];
  const rho = K.TIP_ROUND;
  for (let k = 0; k < K.N; k++) {
    const T = pol(K.R_TIP, 60 * k);
    const V1 = pol(K.R_VAL, 60 * k - 30);
    const V2p = pol(K.R_VAL, 60 * k + 30);
    pts.push(V1);
    const u1: V2 = [V1[0] - T[0], V1[1] - T[1]];
    const u2: V2 = [V2p[0] - T[0], V2p[1] - T[1]];
    const l1 = Math.hypot(u1[0], u1[1]);
    const l2 = Math.hypot(u2[0], u2[1]);
    u1[0] /= l1;
    u1[1] /= l1;
    u2[0] /= l2;
    u2[1] /= l2;
    const half = 0.5 * Math.acos(u1[0] * u2[0] + u1[1] * u2[1]);
    const bx = u1[0] + u2[0];
    const by = u1[1] + u2[1];
    const bl = Math.hypot(bx, by);
    const d = rho / Math.sin(half);
    const C: V2 = [T[0] + (bx / bl) * d, T[1] + (by / bl) * d];
    const tl = rho / Math.tan(half);
    const t1: V2 = [T[0] + u1[0] * tl, T[1] + u1[1] * tl];
    const t2: V2 = [T[0] + u2[0] * tl, T[1] + u2[1] * tl];
    const a1 = Math.atan2(t1[1] - C[1], t1[0] - C[0]);
    let da = Math.atan2(t2[1] - C[1], t2[0] - C[0]) - a1;
    while (da < 0) da += TAU;
    while (da > TAU) da -= TAU;
    const ARC = 6;
    for (let i = 0; i < ARC; i++) {
      const a = a1 + (da * i) / (ARC - 1);
      pts.push([C[0] + rho * Math.cos(a), C[1] + rho * Math.sin(a)]);
    }
  }
  return pts;
}

/** 별 바퀴 D + 허브 고리 + 태엽통. 원점 = D 축, 회전축 = 로컬 Z. name `escapeD` */
export function star238(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'escapeD';
  const outline = starOutline238();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.046));
  const geo = extrude(shape, K.STAR_T, 0, 8);
  geo.translate(0, 0, K.STAR_T / 2);
  const starMat = brass();
  g.add(mesh(geo, starMat));
  // 앞면 허브 고리(반지름 0.07, z 0.06~0.075)
  const hubGeo = lathe(tubeProfile(0.046, 0.07, 0, 0.015, 0.002), 40);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.position.z = K.STAR_T;
  g.add(hub);
  // 태엽통(D 뒤 같은 축)
  const barrel = new THREE.Group();
  barrel.name = 'barrel';
  const bGeo = lathe(rodProfile(0.5, 0, 0.12, 0.008, 0.008), 64);
  bGeo.rotateX(Math.PI / 2);
  const b = mesh(bGeo, steel());
  b.position.z = -0.24;
  barrel.add(b);
  const mark = mesh(new THREE.BoxGeometry(0.16, 0.035, 0.006), paint(0xf2b619));
  mark.position.set(0.40, 0, -0.12 + 0.003);
  barrel.add(mark);
  g.add(barrel);
  g.userData.outline = outline;
  g.userData.mat = starMat;
  return g;
}

// ───────────────────────── 팔레트 틀 ─────────────────────────

function slab(outline: V2[], z0: number, z1: number, mat: THREE.Material, holeR = 0): THREE.Mesh {
  const shape = shapeFrom(outline);
  if (holeR > 0) shape.holes.push(circlePath(0, 0, holeR));
  const geo = extrude(shape, z1 - z0, 0, 6);
  geo.translate(0, 0, (z0 + z1) / 2);
  return mesh(geo, mat);
}

/** 팔레트 틀(판·B·C·허브·두 겹 원·진자). 원점 = A 축, 회전축 = 로컬 Z. name `palletFrame` — 모델이 위치·rotation.z = ψ 를 준다 */
export function frame238(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'palletFrame';
  g.add(slab(FRAME238, -0.1, -0.04, steel(), 0.042));
  // 앞면 두 겹 원(판화 A)
  for (const [ri, ro] of [
    [0.058, 0.07],
    [0.098, 0.11]
  ] as const) {
    const rg = lathe(tubeProfile(ri, ro, 0, 0.008), 48);
    rg.rotateX(Math.PI / 2);
    const m = mesh(rg, darkSteel());
    m.position.z = -0.04;
    g.add(m);
  }
  // 허브(반지름 0.08, z −0.15~−0.04)
  const hubGeo = lathe(tubeProfile(0.042, 0.08, 0, 0.11, 0.003), 48);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, steel());
  hub.position.z = -0.15;
  g.add(hub);
  // 팔레트 B·C
  const mats: THREE.Material[] = [];
  for (const [name, pts] of [
    ['palletB', PALLET_B238],
    ['palletC', PALLET_C238]
  ] as const) {
    const pg = new THREE.Group();
    pg.name = name;
    const m = brass();
    mats.push(m);
    pg.add(slab(pts, -0.04, 0.08, m));
    pg.userData.outline = pts;
    g.add(pg);
  }
  // 진자
  const pend = new THREE.Group();
  pend.name = 'pendulum';
  const bm = brass();
  const rod = mesh(new THREE.BoxGeometry(K.BAR[0], K.BAR[1], K.BAR[2]), bm);
  rod.position.set(0, -K.BAR[1] / 2, -0.125);
  pend.add(rod);
  const bobGeo = lathe(rodProfile(0.11, 0, 0.04, 0.004, 0.004), 48);
  bobGeo.rotateX(Math.PI / 2);
  const bob = mesh(bobGeo, bm);
  bob.position.set(0, -1.0, -0.125 - 0.02);
  pend.add(bob);
  g.add(pend);
  g.userData.matB = mats[0];
  g.userData.matC = mats[1];
  return g;
}
