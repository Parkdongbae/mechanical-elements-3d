// 71·72·73번 전용 키트 — 안쪽 테 잠금 간헐 회전(071), 틸트 해머(072), 스프링 래칫 간헐 회전(073)
// 접촉(피동 전진량·해머 들림·스프링 휨)은 아래 윤곽 다각형으로 푼다: solvePush71 · solveLift72 · solve73.
// 풀이는 무거워서(073 은 10초쯤) 실행 때는 쓰지 않고, 그 결과를 구운 표(BAKED 구역)를 쓴다.
// 치수를 바꾸면 `node shots/_verify/s071bake.mjs --write` 로 표를 다시 굽는다(인자 없이 돌리면 표와 풀이가 같은지 확인만).
// 같은 윤곽을 userData.outline(s) 로 남기므로 autocheck 의 다각형 침범 검사와 shots/_verify/s071~s073.mjs 가 같은 모양을 잰다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, ghost, paint, steel } from '../../models/materials';
import { TAU, extrude, lathe, mesh, rodProfile, shapeFrom, type V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const D2R = Math.PI / 180;
const MARK = 0xf2b619;

// ───────────────────────── 공용 도우미 ─────────────────────────

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** z0 ~ z1 의 Z 축 원기둥 */
function zRod(r: number, z0: number, z1: number, mat: THREE.Material, x = 0, y = 0): THREE.Mesh {
  const geo = lathe(rodProfile(r, 0, z1 - z0, Math.min(0.01, r * 0.3), Math.min(0.012, r * 0.3)), 28);
  geo.rotateX(Math.PI / 2);
  return meshAt(geo, mat, x, y, z0);
}

/** 다각형을 z0 ~ z1 로 압출 */
function slab(pts: V2[], z0: number, z1: number, mat: THREE.Material, bevel = 0.006): THREE.Mesh {
  return meshAt(extrude(shapeFrom(pts), z1 - z0, Math.min(bevel, (z1 - z0) * 0.2)), mat, 0, 0, (z0 + z1) / 2);
}

function rot2(p: V2, a: number): V2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** 점과 닫힌 다각형의 부호 있는 거리: 바깥 +, 안 − */
export function polyDepth71(p: V2, poly: V2[]): number {
  let m = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    m = Math.min(m, segDist(p, pj, pi));
    if (pi[1] > p[1] !== pj[1] > p[1] && p[0] < ((pj[0] - pi[0]) * (p[1] - pi[1])) / (pj[1] - pi[1]) + pi[0]) inside = !inside;
  }
  return inside ? -m : m;
}

/** 변을 step 이하로 잘게 나눈 점열 */
function densify(poly: V2[], step: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** 단조 조건 ok(x) 가 처음 참이 되는 x (lo 에서 거짓, hi 에서 참) */
function firstTrue(lo: number, hi: number, ok: (x: number) => boolean, iter = 26): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < iter; i++) {
    const m = (a + b) / 2;
    if (ok(m)) b = m;
    else a = m;
  }
  return b;
}

function lerpAt(tab: readonly number[], u: number): number {
  if (u <= 0) return tab[0]!;
  if (u >= tab.length - 1) return tab[tab.length - 1]!;
  const i = Math.floor(u);
  return tab[i]! + (tab[i + 1]! - tab[i]!) * (u - i);
}

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// ═════════════════════════ 071: 안쪽 테 잠금 간헐 회전 ═════════════════════════
// 판화 읽기: 왼쪽 스터드 원판 C(스터드 10개), 오른쪽 구동 바퀴 B(반시계). B 의 테 **안쪽 면**(판화의 점선 원)에
// C 의 스터드 둘(중심선 ±36°)이 안에서 기대어 잠긴다(가운데 스터드 하나는 중심선 위, 테 안). 탭핏 A 가 가운데 스터드를 쳐서
// 아래로 밀면 아래 스터드가 **아래 틈**으로 테 밖으로 나가고, 위에서 새 스터드가 **위 틈**으로 들어온다.
// 탭핏 길이 = (±36° 스터드 중심 – B 중심 거리) − 스터드 반지름 → 밀린 스터드가 정확히 −36° 자리(테 안쪽 면에 닿는 자리)에서 놓인다.

const K71_RING = 0.9;
const K71_STUD = 0.06;
const K71_DIST = 1.36;
const K71_D36 = Math.sqrt(K71_DIST * K71_DIST + K71_RING * K71_RING - 2 * K71_DIST * K71_RING * Math.cos(36 * D2R));

/** 71번 치수(설계표 071). 각은 도. 틈 각은 B 로컬(탭핏 방향 = 0°, 반시계 +) */
export const K71 = {
  studs: 10,
  /** C 중심 → B 중심 거리(B 가 오른쪽) */
  dist: K71_DIST,
  ringR: K71_RING,
  studR: K71_STUD,
  plateC: 1.12,
  /** ±36° 스터드 중심에서 B 중심까지 = 0.8241 */
  d36: K71_D36,
  /** 테 안쪽 면 반지름 = d36 + 스터드 반지름 = 0.8841 (잠금 면) */
  rimIn: K71_D36 + K71_STUD,
  rimThick: 0.12,
  /** 테 바깥 반지름 = 앞판 반지름 */
  rimOut: K71_D36 + K71_STUD + 0.12,
  /** 탭핏 길이 = d36 − 스터드 반지름 = 0.7641 */
  tapLen: K71_D36 - K71_STUD,
  tipHalf: 0.03,
  baseHalf: 0.1,
  baseR: 0.12,
  /** 아래 틈(나가는 틈): 탭핏보다 앞(회전 방향 쪽) */
  notchLow: [22, 62] as readonly [number, number],
  /** 위 틈(들어오는 틈): 탭핏보다 뒤 */
  notchUp: [-83, -57] as readonly [number, number],
  /** 테·탭핏이 앞판 뒤로 뻗은 깊이 */
  depth: 0.195
} as const;

/** 탭핏 윤곽(방향 = 로컬 +X): 뿌리(반지름 baseR, 반폭 baseHalf) → 끝(반지름 len 의 호, 반폭 tipHalf) */
export function tappetOutline71(): V2[] {
  const k = K71;
  const beta = Math.asin(k.tipHalf / k.tapLen);
  const pts: V2[] = [[k.baseR, -k.baseHalf]];
  for (let i = 0; i <= 8; i++) {
    const b = -beta + (2 * beta * i) / 8;
    pts.push([k.tapLen * Math.cos(b), k.tapLen * Math.sin(b)]);
  }
  pts.push([k.baseR, k.baseHalf]);
  return pts;
}

/** 테 조각의 각 구간(도, B 로컬): [0] = 두 틈 사이의 가드 조각, [1] = 나머지 큰 테 */
export function rimPieces71(): [number, number][] {
  const k = K71;
  return [
    [k.notchUp[1], k.notchLow[0]],
    [k.notchLow[1], 360 + k.notchUp[0]]
  ];
}

function sectorOutline(r0: number, r1: number, a0Deg: number, a1Deg: number): V2[] {
  const n = Math.max(2, Math.ceil(a1Deg - a0Deg));
  return [...arcPts(0, 0, r1, a0Deg * D2R, a1Deg * D2R, n), ...arcPts(0, 0, r0, a1Deg * D2R, a0Deg * D2R, n)];
}

/** 스터드 k 의 중심(B 중심 기준 세계 방향). aDeg = C 의 시계방향 전진각 */
function stud71(k: number, aDeg: number): V2 {
  const al = (k * 36 - aDeg) * D2R;
  return [K71.ringR * Math.cos(al) - K71.dist, K71.ringR * Math.sin(al)];
}

const PUSH71_CHI0 = 162;
const PUSH71_CHI1 = 220;
const PUSH71_STEP = 0.25;

/** 풀이(굽기용): 탭핏 각 chi(도) 162 ~ 220 에서 C 의 전진각(0 ~ 36). 탭핏 다각형이 스터드 원을 뚫지 않는 가장 작은 전진 */
export function solvePush71(): number[] {
  const tap = tappetOutline71();
  const clear = (chi: number, a: number): number => {
    let m = Infinity;
    for (let k = -1; k <= 2; k++) m = Math.min(m, polyDepth71(rot2(stud71(k, a), -chi * D2R), tap) - K71.studR);
    return m;
  };
  const tab: number[] = [];
  let a = 0;
  for (let chi = PUSH71_CHI0; chi <= PUSH71_CHI1 + 1e-9; chi += PUSH71_STEP) {
    if (a < 36 && clear(chi, a) < -2e-4) {
      let hi = a;
      while (hi < 36 && clear(chi, hi) < 0) hi = Math.min(36, hi + 0.5);
      a = firstTrue(a, hi, (x) => clear(chi, x) >= 0);
    }
    tab.push(a);
  }
  const end = tab[tab.length - 1]!;
  return tab.map((v) => (end > 0 ? Math.min(36, (v * 36) / end) : v));
}

// BAKED71-BEGIN
const PUSH71: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0263, 0.1538, 0.281, 0.408, 0.5346, 0.6609, 0.7869,
  0.9127, 1.0382, 1.1635, 1.2885, 1.4133, 1.5379, 1.6622, 1.7864, 1.9104, 2.0342, 2.1578, 2.2813, 2.4047, 2.5279, 2.6509, 2.7739,
  2.8967, 3.0195, 3.1421, 3.2647, 3.3872, 3.5096, 3.632, 3.7543, 3.8766, 3.9989, 4.1211, 4.2433, 4.3655, 4.4878, 4.61, 4.7323,
  4.8546, 4.9769, 5.0993, 5.2217, 5.3442, 5.4668, 5.5894, 5.7122, 5.835, 5.958, 6.081, 6.2042, 6.3275, 6.451, 6.5746, 6.6984,
  6.8223, 6.9465, 7.0708, 7.1953, 7.32, 7.4449, 7.57, 7.6954, 7.821, 7.9468, 8.0729, 8.1993, 8.3259, 8.4529, 8.5801, 8.7076,
  8.8355, 8.9636, 9.0921, 9.221, 9.3502, 9.4797, 9.6097, 9.74, 9.8707, 10.0018, 10.1333, 10.2653, 10.3977, 10.5305, 10.6638, 10.7976,
  10.9319, 11.0666, 11.2019, 11.3377, 11.474, 11.6108, 11.7482, 11.8862, 12.0248, 12.1639, 12.3037, 12.4441, 12.5851, 12.7268, 12.8691, 13.0122,
  13.1559, 13.3003, 13.4455, 13.5914, 13.738, 13.8855, 14.0337, 14.1828, 14.3327, 14.4834, 14.635, 14.7874, 14.9408, 15.0951, 15.2504, 15.4066,
  15.5638, 15.722, 15.8813, 16.0416, 16.203, 16.3654, 16.529, 16.6938, 16.8598, 17.0269, 17.1953, 17.3649, 17.5359, 17.7081, 17.8817, 18.0567,
  18.2331, 18.411, 18.5903, 18.7712, 18.9537, 19.1377, 19.3233, 19.5107, 19.6997, 19.8906, 20.0832, 20.2777, 20.4741, 20.6724, 20.8728, 21.0752,
  21.2798, 21.4865, 21.6954, 21.9067, 22.1203, 22.3363, 22.5548, 22.776, 22.9997, 23.2262, 23.4556, 23.6878, 23.923, 24.1614, 24.4029, 24.6477,
  24.896, 25.1477, 25.4032, 25.6624, 25.9255, 26.1927, 26.4641, 26.7399, 27.0202, 27.3053, 27.5953, 27.8904, 28.1909, 28.4969, 28.8088, 29.1267,
  29.4511, 29.7821, 30.1201, 30.4656, 30.8187, 31.1801, 31.5501, 31.9292, 32.318, 32.7171, 33.0987, 33.4313, 33.7269, 33.9929, 34.2341, 34.4537,
  34.6544, 34.8377, 35.0052, 35.1579, 35.2967, 35.4221, 35.5347, 35.6348, 35.7229, 35.7989, 35.8631, 35.9154, 35.9558, 35.9841, 36, 36,
  36, 36, 36, 36, 36, 36, 36, 36, 36
];
// BAKED71-END

/** 71번: B 의 누적 탭핏 각 chi(도, 반시계. 180 = 탭핏이 C 중심을 향함) → C 의 누적 시계방향 회전(도). B 한 바퀴에 36° */
export function studAngle71(chiTotalDeg: number): number {
  const q = Math.floor(chiTotalDeg / 360);
  const chi = chiTotalDeg - 360 * q;
  return q * 36 + (chi <= PUSH71_CHI0 ? 0 : chi >= PUSH71_CHI1 ? 36 : lerpAt(PUSH71, (chi - PUSH71_CHI0) / PUSH71_STEP));
}

/** 미는 구간의 chi(도) [시작, 끝] */
export function pushSpan71(): [number, number] {
  const t = PUSH71;
  let i0 = 0;
  let i1 = t.length - 1;
  while (i0 < t.length - 1 && t[i0 + 1]! <= 1e-6) i0++;
  while (i1 > 0 && t[i1 - 1]! >= 36 - 1e-6) i1--;
  return [PUSH71_CHI0 + i0 * PUSH71_STEP, PUSH71_CHI0 + i1 * PUSH71_STEP];
}

/**
 * 스터드 원판 C(071): 반지름 K71.plateC 의 황동 판(두께 0.06, 가운데 z = 0) + 스터드 10개(판 앞으로 height).
 * 스터드 k 의 로컬 각 = k·36°(0° 스터드가 +X = B 쪽). userData.outlines.stud0…9.
 */
export function studWheel71(height = 0.22): THREE.Group {
  const k = K71;
  const t = 0.06;
  const g = new THREE.Group();
  g.add(slab(arcPts(0, 0, k.plateC, 0, TAU, 96).slice(0, 96), -t / 2, t / 2, brass(), 0.01));
  g.add(zRod(0.1, -t / 2 - 0.01, t / 2 + 0.03, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.14, 0.03, 0.01), paint(MARK), k.plateC * 0.45, 0, t / 2 + 0.003));
  const outlines: Record<string, V2[]> = {};
  for (let i = 0; i < k.studs; i++) {
    const a = i * 36 * D2R;
    const x = k.ringR * Math.cos(a);
    const y = k.ringR * Math.sin(a);
    g.add(zRod(k.studR, t / 2 - 0.005, t / 2 + height, steel(), x, y));
    outlines[`stud${i}`] = arcPts(x, y, k.studR, 0, TAU, 20).slice(0, 20);
  }
  g.userData.outlines = outlines;
  setMM(g, { kind: 'part', fn: 'studWheel71', studs: k.studs, ringR: k.ringR, studR: k.studR });
  return g;
}

/**
 * 구동 바퀴 B(071): 앞판(반투명, 틈 자리는 둘레에서 테 안쪽 면까지 따냄, 로컬 z ±0.025) + 판 뒤로 depth 만큼 뻗은 테 두 조각(가드·큰 테)
 * + 허브에서 뻗은 탭핏 A(로컬 +X). 회전축 = 로컬 Z. userData.outlines = { tappet, rimGuard, rimMain }.
 */
export function notchedRimWheel71(): THREE.Group {
  const k = K71;
  const g = new THREE.Group();
  const zb = -0.025 - k.depth;
  // 앞판: 틈을 따낸 원판
  const face: V2[] = [];
  for (let a = k.notchLow[1]; a <= 360 + k.notchUp[0] + 1e-9; a += 1) face.push([k.rimOut * Math.cos(a * D2R), k.rimOut * Math.sin(a * D2R)]);
  for (let a = k.notchUp[0]; a <= k.notchUp[1] + 1e-9; a += 1) face.push([k.rimIn * Math.cos(a * D2R), k.rimIn * Math.sin(a * D2R)]);
  for (let a = k.notchUp[1]; a <= k.notchLow[0] + 1e-9; a += 1) face.push([k.rimOut * Math.cos(a * D2R), k.rimOut * Math.sin(a * D2R)]);
  for (let a = k.notchLow[0]; a <= k.notchLow[1] + 1e-9; a += 1) face.push([k.rimIn * Math.cos(a * D2R), k.rimIn * Math.sin(a * D2R)]);
  g.add(slab(face, -0.025, 0.025, ghost(0xb8c8d8, 0.3), 0.008));
  const pieces = rimPieces71();
  const guard = sectorOutline(k.rimIn, k.rimOut, pieces[0]![0], pieces[0]![1]);
  const main = sectorOutline(k.rimIn, k.rimOut, pieces[1]![0], pieces[1]![1]);
  g.add(slab(guard, zb, 0.025, bronze({ roughness: 0.34 }), 0.008));
  g.add(slab(main, zb, 0.025, bronze({ roughness: 0.34 }), 0.008));
  // 틈 마구리 표시(노란 띠)
  for (const a of [k.notchUp[0], k.notchUp[1], k.notchLow[0], k.notchLow[1]]) {
    const m = meshAt(new THREE.BoxGeometry(k.rimThick, 0.012, k.depth), paint(MARK), (k.rimIn + k.rimThick / 2) * Math.cos(a * D2R), (k.rimIn + k.rimThick / 2) * Math.sin(a * D2R), -0.025 - k.depth / 2);
    m.rotation.z = a * D2R;
    g.add(m);
  }
  const tap = tappetOutline71();
  g.add(slab(tap, zb, -0.025, darkSteel({ roughness: 0.3 })));
  g.add(zRod(k.baseR + 0.03, zb, 0.04, darkSteel()));
  g.userData.outlines = { tappet: tap, rimGuard: guard, rimMain: main };
  setMM(g, { kind: 'part', fn: 'notchedRimWheel71', rimIn: k.rimIn, rimOut: k.rimOut, tapLen: k.tapLen });
  return g;
}

// ═════════════════════════ 072: 틸트 해머 ═════════════════════════
// 판화 읽기: 날개 넷 달린 캠 B(시계)가 해머 자루 아래의 돌기를 밀어 올리고, 날개 끝이 지나가면 해머 A 가 떨어져 모루 위의 쇠를 친다.
// 해머는 오른쪽 끝 아래의 공(받침의 오목한 자리에 앉음)을 축으로 까딱인다. 좌표는 판화 픽셀(4배 확대의 0.7배 = 2576 폭)에서 옮겼다.

const K72_PX = 0.0024;
const K72_GROUND = 0.4;
const K72_PIVOT_PX: V2 = [1920, 715];
const K72_LIFT0 = 4.5 * D2R;

/** 판화 픽셀 → 세계 좌표 */
function w72(x: number, y: number): V2 {
  return [(x - 1395) * K72_PX, K72_GROUND + (990 - y) * K72_PX];
}

/** 72번 치수(설계표 072). 좌표는 세계(x, y) */
export const K72 = {
  ground: K72_GROUND,
  /** 해머 축(공 중심) */
  pivot: w72(K72_PIVOT_PX[0], K72_PIVOT_PX[1]),
  ballR: 0.095,
  /** 캠 중심 */
  cam: w72(1375, 780),
  camTip: 0.446,
  camRoot: 0.276,
  camTeeth: 4,
  /** 돌기 끝의 둥근 반지름 */
  nibR: 0.03,
  /** 판화 자세(가장 들린 때)에서 쉬는 자세까지의 각(rad) = 4.5° */
  lift0: K72_LIFT0,
  /** 떨어지는 데 걸리는 캠 각(도) */
  fallDeg: 14,
  anvil: { x0: w72(655, 0)[0], x1: w72(1105, 0)[0], top: w72(0, 515)[1] }
} as const;

/** 돌기 끝 원의 중심(해머 로컬 = 축 기준, 판화 자세): 캠 중심 바로 위쪽(x −0.036)에서 날개 끝에 닿는 자리 */
function nibFig(): V2 {
  const dx = -0.036;
  const dy = Math.sqrt((K72.camTip + K72.nibR) ** 2 - dx * dx);
  return [K72.cam[0] + dx - K72.pivot[0], K72.cam[1] + dy - K72.pivot[1]];
}

/** 해머 윤곽 — 판화 자세(들린 때), 축(공 중심) 기준 */
function hammerFig(): V2[] {
  const f = (x: number, y: number): V2 => [(x - K72_PIVOT_PX[0]) * K72_PX, (K72_PIVOT_PX[1] - y) * K72_PX];
  const n = nibFig();
  const nx = K72_PIVOT_PX[0] + n[0] / K72_PX;
  const ny = K72_PIVOT_PX[1] - n[1] / K72_PX;
  const rn = K72.nibR / K72_PX;
  const top: V2[] = [
    f(800, 128), f(830, 118), f(900, 124), f(1000, 138), f(1100, 152), f(1180, 170), f(1240, 195), f(1300, 235), f(1360, 268),
    f(1440, 298), f(1600, 335), f(1800, 372), f(1930, 398), f(2040, 410)
  ];
  const foot: V2[] = [f(2025, 520), f(2005, 640), f(1945, 632), f(1945, 690), f(1895, 690), f(1895, 620), f(1908, 560)];
  const under: V2[] = [f(1880, 535), f(1800, 492), f(1700, 470), f(1600, 452), f(1500, 437), f(1450, 445), f(1415, 480), f(1402, 520)];
  const nib: V2[] = [f(nx + rn + 14, ny - 42)];
  for (let i = 0; i <= 10; i++) {
    const a = (-i * Math.PI) / 10; // 오른쪽 → 아래 → 왼쪽 (화면 기준)
    nib.push([n[0] + K72.nibR * Math.cos(a), n[1] + K72.nibR * Math.sin(a)]);
  }
  nib.push(f(nx - rn - 14, ny - 42), f(1318, 520));
  const head: V2[] = [f(1310, 445), f(1290, 415), f(1240, 380), f(1180, 350), f(1100, 330), f(1045, 320), f(1040, 338), f(1022, 376), f(835, 326), f(842, 290), f(790, 268), f(780, 190)];
  return [...top, ...foot, ...under, ...nib, ...head];
}

/** 해머의 때리는 면 두 끝(판화 자세, 축 기준): [왼쪽, 오른쪽] */
function faceFig(): [V2, V2] {
  const f = (x: number, y: number): V2 => [(x - K72_PIVOT_PX[0]) * K72_PX, (K72_PIVOT_PX[1] - y) * K72_PX];
  return [f(835, 326), f(1022, 376)];
}

/** 해머 A 윤곽 — **쉬는 자세**(머리가 쇠 위에 내려앉음), 원점 = 축(공 중심). 들림 λ 는 rotation.z = −λ */
export function tiltHammerOutline(): V2[] {
  return hammerFig().map((p) => rot2(p, K72.lift0));
}

/** 쉬는 자세의 때리는 면 두 끝(세계 좌표): [왼쪽, 오른쪽] */
export function tiltFaceRest(): [V2, V2] {
  const [a, b] = faceFig();
  const ra = rot2(a, K72.lift0);
  const rb = rot2(b, K72.lift0);
  return [
    [K72.pivot[0] + ra[0], K72.pivot[1] + ra[1]],
    [K72.pivot[0] + rb[0], K72.pivot[1] + rb[1]]
  ];
}

/** 캠(와이퍼 바퀴) B 윤곽: 날개 끝이 로컬 k·90°, 끝에서 시계 쪽으로 등이 나선으로 낮아지고(들어 올리는 면) 반시계 쪽은 반지름 방향 절벽(떨어지는 자리) */
export function wiperCamOutline(): V2[] {
  const k = K72;
  const pts: V2[] = [];
  const step = 2;
  for (let t = 0; t < k.camTeeth; t++) {
    const a0 = t * 90;
    for (let a = 0; a <= 90; a += step) {
      const r = k.camRoot + ((k.camTip - k.camRoot) * a) / 90;
      pts.push([r * Math.cos((a0 + a) * D2R), r * Math.sin((a0 + a) * D2R)]);
    }
  }
  return pts;
}

const LIFT72_STEP = 0.5;

/** 풀이(굽기용): 캠 각 0 ~ 90°(0.5° 간격, 180칸)의 해머 들림각 λ(rad) — 돌기 원이 캠 다각형을 뚫지 않는 가장 작은 λ + 날개 끝을 지난 뒤의 떨어짐 */
export function solveLift72(): number[] {
  const cam = wiperCamOutline();
  const n0 = rot2(nibFig(), K72.lift0); // 쉬는 자세의 돌기 중심(축 기준)
  const clear = (camDeg: number, lam: number): number => {
    const p = rot2(n0, -lam);
    const w: V2 = [K72.pivot[0] + p[0] - K72.cam[0], K72.pivot[1] + p[1] - K72.cam[1]];
    return polyDepth71(rot2(w, camDeg * D2R), cam) - K72.nibR; // 캠은 시계로 camDeg → 캠 로컬로는 +camDeg
  };
  const n = Math.round(90 / LIFT72_STEP);
  const contact: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i * LIFT72_STEP;
    contact.push(clear(c, 0) >= 0 ? 0 : firstTrue(0, 0.3, (x) => clear(c, x) >= 0));
  }
  let ip = 0;
  for (let i = 0; i < n; i++) if (contact[i]! > contact[ip]!) ip = i;
  const peak = contact[ip]!;
  const tab = contact.slice();
  const fallN = Math.round(K72.fallDeg / LIFT72_STEP);
  for (let j = 1; j <= fallN; j++) {
    const i = (ip + j) % n;
    const f = peak * (1 - (j / fallN) ** 2);
    if (f > tab[i]!) tab[i] = f;
  }
  return tab;
}

// BAKED72-BEGIN
const LIFT72: readonly number[] = [
  0.07041, 0.0685, 0.0664, 0.0641, 0.06159, 0.05889, 0.05598, 0.05288, 0.04957, 0.04607, 0.04236, 0.03846, 0.03435, 0.03005, 0.02554, 0.02083,
  0.01592, 0.01082, 0.00551, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0.00031, 0.00094, 0.00158, 0.00225, 0.00293, 0.00356, 0.0042, 0.00485, 0.00553, 0.00619, 0.00681, 0.00746,
  0.00813, 0.00882, 0.00944, 0.01008, 0.01074, 0.01142, 0.01207, 0.0127, 0.01336, 0.01403, 0.01471, 0.01533, 0.01598, 0.01665, 0.01733, 0.01797,
  0.0186, 0.01926, 0.01994, 0.0206, 0.02124, 0.02189, 0.02256, 0.02325, 0.02387, 0.02452, 0.02518, 0.02587, 0.02651, 0.02715, 0.02781, 0.02849,
  0.02916, 0.02979, 0.03044, 0.03111, 0.03181, 0.03244, 0.03308, 0.03374, 0.03443, 0.03509, 0.03572, 0.03638, 0.03706, 0.03774, 0.03837, 0.03902,
  0.03969, 0.04038, 0.04102, 0.04166, 0.04233, 0.04301, 0.04368, 0.04431, 0.04497, 0.04565, 0.04634, 0.04696, 0.04761, 0.04828, 0.04898, 0.04962,
  0.05026, 0.05093, 0.05162, 0.05228, 0.05292, 0.05358, 0.05426, 0.05495, 0.05558, 0.05623, 0.0569, 0.0576, 0.05824, 0.05888, 0.05955, 0.06024,
  0.06091, 0.06155, 0.0622, 0.06289, 0.06358, 0.06421, 0.06486, 0.06554, 0.06623, 0.06688, 0.06752, 0.06819, 0.06888, 0.06955, 0.07019, 0.07085,
  0.07153, 0.07223, 0.07286, 0.07351, 0.07419, 0.07489, 0.07554, 0.07618, 0.07685, 0.07754, 0.0782, 0.07852, 0.07842, 0.07812, 0.07762, 0.07692,
  0.07601, 0.07491, 0.07361, 0.07211
];
// BAKED72-END

/** 72번: 캠의 누적 시계방향 각(도) → 해머의 들림각 λ(rad, 0 = 쇠 위에 내려앉음). 주기 90°. 해머 rotation.z = −λ */
export function tiltLift(camDeg: number): number {
  const n = LIFT72.length;
  const u = (((camDeg % 90) + 90) % 90) / LIFT72_STEP;
  const i = Math.floor(u) % n;
  const j = (i + 1) % n;
  return LIFT72[i]! + (LIFT72[j]! - LIFT72[i]!) * (u - Math.floor(u));
}

/** 가장 높이 들린 때의 캠 각(도, 0 ~ 90), 그때의 λ(rad), 떨어진 뒤 다시 들리기 시작하는 캠 각(도) */
export function tiltPeak(): { deg: number; lift: number; startDeg: number } {
  const n = LIFT72.length;
  let ip = 0;
  for (let i = 0; i < n; i++) if (LIFT72[i]! > LIFT72[ip]!) ip = i;
  let is = ip;
  for (let j = 1; j < n; j++) {
    const i = (ip + j) % n;
    if (LIFT72[i]! <= 1e-6 && LIFT72[(i + 1) % n]! > 1e-6) {
      is = i;
      break;
    }
  }
  return { deg: ip * LIFT72_STEP, lift: LIFT72[ip]!, startDeg: is * LIFT72_STEP };
}

/** 캠(와이퍼 바퀴) B: 청동, 가운데 z = 0, 회전축 = 로컬 Z. userData.outline */
export function wiperCam(width = 0.14): THREE.Group {
  const g = new THREE.Group();
  const out = wiperCamOutline();
  g.add(slab(out, -width / 2, width / 2, bronze({ roughness: 0.34 }), 0.01));
  g.add(zRod(0.1, -width / 2 - 0.02, width / 2 + 0.02, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.028, 0.01), paint(MARK), 0.2, 0.2, width / 2 + 0.003));
  g.userData.outline = out;
  setMM(g, { kind: 'part', fn: 'wiperCam', teeth: K72.camTeeth, rTip: K72.camTip, rRoot: K72.camRoot });
  return g;
}

/** 해머 A: 쉬는 자세의 윤곽을 두께 thick 로 압출(가운데 z = 0) + 축의 공. 원점 = 축. userData.outline, mm.pin */
export function tiltHammer(thick = 0.16): THREE.Group {
  const g = new THREE.Group();
  const out = tiltHammerOutline();
  g.add(slab(out, -thick / 2, thick / 2, castIron(), 0.012));
  const ball = mesh(new THREE.SphereGeometry(K72.ballR, 28, 20), darkSteel());
  g.add(ball);
  // 때리는 면의 강철 띠
  const [a, b] = faceFig().map((p) => rot2(p, K72.lift0)) as [V2, V2];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const band = meshAt(new THREE.BoxGeometry(len, 0.03, thick + 0.012), steel(), (a[0] + b[0]) / 2 - 0.015 * Math.sin(ang), (a[1] + b[1]) / 2 + 0.015 * Math.cos(ang), 0);
  band.rotation.z = ang;
  g.add(band);
  g.userData.outline = out;
  markPin(g, [0, 0, 0]);
  return g;
}

/** 모루 위의 쇠(벼리는 굽은 막대) 윤곽 — 세계 좌표. 윗면의 때리는 자리는 해머 면(쉬는 자세)과 꼭 맞는다 */
export function workpieceOutline72(): V2[] {
  const [fl, fr] = tiltFaceRest();
  const ux = (fr[0] - fl[0]) / Math.hypot(fr[0] - fl[0], fr[1] - fl[1]);
  const uy = (fr[1] - fl[1]) / Math.hypot(fr[0] - fl[0], fr[1] - fl[1]);
  const top = K72.anvil.top;
  const sl: V2 = [fl[0] - 0.05 * ux, fl[1] - 0.05 * uy];
  const sr: V2 = [fr[0] + 0.04 * ux, fr[1] + 0.04 * uy];
  return [
    w72(545, 262), w72(620, 318), w72(720, 366), [sl[0] - 0.12, sl[1] + 0.05], sl, sr,
    [sr[0] + 0.07, sr[1] + 0.07], [sr[0] + 0.2, sr[1] + 0.1], [sr[0] + 0.19, sr[1] + 0.02], [sr[0] + 0.06, top],
    [sl[0] + 0.02, top], w72(760, 480), w72(690, 446), w72(620, 392), w72(560, 335)
  ];
}

/**
 * 틸트 해머의 고정부(072) — 세계 좌표로 바로 놓는다(그룹 원점 = 세계 원점, z0 ~ z1 깊이).
 * 바닥 판, 오른쪽 받침(공이 앉는 오목한 자리), 모루, 캠 뒤의 낮은 축받침 대, 모루 위의 쇠(userData.outline).
 */
export function tiltHammerBed(z0 = -0.2, z1 = 0.4): THREE.Group {
  const g = new THREE.Group();
  const k = K72;
  const gx0 = w72(560, 0)[0];
  const gx1 = w72(2230, 0)[0];
  // 바닥 판(받침대 윗면 0.18 위에 놓임)
  g.add(slab([[gx0, 0.18], [gx1, 0.18], [gx1, k.ground], [gx0, k.ground]], z0, z1, castIron(), 0.01));
  // 오른쪽 받침 + 공 자리
  const bx0 = w72(1620, 0)[0];
  const bTop = w72(0, 770)[1];
  const cupR = k.ballR + 0.004;
  const cupTop = k.pivot[1] + 0.145;
  const cup = arcPts(k.pivot[0], k.pivot[1] + 0.004, cupR, 0, -Math.PI, 16);
  const block: V2[] = [
    [bx0, k.ground], [gx1, k.ground], [gx1, bTop], [k.pivot[0] + 0.43, bTop], [k.pivot[0] + 0.31, cupTop], [k.pivot[0] + cupR, cupTop],
    ...cup, [k.pivot[0] - cupR, cupTop], [k.pivot[0] - 0.29, cupTop], [k.pivot[0] - 0.41, bTop], [bx0, bTop]
  ];
  g.add(slab(block, z0 + 0.03, z1 - 0.03, castIron(), 0.01));
  // 모루
  g.add(slab([[k.anvil.x0, k.ground], [k.anvil.x1, k.ground], [k.anvil.x1, k.anvil.top], [k.anvil.x0, k.anvil.top]], z0 + 0.03, z1 - 0.03, darkSteel(), 0.012));
  // 캠 뒤의 낮은 축받침 대(판화의 가는 가로선) — 뒤판에서 캠 뒤까지
  const pedTop = w72(0, 850)[1];
  g.add(slab([[k.anvil.x1, k.ground], [bx0, k.ground], [bx0, pedTop], [k.anvil.x1, pedTop]], STAGE.backZ, -0.06, castIron(), 0.008));
  // 모루 위의 쇠
  const wp = workpieceOutline72();
  const piece = slab(wp, 0.02, 0.18, paint(0xd9772b, { roughness: 0.6 }), 0.008);
  piece.name = 'workpiece';
  piece.userData.outline = wp.map(([x, y]): V2 => [x, y]);
  g.add(piece);
  setMM(g, { kind: 'part', fn: 'tiltHammerBed' });
  return g;
}

// ═════════════════════════ 073: 스프링 래칫 간헐 회전 ═════════════════════════
// 판화 읽기: 구동 원판 D(시계)의 면에 굽은 판스프링 B 가 한쪽 끝(앞서 가는 끝)으로 고정되고, 뒤따르는 자유 끝에 걸쇠 머리가 달렸다.
// 고정 받침에 붙은 센 스프링 C 가 원판 위로 휘어 들어와 끝이 래칫 A 의 이 사이에 놓인다. 걸쇠 머리가 C 밑으로 들어가면 C 가 그것을
// 래칫의 이 속으로 눌러 A 를 한 이(36°)만큼 끌고 가고, C 끝을 벗어나면 B 가 튕겨 나와 A 는 선다. C 끝은 A 가 되돌지 못하게 막는다.
// 좌표는 바퀴 중심 기준, 각은 도(반시계 +). 층: 원판 z 0 ~ 0.05 / 판스프링 B 몸 0.05 ~ 0.11 / 래칫 A·걸쇠 머리·C 0.12 ~ 0.20.

const K73_TIP = 0.69;
const K73_ROOT = 0.56;

/** 73번 치수(설계표 073) */
export const K73 = {
  teeth: 10,
  rTip: K73_TIP,
  rRoot: K73_ROOT,
  discR: 1.05,
  /** 판스프링 B 의 가운데 반지름 */
  leafR: 0.95,
  /** 걸쇠 머리: 풀렸을 때 아랫면 반지름, 높이, 폭 */
  headFree: 0.75,
  headH: 0.21,
  headW: 0.05,
  /** C 끝의 세계 각·반지름(쉴 때) */
  tipDeg: 120,
  tipR: 0.66,
  /** C 가 받침에 물린 자리 Q(바퀴 중심 기준) — 휠 때의 회전 중심 */
  q: [-1.137, -0.78] as V2,
  bladeT: 0.03,
  /** 걸쇠 머리 앞면(시계 쪽 면)의 D 로컬 각 */
  catchDeg0: 186.67,
  /** 판스프링이 걸쇠에서 고정 끝까지 뻗은 각(시계 쪽) */
  leafSpan: 88,
  zDisc: [0, 0.05] as readonly [number, number],
  zLeaf: [0.05, 0.11] as readonly [number, number],
  zTop: [0.12, 0.2] as readonly [number, number]
} as const;

/** 래칫 A 윤곽: 절벽 면이 로컬 k·36°(반시계 쪽을 보는 반지름 방향 면), 등은 반시계로 갈수록 높아져 다음 절벽 꼭대기에서 끝난다 */
export function ratchetOutline73(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < K73.teeth; k++) {
    for (let a = 0; a <= 36; a += 4) {
      const r = K73.rRoot + ((K73.rTip - K73.rRoot) * a) / 36;
      pts.push([r * Math.cos((k * 36 + a) * D2R), r * Math.sin((k * 36 + a) * D2R)]);
    }
  }
  return pts;
}

/** C 의 안쪽 가장자리 반지름(쉴 때): u = 끝에서 반시계로 잰 각(도, 0 ~ 70) */
function bladeR(u: number): number {
  return K73.tipR + 0.00155 * u + 0.000065 * u * u;
}

/** C(센 스프링) 윤곽 — Q 기준 로컬, 쉴 때. 휨은 Q 둘레 회전(rotation.z = psi, 반시계 = 끝이 바깥으로 들림) */
export function bladeOutline73(): V2[] {
  const k = K73;
  const inner: V2[] = [];
  const outer: V2[] = [];
  for (let u = 0; u <= 70; u += 2) {
    const g = (k.tipDeg + u) * D2R;
    const r = bladeR(u);
    const t = k.bladeT * (1 + 0.004 * u);
    inner.push([r * Math.cos(g) - k.q[0], r * Math.sin(g) - k.q[1]]);
    outer.push([(r + t) * Math.cos(g) - k.q[0], (r + t) * Math.sin(g) - k.q[1]]);
  }
  const h = k.bladeT / 2;
  inner.push([0.04, 0.44], [h + 0.006, 0.26], [h, 0]);
  outer.push([0.006, 0.44], [-h - 0.004, 0.26], [-h, 0]);
  return [...inner, ...outer.reverse()];
}

/** 걸쇠 머리 윤곽(머리 로컬: 원점 = 앞면 아래 모서리, +y = 반지름 바깥, +x = 시계 쪽 접선 → 몸은 x ≤ 0). 앞면(x = 0)이 이의 절벽을 민다 */
export function catchHeadOutline73(): V2[] {
  const w = K73.headW;
  const h = K73.headH;
  return [[0, 0], [0, h - w / 2], ...arcPts(-w / 2, h - w / 2, w / 2, 0, Math.PI, 10).slice(1, 10), [-w, h - w / 2], [-w, 0.012]];
}

/** 머리 로컬 → 바퀴 중심 좌표. phiDeg = 앞면의 세계 각, rb = 아랫면 반지름 */
function headWorld(p: V2, phiDeg: number, rb: number): V2 {
  const c = Math.cos(phiDeg * D2R);
  const s = Math.sin(phiDeg * D2R);
  return [(rb + p[1]) * c + p[0] * s, (rb + p[1]) * s - p[0] * c];
}

/** 점이 래칫(절벽 면이 faceDeg + 36k) 안으로 든 깊이(≥ 0). 등 쪽은 반지름 깊이, 절벽 쪽은 면까지의 거리 */
function ratchetSink(p: V2, faceDeg: number): number {
  const r = Math.hypot(p[0], p[1]);
  if (r >= K73.rTip) return 0;
  const a = (((Math.atan2(p[1], p[0]) / D2R - faceDeg) % 36) + 36) % 36; // 절벽에서 반시계로 잰 각
  const top = K73.rRoot + ((K73.rTip - K73.rRoot) * a) / 36;
  if (r >= top) return 0;
  if (r < K73.rRoot) return top - r;
  return Math.min(top - r, (36 - a) * D2R * r);
}

/** 73번 풀이 결과: u(도) 64 → −10, 0.5 간격 */
export interface Sol73 {
  /** A 의 전진(도, 0 → 36) */
  adv: number[];
  /** 걸쇠 머리 아랫면 반지름 */
  rb: number[];
  /** C 의 휨(rad) */
  psi: number[];
  /** 풀린 뒤 절벽 면이 C 끝을 지나쳐 서는 각(도) */
  eps: number;
}

const U73_HI = 64;
const U73_LO = -10;
const U73_STEP = 0.5;

/** 풀이(굽기용): 걸쇠 머리·C·래칫 윤곽이 서로 뚫지 않게 u 를 따라 차례로 푼다(10초쯤 걸린다) */
export function solve73(): Sol73 {
  const k = K73;
  const TOL = 4e-4;
  const head = catchHeadOutline73();
  const headD = densify(head, 0.01);
  const blade = bladeOutline73();
  const bladeD = densify(blade, 0.008).filter((p) => Math.hypot(p[0] + k.q[0], p[1] + k.q[1]) < 1.0);
  const tips: V2[] = [];
  for (let i = 0; i < k.teeth; i++) for (const rr of [k.rTip, k.rTip - 0.02, k.rTip - 0.045]) tips.push([rr * Math.cos(i * 36 * D2R), rr * Math.sin(i * 36 * D2R)]);
  const bladeAt = (psi: number, p: V2): V2 => {
    const q = rot2(p, psi);
    return [q[0] + k.q[0], q[1] + k.q[1]];
  };
  const toBlade = (psi: number, p: V2): V2 => rot2([p[0] - k.q[0], p[1] - k.q[1]], -psi);
  /** C ↔ 래칫 */
  const penBR = (psi: number, face: number): number => {
    let w = 0;
    for (const p of bladeD) {
      const q = bladeAt(psi, p);
      if (q[0] * q[0] + q[1] * q[1] < k.rTip * k.rTip) w = Math.max(w, ratchetSink(q, face));
    }
    for (const t of tips) {
      const q = toBlade(psi, rot2(t, face * D2R));
      const d = polyDepth71(q, blade);
      if (-d > w) w = -d;
    }
    return w;
  };
  /** 머리 ↔ C */
  const penHB = (phi: number, rb: number, psi: number): number => {
    let w = 0;
    const c: V2 = headWorld([-k.headW / 2, k.headH / 2], phi, rb);
    for (const p of headD) {
      const d = polyDepth71(toBlade(psi, headWorld(p, phi, rb)), blade);
      if (-d > w) w = -d;
    }
    const hw: V2[] = head.map((p) => headWorld(p, phi, rb));
    for (const p of bladeD) {
      const q = bladeAt(psi, p);
      if (Math.hypot(q[0] - c[0], q[1] - c[1]) > 0.16) continue;
      const d = polyDepth71(q, hw);
      if (-d > w) w = -d;
    }
    return w;
  };
  /** 머리 ↔ 래칫 */
  const penHR = (phi: number, rb: number, face: number): number => {
    let w = 0;
    for (const p of headD) w = Math.max(w, ratchetSink(headWorld(p, phi, rb), face));
    return w;
  };
  const run = (eps: number): Sol73 => {
    const adv: number[] = [];
    const rbs: number[] = [];
    const psis: number[] = [];
    const face0 = k.tipDeg + 36 - eps; // 밀릴 절벽 면 F1 의 쉬는 각
    let face = face0;
    let rbPrev: number = k.headFree;
    const n = Math.round((U73_HI - U73_LO) / U73_STEP);
    for (let i = 0; i <= n; i++) {
      const u = U73_HI - i * U73_STEP;
      const phi = k.tipDeg + u;
      // 머리 앞면이 절벽에 닿았고 이 속에 들어 있으면 민다(틈 0.12°)
      if (phi - 0.12 < face && phi > face - 6 && rbPrev < k.rTip - 0.012) face = phi - 0.12;
      let psi = penBR(0, face) <= TOL ? 0 : firstTrue(0, 0.2, (x) => penBR(x, face) <= TOL, 18);
      // 머리는 C 의 밑(안쪽)에 있다: 앞 단계 반지름 근처에서 위로 훑어 처음 닿는 곳까지
      let lo = Math.max(0.4, rbPrev - 0.03);
      while (lo > 0.4 && penHB(phi, lo, psi) > TOL) lo = Math.max(0.4, lo - 0.03);
      let hi = lo;
      let hit = false;
      while (hi < k.headFree) {
        hi = Math.min(k.headFree, hi + 0.01);
        if (penHB(phi, hi, psi) > TOL) {
          hit = true;
          break;
        }
        lo = hi;
      }
      let rb: number = hit ? -firstTrue(-hi, -lo, (x) => penHB(phi, -x, psi) <= TOL, 14) : k.headFree;
      if (penHR(phi, rb, face) > TOL) {
        rb = firstTrue(rb, k.headFree, (x) => penHR(phi, x, face) <= TOL, 18);
        if (penHB(phi, rb, psi) > TOL) psi = firstTrue(psi, 0.3, (x) => penHB(phi, rb, x) <= TOL, 18);
      }
      adv.push(face0 - face);
      rbs.push(rb);
      psis.push(psi);
      rbPrev = rb;
    }
    const end = adv[adv.length - 1]!;
    return { adv, rb: rbs, psi: psis, eps: eps + (end - 36) };
  };
  let s = run(3);
  for (let i = 0; i < 6 && Math.abs(s.adv[s.adv.length - 1]! - 36) > 1e-3; i++) s = run(s.eps);
  const last = s.adv[s.adv.length - 1]!;
  return { ...s, adv: s.adv.map((v) => (last > 0 ? Math.min(36, (v * 36) / last) : v)) };
}

// BAKED73-BEGIN
const EPS73 = 4.62;
const ADV73: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7,
  7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15,
  15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23,
  23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5, 30, 30.5, 31,
  31.5, 32, 32.5, 33, 33.5, 34, 34.5, 35, 35.5, 36, 36, 36, 36, 36, 36, 36,
  36, 36, 36, 36, 36
];
const RB73: readonly number[] = [
  0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75,
  0.75, 0.7468, 0.7424, 0.738, 0.7337, 0.7294, 0.7252, 0.7209, 0.7167, 0.7125, 0.7085, 0.7043, 0.7002, 0.6962, 0.6923, 0.6882,
  0.6842, 0.6803, 0.6765, 0.6727, 0.6688, 0.665, 0.6613, 0.6576, 0.6538, 0.6502, 0.6466, 0.643, 0.6394, 0.6359, 0.6324, 0.629,
  0.6255, 0.6221, 0.6188, 0.6154, 0.6121, 0.6088, 0.6056, 0.6024, 0.5991, 0.596, 0.5929, 0.5898, 0.5867, 0.5837, 0.5808, 0.5778,
  0.5749, 0.572, 0.5691, 0.5663, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638,
  0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638,
  0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638,
  0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638,
  0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.5638, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75,
  0.75, 0.75, 0.75, 0.75, 0.75
];
const PSI73: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0.00028, 0.00266, 0.00497, 0.00729, 0.0096, 0.01184, 0.01399, 0.01621, 0.01836, 0.02044, 0.02248, 0.02456,
  0.02657, 0.0285, 0.03046, 0.03239, 0.03424, 0.03605, 0.0379, 0.03968, 0.04139, 0.04312, 0.04483, 0.04646, 0.04807, 0.04968, 0.05124, 0.05273,
  0.05426, 0.05574, 0.05714, 0.05857, 0.05996, 0.06128, 0.06259, 0.0639, 0.06514, 0.06635, 0.06757, 0.06873, 0.06984, 0.07097, 0.07205, 0.07306,
  0.0741, 0.0751, 0.0761, 0.07703, 0.07797, 0.07887, 0.07972, 0.08056, 0.08138, 0.08215, 0.08238, 0.08163, 0.07986, 0.0771, 0.07341, 0.06832,
  0.06134, 0.05377, 0.04632, 0.03899, 0.03179, 0.0247, 0.01772, 0.01087, 0.00412, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0
];
// BAKED73-END

/** 73번의 한 순간 */
export interface Ratchet73State {
  /** 래칫 A 의 rotation.z(rad) — 윤곽의 절벽 면이 제자리에 오게 맞춘 값(시계로 돌수록 작아짐) */
  aRot: number;
  /** A 의 누적 시계방향 전진(도) */
  advDeg: number;
  /** 걸쇠 머리 아랫면 반지름 */
  headR: number;
  /** C 의 rotation.z(rad, Q 둘레) */
  bladeRot: number;
  /** 걸쇠가 이를 밀고 있는가 */
  pushing: boolean;
  /** 걸쇠 앞면이 C 끝에서 떨어진 각(도, + = 아직 못 미침) */
  u: number;
}

/** 73번: D 의 누적 시계방향 각(도) → A 회전, 걸쇠 머리 반지름, C 의 휨. D 한 바퀴에 A 는 정확히 36° */
export function ratchet73State(dDeg: number): Ratchet73State {
  const k = K73;
  const x = dDeg - (k.catchDeg0 - k.tipDeg - 180);
  const q = Math.floor(x / 360);
  const u = 180 - (x - 360 * q);
  const f = (U73_HI - u) / U73_STEP;
  const inTab = u <= U73_HI && u >= U73_LO;
  const adv = u > U73_HI ? 0 : u < U73_LO ? 36 : lerpAt(ADV73, f);
  const total = q * 36 + adv;
  return {
    aRot: (k.tipDeg - EPS73 - total) * D2R,
    advDeg: total,
    headR: inTab ? lerpAt(RB73, f) : k.headFree,
    bladeRot: inTab ? lerpAt(PSI73, f) : 0,
    pushing: adv > 1e-4 && adv < 36 - 1e-4,
    u
  };
}

/** 풀린 뒤 절벽 면이 C 끝을 지나쳐 서는 각 ε(도) — 쉬는 절벽 면은 세계 각 tipDeg − ε + 36k */
export function ratchet73Eps(): number {
  return EPS73;
}

/** 래칫 바퀴 A(073): 황동, z = K73.zTop 층 + 아래 허브 받침. 원점 = 바퀴 중심(z = 원판 뒷면). userData.outline */
export function ratchetWheel73(): THREE.Group {
  const g = new THREE.Group();
  const out = ratchetOutline73();
  const body = slab(out, K73.zTop[0], K73.zTop[1], brass(), 0.008);
  body.userData.outline = out;
  g.add(body);
  g.add(zRod(0.2, K73.zDisc[1] + 0.004, K73.zTop[0], darkSteel()));
  g.add(zRod(0.12, K73.zTop[1], K73.zTop[1] + 0.03, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.16, 0.03, 0.01), paint(MARK), 0.36, 0, K73.zTop[1] + 0.003));
  setMM(g, { kind: 'part', fn: 'ratchetWheel73', teeth: K73.teeth, rTip: K73.rTip, rRoot: K73.rRoot });
  return g;
}

/** 구동 원판 D(073): 강철색 원판(z 0 ~ 0.05) + 판스프링 고정 블록(로컬 각 catchDeg0 − leafSpan) + 둘레 표시 */
export function driveDisc73(): THREE.Group {
  const k = K73;
  const g = new THREE.Group();
  g.add(slab(arcPts(0, 0, k.discR, 0, TAU, 96).slice(0, 96), k.zDisc[0], k.zDisc[1], bronze({ roughness: 0.4 }), 0.008));
  const a0 = k.catchDeg0 - k.leafSpan;
  const blk = [...arcPts(0, 0, k.leafR + 0.05, (a0 - 5) * D2R, (a0 + 3) * D2R, 6), ...arcPts(0, 0, k.leafR - 0.05, (a0 + 3) * D2R, (a0 - 5) * D2R, 6)];
  g.add(slab(blk, k.zDisc[1] - 0.004, k.zLeaf[1], darkSteel(), 0.006));
  for (let i = 0; i < 4; i++) {
    const a = (i * 90 + 40) * D2R;
    const m = meshAt(new THREE.BoxGeometry(0.1, 0.026, 0.008), paint(MARK), (k.discR - 0.08) * Math.cos(a), (k.discR - 0.08) * Math.sin(a), k.zDisc[1] + 0.002);
    m.rotation.z = a;
    g.add(m);
  }
  setMM(g, { kind: 'part', fn: 'driveDisc73', r: k.discR });
  return g;
}

/** 판스프링 B + 걸쇠 머리(073) — D 그룹의 자식으로 둔다(D 로컬). set(headR) 로 자유 끝의 반지름을 바꾸면 띠를 다시 만든다 */
export class CatchSpring73 {
  readonly group = new THREE.Group();
  /** 걸쇠 머리(윤곽 userData.outline, 머리 로컬) */
  readonly head: THREE.Mesh;
  private readonly leaf: THREE.Mesh;
  private last = NaN;

  constructor() {
    const k = K73;
    this.leaf = mesh(new THREE.BufferGeometry(), steel());
    this.leaf.position.z = (k.zLeaf[0] + k.zLeaf[1]) / 2;
    this.group.add(this.leaf);
    const out = catchHeadOutline73();
    this.head = slab(out, k.zLeaf[0], k.zTop[1], darkSteel({ roughness: 0.3 }), 0.005);
    this.head.userData.outline = out;
    this.head.name = 'catchHead';
    this.group.add(this.head);
    this.set(k.headFree);
  }

  /** headR = 걸쇠 머리 아랫면 반지름(K73.headFree = 풀림) */
  set(headR: number): void {
    if (Math.abs(headR - this.last) < 1e-6) return;
    this.last = headR;
    const k = K73;
    const phi = k.catchDeg0 * D2R;
    this.head.position.set(headR * Math.cos(phi), headR * Math.sin(phi), this.head.position.z);
    this.head.rotation.z = phi - Math.PI / 2;
    // 띠: 고정 끝(반지름 leafR) → 머리 꼭대기 바로 아래. 반지름은 3t² − 2t³ 로 부드럽게 바뀐다(양 끝 기울기 0)
    const rEnd = headR + k.headH - 0.012;
    const a0 = (k.catchDeg0 - k.leafSpan) * D2R;
    const a1 = (k.catchDeg0 + 1.5) * D2R;
    const n = 30;
    const inner: V2[] = [];
    const outer: V2[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = k.leafR + (rEnd - k.leafR) * (3 * t * t - 2 * t * t * t);
      const a = a0 + (a1 - a0) * t;
      inner.push([(r - 0.011) * Math.cos(a), (r - 0.011) * Math.sin(a)]);
      outer.push([(r + 0.011) * Math.cos(a), (r + 0.011) * Math.sin(a)]);
    }
    const old = this.leaf.geometry;
    this.leaf.geometry = extrude(shapeFrom([...inner, ...outer.reverse()]), k.zLeaf[1] - k.zLeaf[0], 0.004);
    old.dispose();
  }
}

/** 센 스프링 C 의 휘는 날(073): 원점 = Q(받침에 물린 자리). 모델은 바퀴 중심 + K73.q 에 놓고 rotation.z = bladeRot. userData.outline(자식 메시) */
export function stopSpring73(): THREE.Group {
  const g = new THREE.Group();
  const out = bladeOutline73();
  const m = slab(out, K73.zTop[0], K73.zTop[1], steel({ roughness: 0.28 }), 0.005);
  m.userData.outline = out;
  m.name = 'bladeC';
  g.add(m);
  setMM(g, { kind: 'part', fn: 'stopSpring73' });
  return g;
}

/**
 * 고정 받침(073): 원점 = 바퀴 중심. 받침 블록(오른쪽 면이 Q 의 세로선, 윗면 = Q 높이, 아래는 yBottom 까지, 뒤판 ~ z 0.26)
 * + 블록 옆면에 C 의 뿌리를 누르는 죔판과 볼트 둘. yBottom 은 바퀴 중심 기준(받침대 윗면까지 내리면 떠 있지 않다).
 */
export function springPost73(yBottom: number, zBack: number = STAGE.backZ): THREE.Group {
  const k = K73;
  const g = new THREE.Group();
  const xr = k.q[0] - k.bladeT / 2;
  const top = k.q[1];
  g.add(slab([[xr - 0.66, yBottom], [xr, yBottom], [xr, top], [xr - 0.66, top]], zBack, 0.26, castIron(), 0.012));
  // C 의 뿌리(블록 옆면을 따라 내려감)와 죔판
  const z0 = k.zTop[0];
  const z1 = k.zTop[1];
  g.add(slab([[xr, top - 0.62], [xr + k.bladeT, top - 0.62], [xr + k.bladeT, top + 0.002], [xr, top + 0.002]], z0, z1, steel({ roughness: 0.28 }), 0.004));
  g.add(slab([[xr + k.bladeT, top - 0.56], [xr + k.bladeT + 0.035, top - 0.56], [xr + k.bladeT + 0.035, top - 0.08], [xr + k.bladeT, top - 0.08]], z0 - 0.02, z1 + 0.02, darkSteel(), 0.006));
  for (const y of [top - 0.2, top - 0.44]) {
    const bolt = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), darkSteel());
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(xr + k.bladeT + 0.05, y, (z0 + z1) / 2);
    g.add(bolt);
  }
  setMM(g, { kind: 'part', fn: 'springPost73' });
  return g;
}
