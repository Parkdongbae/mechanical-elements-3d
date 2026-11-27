// 235번 태핏 팔 래칫 전용 키트 — 6이 별 바퀴, 태핏(접히는 미는 폴), 멈춤 폴, 태핏 팔, 스프링, 닫힌 식 운동(접힘·들림 표는 적재 때 한 번)
// 설계표 docs/mm507-sheets/235.md 의 수치·점열 그대로.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { markPin, setMM } from './mm';
import { STAGE } from './stand';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/** 235번 배치 상수(모두 세계 좌표, 각은 라디안) */
export const K235 = {
  W: [-0.882, 1.95] as V2,
  teeth: 6,
  rT: 0.55,
  rR: 0.35,
  A: [1.292, 1.199] as V2,
  zBot: 181.0383 * D2R,
  zTop: 148.8471 * D2R,
  Pt: [1.0076, 0.1098] as V2,
  Rn: 1.87006,
  Lt: 0.869421,
  lt0: -7.2553 * D2R,
  armPin: [0.55, 0] as V2,
  stop: [1.2831, 0.2057] as V2,
  springBase: [0.74, 0.085] as V2,
  K: [0.599209, 0.657917] as V2,
  rk: 0.152483,
  Lk: 0.702483,
  thF: -105.0573 * D2R,
  Ck: [-0.949843, 2.606504] as V2,
  LK: 0.657996,
  lamK0: -116.9138 * D2R,
  RHO0: 77.0878 * D2R,
  flankNormal: -54.6704 * D2R,
  flankD: 0.318053,
  rn: 0.014
} as const;
const K = K235;
const STEP = (60 * D2R) as number;

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
function disc(cx: number, cy: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, TAU, false);
  return s;
}
const wrapPi = (a: number): number => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};

// ═══════════════════════════ 부품 ═══════════════════════════

/** 별 바퀴 윤곽 12점(바퀴 로컬, 반시계) — 이끝 k (0.55, 60k°), 이뿌리 k (0.35, 60k° + 30°) */
export function starOutline235(): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < K.teeth; k++) {
    const a = k * STEP;
    out.push([K.rT * Math.cos(a), K.rT * Math.sin(a)]);
    out.push([K.rR * Math.cos(a + STEP / 2), K.rR * Math.sin(a + STEP / 2)]);
  }
  return out;
}

/** 별 바퀴: 원점 = 중심, 두께 0.08(z ±0.04), 구멍 0.055. 이 0 쪽에 노란 반지름 막대 */
export function starWheel235(): THREE.Group {
  const g = new THREE.Group();
  const outline = starOutline235();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.055));
  g.add(mesh(extrude(shape, 0.08, 0.004, 8), steel()));
  g.add(meshAt(new THREE.BoxGeometry(0.3, 0.022, 0.008), paint(0xffcc00), 0.2, 0, 0.044));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'starWheel235', teeth: K.teeth, ra: K.rT, rf: K.rR, width: 0.08, axis: 'z' });
  return g;
}

export const TAPPET235: V2[] = [[0.8818,0.0066],[0.8772,0.0116],[0.8546,0.0192],[0.8485,0.0226],[0.8446,0.0271],[0.84,0.0371],[0.8352,0.0436],[0.8287,0.0492],[0.8211,0.053],[0.5424,0.1198],[0.2555,0.1046],[0.0196,0.0421],[-0.0019,0.0455],[-0.0091,0.0489],[-0.0736,0.1076],[-0.0811,0.1197],[-0.0863,0.1257],[-0.0919,0.1299],[-0.0979,0.1328],[-0.1052,0.1347],[-0.1133,0.1348],[-0.1215,0.1331],[-0.1283,0.1298],[-0.1346,0.1249],[-0.1398,0.1183],[-0.1431,0.1115],[-0.1448,0.1036],[-0.1448,0.0963],[-0.1431,0.0885],[-0.1399,0.0819],[-0.1357,0.0763],[-0.1281,0.0701],[-0.1139,0.063],[-0.0501,0.005],[-0.0458,-0.0016],[-0.0431,-0.013],[-0.0401,-0.0204],[-0.0356,-0.0276],[-0.0303,-0.0332],[-0.0183,-0.0411],[-0.0045,-0.0448],[0.0067,-0.0445],[0.0174,-0.0415],[0.0267,-0.0362],[0.0369,-0.0273],[0.0425,-0.0248],[0.2663,0.0351],[0.5329,0.0496],[0.5387,0.0491],[0.8044,-0.0146],[0.813,-0.0148],[0.8254,-0.0126],[0.8718,-0.0138],[0.8763,-0.0122],[0.88,-0.0091],[0.8825,-0.005],[0.8834,-0.0002]];

export const CLICK235: V2[] = [[0.0134,-0.0461],[0.0252,-0.0528],[0.0491,-0.0819],[0.0809,-0.1161],[0.1152,-0.148],[0.1499,-0.1762],[0.1902,-0.2044],[0.2299,-0.2283],[0.2694,-0.2485],[0.315,-0.2679],[0.3588,-0.283],[0.404,-0.2951],[0.4479,-0.3037],[0.4939,-0.3095],[0.5446,-0.3121],[0.5542,-0.3102],[0.5631,-0.3055],[0.5698,-0.2992],[0.575,-0.2905],[0.5773,-0.2823],[0.5775,-0.2737],[0.5756,-0.2654],[0.5699,-0.2526],[0.5695,-0.247],[0.5704,-0.2421],[0.6709,-0.0054],[0.672,0.001],[0.6709,0.0054],[0.6686,0.0091],[0.6652,0.012],[0.6611,0.0137],[0.6566,0.0139],[0.6523,0.0128],[0.6486,0.0104],[0.6458,0.0069],[0.6438,0.0021],[0.6435,-0.0011],[0.6446,-0.0056],[0.6471,-0.0096],[0.6399,-0.0342],[0.6314,-0.0551],[0.6182,-0.0801],[0.5994,-0.1071],[0.5491,-0.2309],[0.5462,-0.2349],[0.5418,-0.2386],[0.5372,-0.2406],[0.5324,-0.2414],[0.5009,-0.2398],[0.4593,-0.2346],[0.4195,-0.2268],[0.3792,-0.216],[0.3382,-0.2018],[0.2998,-0.1854],[0.2636,-0.1669],[0.2277,-0.1453],[0.1935,-0.1214],[0.1599,-0.0941],[0.1293,-0.0654],[0.1017,-0.0357],[0.0741,-0.0016],[0.0686,0.0038],[0.0433,0.0178],[0.0319,0.0318],[0.0223,0.0391],[0.0099,0.0439],[-0.0034,0.0449],[-0.0121,0.0433],[-0.0203,0.0402],[-0.0278,0.0354],[-0.0341,0.0293],[-0.0392,0.0221],[-0.0428,0.014],[-0.0447,0.0054],[-0.0449,-0.0034],[-0.0433,-0.0121],[-0.0402,-0.0203],[-0.0354,-0.0278],[-0.0293,-0.0341],[-0.0221,-0.0392],[-0.014,-0.0428],[-0.0054,-0.0447],[0.0088,-0.0449]];

function pawlGroup(outline: V2[], fn: string): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.022));
  const mat = brass();
  g.add(mesh(extrude(shape, 0.05, 0.004), mat));
  g.userData.mat = mat;
  g.userData.outline = outline;
  setMM(g, { kind: 'pawl', fn });
  return g;
}
/** 태핏: 원점 = 태핏 핀 중심, +X = 핀 → 코 원 중심(접히지 않은 자세). 두께 0.05(z ±0.025) */
export function tappet235(): THREE.Group {
  return pawlGroup(TAPPET235, 'tappet235');
}
/** 멈춤 폴: 원점 = 핀 중심, +X = 핀 → 코 원 중심. 두께 0.05(z ±0.025) */
export function click235(): THREE.Group {
  return pawlGroup(CLICK235, 'click235');
}

/**
 * 태핏 팔: 원점 = 팔 받침점 A, +X = 팔 방향. 판은 바퀴 판 뒤(z −0.11 ~ −0.05).
 * 붙은 것: 태핏 핀(Pt), 멈춤 핀 `tappetStop`, 스프링 받침 덩이 `springBase`, 연결봉 핀 + 표식 `armPin`.
 */
export function tappetArm235(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.5 });
  const zc = -0.08;
  const [px, py] = K.Pt;
  const [sx, sy] = K.stop;
  // 판 = 보스 원 ∪ 팔 ∪ 태핏 핀 받이 ∪ 턱 (겹치는 면이 같은 높이로 겹쳐 깜박이지 않게 두께를 조금씩 다르게)
  const arm = stadiumShape(0, 0, 1.1, 0, 0.055);
  arm.holes.push(circlePath(0, 0, 0.042));
  g.add(meshAt(extrude(arm, 0.06, 0.004, 16), iron, 0, 0, zc));
  const boss = disc(0, 0, 0.07);
  boss.holes.push(circlePath(0, 0, 0.042));
  g.add(meshAt(extrude(boss, 0.056, 0.004, 24), iron, 0, 0, zc));
  g.add(meshAt(extrude(disc(px, py, 0.06), 0.056, 0.004, 24), iron, 0, 0, zc));
  g.add(meshAt(extrude(stadiumShape(px, py, sx, sy, 0.04), 0.056, 0.004, 16), iron, 0, 0, zc));
  // 태핏 핀(머리가 앞)
  g.add(meshAt(cylZ(0.02, -0.11, 0.035, 0.003), steel(), px, py, 0));
  g.add(meshAt(cylZ(0.03, 0.025, 0.035, 0.003), steel(), px, py, 0));
  // 멈춤 핀
  const stop = meshAt(cylZ(0.025, -0.05, 0.03, 0.003), steel(), sx, sy, 0);
  stop.name = 'tappetStop';
  g.add(stop);
  // 스프링 받침 덩이
  const sb = meshAt(new THREE.BoxGeometry(0.06, 0.06, 0.062), castIron({ roughness: 0.5 }), K.springBase[0], K.springBase[1], -0.019);
  sb.name = 'springBase';
  g.add(sb);
  // 연결봉 핀(뒤쪽) + 표식
  g.add(meshAt(cylZ(0.03, -0.16, -0.11, 0.003), steel(), K.armPin[0], K.armPin[1], 0));
  const mark = new THREE.Object3D();
  mark.name = 'armPin';
  mark.position.set(K.armPin[0], K.armPin[1], -0.135);
  g.add(markPin(mark));
  setMM(g, { kind: 'lever', fn: 'tappetArm235', pivot: [0, 0, 0] });
  return g;
}

/**
 * 크랭크 축(235 전용): 뒤판 앞면에서 z1 까지. 설계표의 shaftZ(…, −0.24) 는 뒤판 보스(높이 0.1)가 크랭크 원판(z −0.24~−0.18)에 박혀
 * 보스를 0.05 로 줄이고 축은 원판 앞면 바로 앞(z1 = −0.165)까지 뻗어 원판을 꿴다(너트 없음 — 연결봉이 그 앞을 지난다).
 */
export function crankShaft235(x: number, y: number, z1 = -0.165, r = 0.04): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  g.add(meshAt(cylZ(r, STAGE.backZ, z1, r * 0.2), steel(), 0, 0, 0));
  g.add(meshAt(cylZ(r * 2.4, STAGE.backZ, STAGE.backZ + 0.05, 0.01, 40), darkSteel(), 0, 0, 0));
  setMM(g, { kind: 'shaft', axis: 'z', r, z0: STAGE.backZ, z1 });
  return g;
}

/** 스프링 중심선: 받침 덩이 위 S0 → S1 → 태핏 꼬리 혹 위 S2(fold = 태핏 접힘 각 rad) */
export function springCurve235(fold: number): THREE.CatmullRomCurve3 {
  const a = K.lt0 - fold;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = -0.11;
  const dy = 0.135;
  const s2 = new THREE.Vector3(K.Pt[0] + c * dx - s * dy, K.Pt[1] + s * dx + c * dy, 0);
  return new THREE.CatmullRomCurve3([new THREE.Vector3(0.74, 0.115, 0), new THREE.Vector3(0.8, 0.3, 0), s2]);
}

// ═══════════════════════════ 운동식 ═══════════════════════════

/** 팔 상태: u → 크랭크 핀 P, 연결봉 핀 E, 팔 각 ζ(0 ~ 2π) */
function arm(u: number): { P: V2; E: V2; zeta: number } {
  const P: V2 = [K.K[0] + K.rk * Math.cos(K.thF + u), K.K[1] + K.rk * Math.sin(K.thF + u)];
  const E = circleIntersect([K.A[0], K.A[1]], K.armPin[0], [P[0], P[1]], K.Lk, false) ?? [K.A[0] - K.armPin[0], K.A[1]];
  let z = Math.atan2(E[1] - K.A[1], E[0] - K.A[0]);
  if (z < 0) z += TAU;
  return { P, E, zeta: z };
}
const noseFree = (zeta: number): V2 => [K.A[0] + K.Rn * Math.cos(zeta), K.A[1] + K.Rn * Math.sin(zeta)];

/** 밀리는 이 한 개가 밀린 양 δ(rad) — 동작 4 (가)(나). 닿는 데가 없으면 null */
export function pushDelta235(N: V2): number | null {
  const vx = N[0] - K.W[0];
  const vy = N[1] - K.W[1];
  const rv = Math.hypot(vx, vy);
  const av = Math.atan2(vy, vx);
  const base = K.RHO0 - 2 * STEP;
  let best: number | null = null;
  const take = (ph: number): void => {
    const d = wrapPi(ph - base);
    if (Math.abs(d) < 70 * D2R && (best === null || d > best)) best = d;
  };
  // (가) 시계 쪽 옆면 — 이 0 기준 로컬에서 바깥 법선 flankNormal, 원점 거리 flankD
  const c1 = (K.flankD + K.rn) / rv;
  if (c1 <= 1) {
    const ac = Math.acos(c1);
    const tip: V2 = [K.rT, 0];
    const rootCw: V2 = [K.rR * Math.cos(-STEP / 2), K.rR * Math.sin(-STEP / 2)];
    const ex = rootCw[0] - tip[0];
    const ey = rootCw[1] - tip[1];
    const nx = Math.cos(K.flankNormal);
    const ny = Math.sin(K.flankNormal);
    for (const sg of [1, -1]) {
      const ph = av - K.flankNormal - sg * ac;
      const cr = Math.cos(-ph);
      const sr = Math.sin(-ph);
      const lx = vx * cr - vy * sr;
      const ly = vx * sr + vy * cr;
      const fx = lx - K.rn * nx;
      const fy = ly - K.rn * ny;
      const t = ((fx - tip[0]) * ex + (fy - tip[1]) * ey) / (ex * ex + ey * ey);
      if (t >= -1e-9 && t <= 1 + 1e-9) take(ph);
    }
  }
  // (나) 이끝 꼭짓점
  const c2 = (rv * rv + K.rT * K.rT - K.rn * K.rn) / (2 * rv * K.rT);
  if (Math.abs(c2) <= 1) {
    const ac = Math.acos(c2);
    take(av - ac);
    take(av + ac);
  }
  return best;
}

// ── 윤곽 판정(바퀴 12점) ──
const WHEEL_PTS = starOutline235();
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
/** 세계 점 (x, y) 가 바퀴(각 wheelRot)에 침범했나 — margin: 윤곽까지 최소 거리 */
function pierces(x: number, y: number, wheelRot: number, margin: number): boolean {
  const dx = x - K.W[0];
  const dy = y - K.W[1];
  const cr = Math.cos(-wheelRot);
  const sr = Math.sin(-wheelRot);
  const lx = dx * cr - dy * sr;
  const ly = dx * sr + dy * cr;
  return insideWheel(lx, ly) || distWheel(lx, ly) < margin;
}

// ── 바퀴 미는 각 표(u < π, 0.25° 걸음 누적 최댓값) ──
const PHI_STEP = 0.25 * D2R;
const PHI_N = Math.floor(Math.PI / PHI_STEP);
let PHI_TAB: Float64Array | null = null;
function deltaAt(u: number): number | null {
  return pushDelta235(noseFree(arm(u).zeta));
}
function phiTab(): Float64Array {
  if (PHI_TAB !== null) return PHI_TAB;
  const tab = new Float64Array(PHI_N + 2);
  let m = 0;
  for (let i = 0; i <= PHI_N + 1; i++) {
    const d = deltaAt(Math.min(Math.PI, i * PHI_STEP));
    if (d !== null && d > m) m = d;
    tab[i] = m;
  }
  PHI_TAB = tab;
  return tab;
}
function phiCore(u: number): { phi: number; pushing: boolean } {
  if (u >= Math.PI) return { phi: STEP, pushing: false };
  const tab = phiTab();
  const i = Math.min(PHI_N, Math.floor(u / PHI_STEP));
  const base = i > 0 ? tab[i - 1]! : 0;
  const d = deltaAt(u);
  const phi = d !== null && d > base ? d : base;
  const pushing = d !== null && d > 1e-6 && d >= base - 1e-9;
  return { phi, pushing };
}

// ── 태핏 접힘 표 · 멈춤 폴 들림 표 ──
const TAB_N = 1440;
let FOLD_TAB: Float64Array | null = null;
let LIFT_TAB: Float64Array | null = null;

function bisect(pen: (v: number) => boolean, free: number, blocked: number, n: number): number {
  let f = free;
  let b = blocked;
  for (let i = 0; i < n; i++) {
    const m = (f + b) / 2;
    if (pen(m)) b = m;
    else f = m;
  }
  return f;
}

/** 태핏 코가 접히지 않은 자세 + 접힘 f 일 때의 세계 좌표 */
function noseFold(zeta: number, f: number): V2 {
  const a = K.lt0 - f;
  const lx = K.Pt[0] + K.Lt * Math.cos(a);
  const ly = K.Pt[1] + K.Lt * Math.sin(a);
  const c = Math.cos(zeta);
  const s = Math.sin(zeta);
  return [K.A[0] + c * lx - s * ly, K.A[1] + s * lx + c * ly];
}

function followFold(prev: number, zeta: number, wheelRot: number): number {
  const step = 0.02 * D2R;
  const pen = (f: number): boolean => {
    const c = noseFold(zeta, f);
    return pierces(c[0], c[1], wheelRot, K.rn - 0.0002);
  };
  if (pen(prev)) {
    let a = prev;
    let b = prev;
    let k = 0;
    while (pen(b) && k < 3000) {
      a = b;
      b += step;
      k++;
    }
    return pen(b) ? b : bisect(pen, b, a, 30);
  }
  let free = prev;
  for (let k = 0; k < 3000; k++) {
    const n = Math.max(0, free - step);
    if (pen(n)) return bisect(pen, free, n, 30);
    if (n === 0) return 0;
    free = n;
  }
  return free;
}

function followClick(prev: number, wheelRot: number): number {
  const step = 0.02 * D2R;
  const pen = (lift: number): boolean => {
    const lam = K.lamK0 + lift;
    return pierces(K.Ck[0] + K.LK * Math.cos(lam), K.Ck[1] + K.LK * Math.sin(lam), wheelRot, K.rn + 0.0003);
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
    return pen(b) ? b : bisect(pen, b, a, 25);
  }
  let b = a;
  let k = 0;
  while (!pen(b) && k < 1500) {
    a = b;
    b += step;
    k++;
  }
  return pen(b) ? bisect(pen, a, b, 25) : a;
}

function buildTables(): void {
  const fold = new Float64Array(TAB_N + 1);
  const lift = new Float64Array(TAB_N + 1);
  let f = 0;
  let l = 0;
  for (let i = 0; i < 2 * TAB_N; i++) {
    const u = (TAU * (i % TAB_N)) / TAB_N;
    const { zeta } = arm(u);
    if (u < Math.PI) f = 0;
    else f = followFold(f, zeta, K.RHO0 + STEP);
    l = followClick(l, K.RHO0 + phiCore(u).phi);
    if (i >= TAB_N) {
      fold[i - TAB_N] = f;
      lift[i - TAB_N] = l;
    }
  }
  fold[TAB_N] = fold[0]!;
  lift[TAB_N] = lift[0]!;
  FOLD_TAB = fold;
  LIFT_TAB = lift;
}
function tabAt(tab: Float64Array, u: number): number {
  const f = (u / TAU) * TAB_N;
  const i = Math.min(TAB_N - 1, Math.floor(f));
  return tab[i]! + (tab[i + 1]! - tab[i]!) * (f - i);
}

/** 검산용: 접힘·들림 표(두 번째 주기 값, 1440 걸음) */
export function tables235(): { fold: Float64Array; lift: Float64Array } {
  if (FOLD_TAB === null || LIFT_TAB === null) buildTables();
  return { fold: FOLD_TAB!, lift: LIFT_TAB! };
}

export interface State235 {
  u: number;
  zeta: number;
  P: V2;
  E: V2;
  phiRel: number;
  wheel: number;
  fold: number;
  clickLam: number;
  clickLift: number;
  pushing: boolean;
  rising: boolean;
}

/** 235번 운동식(theta = 크랭크 누적각, 닫힌 식 + 표) */
export function state235(theta: number): State235 {
  if (FOLD_TAB === null || LIFT_TAB === null) buildTables();
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const a = arm(u);
  const pc = phiCore(u);
  const fold = u < Math.PI ? 0 : tabAt(FOLD_TAB!, u);
  const lift = tabAt(LIFT_TAB!, u);
  return {
    u,
    zeta: a.zeta,
    P: a.P,
    E: a.E,
    phiRel: pc.phi,
    wheel: K.RHO0 + n * STEP + pc.phi,
    fold,
    clickLam: K.lamK0 + lift,
    clickLift: lift,
    pushing: pc.pushing,
    rising: u < Math.PI
  };
}
