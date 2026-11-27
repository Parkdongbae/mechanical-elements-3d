// 278 오티스의 승강기 안전 정지 장치 전용 키트 — 상수·닫힌 상태식·래칫 줄·폴·판 스프링·엘보 레버 (설계표 docs/mm507-sheets/278.md)
// 줄이 팽팽하면 폴이 안쪽에 있고, 줄이 끊기면 스프링이 핀 b 를 밀어 내려 레버가 폴을 래칫 윗면으로 민다.
import * as THREE from 'three';
import { circlePath, extrude, merge, mesh, pathFrom, shapeFrom, type V2 } from '../../models/parts/geom';
import { paint, steel } from '../../models/materials';

const D2R = Math.PI / 180;

export const K278 = {
  L: [-0.88, -0.42] as [number, number], // 왼쪽 레버 피벗(승강대 좌표)
  ARM_I: 0.82, // 가로 팔(덩이 쪽)
  ARM_D: 0.51, // 세로 팔(폴 쪽)
  A_I0: 8, // 도: 가로 팔 처음 각
  A_D0: -81.87, // 도: 세로 팔 처음 각
  I0: [-0.06798, -0.30588] as [number, number],
  D0: [-0.80788, -0.92487] as [number, number],
  U_MAX: 0.18, // 핀 b 최대 내려감
  TIP_OFF: 0.52012, // 폴 끝 ~ 세로 홈 중심
  TIP_IN: -1.328, // 들어간 폴 끝 x
  PITCH: 0.18,
  TOOTH: 0.1,
  TOP0: 0.65,
  V: 0.3 / 2.25,
  G: 6.0,
  T_LAND: 0.14055,
  Y_BREAK: 1.7,
  Y_CATCH: 1.622,
  PERIOD: 14,
  ROPE_BREAK_Y: 2.892,
  EYE_TOP: 0.942, // 핀 좌표 고리 위 끝
  STUB: 0.25
} as const;

const K = K278;
const A_I = K.A_I0 * D2R;
const A_D = K.A_D0 * D2R;

const ss = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** 핀이 u 만큼 내려갔을 때 레버 각(시계 방향 +) */
export function thetaOfU278(u: number): number {
  const s = (K.ARM_I * Math.sin(A_I) - u) / K.ARM_I;
  return A_I - Math.asin(s);
}
/** 레버 각 θ 에서 왼쪽 폴 끝 x */
export function tipOfTheta278(theta: number): number {
  return K.L[0] + K.ARM_D * Math.cos(A_D - theta) - K.TIP_OFF;
}
/** 왼쪽 폴 끝 x 에서 거꾸로 레버 각 */
export function thetaOfTip278(x: number): number {
  const c = Math.min(1, Math.max(-1, (x + K.TIP_OFF - K.L[0]) / K.ARM_D));
  return A_D + Math.acos(c);
}
export function uOfTheta278(theta: number): number {
  return K.ARM_I * Math.sin(A_I) - K.ARM_I * Math.sin(A_I - theta);
}

export type Phase278 = 'lift' | 'down' | 'break' | 'catch' | 'splice' | 'return';

export interface State278 {
  tc: number;
  phase: Phase278;
  Y: number; // 가로대 밑면 높이
  u: number; // 핀 b 가 내려간 양
  theta: number; // 레버 각(라디안, 시계 +)
  tipX: number; // 왼쪽 폴 끝 x(승강대 좌표)
  ropeLow: number; // 아래 토막 위 끝(세계 높이)
  ropeHigh: number; // 위 토막 아래 끝(세계 높이)
  broken: boolean;
  /** 화살표: 1 위, -1 아래, 0 숨김 */
  dir: number;
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세 */
export function state278(t: number): State278 {
  const tc = ((t % K.PERIOD) + K.PERIOD) % K.PERIOD;
  let Y = 1.45;
  let u = 0;
  let phase: Phase278 = 'lift';
  let dir = 0;
  let tipOverride: number | null = null;
  if (tc < 3) {
    Y = 1.45 + 0.55 * ss(tc / 3);
    dir = 1;
  } else if (tc < 3.5) {
    Y = 2.0;
  } else if (tc < 6) {
    const tau = tc - 3.5;
    Y = tau < 0.5 ? 2.0 - K.V * tau * tau : 2.0 - K.V * (tau - 0.25);
    phase = 'down';
    dir = -1;
  } else if (tc < 6 + K.T_LAND) {
    const tau = tc - 6;
    Y = K.Y_BREAK - K.V * tau - 0.5 * K.G * tau * tau;
    phase = 'break';
    dir = -1;
    const us = K.U_MAX * ss(tau / 0.12);
    const xs = tipOfTheta278(thetaOfU278(us));
    const yb = Y - 0.97;
    const xlim = -1.45 + (K.TOOTH / K.PITCH) * (yb - K.TOP0) + 0.002;
    tipOverride = Math.max(xs, xlim);
    u = uOfTheta278(thetaOfTip278(tipOverride));
  } else if (tc < 9.5) {
    Y = K.Y_BREAK - K.V * K.T_LAND - 0.5 * K.G * K.T_LAND * K.T_LAND;
    u = K.U_MAX;
    phase = 'catch';
  } else if (tc < 10) {
    Y = K.Y_BREAK - K.V * K.T_LAND - 0.5 * K.G * K.T_LAND * K.T_LAND;
    u = K.U_MAX;
    phase = 'splice';
  } else if (tc < 10.5) {
    Y = K.Y_BREAK - K.V * K.T_LAND - 0.5 * K.G * K.T_LAND * K.T_LAND;
    u = K.U_MAX * (1 - ss((tc - 10) / 0.5));
    phase = 'splice';
  } else if (tc < 13) {
    const y0 = K.Y_BREAK - K.V * K.T_LAND - 0.5 * K.G * K.T_LAND * K.T_LAND;
    Y = y0 + (1.45 - y0) * ss((tc - 10.5) / 2.5);
    phase = 'return';
    dir = -1;
  } else {
    phase = 'return';
  }
  const theta = tipOverride === null ? thetaOfU278(u) : thetaOfTip278(tipOverride);
  const tipX = tipOverride === null ? tipOfTheta278(theta) : tipOverride;
  const broken = tc >= 6 && tc < 10;
  const ropeLow = Y - u + K.EYE_TOP + K.STUB;
  let ropeHigh = ropeLow;
  if (tc >= 6 && tc < 9.5) ropeHigh = K.ROPE_BREAK_Y;
  else if (tc >= 9.5 && tc < 10) ropeHigh = K.ROPE_BREAK_Y + (ropeLow - K.ROPE_BREAK_Y) * ss((tc - 9.5) / 0.5);
  return { tc, phase, Y, u, theta, tipX, ropeLow, ropeHigh, broken, dir };
}

/** 래칫 줄 — side 1 = 왼쪽 기둥(톱니가 +x 로), -1 = 오른쪽. 윤곽은 userData.outline, 깊이 −0.05~0.05 */
export function rack278(side: 1 | -1): THREE.Mesh {
  const pts: V2[] = [[-1.452, 0.29]];
  for (let m = -1; m <= 13; m++) {
    const ym = K.TOP0 + K.PITCH * m;
    pts.push([-1.45, ym - K.PITCH], [-1.35, ym]);
    pts.push([-1.45, ym]);
  }
  pts.push([-1.452, 2.99]);
  // 같은 점(이웃 톱니의 시작과 앞 톱니의 윗면 뒤끝) 중복 제거
  const clean: V2[] = [];
  for (const p of pts) {
    const q = clean[clean.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) clean.push(p);
  }
  const out: V2[] = clean.map(([x, y]) => [side === 1 ? x : -x, y] as V2);
  const m = mesh(extrude(shapeFrom(out), 0.1), steel({ roughness: 0.3 }));
  m.name = side === 1 ? 'rackL' : 'rackR';
  m.userData.outline = out;
  return m;
}

const TIP_RUN = 0.08 / (K.PITCH / K.TOOTH); // 끝 윗면 비탈의 가로 길이 0.04444

/** 폴 윤곽(왼쪽 기준, 끝이 원점·밑면 y 0) */
function pawlOutline(side: 1 | -1): V2[] {
  const base: V2[] = [
    [0, 0],
    [0.58, 0],
    [0.58, 0.08],
    [TIP_RUN, 0.08]
  ];
  return base.map(([x, y]) => [side * x, y] as V2);
}

/** 폴 — side 1 = 왼쪽(끝이 왼쪽, 몸통이 +x), -1 = 오른쪽. 그룹 원점 = 폴 끝 밑면, 깊이 −0.04~0.04 */
export function pawl278(side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.name = side === 1 ? 'pawlGroupL' : 'pawlGroupR';
  const mat = paint(0xc8553d);
  const full = pawlOutline(side);
  // 몸통: 끝 ~ 갈래 앞(x 0.46), 깊이 ±0.04
  const bodyPts: V2[] = (
    [
      [0, 0],
      [0.46, 0],
      [0.46, 0.08],
      [TIP_RUN, 0.08]
    ] as V2[]
  ).map(([x, y]) => [side * x, y] as V2);
  const body = mesh(extrude(shapeFrom(bodyPts), 0.08), mat);
  body.name = side === 1 ? 'pawlL' : 'pawlR';
  body.userData.outline = full;
  g.add(body);
  // 갈래 두 볼(x 0.46~0.58): 가운데 ±0.022 비움, 세로 홈 x 0.52012 ± 0.022, y 0.016~0.070
  const cx = K.TIP_OFF;
  const cheekShape = (): THREE.Shape => {
    const s = shapeFrom([
      [side * 0.46, 0],
      [side * 0.58, 0],
      [side * 0.58, 0.08],
      [side * 0.46, 0.08]
    ]);
    s.holes.push(
      pathFrom([
        [side * (cx - 0.022), 0.016],
        [side * (cx + 0.022), 0.016],
        [side * (cx + 0.022), 0.07],
        [side * (cx - 0.022), 0.07]
      ])
    );
    return s;
  };
  for (const sz of [1, -1]) {
    const c = mesh(extrude(cheekShape(), 0.018), mat);
    c.name = (side === 1 ? 'pawlCheekL' : 'pawlCheekR') + (sz > 0 ? 'F' : 'B');
    c.position.z = sz * 0.031;
    g.add(c);
  }
  return g;
}

/** 판 스프링 — 처짐 s, 가운데 구멍 때문에 좌우 두 반쪽(x ±0.052~0.75), 두께 0.02, 폭 깊이 ±0.04 */
export function leafSpring278(s: number): THREE.BufferGeometry {
  const N = 14;
  const hole = 0.052;
  const half = 0.75;
  const yc = (x: number): number => -0.03 - s * (1 - (x / half) * (x / half));
  const geos: THREE.BufferGeometry[] = [];
  for (const sg of [-1, 1]) {
    const top: V2[] = [];
    const bot: V2[] = [];
    for (let i = 0; i <= N; i++) {
      const x = hole + ((half - hole) * i) / N;
      top.push([sg * x, yc(x) + 0.01]);
      bot.push([sg * x, yc(x) - 0.01]);
    }
    geos.push(extrude(shapeFrom([...top, ...bot.reverse()]), 0.08, 0, 4));
  }
  return merge(geos);
}

/** 엘보 레버 윤곽(왼쪽 기준, 원점 = 피벗) — 가로 팔·세로 팔 폭 0.06, 원점 보스 0.05(구멍 0.027), 끝 보스 0.035 */
export function lever278(side: 1 | -1): THREE.Mesh {
  const w = 0.03;
  const rO = 0.05;
  const rE = 0.035;
  const a: V2 = [Math.cos(A_I), Math.sin(A_I)];
  const b: V2 = [Math.cos(A_D), Math.sin(A_D)];
  const nA: V2 = [-a[1], a[0]]; // A 의 왼쪽 법선(바깥 쪽)
  const nB: V2 = [b[1], -b[0]]; // B 의 오른쪽 법선(바깥 쪽)
  const at = (o: V2, ...terms: [number, V2][]): V2 => {
    let x = o[0];
    let y = o[1];
    for (const [k, d] of terms) {
      x += k * d[0];
      y += k * d[1];
    }
    return [x, y];
  };
  const O: V2 = [0, 0];
  const I = at(O, [K.ARM_I, a]);
  const D = at(O, [K.ARM_D, b]);
  const back = Math.sqrt(rE * rE - w * w);
  const near = Math.sqrt(rO * rO - w * w);
  const arc = (c: V2, r: number, a0: number, a1: number, n: number): V2[] => {
    const o: V2[] = [];
    for (let i = 0; i <= n; i++) {
      const t = a0 + ((a1 - a0) * i) / n;
      o.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]);
    }
    return o;
  };
  // 안쪽 모서리: O + s a − w nA = O + t b − w nB 의 교점
  const det = a[0] * -b[1] - -b[0] * a[1];
  const rx = -w * nB[0] + w * nA[0];
  const ry = -w * nB[1] + w * nA[1];
  const sA = (rx * -b[1] - -b[0] * ry) / det;
  const X = at(O, [sA, a], [-w, nA]);
  const q0 = at(O, [near, a], [w, nA]);
  const pso = at(I, [-back, a], [w, nA]);
  const angI = Math.atan2(w, -back); // a 기준 상대각(왼쪽 위)
  const pts: V2[] = [q0, pso];
  pts.push(...arc(I, rE, A_I + angI, A_I - angI, 16).slice(1, -1));
  pts.push(at(I, [-back, a], [-w, nA]), X);
  const pbi = at(D, [-back, b], [-w, nB]);
  pts.push(pbi);
  const angD = Math.atan2(w, -back); // b 기준 상대각(+ = 왼쪽)
  pts.push(...arc(D, rE, A_D + angD, A_D - angD, 16).slice(1, -1));
  pts.push(at(D, [-back, b], [w, nB]));
  const q1 = at(O, [near, b], [w, nB]);
  pts.push(q1);
  const aQ1 = Math.atan2(q1[1], q1[0]);
  const aQ0 = Math.atan2(q0[1], q0[0]);
  const s0 = aQ1 < aQ0 ? aQ1 + 2 * Math.PI : aQ1;
  pts.push(...arc(O, rO, s0, aQ0, 28).slice(1, -1));
  const out: V2[] = pts.map(([x, y]) => [side * x, y] as V2);
  const sh = shapeFrom(out);
  sh.holes.push(circlePath(0, 0, 0.027));
  const m = mesh(extrude(sh, 0.04, 0, 20), paint(0x3c78c8));
  m.name = side === 1 ? 'leverL' : 'leverR';
  return m;
}

/** 줄 끊김 표시용 번개 판(작은 지그재그) — 빨강 */
export function bolt278(): THREE.Mesh {
  const pts: V2[] = [
    [0.01, 0.13],
    [0.06, 0.13],
    [0.025, 0.045],
    [0.075, 0.045],
    [-0.04, -0.13],
    [-0.005, -0.015],
    [-0.06, -0.015]
  ];
  const m = mesh(extrude(shapeFrom(pts), 0.012), paint(0xe0201b));
  m.name = 'boltBreak';
  return m;
}

export { steel };
