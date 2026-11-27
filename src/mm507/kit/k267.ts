// 267번 마찰 풀리(일방향 클러치) 전용 키트 — 상수, 닫힌 식 상태, 팔 판, 허브 판. 설계표 docs/mm507-sheets/267.md
import * as THREE from 'three';
import { bronze, steel } from '../../models/materials';
import { circlePath, extrude, mesh, roundedRect, shapeFrom, type V2 } from '../../models/parts/geom';

const D2R = Math.PI / 180;

/** 팔 0 윤곽(피벗 원점, 반시계 56점) — 설계표 그대로 */
const ARM_PTS: V2[] = [
  [0.0498, -0.0049], [0.0478, -0.0145], [0.0441, -0.0236], [0.0336, -0.037], [0.0191, -0.0462], [0.0025, -0.0499],
  [-0.0145, -0.0478], [-0.0298, -0.0402], [-0.037, -0.0336], [-0.0429, -0.0257], [-0.049, -0.0098], [-0.0499, 0.0025],
  [-0.0478, 0.0145], [-0.0416, 0.0278], [-0.0305, 0.0396], [-0.0232, 0.0722], [-0.0122, 0.1042], [0.0024, 0.1344],
  [0.0206, 0.1627], [0.0422, 0.1889], [0.0671, 0.2128], [0.0952, 0.2342], [0.1263, 0.2533], [0.1603, 0.27],
  [0.1971, 0.2845], [0.2366, 0.2966], [0.2788, 0.3066], [0.3238, 0.3144], [0.3574, 0.3185], [0.3169, 0.3437],
  [0.3469, 0.3956], [0.4056, 0.3582], [0.4609, 0.3159], [0.5122, 0.2688], [0.5592, 0.2175], [0.5132, 0.1789],
  [0.4698, 0.2264], [0.4237, 0.2687], [0.4252, 0.219], [0.3791, 0.2177], [0.3361, 0.2146], [0.2962, 0.2097],
  [0.2593, 0.2031], [0.2255, 0.1948], [0.1949, 0.1849], [0.1672, 0.1735], [0.1424, 0.1606], [0.1205, 0.1462],
  [0.1012, 0.1303], [0.0844, 0.1129], [0.0699, 0.0938], [0.0577, 0.0728], [0.0477, 0.0497], [0.0413, 0.0282],
  [0.0485, 0.0121]
];

/** 267 상수 — 설계표 §부품과 치수 */
export const K267 = {
  C: [0, 1.85] as [number, number], // 테·허브 중심
  CD: [0, 0.55] as [number, number], // 구동 풀리 중심
  R_IN: 0.8,
  R_OUT: 0.86,
  PIVOT_R: 0.3,
  PIVOT_A0: 80 * D2R,
  ARM_PTS,
  P0: [0.05209, 0.29544] as [number, number],
  H0: [0.15098, 0.22384] as [number, number],
  A0_REL: [0.04702, 0.04774] as [number, number],
  SWING: -0.8 * D2R,
  PERIOD: 16,
  RUN: 4.4,
  RATIO: 0.264368
};

export type Phase267 = 'lock' | 'free' | 'rest';
export interface State267 {
  tc: number;
  n: number;
  phase: Phase267;
  phiR: number;
  thetaS: number;
  delta: number;
  phiD: number;
}

/** 한 번 달리는 프로파일(6초, 끝 0.5초 sin² 가감속, 최고 0.8 rad/s) */
function phi(tau: number): number {
  if (tau <= 0) return 0;
  if (tau < 0.5) return 0.8 * (tau / 2 - Math.sin(2 * Math.PI * tau) / (4 * Math.PI));
  if (tau < 5.5) return 0.8 * (0.25 + (tau - 0.5));
  if (tau < 6) {
    const s = tau - 5.5;
    return 0.8 * (5.25 + s / 2 + Math.sin(2 * Math.PI * s) / (4 * Math.PI));
  }
  return K267.RUN;
}

const ss = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
/** 팔이 물러나는 정도(0~1) */
function ease(tau: number): number {
  if (tau < 0.5) return ss(tau / 0.5);
  if (tau < 5.5) return 1;
  return ss((6 - tau) / 0.5);
}

/** 시각 t → 테·축·팔·구동 풀리 자세(결정적, 닫힌 식) */
export function state267(t: number): State267 {
  const n = Math.floor(t / K267.PERIOD);
  const tc = t - n * K267.PERIOD;
  const base = n * K267.RUN;
  if (tc < 6) {
    const p = phi(tc);
    return { tc, n, phase: 'lock', phiR: p, thetaS: base + p, delta: 0, phiD: p / K267.RATIO };
  }
  if (tc < 8) return { tc, n, phase: 'rest', phiR: K267.RUN, thetaS: base + K267.RUN, delta: 0, phiD: K267.RUN / K267.RATIO };
  if (tc < 14) {
    const p = K267.RUN - phi(tc - 8);
    return { tc, n, phase: 'free', phiR: p, thetaS: base + K267.RUN, delta: K267.SWING * ease(tc - 8), phiD: p / K267.RATIO };
  }
  return { tc, n, phase: 'rest', phiR: 0, thetaS: base + K267.RUN, delta: 0, phiD: 0 };
}

/** 편심 팔: 윤곽 extrude 0.07(깊이 0~0.07), 구멍 0.024. 원점 = 피벗. userData.outline 에 윤곽 */
export function frictionArm267(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(K267.ARM_PTS);
  shape.holes.push(circlePath(0, 0, 0.024));
  const geo = extrude(shape, 0.07, 0);
  geo.translate(0, 0, 0.035);
  g.add(mesh(geo, steel({ roughness: 0.3 })));
  g.userData.outline = K267.ARM_PTS;
  return g;
}

/** 허브 판: 둥근 네모(귀 80°·170°·260°·350°), 깊이 −0.05~−0.01, 가운데 구멍 0.06 */
export function hubPlate267(): THREE.Mesh {
  const shape = roundedRect(-0.2828, -0.2828, 0.2828, 0.2828, 0.04);
  shape.holes.push(circlePath(0, 0, 0.06));
  const geo = extrude(shape, 0.04, 0);
  geo.translate(0, 0, -0.03);
  geo.rotateZ(35 * D2R);
  return mesh(geo, bronze());
}
