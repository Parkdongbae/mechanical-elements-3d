// 223번 부채꼴 기어 배열 전용 키트 — 서로 다른 층의 부채꼴 기어 쌍, 아래 축 각(구간마다 일정한 비). 설계표 docs/mm507-sheets/223.md
import * as THREE from 'three';
import { brass, bronze, paint } from '../../models/materials';
import { extrude, mesh } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';
import { setMM } from './mm';

const D = Math.PI / 180;
const TAU = Math.PI * 2;

export interface Sector223Spec {
  name: string;
  grp: 'upper' | 'lower';
  z: number;
  teeth: number;
  /** 남기는 이 수(연속) */
  n: number;
  /** 첫 이(각이 가장 작은 이)의 중심각(도, 로컬 +X 에서 반시계). 가장자리는 이골 가운데 */
  a0: number;
  /** [이 번호, 이끝 반지름 상한] — 짝이 바뀌는 자리의 끝 이만 이끝을 살짝 깎는다(둥글게) */
  trims: readonly (readonly [number, number])[];
  color: number;
}

export const K223 = {
  M: 0.04,
  U: [0, 2.42] as [number, number],
  L: [0, 1.22] as [number, number],
  OMEGA: 0.5,
  V: [0, -22.5, -101.25, -281.25, -360] as readonly number[],
  R: [0.25, 0.875, 2.0, 0.875] as readonly number[],
  HUB_R: 0.07,
  TUBE_R: 0.06,
  WIDTH: 0.05,
  SECTORS: [
    { name: 'secU1', grp: 'upper', z: 0.205, teeth: 40, n: 9, a0: 10.278, trims: [[8, 0.8321]], color: 0xd8362f },
    { name: 'secL4', grp: 'lower', z: 0.205, teeth: 20, n: 11, a0: 197.695, trims: [[0, 0.4328]], color: 0xd8362f },
    { name: 'secU2', grp: 'upper', z: 0.14, teeth: 28, n: 7, a0: 92.462, trims: [[0, 0.5997], [6, 0.5689]], color: 0x2f6fd8 },
    { name: 'secL2', grp: 'lower', z: 0.14, teeth: 32, n: 7, a0: 115.971, trims: [[0, 0.6758], [6, 0.6486]], color: 0x2f6fd8 },
    { name: 'secU3', grp: 'upper', z: 0.075, teeth: 28, n: 7, a0: 286.872, trims: [[0, 0.5954], [5, 0.597]], color: 0x22a35a },
    { name: 'secL3', grp: 'lower', z: 0.075, teeth: 32, n: 8, a0: 24.612, trims: [[0, 0.6753], [7, 0.6754]], color: 0x22a35a },
    { name: 'secU4', grp: 'upper', z: 0.01, teeth: 12, n: 4, a0: 177.544, trims: [[0, 0.2735], [3, 0.272]], color: 0xf08a1c },
    { name: 'secL1', grp: 'lower', z: 0.01, teeth: 48, n: 3, a0: 94.364, trims: [[0, 0.9806], [2, 0.9649]], color: 0xf08a1c }
  ] as readonly Sector223Spec[]
};
const K = K223;

export const PAIR_NAMES223 = ['U4↔L1 (주황)', 'U2↔L2 (파랑)', 'U1↔L4 (빨강)', 'U3↔L3 (초록)'] as const;

export interface Sector223Opts {
  width?: number;
  color?: number;
  driver?: boolean;
}

/**
 * 부채꼴 기어: 로컬 원점 = 축, 각은 도(로컬 +X 에서 반시계). 이 n 개가 이어지고 첫 이의 중심각이 a0, 가장자리는 이골 가운데.
 * 윤곽 = involuteOutline 의 점 가운데 [a0 − 반 피치, + n 피치] 안인 것 + 양 끝 반지름 선(이뿌리 rf) + 허브 원호(0.07).
 * trims 의 이는 이끝 반지름을 상한으로 깎는다(끝 이 몇 개만 둥글게). 허브 구멍(0.06)은 허브 통에 맞는다.
 * 두께 width 로 압출(z 가운데 0), 색 띠, userData.outline, setMM.
 */
export function sector223(
  teeth: number,
  module: number,
  n: number,
  a0Deg: number,
  trims: readonly (readonly [number, number])[],
  opts: Sector223Opts = {}
): THREE.Group {
  const w = opts.width ?? K.WIDTH;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const step = TAU / teeth;
  const start = a0Deg * D - step / 2;
  const span = n * step;
  const norm = (a: number): number => ((a % TAU) + TAU) % TAU;
  const lim = new Map<number, number>(trims.map(([j, r]) => [j, r]));

  const full = involuteOutline(teeth, ra, rf, a0Deg * D);
  const kept = full
    .map((p) => ({ p, rel: norm(Math.atan2(p[1], p[0]) - start) }))
    .filter((q) => q.rel <= span + 1e-9)
    .sort((x, y) => x.rel - y.rel)
    .map((q) => {
      const j = Math.min(n - 1, Math.floor(q.rel / step));
      const limit = lim.get(j);
      const r = Math.hypot(q.p[0], q.p[1]) || 1;
      if (limit !== undefined && r > limit) return [(q.p[0] * limit) / r, (q.p[1] * limit) / r] as V2;
      return q.p;
    });
  const pol = (r: number, a: number): V2 => [Math.cos(a) * r, Math.sin(a) * r];
  const outline: V2[] = [pol(rf, start), ...kept, pol(rf, start + span)];
  const hubR = K.HUB_R;
  const nHub = Math.max(24, Math.round(((TAU - span) / TAU) * 96));
  for (let k = 0; k <= nHub; k++) outline.push(pol(hubR, start + span + ((TAU - span) * k) / nHub));

  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, K.TUBE_R, 0, TAU, true);
  shape.holes.push(hole);

  const g = new THREE.Group();
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  g.add(mesh(extrude(shape, w, 0, 64), body));

  // 색 띠: 앞면 가운데각 방향 반지름 막대(허브 0.08 부터 0.6·rf), 폭 0.025, 두께 0.004
  const len = 0.6 * rf;
  const mid = start + span / 2;
  const band = mesh(new THREE.BoxGeometry(len, 0.025, 0.004), paint(opts.color ?? 0xf2b619));
  band.position.set(Math.cos(mid) * (0.08 + len / 2), Math.sin(mid) * (0.08 + len / 2), w / 2 + 0.002);
  band.rotation.z = mid;
  band.name = 'band';
  g.add(band);

  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'sector223', teeth, module, internal: false, noncircular: true, rp, ra, rf, start: start / D, span: span / D, width: w, axis: 'z' });
  return g;
}

/** 아래 축 각 θL(도) — 위 축 각 θU(도). 한 바퀴에 −360°, 짝마다 구간 [90k, 90k+90) 은 곧은 비례(경계에서 꺾이되 끊기지 않음) */
export function thetaL223(thetaUdeg: number): number {
  const n = Math.floor(thetaUdeg / 360);
  const x = thetaUdeg - 360 * n;
  const k = Math.min(3, Math.floor(x / 90));
  return -360 * n + K.V[k]! - K.R[k]! * (x - 90 * k);
}

/** 물린 짝 0~3(U4↔L1, U2↔L2, U1↔L4, U3↔L3) — 항상 한 짝 */
export function pairOf223(thetaUdeg: number): number {
  const x = thetaUdeg - 360 * Math.floor(thetaUdeg / 360);
  return Math.min(3, Math.floor(x / 90));
}
