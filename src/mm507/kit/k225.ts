// 225번 폴이 달린 래칫 전용 키트 — 20이 래칫 바퀴, 긴 휜 폴(둥근 코·필릿 점열), 흔들 팔, 팔 받침, 닫힌 식 운동(폴 들림 표는 적재 때 한 번)
// 설계표 docs/mm507-sheets/225.md 의 수치·점열 그대로.
import * as THREE from 'three';
import { castIron, darkSteel, brass, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { markPin, setMM } from './mm';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const P_RAD = 18 * D2R;
const DTIP = 3.159334 * D2R;

/** 225번 배치 상수(모두 세계 좌표) */
export const K225 = {
  W: [-0.609, 1.44] as V2,
  teeth: 20,
  rT: 0.85,
  rR: 0.72,
  tilt: 20 * D2R,
  dTip: DTIP,
  B: [0.616, 0.292] as V2,
  LP: 2.45,
  HL: 2.0,
  K: [1.525209, 2.274796] as V2,
  rk: 0.130427,
  Lk: 0.880427,
  thF: -0.828972 * D2R,
  L: 1.505342,
  rn: 0.014,
  Rc: 0.739936,
  eps: 1.706522 * D2R,
  Ulo: 88.4 * D2R,
  Uhi: 111.8 * D2R,
  slack: 5.4 * D2R,
  rho0: 95.5065 * D2R
} as const;
const K = K225;

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

/** 바퀴 윤곽 40점(바퀴 로컬, 반시계) — 이뿌리 k → 이끝 k(기운 곧은 면) → 이뿌리 k+1(비탈) */
export function wheelOutline225(): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < K.teeth; k++) {
    const a = k * P_RAD;
    out.push([K.rR * Math.cos(a), K.rR * Math.sin(a)]);
    out.push([K.rT * Math.cos(a - K.dTip), K.rT * Math.sin(a - K.dTip)]);
  }
  return out;
}

/** 래칫 바퀴: 원점 = 중심, 폭 0.12(z ±0.06), 구멍 0.06. 앞면 안쪽 테 + 노란 반지름 막대 */
export function ratchetWheel225(): THREE.Group {
  const g = new THREE.Group();
  const outline = wheelOutline225();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.06));
  g.add(mesh(extrude(shape, 0.12, 0.004, 8), steel()));
  g.add(meshAt(tubeZ(0.06, 0.125, -0.068, 0.068, 0.004, 48), darkSteel(), 0, 0, 0));
  g.add(meshAt(new THREE.TorusGeometry(0.62, 0.006, 8, 96), darkSteel(), 0, 0, 0.061));
  g.add(meshAt(new THREE.BoxGeometry(0.4, 0.022, 0.008), paint(0xffcc00), 0.36, 0, 0.064));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'ratchetWheel225', teeth: K.teeth, ra: K.rT, rf: K.rR, width: 0.12, axis: 'z' });
  return g;
}

export const PAWL225: V2[] = [[1.3597,-0.0617],[1.3539,-0.0635],[1.3470,-0.0635],[1.2566,-0.0467],[1.2201,-0.0546],[1.2174,-0.0535],[1.2138,-0.0486],[1.2099,-0.0477],[0.9723,-0.1003],[0.6805,-0.1153],[0.3851,-0.0714],[0.0511,0.0290],[0.0452,0.0323],[0.0362,0.0414],[0.0283,0.0472],[0.0186,0.0518],[0.0083,0.0544],[-0.0037,0.0549],[-0.0147,0.0530],[-0.0259,0.0485],[-0.0359,0.0417],[-0.0440,0.0330],[-0.0501,0.0226],[-0.0539,0.0111],[-0.0550,0.0000],[-0.0542,-0.0091],[-0.0522,-0.0172],[-0.0486,-0.0257],[-0.0436,-0.0336],[-0.0379,-0.0398],[-0.0308,-0.0456],[-0.0235,-0.0497],[-0.0147,-0.0530],[0.0010,-0.0550],[0.0197,-0.0519],[0.0266,-0.0524],[0.3678,-0.1548],[0.6776,-0.2005],[0.9834,-0.1848],[1.2342,-0.1296],[1.3682,-0.1538],[1.3766,-0.1542],[1.3849,-0.1529],[1.3964,-0.1480],[1.4058,-0.1401],[1.4829,-0.0483],[1.5033,-0.0199],[1.5082,-0.0182],[1.5170,-0.0078],[1.5189,-0.0036],[1.5193,0.0010],[1.5182,0.0056],[1.5157,0.0094],[1.5121,0.0122],[1.5078,0.0138],[1.5032,0.0138],[1.4988,0.0124]];

/** 폴: 원점 = 폴 핀 중심, 구멍 0.024, 두께 0.05(z 가운데 0). 재질은 폴마다 따로(userData.mat) */
export function pawl225(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(PAWL225);
  shape.holes.push(circlePath(0, 0, 0.024));
  const mat = brass();
  g.add(mesh(extrude(shape, 0.05, 0.004), mat));
  g.userData.mat = mat;
  g.userData.outline = PAWL225;
  setMM(g, { kind: 'pawl', fn: 'pawl225' });
  return g;
}

/** 팔: 그룹 원점 = 아래 핀 B, 로컬 +Y = 위 핀 쪽. 위 핀 `pawlPin`, 팔 핀 표식 `leverPin` */
export function arm225(): THREE.Group {
  const g = new THREE.Group();
  const shape = stadiumShape(0, 0, 0, K.LP, 0.0425);
  shape.holes.push(circlePath(0, 0, 0.036));
  g.add(meshAt(extrude(shape, 0.05, 0.004, 16), castIron({ roughness: 0.5 }), 0, 0, 0.095));
  g.add(meshAt(tubeZ(0.036, 0.06, 0.06, 0.125, 0.004, 40), castIron({ roughness: 0.5 }), 0, 0, 0));
  // 위 핀(폴 핀) — 머리는 앞쪽 끝
  const pin = new THREE.Group();
  pin.name = 'pawlPin';
  pin.position.set(0, K.LP, 0);
  pin.add(meshAt(cylZ(0.022, -0.07, 0.15, 0.003), steel(), 0, 0, 0));
  pin.add(meshAt(cylZ(0.032, 0.13, 0.15, 0.003), steel(), 0, 0, 0));
  g.add(pin);
  // 팔 핀(연결봉이 거는 자리)
  g.add(meshAt(cylZ(0.045, 0.07, 0.24, 0.005), steel(), 0, K.HL, 0));
  const mark = new THREE.Object3D();
  mark.name = 'leverPin';
  mark.position.set(0, K.HL, 0.19);
  g.add(markPin(mark));
  setMM(g, { kind: 'lever', fn: 'arm225', pivot: [0, 0, 0] });
  return g;
}

/** 팔 받침(판화의 종 모양): 원점 = (B.x, 받침대 윗면 0.18, 0). 사다리꼴 판 + 보스 + 아래 핀 */
export function bracket225(): THREE.Group {
  const g = new THREE.Group();
  const trap = shapeFrom([[-0.2, 0], [0.2, 0], [0.07, 0.17], [-0.07, 0.17]]);
  g.add(meshAt(extrude(trap, 0.08, 0.006), castIron({ roughness: 0.55 }), 0, 0, 0.02));
  const by = K.B[1] - 0.18;
  g.add(meshAt(cylZ(0.07, -0.02, 0.06, 0.004, 36), castIron({ roughness: 0.55 }), 0, by, 0));
  g.add(meshAt(cylZ(0.035, -0.02, 0.15, 0.003), steel(), 0, by, 0));
  g.add(meshAt(cylZ(0.05, 0.13, 0.15, 0.003), steel(), 0, by, 0));
  setMM(g, { kind: 'bracket', fn: 'bracket225' });
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

function armOf(u: number): { gamma: number; P: V2; H: V2; T: V2 } {
  const P: V2 = [K.K[0] + K.rk * Math.cos(K.thF + u), K.K[1] + K.rk * Math.sin(K.thF + u)];
  const H = circleIntersect([K.B[0], K.B[1]], K.HL, [P[0], P[1]], K.Lk, true) ?? [K.B[0], K.B[1] + K.HL];
  const gamma = Math.atan2(H[1] - K.B[1], H[0] - K.B[0]) - Math.PI / 2;
  const T: V2 = [K.B[0] - K.LP * Math.sin(gamma), K.B[1] + K.LP * Math.cos(gamma)];
  return { gamma, P, H, T };
}
function cornerOf(T: V2): V2 {
  return circleIntersect([K.W[0], K.W[1]], K.Rc, [T[0], T[1]], K.L, true) ?? [K.W[0], K.W[1] + K.Rc];
}
const angW = (c: V2): number => Math.atan2(c[1] - K.W[1], c[0] - K.W[0]);
const uOf = (u: number): number => angW(cornerOf(armOf(u).T));

interface Consts {
  Ulo: number;
  Uhi: number;
  slack: number;
  rho0: number;
}
let CONSTS: Consts | null = null;
function consts(): Consts {
  if (CONSTS !== null) return CONSTS;
  const Ulo = uOf(0);
  const Uhi = uOf(Math.PI);
  const slack = Uhi - Ulo - P_RAD;
  CONSTS = { Ulo, Uhi, slack, rho0: Uhi - P_RAD + K.eps };
  return CONSTS;
}
/** 검산용: 설계표 상수와 식으로 낸 값 */
export function consts225(): Consts {
  return { ...consts() };
}

interface Core {
  u: number;
  gamma: number;
  P: V2;
  H: V2;
  T: V2;
  C: V2;
  U: number;
  phi: number; // 한 주기 안의 누적각(반시계)
  drive: boolean;
}
function core(u: number): Core {
  const c = consts();
  const { gamma, P, H, T } = armOf(u);
  const C = cornerOf(T);
  const U = angW(C);
  let phi: number;
  let drive = false;
  if (u < Math.PI) {
    const d = U - c.Ulo - c.slack;
    phi = Math.max(0, d);
    drive = d > 0;
  } else {
    phi = P_RAD;
  }
  return { u, gamma, P, H, T, C, U, phi, drive };
}

// ── 폴 들림 표 ──
const TAB_N = 1440;
let LIFT: Float64Array | null = null;
const WHEEL_PTS = wheelOutline225();

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

/** 바깥(들림) 방향 = 시계(−1): 침범이면 그쪽으로 가다 처음 자유, 아니면 반대로 가다 처음 침범 → 이분법 */
function followLift(prev: number, T: V2, base: number, wheelRot: number): number {
  const out = -1;
  const step = 0.02 * D2R;
  const cr = Math.cos(-wheelRot);
  const sr = Math.sin(-wheelRot);
  const pen = (lift: number): boolean => {
    const lam = base + lift;
    const dx = T[0] + K.L * Math.cos(lam) - K.W[0];
    const dy = T[1] + K.L * Math.sin(lam) - K.W[1];
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
  const tab = new Float64Array(TAB_N + 1);
  let l = 0;
  for (let i = 0; i < 2 * TAB_N; i++) {
    const u = (TAU * (i % TAB_N)) / TAB_N;
    const s = core(u);
    const base = Math.atan2(s.C[1] - s.T[1], s.C[0] - s.T[0]);
    l = s.drive ? 0 : followLift(l, s.T, base, c.rho0 + s.phi);
    if (i >= TAB_N) tab[i - TAB_N] = l;
  }
  tab[TAB_N] = tab[0]!;
  LIFT = tab;
}
function tabAt(tab: Float64Array, u: number): number {
  const f = (u / TAU) * TAB_N;
  const i = Math.min(TAB_N - 1, Math.floor(f));
  return tab[i]! + (tab[i + 1]! - tab[i]!) * (f - i);
}

export interface State225 {
  u: number;
  gamma: number;
  P: V2;
  H: V2;
  T: V2;
  U: number;
  phi: number;
  wheel: number;
  lam: number;
  lift: number;
  drive: boolean;
  pushing: boolean;
}

/** 225번 운동식(theta = 크랭크 누적각, 모두 닫힌 식) */
export function state225(theta: number): State225 {
  if (LIFT === null) buildLift();
  const c = consts();
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const s = core(u);
  const phi = n * P_RAD + s.phi;
  const lift = s.drive ? 0 : tabAt(LIFT!, u);
  const lamS = Math.atan2(s.C[1] - s.T[1], s.C[0] - s.T[0]);
  return {
    u,
    gamma: s.gamma,
    P: s.P,
    H: s.H,
    T: s.T,
    U: s.U,
    phi,
    wheel: c.rho0 + phi,
    lam: lamS + lift,
    lift,
    drive: s.drive,
    pushing: u < Math.PI
  };
}
