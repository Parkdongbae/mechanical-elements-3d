// 236번 두 폴 래칫 2 전용 키트 — 16이 래칫 바퀴, 폴 b·c(둥근 코·필릿 점열), 레버 a, 닫힌 식 운동(들림 표는 적재 때 한 번)
// 설계표 docs/mm507-sheets/236.md 의 수치·점열 그대로.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { markPin, setMM } from './mm';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const P_RAD = 22.5 * D2R;
const DTIP = 3.030824 * D2R;

/** 236번 배치 상수(모두 세계 좌표, 각은 라디안). 레버 로컬 점은 원점 F, 회전 γ */
export const K236 = {
  W: [0.051, 1.0] as V2,
  teeth: 16,
  rT: 0.75,
  rR: 0.64,
  tilt: 20 * D2R,
  dTip: DTIP,
  F: [0.3315, 2.309] as V2,
  Bl: [-0.61203, 0.068] as V2,
  Cl: [0.34851, -0.272] as V2,
  handle: [-1.79242, 0.16501] as V2,
  K: [1.244233, 2.80327] as V2,
  rk: 0.151207,
  Lk: 0.951207,
  thF: -127.97 * D2R,
  Lb: 1.11717,
  Lc: 0.91046,
  rn: 0.014,
  Rc: 0.656799,
  eps: 1.8228 * D2R,
  rho0: 143.5623 * D2R
} as const;
const K = K236;
const RB = Math.hypot(K.Bl[0], K.Bl[1]);
const AB = Math.atan2(K.Bl[1], K.Bl[0]);
const RC = Math.hypot(K.Cl[0], K.Cl[1]);
const AC = Math.atan2(K.Cl[1], K.Cl[0]);

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.003, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
const wrapPi = (a: number): number => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};

// ═══════════════════════════ 부품 ═══════════════════════════

/** 바퀴 윤곽 32점(바퀴 로컬, 반시계) — 이뿌리 k → 이끝 k(이뿌리보다 시계로 dTip 앞섬, 기운 곧은 면) → 다음 이뿌리(비탈) */
export function wheelOutline236(): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < K.teeth; k++) {
    const a = k * P_RAD;
    out.push([K.rR * Math.cos(a), K.rR * Math.sin(a)]);
    out.push([K.rT * Math.cos(a - K.dTip), K.rT * Math.sin(a - K.dTip)]);
  }
  return out;
}

/** 래칫 바퀴: 원점 = 중심, 폭 0.12(z ±0.06), 구멍 0.06. 0번 이 쪽에 노란 반지름 막대 */
export function ratchetWheel236(): THREE.Group {
  const g = new THREE.Group();
  const outline = wheelOutline236();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.06));
  g.add(mesh(extrude(shape, 0.12, 0.004, 8), steel()));
  g.add(meshAt(new THREE.TorusGeometry(0.56, 0.006, 8, 96), darkSteel(), 0, 0, 0.061));
  g.add(meshAt(new THREE.BoxGeometry(0.34, 0.022, 0.008), paint(0xffcc00), 0.3, 0, 0.064));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'ratchetWheel236', teeth: K.teeth, ra: K.rT, rf: K.rR, width: 0.12, axis: 'z' });
  return g;
}

export const PAWL_B236: V2[] = [[1.0544,-0.021],[1.0479,-0.0226],[1.0321,-0.0223],[1.0196,-0.0262],[1.011,-0.032],[1.0034,-0.041],[0.9996,-0.0493],[0.9979,-0.057],[0.9977,-0.065],[0.9991,-0.0727],[1.0019,-0.0801],[1.0287,-0.1323],[1.0304,-0.1391],[1.0291,-0.1477],[1.0249,-0.1544],[1.0184,-0.1589],[1.0106,-0.1606],[0.7428,-0.1625],[0.3851,-0.0994],[0.0552,0.0223],[0.0493,0.0261],[0.04,0.0377],[0.0309,0.0455],[0.0202,0.0512],[0.0083,0.0544],[-0.0036,0.0549],[-0.0155,0.0528],[-0.0267,0.0481],[-0.0358,0.0418],[-0.044,0.033],[-0.0502,0.0225],[-0.0539,0.0111],[-0.055,-0.0009],[-0.0524,-0.0168],[-0.0453,-0.0313],[-0.035,-0.0424],[-0.0213,-0.0507],[-0.0123,-0.0536],[-0.0029,-0.0549],[0.0076,-0.0545],[0.0197,-0.0519],[0.0275,-0.0528],[0.3653,-0.1771],[0.736,-0.2425],[1.1084,-0.2398],[1.1181,-0.2386],[1.1261,-0.2356],[1.1343,-0.2302],[1.1407,-0.2232],[1.1454,-0.2146],[1.1477,-0.2063],[1.1482,-0.1969],[1.1463,-0.1873],[1.1012,-0.0986],[1.0988,-0.0968],[1.0846,-0.0928],[1.0719,-0.0873],[1.0581,-0.0786],[1.0565,-0.0754],[1.0577,-0.0727],[1.1118,-0.0194],[1.1155,-0.0197],[1.1182,-0.0187],[1.129,-0.0076],[1.1306,-0.0038],[1.1312,0.0004],[1.1304,0.0046],[1.1285,0.0083],[1.1256,0.0112],[1.122,0.0132],[1.1179,0.014],[1.1137,0.0136]];

export const PAWL_C236: V2[] = [[0.8535,-0.0318],[0.8471,-0.0349],[0.8318,-0.0374],[0.8233,-0.0412],[0.8138,-0.049],[0.8073,-0.0589],[0.8048,-0.0662],[0.8038,-0.0735],[0.804,-0.08],[0.8055,-0.0875],[0.8085,-0.0945],[0.8318,-0.1377],[0.8335,-0.1432],[0.8337,-0.1482],[0.8323,-0.1539],[0.8293,-0.1589],[0.825,-0.1629],[0.8199,-0.1654],[0.8151,-0.1663],[0.6152,-0.1796],[0.3228,-0.1172],[0.0574,0.016],[0.0519,0.0204],[0.0441,0.0328],[0.036,0.0415],[0.0259,0.0485],[0.0146,0.053],[0.0016,0.055],[-0.0107,0.0539],[-0.0233,0.0498],[-0.0339,0.0433],[-0.0426,0.0348],[-0.0497,0.0237],[-0.0537,0.012],[-0.055,-0.0011],[-0.0527,-0.0157],[-0.0471,-0.0284],[-0.038,-0.0397],[-0.0261,-0.0484],[-0.0174,-0.0522],[-0.0082,-0.0544],[0.0014,-0.055],[0.0137,-0.0538],[0.0214,-0.0555],[0.2955,-0.1929],[0.602,-0.2592],[0.6112,-0.2601],[0.9152,-0.2398],[0.9271,-0.2366],[0.9383,-0.2292],[0.9463,-0.2187],[0.9503,-0.2073],[0.9505,-0.1942],[0.9469,-0.1826],[0.9017,-0.0997],[0.8989,-0.0978],[0.8865,-0.0954],[0.8754,-0.0919],[0.8707,-0.0899],[0.8691,-0.0873],[0.8696,-0.0846],[0.9097,-0.0201],[0.913,-0.0195],[0.9153,-0.0178],[0.9237,-0.0044],[0.9245,0.0001],[0.9236,0.0047],[0.9215,0.0086],[0.9181,0.0117],[0.9139,0.0136],[0.9094,0.014],[0.9048,0.0128],[0.9011,0.0104]];

/** 폴: 원점 = 폴 핀 중심, +X = 핀 → 코 원 중심. 구멍 0.024, 두께 0.05. b 는 z −0.055~−0.005, c 는 z 0.005~0.055. 재질은 폴마다 따로(userData.mat) */
export function pawl236(side: 'b' | 'c'): THREE.Group {
  const g = new THREE.Group();
  const outline = side === 'b' ? PAWL_B236 : PAWL_C236;
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.024));
  const mat = brass();
  g.add(meshAt(extrude(shape, 0.05, 0.004), mat, 0, 0, side === 'b' ? -0.03 : 0.03));
  g.userData.mat = mat;
  g.userData.outline = outline;
  setMM(g, { kind: 'pawl', fn: 'pawl236' });
  return g;
}

/** 점들의 볼록 껍질(반시계) */
function hull(pts: V2[]): V2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: V2[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: V2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return [...lo, ...up];
}

/**
 * 레버 a: 그룹 원점 = 받침점 F, 로컬 +X 는 세계 +X(γ = 0). 판 z 0.075~0.135.
 * b 핀 그룹 `bPin`, c 핀 그룹 + 표식 `cPin`(z 0.19).
 */
export function lever236(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.5 });
  const circ: V2[] = [];
  for (const c of [K.Bl, [0, 0] as V2, K.Cl]) for (let i = 0; i < 24; i++) circ.push([c[0] + 0.05 * Math.cos((i / 24) * TAU), c[1] + 0.05 * Math.sin((i / 24) * TAU)]);
  const plate = shapeFrom(hull(circ));
  plate.holes.push(circlePath(0, 0, 0.037));
  g.add(meshAt(extrude(plate, 0.06, 0.004, 16), iron, 0, 0, 0.105));
  const handle = stadiumShape(0, 0, K.handle[0], K.handle[1], 0.035);
  handle.holes.push(circlePath(0, 0, 0.037));
  g.add(meshAt(extrude(handle, 0.058, 0.004, 16), iron, 0, 0, 0.105));
  g.add(meshAt(tubeZ(0.037, 0.07, 0.075, 0.135, 0.004, 40), iron, 0, 0, 0));
  // b 핀
  const bPin = new THREE.Group();
  bPin.name = 'bPin';
  bPin.position.set(K.Bl[0], K.Bl[1], 0);
  bPin.add(meshAt(cylZ(0.022, -0.07, 0.15), steel(), 0, 0, 0));
  bPin.add(meshAt(cylZ(0.032, -0.07, -0.057), steel(), 0, 0, 0));
  g.add(bPin);
  // c 핀(앞쪽은 굵어져 연결봉 눈이 앉는다)
  const cPinG = new THREE.Group();
  cPinG.position.set(K.Cl[0], K.Cl[1], 0);
  cPinG.add(meshAt(cylZ(0.022, -0.07, 0.15), steel(), 0, 0, 0));
  cPinG.add(meshAt(cylZ(0.032, -0.07, -0.057), steel(), 0, 0, 0));
  cPinG.add(meshAt(cylZ(0.045, 0.15, 0.24, 0.005), steel(), 0, 0, 0));
  g.add(cPinG);
  const mark = new THREE.Object3D();
  mark.name = 'cPin';
  mark.position.set(K.Cl[0], K.Cl[1], 0.19);
  g.add(markPin(mark));
  setMM(g, { kind: 'lever', fn: 'lever236', pivot: [0, 0, 0] });
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

/** 레버 각 γ 와 핀 자리 — u 는 크랭크 각 */
function gammaOf(u: number): { gamma: number; P: V2; Qc: V2 } {
  const P: V2 = [K.K[0] + K.rk * Math.cos(K.thF + u), K.K[1] + K.rk * Math.sin(K.thF + u)];
  const Qc = circleIntersect([K.F[0], K.F[1]], RC, [P[0], P[1]], K.Lk, false) ?? [K.F[0] + K.Cl[0], K.F[1] + K.Cl[1]];
  return { gamma: wrapPi(Math.atan2(Qc[1] - K.F[1], Qc[0] - K.F[0]) - AC), P, Qc };
}
const qbOf = (g: number): V2 => [K.F[0] + RB * Math.cos(AB + g), K.F[1] + RB * Math.sin(AB + g)];
const qcOf = (g: number): V2 => [K.F[0] + RC * Math.cos(AC + g), K.F[1] + RC * Math.sin(AC + g)];
function cornerB(g: number): V2 {
  return circleIntersect([K.W[0], K.W[1]], K.Rc, qbOf(g), K.Lb, true) ?? [K.W[0] - K.Rc, K.W[1]];
}
function cornerC(g: number): V2 {
  return circleIntersect([K.W[0], K.W[1]], K.Rc, qcOf(g), K.Lc, true) ?? [K.W[0], K.W[1] + K.Rc];
}
const angW = (c: V2): number => Math.atan2(c[1] - K.W[1], c[0] - K.W[0]);

const G_LO = -20 * D2R;
const G_HI = 20 * D2R;
const UB_LO = angW(cornerB(G_LO));
const UB_HI = angW(cornerB(G_HI));
const UC_LO = angW(cornerC(G_LO));
const UC_HI = angW(cornerC(G_HI));
const mod = (a: number, m: number): number => ((a % m) + m) % m;
const TB = mod(UC_LO - UB_LO, P_RAD);
const TC = mod(UB_HI - UC_HI, P_RAD);
const A1 = UB_HI - UB_LO - TB;
const A2 = UC_LO - UC_HI - TC;

/** 검산용 상수(설계표 5번) */
export const CONSTS236 = { UbLo: UB_LO, UbHi: UB_HI, UcLo: UC_LO, UcHi: UC_HI, tb: TB, tc: TC, A1, A2 };

interface Core {
  u: number;
  gamma: number;
  P: V2;
  Qb: V2;
  Qc: V2;
  Cb: V2;
  Cc: V2;
  phi: number;
  drive: 'b' | 'c' | 'none';
}
function core(u: number): Core {
  const { gamma, P } = gammaOf(u);
  const Qb = qbOf(gamma);
  const Qc = qcOf(gamma);
  const Cb = cornerB(gamma);
  const Cc = cornerC(gamma);
  let phi: number;
  let drive: 'b' | 'c' | 'none' = 'none';
  if (u < Math.PI) {
    const d = angW(Cb) - UB_LO - TB;
    phi = Math.max(0, d);
    if (d > 0) drive = 'b';
  } else {
    const d = angW(Cc) - UC_HI - TC;
    phi = A1 + Math.max(0, d);
    if (d > 0) drive = 'c';
  }
  return { u, gamma, P, Qb, Qc, Cb, Cc, phi, drive };
}

// ── 들림 표 ──
const TAB_N = 1440;
let LIFT_B: Float64Array | null = null;
let LIFT_C: Float64Array | null = null;
const WHEEL_PTS = wheelOutline236();

function insideWheel(x: number, y: number): boolean {
  let c = false;
  const P = WHEEL_PTS;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i]!;
    const b = P[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function distWheel(x: number, y: number): number {
  let best = Infinity;
  const P = WHEEL_PTS;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[j]!;
    const b = P[i]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey)));
    const d = Math.hypot(x - a[0] - t * ex, y - a[1] - t * ey);
    if (d < best) best = d;
  }
  return best;
}

function followLift(prev: number, L: number, Q: V2, base: number, wheelRot: number): number {
  const step = 0.02 * D2R;
  const cr = Math.cos(-wheelRot);
  const sr = Math.sin(-wheelRot);
  const pen = (lift: number): boolean => {
    const lam = base + lift;
    const dx = Q[0] + L * Math.cos(lam) - K.W[0];
    const dy = Q[1] + L * Math.sin(lam) - K.W[1];
    const x = dx * cr - dy * sr;
    const y = dx * sr + dy * cr;
    return insideWheel(x, y) || distWheel(x, y) < K.rn - 0.0002;
  };
  const bisect = (free: number, blocked: number): number => {
    let f = free;
    let b = blocked;
    for (let i = 0; i < 25; i++) {
      const m = (f + b) / 2;
      if (pen(m)) b = m;
      else f = m;
    }
    return f;
  };
  let a = prev;
  if (pen(a)) {
    let b = a;
    let k = 0;
    while (pen(b) && k < 2000) {
      a = b;
      b -= step; // out = −1 (시계 = 코가 바퀴에서 멀어짐)
      k++;
    }
    return pen(b) ? b : bisect(b, a);
  }
  let b = a;
  let k = 0;
  while (!pen(b) && k < 1500) {
    a = b;
    b += step;
    k++;
  }
  return pen(b) ? bisect(a, b) : a;
}

function buildLift(): void {
  const lb = new Float64Array(TAB_N + 1);
  const lc = new Float64Array(TAB_N + 1);
  let xb = 0;
  let xc = 0;
  for (let i = 0; i < 2 * TAB_N; i++) {
    const u = (TAU * (i % TAB_N)) / TAB_N;
    const s = core(u);
    const wheelRot = K.rho0 + s.phi;
    const baseB = Math.atan2(s.Cb[1] - s.Qb[1], s.Cb[0] - s.Qb[0]);
    const baseC = Math.atan2(s.Cc[1] - s.Qc[1], s.Cc[0] - s.Qc[0]);
    xb = s.drive === 'b' ? 0 : followLift(xb, K.Lb, s.Qb, baseB, wheelRot);
    xc = s.drive === 'c' ? 0 : followLift(xc, K.Lc, s.Qc, baseC, wheelRot);
    if (i >= TAB_N) {
      lb[i - TAB_N] = xb;
      lc[i - TAB_N] = xc;
    }
  }
  lb[TAB_N] = lb[0]!;
  lc[TAB_N] = lc[0]!;
  LIFT_B = lb;
  LIFT_C = lc;
}
function tabAt(tab: Float64Array, u: number): number {
  const f = (u / TAU) * TAB_N;
  const i = Math.min(TAB_N - 1, Math.floor(f));
  return tab[i]! + (tab[i + 1]! - tab[i]!) * (f - i);
}

export interface State236 {
  u: number;
  gamma: number;
  P: V2;
  Qb: V2;
  Qc: V2;
  phi: number;
  wheel: number;
  lamB: number;
  lamC: number;
  liftB: number;
  liftC: number;
  drive: 'b' | 'c' | 'none';
  lowering: boolean;
}

/** 236번 운동식(theta = 크랭크 누적각, 닫힌 식 + 들림 표) */
export function state236(theta: number): State236 {
  if (LIFT_B === null || LIFT_C === null) buildLift();
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const s = core(u);
  const phi = n * 2 * P_RAD + s.phi;
  const liftB = s.drive === 'b' ? 0 : tabAt(LIFT_B!, u);
  const liftC = s.drive === 'c' ? 0 : tabAt(LIFT_C!, u);
  const baseB = Math.atan2(s.Cb[1] - s.Qb[1], s.Cb[0] - s.Qb[0]);
  const baseC = Math.atan2(s.Cc[1] - s.Qc[1], s.Cc[0] - s.Qc[0]);
  return {
    u,
    gamma: s.gamma,
    P: s.P,
    Qb: s.Qb,
    Qc: s.Qc,
    phi,
    wheel: K.rho0 + phi,
    lamB: baseB + liftB,
    lamC: baseC + liftC,
    liftB,
    liftC,
    drive: s.drive,
    lowering: u < Math.PI
  };
}
