// 296번 레버 탈진기 전용 키트 — 탈진 바퀴(톱날 이 20)·레버(닻 + 팔 + 홈 + 꼬리)·균형 바퀴와 접촉 계산. 설계표 docs/mm507-sheets/296.md
// 균형 바퀴 각만 시간표(β = 220°·sin πt). 레버 각 λ 는 핀과 홈의 기하, 바퀴 각 φ 는 이끝과 팔레트 면의 접촉(원·선분 교점)에서 매 순간 구한다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

const pol = (r: number, deg: number, c: V2 = [0, 0]): V2 => [c[0] + r * Math.cos(deg * D2R), c[1] + r * Math.sin(deg * D2R)];
const angOf = (p: V2, c: V2): number => Math.atan2(p[1] - c[1], p[0] - c[0]) / D2R;
const rotAbout = (p: V2, deg: number, c: V2): V2 => {
  const t = deg * D2R;
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(t) - y * Math.sin(t), c[1] + x * Math.sin(t) + y * Math.cos(t)];
};
/** a 를 ref 근처(ref ± 180°)로 */
const wrapNear = (a: number, ref: number): number => ((((a - ref + 180) % 360) + 360) % 360) - 180 + ref;

const W: V2 = [0.25, 1.22];
const B: V2 = [0.25, 1.22 + 0.9 / Math.cos(31.5 * D2R)];
const D: V2 = [-0.817, 2.157];
const RT = 0.9;
const PIN_R = 0.12;
const PIN_A = angOf(B, D); // D 에서 B 방향 6.3396°
const ARM_A = angOf(D, B); // B 에서 D 방향 −173.6604°
const LB = 6.3;
const OUT = 0.12;
const CU = 0.0144;
const CE = 0.0385;

/** 팔레트 4점(바깥 변 위·아래 + 이 닿는 안쪽 점) — 반지름 R+OUT 바깥, R+CU·R−CE 안쪽 */
const stone = (hi: number, lo: number): V2[] => [pol(RT + OUT, hi, W), pol(RT + CU, hi, W), pol(RT - CE, lo, W), pol(RT + OUT, lo, W)];
const SE = stone(124.5, 118.5);
const SX = stone(61.5, 55.5);

export const K296 = {
  W,
  B,
  D,
  Z: 20,
  PITCH: 18,
  RT,
  RR: 0.72,
  FRONT: 4,
  BACK: 10,
  BULGE: 0.03,
  AMP: 220,
  PERIOD: 2,
  PIN_R,
  PIN_A,
  ARM_A,
  LB,
  /** 입구(왼쪽)·출구(오른쪽) 팔레트 닿는 꺾은선(세계 좌표, λ = 0) */
  FACE_E: SE.slice(0, 3) as V2[],
  FACE_X: SX.slice(0, 3) as V2[],
  BE: 0,
  /** [t, β, λ, φ] 설계표 기대값 */
  EXPECT: [
    [0, 0, 0, -2.962],
    [0.02, 13.814, -1.7148, -4.7468],
    [0.04, 27.573, -3.2869, -6.2806],
    [0.06, 41.224, -4.598, -10.4621],
    [0.1, 67.984, -6.173, -10.4967],
    [0.25, 155.563, -6.3, -10.5006],
    [1.0, 0, 0, -11.962],
    [1.02, -13.814, 1.7148, -13.8081],
    [1.04, -27.573, 3.2869, -15.8553],
    [1.05, -34.416, 3.981, -19.2746],
    [1.1, -67.984, 6.173, -19.071],
    [1.5, -220, 6.3, -19.0574],
    [2.0, 0, 0, -20.962],
    [30, 0, 0, -272.962]
  ] as [number, number, number, number][]
};
const K = K296;
const th = (k: number): number => 90 - K.PITCH * k;

// ───────────────────────── 기하·접촉 계산 ─────────────────────────

/** 핀 중심(세계, 균형 각 β) */
const pinAt = (beta: number): V2 => pol(PIN_R, PIN_A + beta, D);
const lamRaw = (beta: number): number => wrapNear(angOf(pinAt(beta), B) - ARM_A, 0);

/** 핀이 홈 안에 드는 균형 각 한계 — 걸림 끝에서 레버가 멈춤 핀에 닿는 각(72.7292°) */
function findBE(): number {
  let a = 0;
  let b = 83;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (lamRaw(m) <= -LB) b = m;
    else a = m;
  }
  return (a + b) / 2;
}
const BE = findBE();
(K as { BE: number }).BE = BE;

/** 레버 각 λ(도) — 홈 안: 핀–홈 기하, 밖: 멈춤 핀에 기댐 */
export function lam296(beta: number): number {
  if (Math.abs(beta) <= BE) return lamRaw(beta);
  return beta > 0 ? -LB : LB;
}

/** 면(꺾은선, λ=0 세계 좌표)을 B 둘레로 lam 돌려 이끝 원(W, RT)과 만나는 바퀴 각 φ(도). 가장 큰 α(먼저 닿는 점). 안 닿으면 null */
export function contact296(face: V2[], k: number, lam: number, ref: number): number | null {
  const fw = face.map((p) => rotAbout(p, lam, B));
  let best: number | null = null;
  for (let i = 0; i < fw.length - 1; i++) {
    const p = fw[i]!;
    const q = fw[i + 1]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const fx = p[0] - W[0];
    const fy = p[1] - W[1];
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - RT * RT;
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a === 0) continue;
    const sq = Math.sqrt(disc);
    for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (s < -1e-12 || s > 1 + 1e-12) continue;
      const al = wrapNear(angOf([p[0] + s * dx, p[1] + s * dy], W), ref);
      if (best === null || al > best) best = al;
    }
  }
  return best === null ? null : best - th(k);
}

/** 드롭(입구·출구 팔레트가 이를 놓는 τ) — 접촉이 사라지는 때를 이분법으로 */
function findDrop(face: V2[], k: number, ref: number, t0: number, t1: number): number {
  let a = t0;
  let b = t1;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (contact296(face, k, lam296(K.AMP * Math.sin(Math.PI * m)), ref) === null) b = m;
    else a = m;
  }
  return b;
}
const DROP_A = findDrop(K.FACE_E, -2, 126, 0, 0.5);
const DROP_B = findDrop(K.FACE_X, 1, 72, 0.5, 1.5);

export interface State296 {
  beta: number;
  lam: number;
  phi: number;
  holder: 'entry' | 'exit';
  engaged: boolean;
  justDropped: boolean;
}

export function state296(t: number): State296 {
  const n = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - n * K.PERIOD;
  const beta = K.AMP * Math.sin(Math.PI * tau);
  const lam = lam296(beta);
  const E = (k: number, ref: number): number | null => contact296(K.FACE_E, k, lam, ref);
  const X = (k: number, ref: number): number | null => contact296(K.FACE_X, k, lam, ref);
  let phi: number | null;
  let holder: 'entry' | 'exit';
  if (tau < 0.5) {
    phi = E(-2, 126);
    holder = 'entry';
    if (phi === null) {
      phi = X(1, 72);
      holder = 'exit';
    }
  } else if (tau < 1.5) {
    phi = X(1, 72);
    holder = 'exit';
    if (phi === null) {
      phi = E(-3, 144);
      holder = 'entry';
    }
  } else {
    phi = E(-3, 144);
    holder = 'entry';
  }
  // 설계표대로면 일어나지 않는다(드롭 순간의 수치 경계만) — 반대 팔레트로 한 번 더
  if (phi === null) {
    phi = holder === 'entry' ? X(1, 72) : E(-3, 144);
    if (phi === null) phi = 0;
  }
  const dropped = (tau >= DROP_A && tau < DROP_A + 0.1) || (tau >= DROP_B && tau < DROP_B + 0.1);
  return { beta, lam, phi: phi - K.PITCH * n, holder, engaged: Math.abs(beta) <= BE, justDropped: dropped };
}

// ───────────────────────── 탈진 바퀴 ─────────────────────────

/** 바퀴 윤곽(W 원점, 시계 차례) — 이 20. 등면(볼록) → 이끝 T → 앞면 F → 뿌리 원호 */
export function wheelOutline296(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < K.Z; k++) {
    const t = th(k);
    const Bk = pol(K.RR, t + K.BACK);
    const Tk = pol(RT, t);
    const Fk = pol(K.RR, t + K.FRONT);
    const m = pol(1, t + K.BACK / 2);
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      pts.push([(1 - s) * Bk[0] + s * Tk[0] + K.BULGE * s * (1 - s) * m[0], (1 - s) * Bk[1] + s * Tk[1] + K.BULGE * s * (1 - s) * m[1]]);
    }
    pts.push(Fk);
    const a0 = t + K.FRONT;
    const a1 = th(k + 1) + K.BACK;
    for (let i = 1; i < 4; i++) pts.push(pol(K.RR, a0 + ((a1 - a0) * i) / 4));
  }
  return pts;
}

/** 탈진 바퀴(brass)·허브 칼라·빨간 표시·태엽통(steel)·노란 막대. 원점 = W, 회전축 = 로컬 Z. 몸통 메시 name `escapeWheel`·`barrel` */
export function escWheel296(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const outline = wheelOutline296();
  const shape = shapeFrom(outline);
  for (let j = 0; j < 3; j++) shape.holes.push(annularSector(0.18, 0.6, (120 * j + 20) * D2R, (120 * j + 100) * D2R));
  shape.holes.push(circlePath(0, 0, 0.042));
  const geo = extrude(shape, 0.06, 0, 8);
  geo.translate(0, 0, 0.03);
  const wmat = brass();
  const wheel = mesh(geo, wmat);
  wheel.name = 'escapeWheel';
  wheel.userData.outline = outline;
  g.add(wheel);
  // 허브 칼라 z 0.058(바퀴 속에 0.002 박음)~0.09
  const colGeo = lathe(tubeProfile(0.042, 0.08, 0.058, 0.09, 0.002), 40);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, darkSteel()));
  // 빨간 표시 — 바퀴 앞면(z 0.06) 위, 반지름 0.66, 각 90°
  const red = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.004), paint(0xd03020));
  red.position.set(0, 0.66, 0.061);
  g.add(red);
  // 태엽통 z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.45, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  // 노란 막대 — 태엽통 앞면(z −0.08) 위, 반지름 0.30 자리, 창(60° 가운데)으로 보이게
  const yel = mesh(new THREE.BoxGeometry(0.25, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.3 * Math.cos(60 * D2R), 0.3 * Math.sin(60 * D2R), -0.079);
  yel.rotation.z = 60 * D2R;
  g.add(yel);
  g.userData.wheelMat = wmat;
  return g;
}

// ───────────────────────── 레버 ─────────────────────────

const rel = (pts: V2[]): V2[] => pts.map((p) => [p[0] - B[0], p[1] - B[1]] as V2);

function slab(worldPts: V2[], z0: number, z1: number, mat: THREE.Material, holeR = 0, keepOutline = true): THREE.Mesh {
  const outline = rel(worldPts);
  const shape = shapeFrom(outline);
  if (holeR > 0) shape.holes.push(circlePath(0, 0, holeR));
  const geo = extrude(shape, z1 - z0, 0, 6);
  geo.translate(0, 0, (z0 + z1) / 2);
  const m = mesh(geo, mat);
  if (keepOutline) m.userData.outline = outline;
  return m;
}

// 닻 판 윤곽 — 오각형 판 + 두 다리를 한 윤곽으로 합친 것(설계표 오각형·다리 좌표의 합집합, 세계 좌표)
const ANCHOR_OUTLINE: V2[] = [
  [-0.3377, 2.2255],
  [-0.2985714, 2.2255],
  [-0.41, 2.2555],
  [-0.41, 2.3355],
  [0.25, 2.4255],
  [0.91, 2.3355],
  [0.91, 2.2555],
  [0.7985714, 2.2255],
  [0.8377, 2.2255],
  [0.8277, 2.0606],
  [0.7367, 2.1164],
  [0.6861243, 2.1952258],
  [0.65, 2.1855],
  [-0.15, 2.1855],
  [-0.1861243, 2.1952258],
  [-0.2367, 2.1164],
  [-0.3277, 2.0606]
];
const ARM_PTS: V2[] = [
  [0.197, 2.2998],
  [-0.618, 2.2093],
  [-0.6114, 2.1497],
  [0.2036, 2.2402]
];
const FORK_PTS: V2[] = [
  [-0.6136, 2.2601],
  [-0.7974, 2.2397],
  [-0.7923, 2.193],
  [-0.6621, 2.2074],
  [-0.6548, 2.1418],
  [-0.785, 2.1274],
  [-0.7798, 2.0806],
  [-0.5959, 2.1011]
];
const TAIL_PTS: V2[] = [
  [0.2476, 2.2406],
  [1.0456, 2.1848],
  [1.2213, 2.1174],
  [1.2339, 2.297],
  [1.0505, 2.2547],
  [0.2524, 2.3105]
];

/** 레버(닻 판 + 왼팔 + 홈 끝 + 꼬리 + 팔레트 둘 + 허브). 원점 = B 축, 회전축 = 로컬 Z.
 *  몸통 메시 name `anchorBody`·`leverArm`·`leverFork`·`leverTail`·`palletEntry`·`palletExit` */
export function lever296(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'leverGroup';
  const mat = steel();
  // 팔·홈·꼬리는 닻 판과 한 몸(겹침)이라 윤곽(userData.outline)은 닻 판·팔레트에만 둔다
  // 같은 높이의 면이 겹치지 않게 닻 판 0.010~0.050, 팔·꼬리 0.012~0.048, 홈 끝 0.014~0.046(겹친 자리에서 안쪽으로 들어감)
  const body = slab(ANCHOR_OUTLINE, 0.01, 0.05, mat, 0.037);
  body.name = 'anchorBody';
  const arm = slab(ARM_PTS, 0.012, 0.048, mat, 0, false);
  arm.name = 'leverArm';
  const fork = slab(FORK_PTS, 0.014, 0.046, mat, 0, false);
  fork.name = 'leverFork';
  const tail = slab(TAIL_PTS, 0.012, 0.048, mat, 0, false);
  tail.name = 'leverTail';
  g.add(body, arm, fork, tail);
  // 허브 z 0.048(판 속에 0.002 박음)~0.08
  const hubGeo = lathe(tubeProfile(0.037, 0.07, 0.048, 0.08, 0.002), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 팔레트(루비색) — 바깥 변이 다리 아래 변과 맞붙음
  const mE = paint(0xb3122e);
  const mX = paint(0xb3122e);
  const pe = slab(SE, 0, 0.06, mE);
  pe.name = 'palletEntry';
  const px = slab(SX, 0, 0.06, mX);
  px.name = 'palletExit';
  g.add(pe, px);
  g.userData.matEntry = mE;
  g.userData.matExit = mX;
  return g;
}

/** 멈춤 핀 둘(darkSteel, 고정, 세계 좌표) — 뒤판 앞면(−0.30)에서 z 0.06 까지. 메시 하나 name `bankPins` */
export function bankPins296(): THREE.Mesh {
  const mk = (x: number, y: number): THREE.BufferGeometry => {
    const geo = lathe(rodProfile(0.025, 0, 0.36, 0, 0.003), 24);
    geo.rotateX(Math.PI / 2);
    geo.translate(x, y, -0.3);
    return geo;
  };
  const merged = mergeGeometries([mk(0.967, 2.3644), mk(0.9477, 2.0878)], false);
  const m = mesh(merged, darkSteel());
  m.name = 'bankPins';
  return m;
}

// ───────────────────────── 균형 바퀴 ─────────────────────────

/** 균형 바퀴 묶음(원점 = D 축). 뒤판 보스는 묶음 밖(balanceBoss296). 몸통 메시 name `balanceStaff`·`balanceWheel`·`rollerDisk`·`impulsePin` */
export function balance296(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'balanceGroup';
  // 축: z −0.29(보스 속)~−0.012(원판 속에 0.002 박음 — 앞으로 더 나오면 레버와 부딪친다)
  const staffGeo = lathe(rodProfile(0.03, 0, 0.278, 0, 0), 24);
  staffGeo.rotateX(Math.PI / 2);
  const staff = mesh(staffGeo, steel());
  staff.name = 'balanceStaff';
  staff.position.set(0, 0, -0.29);
  g.add(staff);
  // 축 칼라 z −0.202(보스 속에 0.002)~−0.168(테 허브 속에 0.002)
  const colGeo = lathe(tubeProfile(0.03, 0.05, -0.202, -0.168), 32);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, steel()));
  // 테: 고리 반지름 0.38~0.42, z −0.17~−0.13 (원 전체 고리)
  const ring = shapeFrom(circlePts(0.42, 96));
  ring.holes.push(circlePath(0, 0, 0.38));
  const ringGeo = extrude(ring, 0.04, 0, 48);
  ringGeo.translate(0, 0, -0.15);
  const bw = mesh(ringGeo, brass());
  bw.name = 'balanceWheel';
  g.add(bw);
  // 허브 원판 반지름 0.07
  const hubGeo = extrude(shapeFrom(circlePts(0.07)), 0.04, 0, 8);
  hubGeo.translate(0, 0, -0.15);
  g.add(mesh(hubGeo, brass()));
  // 살 3 (폭 0.04, 0°·120°·240°) — 두께를 테보다 0.002 씩 얇게(같은 높이 면 겹침 방지), 허브·테 속으로 0.01 박음
  const spokeMat = brass();
  for (let j = 0; j < 3; j++) {
    const sp = mesh(new THREE.BoxGeometry(0.33, 0.04, 0.036), spokeMat);
    sp.position.set(0.225, 0, -0.15);
    const holder = new THREE.Group();
    holder.rotation.z = j * 120 * D2R;
    holder.add(sp);
    g.add(holder);
  }
  // 빨간 표시 — 테 앞면(z −0.13) 위, 반지름 0.40, 각 90°
  const red = mesh(new THREE.BoxGeometry(0.08, 0.03, 0.004), paint(0xd03020));
  red.position.set(0, 0.4, -0.129);
  g.add(red);
  // 원판 D: 반지름 0.21, z −0.05~−0.01
  const diskGeo = extrude(shapeFrom(circlePts(0.21)), 0.04, 0, 8);
  diskGeo.translate(0, 0, -0.03);
  const disk = mesh(diskGeo, steel());
  disk.name = 'rollerDisk';
  g.add(disk);
  // 충격 핀: 반지름 0.03, z −0.012(원판 속에 0.002)~0.06
  const pinGeo = lathe(rodProfile(0.03, 0, 0.072, 0, 0.004), 24);
  pinGeo.rotateX(Math.PI / 2);
  const pinMat = brass();
  const pin = mesh(pinGeo, pinMat);
  pin.name = 'impulsePin';
  pin.position.set(PIN_R * Math.cos(PIN_A * D2R), PIN_R * Math.sin(PIN_A * D2R), -0.012);
  g.add(pin);
  g.userData.pinMat = pinMat;
  return g;
}

function circlePts(r: number, n = 48): V2[] {
  const o: V2[] = [];
  for (let i = 0; i < n; i++) o.push([r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)]);
  return o;
}

/** 균형 축이 박히는 뒤판 보스(고정, 묶음 밖) — D 에서 z −0.30~−0.20 */
export function balanceBoss296(): THREE.Mesh {
  const geo = lathe(rodProfile(0.07, 0, 0.1, 0.008, 0.008), 32);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, darkSteel());
  m.position.set(D[0], D[1], -0.3);
  return m;
}
