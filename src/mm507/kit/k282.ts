// 282 원판과 톱니 부채꼴 레버 전용 키트 — 상수, 운동식(state282), 톱니 부채꼴(sector282), 가로 랙(rack282), 랙 소매(sleeve282).
// 설계표 docs/mm507-sheets/282.md 의 치수·식을 그대로 옮겼다. 자세는 t(초)의 절대 함수다.
import * as THREE from 'three';
import { brass, castIron, steel } from '../../models/materials';
import { extrude, mesh, shapeFrom } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { setMM } from './mm';

type V2 = [number, number];
const PI = Math.PI;
const TAU = PI * 2;
const DEG = PI / 180;

export const K282 = {
  O: [0, 0.95] as V2,
  D: [0, 2.0] as V2,
  PIN_R: 0.4,
  W: 0.6,
  N: 18,
  M: 0.06,
  RS: 0.54,
  P: 0.1885,
  TOOTH: [0.075, 0.06, 0.07442, 0.02529] as const,
  PULLEY: [1.3, 2.96] as V2,
  ROPE_RC: 0.1088,
  LTOT: 2.78468,
  T_LEN: 2.0
} as const;
const K = K282;

export interface State282 {
  phi: number;
  beta: number;
  X: number;
  d: number;
  T: V2;
  /** 줄이 도르래에 감긴 각(rad) */
  wrap: number;
  /** 줄 길이 식의 s(T → 접점 접선 길이 + 감긴 호) */
  s: number;
  yHook: number;
}

export function state282(t: number): State282 {
  const phi = K.W * t;
  const px = K.PIN_R * Math.cos(phi);
  const py = K.D[1] + K.PIN_R * Math.sin(phi);
  const dy = py - K.O[1];
  const beta = Math.atan2(-px, dy);
  const d = Math.hypot(px, dy);
  const X = K.RS * beta;
  const T: V2 = [-K.T_LEN * Math.sin(beta), K.O[1] + K.T_LEN * Math.cos(beta)];
  const vx = T[0] - K.PULLEY[0];
  const vy = T[1] - K.PULLEY[1];
  const L = Math.hypot(vx, vy);
  const tl = Math.sqrt(L * L - K.ROPE_RC * K.ROPE_RC);
  const ang = Math.atan2(vy, vx);
  const da = Math.acos(K.ROPE_RC / L);
  const a1 = ang + da;
  const a2 = ang - da;
  let wrap = Math.sin(a1) >= Math.sin(a2) ? a1 : a2;
  wrap = Math.atan2(Math.sin(wrap), Math.cos(wrap));
  const s = tl + K.ROPE_RC * wrap;
  const yHook = K.PULLEY[1] - (K.LTOT - s);
  return { phi, beta, X, d, T, wrap, s, yHook };
}

const polar = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];

/** 톱니 부채꼴 띠(로컬 원점 = 받침점, 막대와 같은 깊이 −0.02 ~ 0.06). 이 7개, 극각 200° ~ 340° */
export function sector282(): THREE.Mesh {
  const full = involuteOutline(K.N, 0.6, 0.465);
  const lo = 200 * DEG;
  const hi = 340 * DEG;
  const eps = 1e-6;
  const inRange = full
    .map((p) => ({ p, a: ((Math.atan2(p[1], p[0]) % TAU) + TAU) % TAU }))
    .filter((q) => q.a >= lo - eps && q.a <= hi + eps)
    .sort((x, y) => x.a - y.a)
    .map((q) => q.p);
  const pts: V2[] = [polar(0.465, lo), ...inRange, polar(0.465, hi)];
  const clean: V2[] = [];
  for (const p of pts) {
    const q = clean[clean.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) clean.push(p);
  }
  const arc: V2[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) arc.push(polar(0.4, hi - ((hi - lo) * i) / n));
  const outline = [...clean, ...arc];
  const m = mesh(extrude(shapeFrom(outline), 0.08, 0), brass());
  m.position.z = 0.02;
  m.name = 'sector';
  m.userData.outline = outline;
  setMM(m, { kind: 'sector', fn: 'sector282', teeth: K.N, module: K.M, axis: 'z' });
  return m;
}

/** 가로 랙(로컬 원점 = 피치선 위 x 0, 깊이 −0.02 ~ 0.06). 이 6개 */
export function rack282(): THREE.Mesh {
  const [, , hw, hw2] = K.TOOTH;
  const teeth: V2[] = [];
  for (let k = 2; k >= -3; k--) {
    const c = (k + 0.5) * K.P;
    teeth.push([c + hw, -0.075], [c + hw2, 0.06], [c - hw2, 0.06], [c - hw, -0.075]);
  }
  const outline: V2[] = [[-1.35, -0.19], [1.35, -0.19], [1.35, -0.075], ...teeth, [-1.35, -0.075]];
  const m = mesh(extrude(shapeFrom(outline), 0.08, 0), steel());
  m.position.z = 0.02;
  m.name = 'rack';
  m.userData.outline = outline;
  setMM(m, { kind: 'rack', fn: 'rack282', module: K.M, axis: 'x' });
  return m;
}

/** 랙 소매 + 뒤 팔(한 메시). x0 = 소매 안쪽 끝, 바깥으로 0.20 */
export function sleeve282(x0: number): THREE.Mesh {
  const sgn = x0 >= 0 ? 1 : -1;
  // 단면(u = −z, v = y): 바깥 z −0.30 ~ 0.092, 구멍 z −0.022 ~ 0.062 × y 0.22 ~ 0.337 (랙이 x 로 지나감)
  const shape = shapeFrom([[-0.092, 0.19], [0.3, 0.19], [0.3, 0.367], [-0.092, 0.367]]);
  const hole = new THREE.Path();
  hole.moveTo(-0.062, 0.22);
  hole.lineTo(0.022, 0.22);
  hole.lineTo(0.022, 0.337);
  hole.lineTo(-0.062, 0.337);
  hole.closePath();
  shape.holes.push(hole);
  const geo = extrude(shape, 0.2, 0);
  geo.rotateY(PI / 2);
  const m = mesh(geo, castIron());
  m.position.x = x0 + sgn * 0.1;
  m.name = sgn < 0 ? 'sleeveL' : 'sleeveR';
  return m;
}
