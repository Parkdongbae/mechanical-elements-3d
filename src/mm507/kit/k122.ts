// 122·123·124번 전용 키트
//  122 두 기어로 만드는 가변 왕복: 크랭크 핀 달린 평기어, 구멍 셋 뜬 지레, 눈 달린 미끄럼 막대, 주기 시간표(linkage122)
//  123 크랭크 대용 이중 랙: 양쪽 이 랙(긴 안내 홈·멈춤쇠 2개), 이 부채꼴, 걸림쇠(굽은 조각), 안내 축, 랙 운동식(rackLift123)
//  124 활비비(피들 드릴): 활, 실패(납작 림)·드릴 축, 축받이, 시위 경로(fiddlePath124)
// 치수 상수(K122·K123·K124)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s122.mjs · s123.mjs · s124.mjs)가 번들해 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, rubber, steel, wood } from '../../models/materials';
import { TAU, circlePts, extrude, lathe, loft, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { LoftLayer, V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { STAGE } from './stand';
import { meshAngle, spurGear } from './gear';
import { markAnchor, markPin, setMM, tagArc } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1, 양끝 모따기 c) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * 뒤판에서 나온 고정 축(끝 너트 없이 얇은 덮개 원판) — 122·123 공용. 그룹 원점 = (x, y, 0).
 * 뒤판 보스(반지름 2.2r, 길이 0.09) + 축(반지름 r, 뒤판 ~ z1) + 끝 덮개(반지름 capR, 두께 capT, 앞면이 z1).
 * 기어 앞으로 연결봉이 지나가는 자리라 shaftZ 의 두꺼운 육각 너트를 쓸 수 없을 때 쓴다.
 */
export function studZ(x: number, y: number, r: number, z1: number, capR: number = r + 0.03, capT = 0.02): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const back = STAGE.backZ;
  g.add(mesh(cylZ(r, back, z1 - capT * 0.5, 0.004, 32), steel()));
  g.add(mesh(cylZ(Math.max(r * 1.6, r + 0.04), back, back + 0.09, 0.012, 40), darkSteel()));
  g.add(mesh(cylZ(capR, z1 - capT, z1, 0.005, 36), darkSteel()));
  setMM(g, { kind: 'shaft', axis: 'z', r, z0: back, z1 });
  return g;
}

// ═══════════════════════════ 122 두 기어로 만드는 가변 왕복 ═══════════════════════════

/**
 * 122번 치수. 판화 비에서 크랭크 반지름만 80 %(0.45·0.41 → 0.36·0.33)로 줄이고 지레를 1.44 → 1.6 으로 늘렸다
 * (판화 치수로는 두 핀이 반대 위상일 때 지레가 넘어가 풀리지 않는다 — shots/_verify/s122b.mjs).
 */
export const K122 = {
  /** 큰 기어(위, 구동)·작은 기어(아래) 잇수, 모듈 */
  z1: 30,
  z2: 25,
  m: 0.05,
  /** 작은 기어 중심 */
  O2: [-0.7, 0.95] as V2,
  /** 작은 기어 → 큰 기어 중심선의 방향(도) */
  axisDeg: 102.2,
  /** 크랭크 반지름(큰·작은 기어) */
  r1: 0.36,
  r2: 0.33,
  /** 연결봉 길이(위·아래) */
  L1: 1.44,
  L2: 1.22,
  /** 뜬 지레의 두 끝 핀 사이 길이(가운데 핀은 한가운데) */
  lever: 1.6,
  /** 판화 자세(t = 1)의 크랭크 핀 각 */
  pose1: 101 * DEG,
  pose2: 101.5 * DEG,
  /** 한 주기의 구동 각 = 큰 기어 5바퀴(작은 기어 6바퀴) */
  period: 10 * Math.PI
} as const;

const C122 = ((K122.z1 + K122.z2) * K122.m) / 2;
/** 큰 기어 중심 */
export const K122_O1: V2 = [K122.O2[0] + C122 * Math.cos(K122.axisDeg * DEG), K122.O2[1] + C122 * Math.sin(K122.axisDeg * DEG)];
/** 미끄럼 막대의 높이(= 큰 기어 축 높이) */
export const K122_BAR_Y = K122_O1[1];

/** 두 기어의 그룹 회전각. g1 = 큰 기어(반시계), g2 = 작은 기어(시계, 6/5 배) — 이가 맞물리는 위상 */
export function gearAngles122(theta: number): { g1: number; g2: number } {
  const g1 = theta - 1.6;
  return { g1, g2: meshAngle(K122_O1, K122.z1, g1, K122.O2, K122.z2) };
}
/** 크랭크 핀의 기어 로컬 각 — 큰 기어 / 작은 기어 (t = 1 에 판화 자세가 되게) */
export const K122_PIN1_LOCAL: number = K122.pose1;
export const K122_PIN2_LOCAL: number = K122.pose2 - meshAngle(K122_O1, K122.z1, 0, K122.O2, K122.z2);

export interface Link122 {
  /** 크랭크 핀의 세계 각(큰·작은) */
  a1: number;
  a2: number;
  /** 크랭크 핀 위치 */
  p1: V2;
  p2: V2;
  /** 지레 가운데 핀(= 막대 눈)의 x. y 는 K122_BAR_Y */
  x: number;
  /** 지레의 각(가운데 → 위 끝 A 방향) */
  phi: number;
  /** 지레 위 끝·아래 끝 */
  A: V2;
  B: V2;
  /** 연결봉이 +X 와 이루는 각(크랭크 핀 → 지레 끝) */
  rod1: number;
  rod2: number;
}

function pins122(theta: number): { a1: number; a2: number; p1: V2; p2: V2 } {
  const d = theta - 1.6;
  const a1 = K122.pose1 + d;
  const a2 = K122.pose2 - (K122.z1 / K122.z2) * d;
  return {
    a1,
    a2,
    p1: [K122_O1[0] + K122.r1 * Math.cos(a1), K122_O1[1] + K122.r1 * Math.sin(a1)],
    p2: [K122.O2[0] + K122.r2 * Math.cos(a2), K122.O2[1] + K122.r2 * Math.sin(a2)]
  };
}

/** 두 연결봉 길이 조건을 뉴턴법으로 푼다(미지수 x, phi). 출발값에서 가까운 해 */
function solve122(p1: V2, p2: V2, x0: number, phi0: number): [number, number] {
  const h = K122.lever / 2;
  const yb = K122_BAR_Y;
  let x = x0;
  let phi = phi0;
  for (let it = 0; it < 30; it++) {
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const ax = x + h * c - p1[0];
    const ay = yb + h * s - p1[1];
    const bx = x - h * c - p2[0];
    const by = yb - h * s - p2[1];
    const f1 = ax * ax + ay * ay - K122.L1 * K122.L1;
    const f2 = bx * bx + by * by - K122.L2 * K122.L2;
    const j11 = 2 * ax;
    const j12 = 2 * (-ax * h * s + ay * h * c);
    const j21 = 2 * bx;
    const j22 = 2 * (bx * h * s - by * h * c);
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-12) break;
    const dx = (f1 * j22 - f2 * j12) / det;
    const dp = (j11 * f2 - j21 * f1) / det;
    x -= dx;
    phi -= dp;
    if (Math.abs(dx) + Math.abs(dp) < 1e-13) break;
  }
  return [x, phi];
}

const N122 = 2400;
let tab122: Float64Array | null = null;
/** 한 주기 시간표(x, phi) — 판화 자세에서 출발해 이어 푼다. 처음 부를 때 한 번 만든다 */
function table122(): Float64Array {
  if (tab122 !== null) return tab122;
  const t = new Float64Array(2 * (N122 + 1));
  let x = 0.372;
  let phi = 94.4 * DEG;
  for (let i = 0; i <= N122; i++) {
    const { p1, p2 } = pins122(1.6 + (K122.period * i) / N122);
    [x, phi] = solve122(p1, p2, x, phi);
    t[2 * i] = x;
    t[2 * i + 1] = phi;
  }
  tab122 = t;
  return t;
}

/**
 * 122번 운동식: theta(큰 기어 누적각)만의 함수. 한 주기(theta 10π)의 시간표를 보간한 값을 출발값으로 다시 풀어 정확한 해를 돌려준다.
 * 누적 오차 없음(주기 끝 = 주기 처음).
 */
export function linkage122(theta: number): Link122 {
  const P = K122.period;
  const d = (((theta - 1.6) % P) + P) % P;
  const f = (d / P) * N122;
  const i = Math.min(N122 - 1, Math.floor(f));
  const u = f - i;
  const t = table122();
  const { a1, a2, p1, p2 } = pins122(theta);
  const [x, phi] = solve122(p1, p2, t[2 * i]! * (1 - u) + t[2 * i + 2]! * u, t[2 * i + 1]! * (1 - u) + t[2 * i + 3]! * u);
  const h = K122.lever / 2;
  const A: V2 = [x + h * Math.cos(phi), K122_BAR_Y + h * Math.sin(phi)];
  const B: V2 = [x - h * Math.cos(phi), K122_BAR_Y - h * Math.sin(phi)];
  return { a1, a2, p1, p2, x, phi, A, B, rod1: Math.atan2(A[1] - p1[1], A[0] - p1[0]), rod2: Math.atan2(B[1] - p2[1], B[0] - p2[0]) };
}

export interface CrankGearOpts {
  /** 이 폭(z). 기본 0.12 */
  width?: number;
  /** 핀 반지름. 기본 0.04 */
  pinR?: number;
  /** 핀 끝의 로컬 z. 기본 0.19 */
  pinTop?: number;
  /** 연결봉 평면의 로컬 z(핀 표식 자리). 기본 0.14 */
  pinZ?: number;
  /** 핀 표식 child 이름. 기본 'crankPin' */
  pinName?: string;
  driver?: boolean;
}

/**
 * 크랭크 핀 달린 민판 평기어(122번): spurGear(민판) + 허브 고리 + 로컬 각 pinLocal·반지름 crankR 자리의 핀.
 * 회전축 = 로컬 Z, 원점 = 중심. 축 구멍 반지름 = max(0.024, 0.14·피치 반지름) (spurGear 와 같다).
 * 핀 표식 child(name = pinName, 기본 'crankPin')가 연결봉 평면 z = pinZ 에 있다.
 */
export function crankGear(teeth: number, module: number, crankR: number, pinLocal: number, o: CrankGearOpts = {}): THREE.Group {
  const width = o.width ?? 0.12;
  const pinR = o.pinR ?? 0.04;
  const pinTop = o.pinTop ?? 0.19;
  const pinZ = o.pinZ ?? 0.14;
  const g = spurGear(teeth, module, { width, spokes: 0, driver: o.driver === true });
  const rp = (teeth * module) / 2;
  const bore = Math.max(0.024, rp * 0.14);
  // 허브 고리(판화의 축 둘레 두 겹 원)
  g.add(mesh(tubeZ(bore, bore + 0.07, -width / 2 - 0.012, width / 2 + 0.018, 0.008, 48), darkSteel()));
  const px = crankR * Math.cos(pinLocal);
  const py = crankR * Math.sin(pinLocal);
  g.add(meshAt(cylZ(pinR * 1.8, width / 2 - 0.004, width / 2 + 0.03, 0.006), darkSteel(), px, py, 0));
  g.add(meshAt(cylZ(pinR, 0, pinTop, 0.006), steel(), px, py, 0));
  g.add(meshAt(new THREE.CylinderGeometry(pinR * 0.5, pinR * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), px, py, pinTop + 0.002));
  const pin = new THREE.Object3D();
  pin.name = o.pinName ?? 'crankPin';
  pin.position.set(px, py, pinZ);
  g.add(markPin(pin));
  setMM(g, { crankR, pinLocal });
  return g;
}

export interface FloatLeverOpts {
  /** 눈 바깥 반지름. 기본 0.08 */
  eyeR?: number;
  /** 핀 반지름. 기본 0.04 */
  pinR?: number;
  /** 막대 반폭. 기본 0.04 */
  barHalf?: number;
  /** 두께(z). 기본 0.06 */
  thick?: number;
  /** 끝 핀이 뒤로 나가는 로컬 z(연결봉을 꿴다). 기본 −0.11 */
  endPinBack?: number;
  /** 가운데 핀이 앞으로 나가는 로컬 z(막대 눈을 꿴다). 기본 0.12 */
  midPinFront?: number;
  /** 연결봉 평면의 로컬 z(끝 핀 표식 자리). 기본 −0.07 */
  rodZ?: number;
  /** 막대 눈 평면의 로컬 z(가운데 핀 표식 자리). 기본 0.07 */
  barZ?: number;
}

/**
 * 구멍 셋 뜬 지레(122번): 원점 = 가운데 핀, 로컬 +X 끝이 A(위 연결봉), −X 끝이 B(아래 연결봉). 두께 가운데 z = 0.
 * 끝 핀 둘은 뒤(−z)로, 가운데 핀은 앞(+z)으로 솟는다. 핀 표식 child: 'leverA'·'leverB'(z = rodZ), 'leverM'(z = barZ).
 */
export function floatLever(length: number, o: FloatLeverOpts = {}): THREE.Group {
  const eyeR = o.eyeR ?? 0.08;
  const pinR = o.pinR ?? 0.04;
  const half = o.barHalf ?? 0.04;
  const thick = o.thick ?? 0.06;
  const back = o.endPinBack ?? -0.11;
  const front = o.midPinFront ?? 0.12;
  const rodZ = o.rodZ ?? -0.07;
  const barZ = o.barZ ?? 0.07;
  const h = length / 2;
  const g = new THREE.Group();
  g.add(mesh(extrude(stadiumShape(-h, 0, h, 0, half), thick * 0.8, 0.006), castIron({ roughness: 0.5 })));
  for (const x of [-h, 0, h]) g.add(meshAt(cylZ(eyeR, -thick / 2, thick / 2, 0.006, 36), castIron({ roughness: 0.5 }), x, 0, 0));
  for (const x of [-h, h]) {
    g.add(meshAt(cylZ(pinR, back, thick / 2 + 0.02, 0.006), steel(), x, 0, 0));
    g.add(meshAt(new THREE.CylinderGeometry(pinR * 0.5, pinR * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), x, 0, thick / 2 + 0.022));
  }
  g.add(meshAt(cylZ(pinR, -thick / 2 - 0.01, front, 0.006), steel(), 0, 0, 0));
  g.add(meshAt(new THREE.CylinderGeometry(pinR * 0.5, pinR * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), 0, 0, front + 0.002));
  const mk = (name: string, x: number, z: number): void => {
    const p = new THREE.Object3D();
    p.name = name;
    p.position.set(x, 0, z);
    g.add(markPin(p));
  };
  mk('leverA', h, rodZ);
  mk('leverB', -h, rodZ);
  mk('leverM', 0, barZ);
  setMM(g, { kind: 'link', length, a: [-h, 0, 0], b: [h, 0, 0] });
  return g;
}

export interface EyeBarOpts {
  /** 눈 바깥 반지름. 기본 0.085 */
  eyeR?: number;
  /** 눈 구멍 반지름. 기본 0.041 */
  holeR?: number;
  /** 둥근 막대 반지름. 기본 0.045 */
  rodR?: number;
  /** 눈 두께(z). 기본 0.06 */
  thick?: number;
}

/**
 * 눈 달린 미끄럼 막대(122번): 원점 = 눈 구멍 중심, 로컬 +X 로 length 까지. 눈 → 납작한 목 → 어깨 → 둥근 막대(판화 모양).
 * 핀 표식 child 'barEye'(원점).
 */
export function eyeBar(length: number, o: EyeBarOpts = {}): THREE.Group {
  const eyeR = o.eyeR ?? 0.085;
  const holeR = o.holeR ?? 0.041;
  const rodR = o.rodR ?? 0.045;
  const thick = o.thick ?? 0.06;
  const g = new THREE.Group();
  g.add(mesh(tubeZ(holeR, eyeR, -thick / 2, thick / 2, 0.006, 40), steel()));
  // 납작한 목(눈 가장자리 → 어깨)
  const neck0 = eyeR * 0.9;
  const neck1 = eyeR + 0.14;
  g.add(meshAt(new THREE.BoxGeometry(neck1 - neck0, eyeR * 1.3, thick * 0.9), steel(), (neck0 + neck1) / 2, 0, 0));
  // 어깨(굵은 고리) + 둥근 막대
  g.add(mesh(cylX(rodR * 1.35, neck1 - 0.01, neck1 + 0.05, 0.008), darkSteel()));
  g.add(mesh(cylX(rodR, neck1, length, 0.008), steel()));
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.012, 0.006), paint(MARK), neck1 + 0.2, 0, rodR + 0.001));
  const p = new THREE.Object3D();
  p.name = 'barEye';
  g.add(markPin(p));
  setMM(g, { kind: 'rod', r: rodR, a: [0, 0, 0], b: [length, 0, 0], length });
  return g;
}

// ═══════════════════════════ 123 크랭크 대용 이중 랙 ═══════════════════════════

const TAN20 = Math.tan(20 * DEG);

/** 123번 치수 */
export const K123 = {
  /** 부채꼴의 온 바퀴 잇수·모듈(피치 반지름 R = zs·m/2) */
  zs: 32,
  m: 0.026,
  /** 부채꼴에 난 이 수(가운데가 이골 — 짝수) */
  N: 12,
  /** 랙의 한쪽 이 수(= N + 1, 가운데 이가 랙 한가운데) */
  rackTeeth: 13,
  /** 랙 중심선에서 피치선까지 */
  w: 0.104,
  /** 직선 구간의 반각(rad): |psi| ≤ a 동안 랙은 부채꼴 피치 속도로 곧게 간다 */
  a: 83 * DEG,
  /** 부채꼴 축에 붙은 평기어·가운데 기어 잇수(같은 모듈, 1:1) */
  gz: 20,
  /** 걸림쇠(가운데 기어의 굽은 조각)의 가운데 반지름·반두께·펼친 각(도) */
  catchR: 0.075,
  catchHalf: 0.02,
  catchSpan: 70,
  /** 멈춤쇠(랙 뒷면 마름모)의 반대각선 */
  stopHalf: 0.03,
  /** 사점에서 멈춤쇠 꼭짓점과 걸림쇠 사이 틈 */
  stopGap: 0.004,
  /** 안내 홈 반폭, 안내 블록 반높이 */
  slotHalf: 0.039,
  blockHalf: 0.06,
  /** 기구 중심(가운데 기어 축) */
  C: [0, 1.7] as V2,
  /** 층: 랙·부채꼴 평면 z, 평기어·가운데 기어 평면 z, 폭 */
  zRack: 0.1,
  zGear: -0.14,
  width: 0.1,
  /** 평기어·가운데 기어의 폭, 축 반지름(= 평기어 구멍) */
  gearWidth: 0.08,
  shaftR: 0.036
} as const;

/** 부채꼴 피치 반지름 */
export const K123_R: number = (K123.zs * K123.m) / 2;
/** 부채꼴 축 ↔ 가운데 축 거리(= R + w = 평기어 두 개의 피치 반지름 합) */
export const K123_D: number = K123_R + K123.w;

/**
 * 123번 랙의 세로 변위(가운데 기준, 위가 +). psi = 부채꼴의 시계 방향 누적각(psi = 0 에서 왼쪽 부채꼴이 물림 한가운데).
 * |psi| ≤ a: −R·psi(왼쪽 부채꼴이 물려 랙이 내려감) → 사점 구간(a ~ π−a): 등가속으로 되돌아섬(변위 차 0)
 * → |psi − π| ≤ a: 오른쪽 부채꼴이 물려 랙이 올라감 → 위 사점. 주기 2π, 누적 오차 없음.
 */
export function rackLift123(psi: number, R: number = K123_R, a: number = K123.a): number {
  let p = psi % TAU;
  if (p > Math.PI) p -= TAU;
  if (p <= -Math.PI) p += TAU;
  const g = Math.PI - 2 * a;
  if (Math.abs(p) <= a) return -R * p;
  if (p > a && p < Math.PI - a) {
    const t = p - a;
    return -R * a - R * t + (R * t * t) / g;
  }
  if (p < -a && p > -Math.PI + a) {
    const t = p + Math.PI - a;
    return R * a + R * t - (R * t * t) / g;
  }
  const q = p > 0 ? p - Math.PI : p + Math.PI;
  return R * q;
}
/** 사점에서의 랙 변위 크기(= R·a + R·(π − 2a)/4) */
export function rackDead123(R: number = K123_R, a: number = K123.a): number {
  return R * a + (R * (Math.PI - 2 * a)) / 4;
}
/** 멈춤쇠 중심의 랙 로컬 |y| — 사점에서 걸림쇠 바깥면 바로 위(틈 stopGap)에 온다 */
export const K123_STOP_Y: number = rackDead123() + K123.catchR + K123.catchHalf + K123.stopGap + K123.stopHalf;
/** 안내 홈의 반길이(랙 로컬) */
export const K123_SLOT_HALF: number = rackDead123() + K123.blockHalf + 0.006;

/**
 * 이 부채꼴 윤곽(반시계). 로컬 +X 가 이 난 호의 한가운데(짝수면 이골, 홀수면 이). 호의 양 끝에서 현(弦)으로 닫고 축 둘레는 허브 원이 불룩 나온다.
 * zs = 온 바퀴 잇수, N = 난 이 수, hubR = 허브 반지름.
 */
export function sectorOutline123(zs: number = K123.zs, m: number = K123.m, N: number = K123.N, hubR = 0.085): V2[] {
  const rp = (zs * m) / 2;
  const ra = rp + m;
  const rf = rp - 1.25 * m;
  const step = TAU / zs;
  const full = involuteOutline(zs, ra, rf, -((N - 1) / 2) * step);
  const per = full.length / zs;
  const out: V2[] = full.slice(0, Math.round(per * N));
  const half = (N / 2) * step;
  // 호 끝(+half) → 허브 원에 접하는 곧은 변 → 허브 뒤쪽 원호 → 곧은 변 → 호 시작(−half)
  out.push([rf * Math.cos(half), rf * Math.sin(half)]);
  const tau = half + Math.acos(hubR / rf);
  for (let i = 0; i <= 12; i++) {
    const t = tau + ((TAU - 2 * tau) * i) / 12;
    out.push([hubR * Math.cos(t), hubR * Math.sin(t)]);
  }
  out.push([rf * Math.cos(half), -rf * Math.sin(half)]);
  return out;
}

export interface RackShape {
  /** 이 난 구간 끝(마지막 이뿌리)의 |y| */
  toothEnd: number;
  /** 어깨(턱)의 |y| 범위 */
  collar0: number;
  collar1: number;
  /** 자루 끝의 |y| */
  end: number;
}

/** 랙 모양 치수(로컬 |y|) — 어깨는 멈춤쇠를 덮을 만큼 */
export function rackShape123(m: number = K123.m, teeth: number = K123.rackTeeth): RackShape {
  const p = Math.PI * m;
  const n = (teeth - 1) / 2;
  const rh = 0.24 * p + 1.25 * m * TAN20;
  const toothEnd = n * p + rh;
  const collar0 = toothEnd + 0.3 * m;
  const collar1 = Math.max(collar0 + 0.08, K123_STOP_Y + K123.stopHalf + 0.012);
  return { toothEnd, collar0, collar1, end: collar1 + 0.05 };
}

/**
 * 양쪽 이 랙 윤곽(반시계, 로컬: 원점 = 한가운데, 세로 = Y). 피치선 x = ±w, 이는 바깥으로. 이 k(−n…n)의 중심 y = k·πm (좌우 같은 높이).
 * 압력각 20° 사다리꼴 이(이끝 모서리 0.2m 깎음), 이뿌리 = 피치선 안쪽 1.25m. 양 끝에 턱(넓은 어깨, 길이 0.07) → 몸통 폭 구간 → 자루.
 */
export function rackOutline123(m: number = K123.m, w: number = K123.w, teeth: number = K123.rackTeeth, stemHalf = 0.04): V2[] {
  const p = Math.PI * m;
  const n = (teeth - 1) / 2;
  const t2 = 0.24 * p; // 피치선 반두께(백래시 4 %)
  const th = t2 - m * TAN20;
  const rh = t2 + 1.25 * m * TAN20;
  const xt = w + m;
  const xb = w - 1.25 * m;
  const ch = 0.2 * m;
  const S = rackShape123(m, teeth);
  const wc = xt;
  const cc = 0.025;
  const yc = S.collar0 + 0.07; // 턱(넓은 어깨)의 바깥 끝. 그 뒤 collar1 까지는 몸통 폭(홈 끝·멈춤쇠 자리)
  const right: V2[] = [
    [stemHalf, -S.end],
    [stemHalf, -S.collar1],
    [xb, -S.collar1],
    [xb, -yc],
    [wc - cc, -yc],
    [wc, -yc + cc],
    [wc, -S.collar0],
    [xb, -S.collar0]
  ];
  for (let k = -n; k <= n; k++) {
    const y = k * p;
    right.push([xb, y - rh], [xt - ch, y - th - ch * TAN20], [xt, y - th + ch], [xt, y + th - ch], [xt - ch, y + th + ch * TAN20], [xb, y + rh]);
  }
  right.push([xb, S.collar0], [wc, S.collar0], [wc, yc - cc], [wc - cc, yc], [xb, yc], [xb, S.collar1], [stemHalf, S.collar1], [stemHalf, S.end]);
  const left: V2[] = right.map(([x, y]) => [-x, y] as V2).reverse();
  return [...right, ...left];
}

/** 123번의 회전각들. psi = theta − 1.6 (t = 1 에 판화 자세: 왼쪽 부채꼴 물림 한가운데, 걸림쇠 3시) */
export function angles123(theta: number): { psi: number; sector: number; spurL: number; centre: number; spurR: number; catchA: number; lift: number } {
  const psi = theta - 1.6;
  const cL: V2 = [K123.C[0] - K123_D, K123.C[1]];
  const cR: V2 = [K123.C[0] + K123_D, K123.C[1]];
  const spurL = -psi;
  const centre = meshAngle(cL, K123.gz, spurL, K123.C, K123.gz);
  const spurR = meshAngle(K123.C, K123.gz, centre, cR, K123.gz);
  return { psi, sector: -psi, spurL, centre, spurR, catchA: psi, lift: rackLift123(psi) };
}

export interface ToothSectorOpts {
  width?: number;
  /** 축 구멍 반지름. 기본 0.037 */
  bore?: number;
  /** 허브 반지름. 기본 0.085 */
  hubR?: number;
  /** 뒤(−z)로 뻗는 허브 소매 길이 — 같은 축의 평기어 앞면까지 이어 한 몸으로 보이게. 기본 0 */
  sleeve?: number;
  driver?: boolean;
}

/**
 * 이 부채꼴(123번): 회전축 = 로컬 Z, 로컬 +X 가 이 난 호의 한가운데. 살 셋(가운데·양 가장자리) 사이에 창 둘(판화 모양).
 * userData.outline = 윤곽(침범 검사용), userData.mm.kind = 'gear'(teeth = 온 바퀴 잇수, count = 난 이 수).
 */
export function toothSector(zs: number = K123.zs, m: number = K123.m, N: number = K123.N, o: ToothSectorOpts = {}): THREE.Group {
  const width = o.width ?? K123.width;
  const bore = o.bore ?? 0.037;
  const hubR = o.hubR ?? 0.085;
  const rp = (zs * m) / 2;
  const ra = rp + m;
  const rf = rp - 1.25 * m;
  const outline = sectorOutline123(zs, m, N, hubR);
  const half = (N / 2) * (TAU / zs);
  // 창 둘: 가운데 살(반폭 0.03)과 곧은 변 쪽 살(폭 0.055) 사이, 반지름 hubR + 0.04 ~ rf − 0.055
  const r0 = hubR + 0.04;
  const r1 = rf - 0.055;
  const tau = half + Math.acos(hubR / rf);
  const hIn = hubR - 0.055; // 곧은 변에서 0.055 안쪽 평행선이 원점에서 떨어진 거리
  const aLo = (r: number): number => Math.asin(0.03 / r);
  const aHi = (r: number): number => tau - Math.acos(hIn / r);
  const win = (sgn: 1 | -1): V2[] => {
    const pts: V2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = aLo(r1) + ((aHi(r1) - aLo(r1)) * i) / 14;
      pts.push([r1 * Math.cos(t), sgn * r1 * Math.sin(t)]);
    }
    for (let i = 1; i < 6; i++) {
      const r = r1 + ((r0 - r1) * i) / 6;
      pts.push([r * Math.cos(aHi(r)), sgn * r * Math.sin(aHi(r))]);
    }
    for (let i = 0; i <= 6; i++) {
      const t = aHi(r0) + ((aLo(r0) - aHi(r0)) * i) / 6;
      pts.push([r0 * Math.cos(t), sgn * r0 * Math.sin(t)]);
    }
    return pts;
  };
  const c = Math.min(m * 0.3, width * 0.12);
  const layers: LoftLayer[] = [
    { z: -width / 2, s: (ra - c) / ra, hs: 1 },
    { z: -width / 2 + c, s: 1, hs: 1 },
    { z: width / 2 - c, s: 1, hs: 1 },
    { z: width / 2, s: (ra - c) / ra, hs: 1 }
  ];
  const g = new THREE.Group();
  const body = o.driver === true ? bronze({ roughness: 0.34 }) : brass();
  g.add(mesh(loft(outline, [circlePts(bore, 32), win(1), win(-1)], layers), body));
  g.add(mesh(tubeZ(bore, bore + 0.03, -width / 2 - 0.012, width / 2 + 0.016, 0.006, 40), darkSteel()));
  const sleeve = o.sleeve ?? 0;
  if (sleeve > 0) g.add(mesh(tubeZ(bore, bore + 0.022, -width / 2 - sleeve, -width / 2 - 0.01, 0.004, 40), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.08, 0.012, 0.008), paint(MARK), (r0 + r1) / 2, 0, width / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'toothSector', teeth: zs, module: m, internal: false, rp, ra, rf, width, axis: 'z', count: N });
  return g;
}

export interface DoubleRackOpts {
  width?: number;
  /** 자루 반폭. 기본 0.04 */
  stemHalf?: number;
}

/**
 * 양쪽 이 랙(123번): 원점 = 한가운데, 세로 = 로컬 Y, 두께 가운데 z = 0. 가운데에 긴 안내 홈(반폭 K123.slotHalf, 반길이 K123_SLOT_HALF — 판화에 없음),
 * 뒷면(−z)에 마름모 멈춤쇠 2개(y = ±K123_STOP_Y, 뒤로 0.07 — 판화의 점선 마름모). 위 자루는 네모, 아래 자루는 둥글다(판화).
 * userData.outline = 바깥 윤곽(침범 검사용). 멈춤쇠 표식 child 'stopTop'·'stopBottom'.
 */
export function doubleRack(o: DoubleRackOpts = {}): THREE.Group {
  const width = o.width ?? K123.width;
  const stemHalf = o.stemHalf ?? 0.04;
  const outline = rackOutline123(K123.m, K123.w, K123.rackTeeth, stemHalf);
  const S = rackShape123();
  const g = new THREE.Group();
  // 메시는 아래 자루를 뺀 윤곽으로(아래 자루는 둥근 막대로 따로 만든다 — 판화)
  const meshPts: V2[] = [];
  for (const [x, y] of outline) {
    const q: V2 = [x, Math.max(y, -S.collar1)];
    const last = meshPts[meshPts.length - 1];
    if (last === undefined || Math.hypot(last[0] - q[0], last[1] - q[1]) > 1e-9) meshPts.push(q);
  }
  const shape = shapeFrom(meshPts);
  const sh = K123.slotHalf;
  const sl = K123_SLOT_HALF;
  const slot: V2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = (Math.PI * i) / 12;
    slot.push([sh * Math.cos(t), sl - sh + sh * Math.sin(t)]);
  }
  for (let i = 0; i <= 12; i++) {
    const t = Math.PI + (Math.PI * i) / 12;
    slot.push([sh * Math.cos(t), -sl + sh + sh * Math.sin(t)]);
  }
  shape.holes.push(pathFrom(slot));
  g.add(mesh(extrude(shape, width, 0.005, 8), steel({ roughness: 0.4 })));
  // 아래 자루: 둥근 막대(판화)
  const rodGeo = lathe(rodProfile(stemHalf, -S.end - 0.012, -S.collar1 + 0.01, 0.008, 0), 28);
  g.add(mesh(rodGeo, steel({ roughness: 0.4 })));
  // 멈춤쇠(뒷면 마름모)
  const d = K123.stopHalf;
  for (const sy of [1, -1] as const) {
    const st = mesh(extrude(shapeFrom([[d, 0], [0, d], [-d, 0], [0, -d]]), 0.07, 0.004), darkSteel());
    st.position.set(0, sy * K123_STOP_Y, -width / 2 - 0.035);
    st.name = sy > 0 ? 'stopTop' : 'stopBottom';
    g.add(st);
  }
  // 표시줄(이 가운데 높이)
  g.add(meshAt(new THREE.BoxGeometry(0.02, 0.01, 0.006), paint(MARK), K123.w - 0.045, 0, width / 2 + 0.002));
  g.userData.outline = outline;
  setMM(g, { kind: 'rack', module: K123.m, teeth: K123.rackTeeth, pitchHalf: K123.w, width, slotHalf: sh, slotLen: sl, stopY: K123_STOP_Y });
  return g;
}

/** 걸림쇠 윤곽(반시계, 로컬 +X 가 한가운데): 가운데 반지름 catchR 의 굽은 띠, 끝은 둥글다 */
export function catchOutline123(): V2[] {
  const r = K123.catchR;
  const hw = K123.catchHalf;
  const sp = (K123.catchSpan / 2) * DEG;
  const pts: V2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = -sp + (2 * sp * i) / 16;
    pts.push([(r + hw) * Math.cos(t), (r + hw) * Math.sin(t)]);
  }
  for (let i = 1; i < 8; i++) {
    const t = sp + (Math.PI * i) / 8;
    pts.push([r * Math.cos(sp) + hw * Math.cos(t), r * Math.sin(sp) + hw * Math.sin(t)]);
  }
  for (let i = 0; i <= 16; i++) {
    const t = sp - (2 * sp * i) / 16;
    pts.push([(r - hw) * Math.cos(t), (r - hw) * Math.sin(t)]);
  }
  for (let i = 1; i < 8; i++) {
    const t = -sp + Math.PI + (Math.PI * i) / 8;
    pts.push([r * Math.cos(-sp) + hw * Math.cos(t), r * Math.sin(-sp) + hw * Math.sin(t)]);
  }
  return pts;
}

/**
 * 걸림쇠(123번, 가운데 기어 앞면의 굽은 조각 — 판화의 점선 호): 원점 = 가운데 축, 로컬 +X 가 조각 한가운데. 로컬 z0 ~ z1.
 * 가운데 반지름 K123.catchR, 반두께 K123.catchHalf, 펼친 각 K123.catchSpan°. 끝은 둥글다.
 */
export function catchPiece(z0: number, z1: number): THREE.Group {
  const r = K123.catchR;
  const hw = K123.catchHalf;
  const pts = catchOutline123();
  const g = new THREE.Group();
  g.add(meshAt(extrude(shapeFrom(pts), z1 - z0, 0.004, 8), darkSteel(), 0, 0, (z0 + z1) / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.02, 0.012, 0.006), paint(MARK), r, 0, z1 + 0.001));
  setMM(g, { kind: 'catch', r, half: hw, spanDeg: K123.catchSpan });
  return g;
}

/**
 * 가운데 안내 축(123번, 고정 — 판화에 없는 안내): 그룹 원점 = (x, y, 0). 뒤판 보스에서 나와 가운데 기어(구멍 0.036)를 꿰고,
 * 앞 끝에 랙의 긴 홈에 끼는 안내 블록(반폭 K123.slotHalf − 0.003, 반높이 K123.blockHalf, 세계 z = zRack ± width/2)과 앞 덮개판이 달렸다.
 */
export function guideStud(x: number, y: number, zRack: number = K123.zRack, width: number = K123.width): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const back = STAGE.backZ;
  const r = K123.shaftR;
  g.add(mesh(cylZ(r, back, zRack + width / 2 + 0.03, 0.006, 32), steel()));
  g.add(mesh(cylZ(r * 2.2, back, back + 0.09, 0.012, 40), darkSteel()));
  const bw = K123.slotHalf - 0.003;
  const bh = K123.blockHalf;
  const blk = extrude(stadiumShape(0, -(bh - bw), 0, bh - bw, bw), width + 0.004, 0.004, 12);
  g.add(meshAt(blk, bronze({ roughness: 0.4 }), 0, 0, zRack));
  // 앞 덮개판(랙이 앞으로 빠지지 않게) — 홈보다 넓다
  const cap = extrude(stadiumShape(0, -0.03, 0, 0.03, K123.slotHalf + 0.025), 0.022, 0.004, 12);
  g.add(meshAt(cap, darkSteel(), 0, 0, zRack + width / 2 + 0.013));
  setMM(g, { kind: 'guide', r, blockHalfW: bw, blockHalfH: bh });
  return g;
}

// ═══════════════════════════ 124 활비비(피들 드릴) ═══════════════════════════

/** 124번 치수 */
export const K124 = {
  /** 시위 방향(도) — 판화: 왼쪽 아래 → 오른쪽 위 */
  dirDeg: 48.9,
  /** 시위의 평면 길이, 판화 자세에서 아래 끝 ~ 접점 길이 */
  Ls: 2.3,
  low: 1.29,
  /** 활 왕복의 진폭(시위 방향) */
  amp: 0.6,
  /** 실패 몸통 반지름·폭, 턱 반지름·두께 */
  r: 0.2,
  width: 0.12,
  flangeR: 0.25,
  flangeT: 0.02,
  /** 시위 반지름, 한 바퀴 감기며 축방향으로 가는 거리 */
  rho: 0.012,
  pitch: 0.04,
  /** 시위가 실패에 닿는 접점(고정) */
  T: [0.05, 1.8] as V2,
  /** 실패 가운데 평면의 z */
  zS: 0.36,
  /** 활 휨(시위 가운데 ~ 활대 가운데) */
  sag: 0.4
} as const;

const U124: V2 = [Math.cos(K124.dirDeg * DEG), Math.sin(K124.dirDeg * DEG)];
/** 실패(드릴 축) 중심 — 시위의 오른쪽 아래 */
export const K124_C: V2 = [K124.T[0] + U124[1] * (K124.r + K124.rho), K124.T[1] - U124[0] * (K124.r + K124.rho)];
/** 활의 두 시위 끝 사이 거리(z 차 pitch 포함) */
export const K124_CHORD: number = Math.hypot(K124.Ls, K124.pitch);

/** 124번 운동식: s = 활의 시위 방향 변위(+ = 오른쪽 위), phi = 드릴 축 회전각(s > 0 이면 시계 = 음). t = 1 에 판화 자세(s = 0) */
export function fiddle124(theta: number): { s: number; phi: number } {
  const s = K124.amp * Math.sin(theta - 1.6);
  return { s, phi: -s / (K124.r + K124.rho) };
}

/** 시위의 두 끝(세계 좌표): a = 아래 끝(z = zS − pitch/2), b = 위 끝(z = zS + pitch/2) */
export function fiddleEnds124(s: number): { a: THREE.Vector3; b: THREE.Vector3 } {
  const la = -K124.low + s;
  const lb = K124.Ls - K124.low + s;
  return {
    a: new THREE.Vector3(K124.T[0] + U124[0] * la, K124.T[1] + U124[1] * la, K124.zS - K124.pitch / 2),
    b: new THREE.Vector3(K124.T[0] + U124[0] * lb, K124.T[1] + U124[1] * lb, K124.zS + K124.pitch / 2)
  };
}

/**
 * 시위 경로(세계 좌표): 아래 끝 → 접점 → 실패를 시계 방향으로 한 바퀴(360°, 나선으로 z 가 pitch 만큼 앞으로) → 접점 → 위 끝.
 * 호 점에는 검사 표식(tagArc)이 달려 Rope.setPath 가 감긴 각을 읽는다. 점 개수는 항상 같다.
 */
export function fiddlePath124(s: number, seg = 48): THREE.Vector3[] {
  const { a, b } = fiddleEnds124(s);
  const rr = K124.r + K124.rho;
  const a0 = Math.atan2(K124.T[1] - K124_C[1], K124.T[0] - K124_C[0]);
  const arc: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = a0 - (TAU * i) / seg;
    arc.push(new THREE.Vector3(K124_C[0] + rr * Math.cos(t), K124_C[1] + rr * Math.sin(t), K124.zS - K124.pitch / 2 + (K124.pitch * i) / seg));
  }
  tagArc(arc, { c: [K124_C[0], K124_C[1], K124.zS], r: rr, ccw: false, axis: [0, 0, 1], wheel: 'spool', src: 'fiddlePath124' });
  return [a, ...arc, b];
}

export interface BowOpts {
  /** 활대 반지름. 기본 0.026 */
  r?: number;
  /** 시위 끝 밖으로 더 나간 활대 길이. 기본 0.09 */
  ext?: number;
}

/**
 * 활(124번): 로컬 원점 = 시위 아래 끝 매듭, 로컬 +X 로 chord 떨어진 곳이 위 끝 매듭. 활대는 +Y 쪽으로 sag 만큼 휜 원호(나무), 양 끝에 감은 끈.
 * 줄 끝 자리 표식 child 'bowEndA'(원점)·'bowEndB'((chord, 0, 0)). 시위 자체는 Rope 로 따로 그린다.
 */
export function bow(chord: number = K124_CHORD, sag: number = K124.sag, o: BowOpts = {}): THREE.Group {
  const r = o.r ?? 0.026;
  const ext = o.ext ?? 0.09;
  const Rc = (chord * chord) / 4 / (2 * sag) + sag / 2;
  const cy = sag - Rc;
  const f0 = Math.asin(chord / 2 / Rc);
  const fe = f0 + ext / Rc;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const f = -fe + (2 * fe * i) / 40; // 0 = 꼭대기, −: 원점 쪽
    pts.push(new THREE.Vector3(chord / 2 + Rc * Math.sin(f), cy + Rc * Math.cos(f), 0));
  }
  const g = new THREE.Group();
  const stick = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 12, false);
  g.add(mesh(stick, wood()));
  for (const p of [pts[0]!, pts[pts.length - 1]!]) g.add(meshAt(new THREE.SphereGeometry(r * 1.05, 14, 10), wood(), p.x, p.y, 0));
  // 감은 끈(시위 끝 매듭) — 활대를 따라 고리 4개
  const cord = rubber().clone();
  cord.color.set(0x5a4326);
  for (const sgn of [-1, 1] as const) {
    for (let k = 0; k < 4; k++) {
      const f = sgn * (f0 + (k - 1.5) * (0.018 / Rc));
      const ring = mesh(new THREE.TorusGeometry(r + 0.006, 0.008, 8, 20), cord);
      ring.position.set(chord / 2 + Rc * Math.sin(f), cy + Rc * Math.cos(f), 0);
      ring.rotation.set(0, Math.PI / 2, 0);
      ring.rotateX(f); // 고리 축을 활대 접선으로
      g.add(ring);
    }
  }
  const ea = new THREE.Object3D();
  ea.name = 'bowEndA';
  g.add(markAnchor(ea, [0, 0, 0], { of: 'bow' }));
  const eb = new THREE.Object3D();
  eb.name = 'bowEndB';
  eb.position.set(chord, 0, 0);
  g.add(markAnchor(eb, [0, 0, 0], { of: 'bow' }));
  setMM(g, { kind: 'bow', chord, sag, r });
  return g;
}

/** 활을 변위 s 의 자리에 놓는다: 원점 = 시위 아래 끝, 로컬 +X = 위 끝 방향, 로컬 +Y = 시위의 왼쪽 위(활대가 휜 쪽) */
export function poseBow124(g: THREE.Object3D, s: number): void {
  const { a, b } = fiddleEnds124(s);
  const ex = b.clone().sub(a).normalize();
  const ez0 = new THREE.Vector3(0, 0, 1);
  const ey = ez0.clone().cross(ex).normalize();
  const ez = ex.clone().cross(ey).normalize();
  g.position.copy(a);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
}

export interface DrillSpindleOpts {
  /** 축 반지름. 기본 0.04 */
  shaftR?: number;
  /** 축 뒤 끝·척 앞 끝·날 끝의 로컬 z. 기본 −0.64, 0.28, 0.4 */
  back?: number;
  chuck?: number;
  tip?: number;
}

/**
 * 드릴 축(124번, 도는 것): 회전축 = 로컬 Z, 원점 = 실패 가운데. 실패(몸통 반지름 K124.r, 납작 림 + 양쪽 턱) + 축 + 척 + 납작 날.
 * 실패 child(name 'spool')에 userData.mm = { kind:'wheel', rim:'flat', r, bottom, outer, width, span }.
 */
export function drillSpindle(o: DrillSpindleOpts = {}): THREE.Group {
  const shaftR = o.shaftR ?? 0.04;
  const zb = o.back ?? -0.64;
  const zc = o.chuck ?? 0.28;
  const zt = o.tip ?? 0.4;
  const h = K124.width / 2;
  const g = new THREE.Group();
  g.add(mesh(cylZ(shaftR, zb, zc - 0.1, 0.006, 28), steel()));
  // 실패: 몸통 + 턱
  const spool = new THREE.Group();
  spool.name = 'spool';
  spool.add(mesh(tubeZ(shaftR, K124.r, -h, h, 0.004, 64), wood(0x8a5a2e)));
  for (const sz of [-1, 1]) spool.add(meshAt(tubeZ(shaftR, K124.flangeR, -K124.flangeT / 2, K124.flangeT / 2, 0.004, 64), wood(0x6f4522), 0, 0, sz * (h + K124.flangeT / 2)));
  spool.add(meshAt(new THREE.BoxGeometry(0.1, 0.02, 0.006), paint(MARK), (shaftR + K124.flangeR) / 2 + 0.02, 0, h + K124.flangeT + 0.002));
  setMM(spool, { kind: 'wheel', fn: 'drillSpindle', axis: 'z', r: K124.r, bottom: K124.r, outer: K124.flangeR, width: K124.width, span: [-h, h], rim: 'flat' });
  g.add(spool);
  // 척(굵은 고리) + 납작 날(도는 것이 보이게)
  g.add(mesh(cylZ(shaftR * 1.7, zc - 0.11, zc, 0.01, 28), darkSteel()));
  const blade: V2[] = [[-0.035, 0], [0.035, 0], [0.035, zt - zc - 0.04], [0, zt - zc], [-0.035, zt - zc - 0.04]];
  const bg = extrude(shapeFrom(blade), 0.012, 0.002);
  bg.rotateX(Math.PI / 2); // (x, y, z) → (x, −z, y): 날 길이가 +Z
  g.add(meshAt(bg, steel({ roughness: 0.25 }), 0, 0, zc));
  setMM(g, { kind: 'spindle', axis: 'z', r: shaftR });
  return g;
}

/**
 * 드릴 축받이(124번, 고정 — 판화에 없음): 그룹 원점 = (x, y, 0)(축 중심). 뒤판 보스 + 뒤판에서 나온 팔 끝의 고리(세계 z = zRing, 구멍이 축 방향 = Z).
 * 팔은 축 아래 0.17 에서 나와 축에 닿지 않는다.
 */
export function spindleBearing(x: number, y: number, zRing = 0.1, bore = 0.045): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const back = STAGE.backZ;
  const body = castIron();
  g.add(mesh(tubeZ(bore, bore + 0.06, back, back + 0.1, 0.01, 40), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.14, 0.03), body, 0, -0.17, back + 0.015));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.07, zRing + 0.04 - back), body, 0, -0.17, back + (zRing + 0.04 - back) / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.17 - bore - 0.03, 0.07), body, 0, -(0.17 + bore + 0.03) / 2 - 0.0, zRing));
  g.add(mesh(tubeZ(bore, bore + 0.045, zRing - 0.04, zRing + 0.04, 0.008, 40), darkSteel()));
  setMM(g, { kind: 'bearing', axis: 'z', bore });
  return g;
}
