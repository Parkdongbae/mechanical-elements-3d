// 223번 부채꼴 기어 배열 전용 키트 — 서로 다른 층의 부채꼴 기어 쌍, 아래 축 각(전환 구간 3차 곡선). 설계표 docs/mm507-sheets/223.md
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
  start: number;
  span: number;
  phase: number;
  keep: number[];
  color: number;
}

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const K223 = {
  M: 0.04,
  U: [0, 2.42] as [number, number],
  L: [0, 1.22] as [number, number],
  OMEGA: 0.5,
  BLEND: 4,
  V: [0, -22.5, -101.25, -281.25, -360] as readonly number[],
  R: [0.25, 0.875, 2.0, 0.875] as readonly number[],
  HUB_R: 0.07,
  TUBE_R: 0.06,
  WIDTH: 0.05,
  SECTORS: [
    { name: 'secU1', grp: 'upper', z: 0.205, teeth: 40, start: 0, span: 90, phase: 4.5, keep: range(1, 8), color: 0xd8362f },
    { name: 'secL4', grp: 'lower', z: 0.205, teeth: 20, start: 191.25, span: 180, phase: 11.25, keep: range(11, 19), color: 0xd8362f },
    { name: 'secU2', grp: 'upper', z: 0.14, teeth: 28, start: 90, span: 90, phase: 96.42857, keep: range(1, 5), color: 0x2f6fd8 },
    { name: 'secL2', grp: 'lower', z: 0.14, teeth: 32, start: 112.5, span: 78.75, phase: 0, keep: range(11, 15), color: 0x2f6fd8 },
    { name: 'secU3', grp: 'upper', z: 0.075, teeth: 28, start: 270, span: 90, phase: 276.42857, keep: range(1, 5), color: 0x22a35a },
    { name: 'secL3', grp: 'lower', z: 0.075, teeth: 32, start: 11.25, span: 78.75, phase: 0, keep: range(35, 39), color: 0x22a35a },
    { name: 'secU4', grp: 'upper', z: 0.01, teeth: 12, start: 180, span: 90, phase: 195, keep: range(0, 2), color: 0xf08a1c },
    { name: 'secL1', grp: 'lower', z: 0.01, teeth: 48, start: 90, span: 22.5, phase: 0, keep: range(13, 14), color: 0xf08a1c }
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
 * 부채꼴 기어: 로컬 원점 = 축, 각은 도(로컬 +X 에서 반시계). 이 중심각 = phase + j·360/teeth, keep 에 든 j 만 이를 남긴다.
 * 윤곽 = involuteOutline 의 점 가운데 각이 [start, start+span] 안인 것(빼는 이 칸의 점은 반지름 rf 로) + 양 끝 반지름 선 + 허브 원호(0.07).
 * 허브 구멍(0.06)은 허브 통에 맞는다. 두께 width 로 압출(z 가운데 0), 색 띠, userData.outline, setMM.
 */
export function sector223(
  teeth: number,
  module: number,
  startDeg: number,
  spanDeg: number,
  phaseDeg: number,
  keep: number[],
  opts: Sector223Opts = {}
): THREE.Group {
  const w = opts.width ?? K.WIDTH;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const phase = phaseDeg * D;
  const step = TAU / teeth;
  const start = startDeg * D;
  const span = spanDeg * D;
  const norm = (a: number): number => ((a % TAU) + TAU) % TAU;
  const keepSet = new Set(keep);

  const full = involuteOutline(teeth, ra, rf, phase);
  const kept = full
    .map((p) => {
      const a = Math.atan2(p[1], p[0]);
      return { p, a, rel: norm(a - start + 1e-9) };
    })
    .filter((q) => q.rel <= span + 2e-9)
    .sort((x, y) => x.rel - y.rel)
    .map((q) => {
      const j = Math.round(norm(q.a - phase) / step) % teeth;
      if (keepSet.has(j)) return q.p;
      const r = Math.hypot(q.p[0], q.p[1]) || 1;
      return [(q.p[0] * rf) / r, (q.p[1] * rf) / r] as V2;
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
  setMM(g, { kind: 'gear', fn: 'sector223', teeth, module, internal: false, noncircular: true, rp, ra, rf, start: startDeg, span: spanDeg, width: w, axis: 'z' });
  return g;
}

function hermite(x: number, a: number, b: number, ya: number, yb: number, sa: number, sb: number): number {
  const h = b - a;
  const s = (x - a) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * ya + (s3 - 2 * s2 + s) * h * sa + (-2 * s3 + 3 * s2) * yb + (s3 - s2) * h * sb;
}

const B223 = [0, 90, 180, 270, 360];

/** 아래 축 각 θL(도) — 위 축 각 θU(도). 한 바퀴에 −360°, 이음 구간(경계 ±4°)은 3차 에르미트 */
export function thetaL223(thetaUdeg: number): number {
  const n = Math.floor(thetaUdeg / 360);
  const x = thetaUdeg - 360 * n;
  const { V, R, BLEND } = K;
  for (let i = 0; i < B223.length; i++) {
    const bi = B223[i]!;
    if (Math.abs(x - bi) < BLEND) {
      const rp = R[(i + 3) % 4]!;
      const rn = R[i % 4]!;
      return -360 * n + hermite(x, bi - BLEND, bi + BLEND, V[i]! + BLEND * rp, V[i]! - BLEND * rn, -rp, -rn);
    }
  }
  const k = Math.floor(x / 90);
  return -360 * n + V[k]! - R[k]! * (x - 90 * k);
}

/** 물린 짝 0~3(U4↔L1, U2↔L2, U1↔L4, U3↔L3), 이음 구간이면 −1 */
export function pairOf223(thetaUdeg: number): number {
  const x = thetaUdeg - 360 * Math.floor(thetaUdeg / 360);
  for (const bi of B223) if (Math.abs(x - bi) < K.BLEND) return -1;
  return Math.floor(x / 90);
}
