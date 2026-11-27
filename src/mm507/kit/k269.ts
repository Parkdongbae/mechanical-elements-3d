// 269번 결손 랙 틀 전용 키트 — 위·아래 랙 막대(이 구간이 엇갈림)와 오른쪽 벽·자루·손잡이로 된 ㄷ 자 틀, 닫힌 식 운동.
// 설계표 docs/mm507-sheets/269.md 의 수치·윤곽 56점 그대로.
import * as THREE from 'three';
import { brass, castIron, steel, wood } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const TAU = Math.PI * 2;

/** xy 배율(설계표 원치수 → 이 모델). 기어 중심 기준 같은 비율 확대, z 는 그대로 */
const S = 1.3;
const XW0 = 1.07; // 원치수 벽 안쪽 X(벽 두께 0.08)

/** 원치수 윤곽 56점(위 랙 이 3 + 4, 아래 랙 이 3 + 2) — 아래 2 구간을 뺀 새 윤곽은 아래 함수가 만든다 */
const ORIG_PTS: V2[] = [
  [-0.06, 0.24875], [-0.06, 0.16875], [-0.01813, 0.16875], [-0.00585, 0.135], [0.00585, 0.135], [0.01813, 0.16875],
  [0.02899, 0.16875], [0.04127, 0.135], [0.05297, 0.135], [0.06526, 0.16875], [0.07611, 0.16875], [0.0884, 0.135],
  [0.1001, 0.135], [0.11238, 0.16875], [0.61716, 0.16875], [0.62945, 0.135], [0.64115, 0.135], [0.65343, 0.16875],
  [0.66429, 0.16875], [0.67657, 0.135], [0.68827, 0.135], [0.70055, 0.16875], [0.71141, 0.16875], [0.72369, 0.135],
  [0.73539, 0.135], [0.74768, 0.16875], [0.75853, 0.16875], [0.77082, 0.135], [0.78252, 0.135], [0.7948, 0.16875],
  [1.2422, 0.16875],
  [1.2422, -0.16875], [1.06533, -0.16875], [1.05304, -0.135], [1.04134, -0.135], [1.02906, -0.16875], [1.0182, -0.16875],
  [1.00592, -0.135], [0.99422, -0.135], [0.98193, -0.16875], [0.43003, -0.16875], [0.41775, -0.135], [0.40605, -0.135],
  [0.39376, -0.16875], [0.38291, -0.16875], [0.37062, -0.135], [0.35892, -0.135], [0.34664, -0.16875], [0.33578, -0.16875],
  [0.3235, -0.135], [0.3118, -0.135], [0.29951, -0.16875], [-0.06, -0.16875], [-0.06, -0.24875], [1.3222, -0.24875],
  [1.3222, 0.24875]
];
const sc = (pts: V2[]): V2[] => pts.map(([x, y]) => [x * S, y * S] as V2);

/** 위 랙 막대 윤곽(틀 로컬, 반시계): 위 1(이 3) + 위 2(이 4), 오른쪽은 벽 안쪽까지 */
const TOP_PTS: V2[] = sc(ORIG_PTS.slice(0, 30).concat([[XW0, 0.16875], [XW0, 0.24875]]));
/** 아래 랙 막대 윤곽: 아래 1(이 3)만 */
const BOTTOM_PTS: V2[] = sc([[XW0, -0.16875] as V2].concat(ORIG_PTS.slice(40, 54), [[XW0, -0.24875]]));
/** 벽 */
const WALL_PTS: V2[] = sc([[XW0, -0.24875], [XW0 + 0.08, -0.24875], [XW0 + 0.08, 0.24875], [XW0, 0.24875]]);
const WALL_OUT = (XW0 + 0.08) * S;

/** 269번 배치 상수(xy 는 설계표 원치수 ×1.3) */
export const K269 = {
  S,
  /** 기어 중심 */
  G: [-0.86, 1.6] as V2,
  Z: 20,
  M: 0.015 * S,
  RP: 0.15 * S,
  CSTAR: 0.0967 * S,
  F: 0.03 * S,
  /** 틀 왕복 거리(위 2 구간 끝) */
  U: 0.87337 * S,
  PERIOD: 20,
  WALL_OUT,
  /** 틀 로컬 자루 끝 X, 안내 베어링 중심 X */
  STEM_END: 2.856,
  GUIDE_X: 1.62,
  /** [u 시작, u 끝, 부호(+1 반시계 / −1 시계)] — 위 1, 아래 1, 위 2 */
  SEGS: [
    [-0.0967 * S, 0.19095 * S, 1],
    [0.22095 * S, 0.5086 * S, -1],
    [0.5386 * S, 0.87337 * S, 1]
  ] as [number, number, number][],
  TOP_PTS,
  BOTTOM_PTS,
  WALL_PTS
};

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

export interface State269 {
  u: number;
  xf: number;
  theta: number;
  rack: 'top' | 'bottom' | 'none';
  /** 틀 방향 부호: −1 = 왼쪽(−x), +1 = 오른쪽(+x), 0 = 멈춤 */
  dir: -1 | 0 | 1;
  /** 기어 회전 방향: +1 반시계, −1 시계, 0 멈춤 */
  spin: -1 | 0 | 1;
}

/** 269번 운동식(t = 초, 속도 배율이 음수면 t 가 줄어듦 — 주기로 접어 쓴다) */
export function state269(t: number): State269 {
  const tt = ((t % K269.PERIOD) + K269.PERIOD) % K269.PERIOD;
  const w = TAU / K269.PERIOD;
  const u = (K269.U / 2) * (1 - Math.cos(w * tt));
  const du = Math.sin(w * tt); // du/dt 의 부호
  let theta = Math.PI / 2;
  let rack: State269['rack'] = 'none';
  let sgn = 0;
  for (const [a, b, s] of K269.SEGS) {
    theta += (s / K269.RP) * (clamp(u, a, b) - clamp(0, a, b));
    if (u >= a && u <= b && u > 1e-9 && u < K269.U - 1e-9) {
      rack = s > 0 ? 'top' : 'bottom';
      sgn = s;
    }
  }
  if (u <= 1e-9) {
    // 출발점: 위 1 구간 안(−0.0967 ≤ 0)이라 물려 있음
    rack = 'top';
    sgn = 1;
  }
  const dir = du > 1e-9 ? -1 : du < -1e-9 ? 1 : 0;
  const spin = dir === 0 || rack === 'none' ? 0 : (sgn * (du > 0 ? 1 : -1)) as -1 | 1;
  return { u, xf: -0.8 - u, theta, rack, dir, spin };
}

function cylX(r: number, x0: number, x1: number, c0 = 0, c1 = 0): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c0, c1), 28);
  g.rotateZ(-Math.PI / 2); // 로컬 y → x
  return g;
}

/** 틀: 원점 = 틀 로컬 (0, 0)(기어 중심과 같은 높이). 메시 rackTop·rackBottom·frameWall·stem·knob + 보강 관 */
export function rackFrame269(): THREE.Group {
  const g = new THREE.Group();
  const T = 0.06;
  const zc = T / 2;
  const top = TOP_PTS;
  const bottom = BOTTOM_PTS;
  const wallPts = WALL_PTS;

  const rackTop = mesh(extrude(shapeFrom(top), T), brass());
  rackTop.name = 'rackTop';
  rackTop.position.z = zc;
  rackTop.userData.outline = top;
  const rackBottom = mesh(extrude(shapeFrom(bottom), T), brass());
  rackBottom.name = 'rackBottom';
  rackBottom.position.z = zc;
  rackBottom.userData.outline = bottom;
  const wall = mesh(extrude(shapeFrom(wallPts), T), castIron());
  wall.name = 'frameWall';
  wall.position.z = zc;
  wall.userData.outline = wallPts;
  g.add(rackTop, rackBottom, wall);

  // 자루(벽 속 0.022 박힘) + 보강 관 + 손잡이
  const stem = mesh(cylX(0.03, WALL_OUT - 0.022, K269.STEM_END, 0, 0.004), steel());
  stem.name = 'stem';
  stem.position.z = zc;
  g.add(stem);
  const sleeveGeo = lathe(tubeProfile(0.03, 0.055, WALL_OUT - 0.002, WALL_OUT + 0.03, 0.004), 32);
  sleeveGeo.rotateZ(-Math.PI / 2);
  const sleeve = mesh(sleeveGeo, steel());
  sleeve.name = 'stemSleeve';
  sleeve.position.z = zc;
  g.add(sleeve);
  const knob = mesh(new THREE.SphereGeometry(0.045, 24, 16), wood());
  knob.name = 'knob';
  knob.position.set(K269.STEM_END + 0.025, 0, zc);
  g.add(knob);
  setMM(g, { kind: 'rackFrame' });
  return g;
}
