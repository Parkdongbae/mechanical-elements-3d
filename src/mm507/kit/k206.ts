// 206번 두 폴 래칫 전용 키트 — 40이 래칫 바퀴, 갈고리 폴·미는 폴(둥근 코·필릿 점열), 레버, 닫힌 식 운동(들림 표는 적재 때 한 번)
// 설계표 docs/mm507-sheets/206.md 의 수치·점열 그대로.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { markPin, setMM } from './mm';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

const HDIR = 19.916406 * D2R;
const P_RAD = 9 * D2R;
const DTIP = 1.872778 * D2R;

/** 206번 배치 상수(모두 세계 좌표) */
export const K206 = {
  W: [-0.45, 1.3] as V2,
  teeth: 40,
  rT: 0.775,
  rR: 0.705,
  tilt: 20 * D2R,
  dTip: DTIP,
  P0: [-0.105, 2.4375] as V2,
  hdir: HDIR,
  armQ: 0.366947,
  armH: 0.75,
  K: [0.934409, 1.652951] as V2,
  rk: 0.241699,
  Lk: 1.091699,
  thF: 109.916406 * D2R,
  LL: 0.855,
  LR: 0.82,
  rn: 0.014,
  Rc: 0.729457,
  eps: 1.858741 * D2R,
  swing: 37.6 * D2R
} as const;
const K = K206;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 바퀴 윤곽 80점(바퀴 로컬, 반시계) — 이뿌리 점 → 이끝 점(비탈) → 다음 이뿌리(기운 곧은 면) */
export function wheelOutline206(): V2[] {
  const out: V2[] = [];
  const p = TAU / K.teeth;
  for (let k = 0; k < K.teeth; k++) {
    out.push([K.rR * Math.cos(k * p), K.rR * Math.sin(k * p)]);
    const a = (k + 1) * p + K.dTip;
    out.push([K.rT * Math.cos(a), K.rT * Math.sin(a)]);
  }
  return out;
}

/** 래칫 바퀴: 원점 = 중심, 폭 0.12(z ±0.06), 구멍 0.06. 0번 이 쪽에 노란 반지름 막대 */
export function ratchetWheel206(): THREE.Group {
  const g = new THREE.Group();
  const outline = wheelOutline206();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.06));
  g.add(mesh(extrude(shape, 0.12, 0.004, 8), steel()));
  g.add(meshAt(tubeZ(0.06, 0.125, -0.068, 0.068, 0.004, 48), darkSteel(), 0, 0, 0));
  g.add(meshAt(new THREE.TorusGeometry(0.655, 0.006, 8, 96), darkSteel(), 0, 0, 0.061));
  g.add(meshAt(new THREE.BoxGeometry(0.4, 0.022, 0.008), paint(0xffcc00), 0.4, 0, 0.064));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'ratchetWheel206', teeth: K.teeth, ra: K.rT, rf: K.rR, width: 0.12, axis: 'z' });
  return g;
}

export const PAWL_HOOK206: V2[] = [[0.9461,-0.0551],[0.8636,0.0110],[0.8564,0.0139],[0.8500,0.0131],[0.8454,0.0102],[0.8422,0.0057],[0.8410,-0.0004],[0.8430,-0.0071],[0.8681,-0.0471],[0.8704,-0.0526],[0.8710,-0.0595],[0.8692,-0.0662],[0.8652,-0.0718],[0.8596,-0.0758],[0.8446,-0.0793],[0.8035,-0.0865],[0.7343,-0.0955],[0.6640,-0.1010],[0.6071,-0.1026],[0.5639,-0.1022],[0.5201,-0.1003],[0.4763,-0.0970],[0.4319,-0.0920],[0.3872,-0.0854],[0.3420,-0.0771],[0.2660,-0.0593],[0.2199,-0.0460],[0.1734,-0.0307],[0.1271,-0.0134],[0.0805,0.0061],[0.0540,0.0188],[0.0505,0.0226],[0.0416,0.0360],[0.0306,0.0457],[0.0199,0.0513],[0.0092,0.0542],[-0.0015,0.0550],[-0.0132,0.0534],[-0.0234,0.0498],[-0.0328,0.0441],[-0.0409,0.0368],[-0.0478,0.0272],[-0.0522,0.0173],[-0.0546,0.0066],[-0.0549,-0.0026],[-0.0537,-0.0119],[-0.0509,-0.0209],[-0.0471,-0.0284],[-0.0416,-0.0360],[-0.0348,-0.0426],[-0.0272,-0.0478],[-0.0187,-0.0517],[-0.0040,-0.0549],[0.0143,-0.0536],[0.0201,-0.0545],[0.0809,-0.0811],[0.1309,-0.1004],[0.1802,-0.1174],[0.2455,-0.1366],[0.2936,-0.1485],[0.3419,-0.1586],[0.3897,-0.1668],[0.4372,-0.1733],[0.5153,-0.1802],[0.5922,-0.1826],[0.6678,-0.1809],[0.7423,-0.1751],[0.7865,-0.1698],[0.8303,-0.1632],[0.8738,-0.1552],[0.9156,-0.1461],[0.9238,-0.1422],[0.9839,-0.1269],[0.9875,-0.1231],[0.9869,-0.1180]];

export const PAWL_PUSH206: V2[] = [[0.1153,0.0035],[0.1847,0.0265],[0.2397,0.0419],[0.3073,0.0577],[0.3737,0.0699],[0.4392,0.0790],[0.5036,0.0850],[0.5794,0.0887],[0.6668,0.0884],[0.7160,0.0861],[0.7468,0.0833],[0.7527,0.0801],[0.7568,0.0756],[0.8103,-0.0101],[0.8142,-0.0127],[0.8177,-0.0138],[0.8256,-0.0128],[0.8287,-0.0109],[0.8319,-0.0074],[0.8340,0.0003],[0.8329,0.0053],[0.8036,0.0888],[0.8034,0.0946],[0.8098,0.1528],[0.8091,0.1556],[0.8072,0.1578],[0.8044,0.1588],[0.7595,0.1632],[0.6951,0.1673],[0.6302,0.1691],[0.5774,0.1686],[0.4975,0.1648],[0.4160,0.1568],[0.3329,0.1442],[0.2910,0.1360],[0.2480,0.1264],[0.1904,0.1115],[0.1324,0.0939],[0.0734,0.0734],[0.0234,0.0538],[0.0166,0.0529],[0.0059,0.0547],[-0.0024,0.0549],[-0.0104,0.0540],[-0.0183,0.0519],[-0.0292,0.0466],[-0.0394,0.0383],[-0.0469,0.0287],[-0.0521,0.0176],[-0.0545,0.0071],[-0.0549,-0.0037],[-0.0531,-0.0144],[-0.0493,-0.0244],[-0.0436,-0.0336],[-0.0362,-0.0414],[-0.0274,-0.0477],[-0.0176,-0.0521],[-0.0073,-0.0545],[0.0024,-0.0549],[0.0128,-0.0535],[0.0221,-0.0504],[0.0301,-0.0460],[0.0366,-0.0411],[0.0431,-0.0342],[0.0507,-0.0234],[0.0574,-0.0188]];

/** 폴: 원점 = 폴 핀 중심, 구멍 0.024, 두께 0.05(z 가운데 0). 재질은 폴마다 따로(userData.mat) */
export function pawl206(side: 'hook' | 'push'): THREE.Group {
  const g = new THREE.Group();
  const outline = side === 'hook' ? PAWL_HOOK206 : PAWL_PUSH206;
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.024));
  const mat = brass();
  g.add(mesh(extrude(shape, 0.05, 0.004), mat));
  g.userData.mat = mat;
  g.userData.outline = outline;
  setMM(g, { kind: 'pawl', fn: 'pawl206' });
  return g;
}

/** 레버: 그룹 원점 = 받침점 P0, 로컬 +X = 손잡이 쪽 */
export function lever206(): THREE.Group {
  const g = new THREE.Group();
  const shape = stadiumShape(-K.armQ, 0, 0.85, 0, 0.045);
  shape.holes.push(circlePath(0, 0, 0.037));
  g.add(meshAt(extrude(shape, 0.06, 0.004, 16), castIron({ roughness: 0.5 }), 0, 0, 0.105));
  g.add(meshAt(tubeZ(0.037, 0.07, 0.075, 0.135, 0.004, 40), castIron({ roughness: 0.5 }), 0, 0, 0));
  // 폴 핀(머리는 뒤쪽 끝 — 두 폴이 레버 판과 머리 사이에 끼워진다)
  const pin = new THREE.Group();
  pin.name = 'pawlPin';
  pin.position.set(-K.armQ, 0, 0);
  pin.add(meshAt(cylZ(0.022, -0.07, 0.15, 0.003), steel(), 0, 0, 0));
  pin.add(meshAt(cylZ(0.032, -0.07, -0.057, 0.003), steel(), 0, 0, 0));
  g.add(pin);
  // 손잡이 핀
  g.add(meshAt(cylZ(0.045, 0.075, 0.24, 0.005), steel(), K.armH, 0, 0));
  const mark = new THREE.Object3D();
  mark.name = 'handlePin';
  mark.position.set(K.armH, 0, 0.19);
  g.add(markPin(mark));
  setMM(g, { kind: 'lever', fn: 'lever206', pivot: [0, 0, 0] });
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

/** 폴 핀 자리 Q(γ) */
export function q206(gamma: number): V2 {
  const a = K.hdir + Math.PI + gamma;
  return [K.P0[0] + K.armQ * Math.cos(a), K.P0[1] + K.armQ * Math.sin(a)];
}

/** 가상 구석점: 폴 핀 Q 에서 코 거리만큼, 바퀴 중심에서 Rc 인 점(갈고리 = 왼쪽 해, 미는 = 오른쪽 해) */
export function vCorner206(q: V2, side: 'hook' | 'push'): V2 {
  const r = circleIntersect([K.W[0], K.W[1]], K.Rc, [q[0], q[1]], side === 'hook' ? K.LL : K.LR, side === 'hook');
  if (r === null) return [K.W[0], K.W[1] + K.Rc];
  return r;
}

function gammaOf(u: number): { gamma: number; pin: V2; H: V2 } {
  const pin: V2 = [K.K[0] + K.rk * Math.cos(K.thF + u), K.K[1] + K.rk * Math.sin(K.thF + u)];
  const H = circleIntersect([K.P0[0], K.P0[1]], K.armH, [pin[0], pin[1]], K.Lk, true) ?? [K.P0[0] + K.armH, K.P0[1]];
  return { gamma: Math.atan2(H[1] - K.P0[1], H[0] - K.P0[0]) - K.hdir, pin, H };
}
const angW = (c: V2): number => Math.atan2(c[1] - K.W[1], c[0] - K.W[0]);
const ulOf = (g: number): number => angW(vCorner206(q206(g), 'hook'));
const urOf = (g: number): number => angW(vCorner206(q206(g), 'push'));

interface Consts {
  uL0: number;
  uR0: number;
  URlow: number;
  tL: number;
  tR: number;
  A1: number;
  rho0: number;
}
let CONSTS: Consts | null = null;
function consts(): Consts {
  if (CONSTS !== null) return CONSTS;
  const p = P_RAD;
  const gHi = gammaOf(0).gamma;
  const gLo = gammaOf(Math.PI).gamma;
  const uL0 = ulOf(gHi);
  const uR0 = urOf(gHi);
  const URlow = urOf(gLo);
  const ULlow = ulOf(gLo);
  const tL = uL0 - uR0 - 13 * p;
  const dUL = uL0 - ULlow;
  const dUR = URlow - uR0;
  const tR = dUL + dUR - 2 * p - tL;
  CONSTS = { uL0, uR0, URlow, tL, tR, A1: dUL - tL, rho0: uL0 - tL - K.eps };
  return CONSTS;
}

/** 검산용: 기대값 표(설계표 5번) */
export function consts206(): Consts & { gHi: number; gLo: number } {
  return { ...consts(), gHi: gammaOf(0).gamma, gLo: gammaOf(Math.PI).gamma };
}

interface Core {
  u: number;
  gamma: number;
  pin: V2;
  H: V2;
  Q: V2;
  CL: V2;
  CR: V2;
  phi: number; // 한 주기 안의 누적각
  drive: 'hook' | 'push' | 'none';
}
function core(u: number): Core {
  const c = consts();
  const { gamma, pin, H } = gammaOf(u);
  const Q = q206(gamma);
  const CL = vCorner206(Q, 'hook');
  const CR = vCorner206(Q, 'push');
  let phi: number;
  let drive: 'hook' | 'push' | 'none' = 'none';
  if (u < Math.PI) {
    const d = c.uL0 - angW(CL) - c.tL;
    phi = Math.max(0, d);
    if (d > 0) drive = 'hook';
  } else {
    const d = c.URlow - angW(CR) - c.tR;
    phi = c.A1 + Math.max(0, d);
    if (d > 0) drive = 'push';
  }
  return { u, gamma, pin, H, Q, CL, CR, phi, drive };
}

// ── 들림 표 ──
const TAB_N = 1440;
let LIFT_HOOK: Float64Array | null = null;
let LIFT_PUSH: Float64Array | null = null;
const WHEEL_PTS = wheelOutline206();

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

function followLift(prev: number, side: 'hook' | 'push', Q: V2, base: number, wheelRot: number): number {
  const L = side === 'hook' ? K.LL : K.LR;
  const out = side === 'hook' ? -1 : 1;
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
      b += out * step;
      k++;
    }
    return pen(b) ? b : bisect(b, a);
  }
  let b = a;
  let k = 0;
  while (!pen(b) && k < 1500) {
    a = b;
    b -= out * step;
    k++;
  }
  return pen(b) ? bisect(a, b) : a;
}

function buildLift(): void {
  const c = consts();
  const hook = new Float64Array(TAB_N + 1);
  const push = new Float64Array(TAB_N + 1);
  let lh = 0;
  let lp = 0;
  for (let i = 0; i < 2 * TAB_N; i++) {
    const u = (TAU * (i % TAB_N)) / TAB_N;
    const s = core(u);
    const wheelRot = c.rho0 - s.phi;
    const baseH = Math.atan2(s.CL[1] - s.Q[1], s.CL[0] - s.Q[0]);
    const baseP = Math.atan2(s.CR[1] - s.Q[1], s.CR[0] - s.Q[0]);
    lh = s.drive === 'hook' ? 0 : followLift(lh, 'hook', s.Q, baseH, wheelRot);
    lp = s.drive === 'push' ? 0 : followLift(lp, 'push', s.Q, baseP, wheelRot);
    if (i >= TAB_N) {
      hook[i - TAB_N] = lh;
      push[i - TAB_N] = lp;
    }
  }
  hook[TAB_N] = hook[0]!;
  push[TAB_N] = push[0]!;
  LIFT_HOOK = hook;
  LIFT_PUSH = push;
}
function tabAt(tab: Float64Array, u: number): number {
  const f = (u / TAU) * TAB_N;
  const i = Math.min(TAB_N - 1, Math.floor(f));
  return tab[i]! + (tab[i + 1]! - tab[i]!) * (f - i);
}

export interface State206 {
  u: number;
  gamma: number;
  pin: V2;
  H: V2;
  Q: V2;
  wheel: number;
  phi: number;
  lamHook: number;
  lamPush: number;
  liftHook: number;
  liftPush: number;
  drive: 'hook' | 'push' | 'none';
  rising: boolean;
}

/** 206번 운동식(theta = 크랭크 누적각, 모두 닫힌 식) */
export function state206(theta: number): State206 {
  if (LIFT_HOOK === null || LIFT_PUSH === null) buildLift();
  const c = consts();
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const s = core(u);
  const phi = n * 2 * P_RAD + s.phi;
  // 구동 중인 폴은 들림 0(표에도 0 으로 들어 있다)
  const liftHook = s.drive === 'hook' ? 0 : tabAt(LIFT_HOOK!, u);
  const liftPush = s.drive === 'push' ? 0 : tabAt(LIFT_PUSH!, u);
  const baseH = Math.atan2(s.CL[1] - s.Q[1], s.CL[0] - s.Q[0]);
  const baseP = Math.atan2(s.CR[1] - s.Q[1], s.CR[0] - s.Q[0]);
  return {
    u,
    gamma: s.gamma,
    pin: s.pin,
    H: s.H,
    Q: s.Q,
    wheel: c.rho0 - phi,
    phi,
    lamHook: baseH + liftHook,
    lamPush: baseP + liftPush,
    liftHook,
    liftPush,
    drive: s.drive,
    rising: u < Math.PI
  };
}
