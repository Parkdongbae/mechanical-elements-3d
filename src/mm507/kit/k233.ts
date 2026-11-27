// 233번 랜턴 바퀴의 멈추개 전용 키트 — 랜턴 바퀴(원판 + 핀 14), 롤러 레버, 막대 폴, 닫힌 식 + 표 운동
// 설계표 docs/mm507-sheets/233.md 의 수치·점열·표 그대로.
import * as THREE from 'three';
import { brass, darkSteel, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const PIT = 360 / 14;

/** 233번 배치 상수(세계 좌표) */
export const K233 = {
  W: [-0.15, 1.55] as V2,
  PL: [-1.345, 1.814] as V2,
  PR: [1.302, 2.124] as V2,
  diskR: 0.805,
  pins: 14,
  ringR: 0.66,
  pinR: 0.06,
  a0: 2.143,
  pit: PIT,
  rollerR: 0.12,
  arm: [0.8445, 0.3992] as V2,
  Tb: 2.4,
  turn: PIT + 9, // 34.714° — 한 박자에 앞으로 돌리는 각
  back: 9,
  fall: 33.8
} as const;
const K = K233;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
/** Z 방향 원기둥(z0 → z1, 앞끝 모따기 c1) */
function cylZ(r: number, z0: number, z1: number, c0 = 0.004, c1 = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c0, c1), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function discShape(r: number, hole: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  s.holes.push(circlePath(0, 0, hole));
  return s;
}

/** 핀 k 의 중심(원판 로컬) */
export function pinCenter233(k: number): V2 {
  const a = (K.a0 + PIT * k) * D2R;
  return [K.ringR * Math.cos(a), K.ringR * Math.sin(a)];
}

/** 랜턴 바퀴: 원점 = 원판 중심, 원판 z −0.10~−0.04, 핀 z −0.04~0.06(이름 pin0~pin13, outline = 원판 로컬 원 24 점), 허브 */
export function lantern233(): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(extrude(discShape(K.diskR, 0.06), 0.06, 0.004, 64), brass(), 0, 0, -0.07));
  g.add(meshAt(tubeZ(0.06, 0.1, -0.04, 0.0, 0.003, 40), brass(), 0, 0, 0));
  g.add(meshAt(new THREE.TorusGeometry(0.16, 0.008, 8, 72), darkSteel(), 0, 0, -0.039));
  for (let k = 0; k < K.pins; k++) {
    const [cx, cy] = pinCenter233(k);
    const pin = new THREE.Group();
    pin.name = `pin${k}`;
    pin.add(meshAt(cylZ(K.pinR, -0.04, 0.06, 0, 0.008, 32), steel(), cx, cy, 0));
    pin.userData.outline = circlePts(K.pinR, 24, cx, cy);
    g.add(pin);
  }
  setMM(g, { kind: 'lantern', teeth: K.pins, axis: 'z' });
  return g;
}

/** 롤러 레버: 원점 = 받침점. 팔(스타디움 + 보스, z 0.065~0.105), 롤러 핀, 롤러(name roller, z −0.02~0.06) */
export function rollerLever233(): THREE.Group {
  const g = new THREE.Group();
  const [ax, ay] = K.arm;
  const mat = steel();
  const shape = stadiumShape(0, 0, ax, ay, 0.045);
  shape.holes.push(circlePath(0, 0, 0.032));
  g.add(meshAt(extrude(shape, 0.04, 0.003, 16), mat, 0, 0, 0.085));
  g.add(meshAt(tubeZ(0.032, 0.07, 0.062, 0.108, 0.003, 40), mat, 0, 0, 0));
  g.add(meshAt(cylZ(0.025, -0.02, 0.105, 0.003, 0.003, 24), darkSteel(), ax, ay, 0));
  const roller = new THREE.Group();
  roller.name = 'roller';
  roller.position.set(ax, ay, 0);
  const rm = brass();
  roller.add(meshAt(extrude(discShape(K.rollerR, 0.027), 0.08, 0.004, 48), rm, 0, 0, 0.02));
  roller.add(meshAt(new THREE.TorusGeometry(0.06, 0.006, 8, 48), darkSteel(), 0, 0, 0.0605));
  roller.userData.mat = rm;
  roller.userData.outline = circlePts(K.rollerR, 48);
  g.add(roller);
  g.userData.mat = mat;
  setMM(g, { kind: 'lever', pivot: [0, 0, 0] });
  return g;
}

/** 막대 폴 점열(로컬 = 받침점 기준, 반시계 25 점) */
export const BAR233: V2[] = [[0.0158,-0.1891],[0.0379,-0.1840],[0.0585,-0.1747],[0.0770,-0.1616],[0.0925,-0.1452],[0.1046,-0.1260],[0.1126,-0.1049],[0.1164,-0.0825],[0.1158,-0.0599],[0.1126,-0.0441],[0.1050,-0.0239],[0.0931,-0.0046],[0.0825,0.0075],[0.0650,0.0218],[0.0459,0.0320],[0.0306,0.0372],[0.0092,0.0407],[-0.9536,0.0253],[-0.9609,0.0215],[-0.9641,0.0170],[-1.0589,-0.1856],[-1.0603,-0.1915],[-1.0579,-0.2001],[-1.0537,-0.2044],[-1.0451,-0.2070]];

/** 막대 폴: 원점 = 받침점, 두께 0.08(z −0.02~0.06), 구멍 0.03, outline */
export function barPawl233(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(BAR233);
  shape.holes.push(circlePath(0, 0, 0.03));
  const mat = brass();
  g.add(meshAt(extrude(shape, 0.08, 0.004, 16), mat, 0, 0, 0.02));
  g.userData.mat = mat;
  g.userData.outline = BAR233;
  setMM(g, { kind: 'pawl', fn: 'barPawl233' });
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

const TAB_R = [-0.094, 0.678, 1.351, 1.939, 2.465, 2.924, 3.343, 3.711, 4.042, 4.337, 4.595, 4.821, 5.016, 5.178, 5.312, 5.414, 5.489, 5.533, 5.553, 5.534, 5.493, 5.418, 5.316, 5.177, 5.016, 4.814, 4.579, 4.308, 4.006, 3.657, 3.274, 2.844, 2.371, 1.840, 1.257, 0.620, -0.094];
const TAB_B = [0.060, -0.276, -0.609, -0.939, -1.265, -1.588, -1.908, -2.224, -2.536, -2.845, -3.150, -3.451, -3.749, -4.044, -4.336, -4.623, -4.907, -5.186, -5.462, -5.733, -6.000, -6.263, -6.522, -6.776, -7.026, -7.273, -7.514, -7.752, -7.985, -8.214, -8.439, -8.659, -8.876, -9.088, -9.295, -9.500, -9.700, -9.897, -10.089, -10.276, -10.460, -10.640, -10.815, -10.986, -11.153, -11.316, -11.476, -11.631, -11.782, -11.929, -12.072, -12.211, -12.347, -12.478, -12.606, -12.730, -12.840, -12.931, -13.007, -13.051, -13.067, -13.060, -13.013, -12.935, -12.793, -12.591, -12.265, -11.703];
const B_LAST_PHI = 33.78;
const B_LAST = -10.864;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const sm = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** 롤러 레버 각(도): 한 피치 주기 표 */
export function tableR233(phi: number): number {
  const step = PIT / 36;
  const f = mod(phi, PIT) / step;
  const i = Math.min(35, Math.floor(f));
  return TAB_R[i]! + (TAB_R[i + 1]! - TAB_R[i]!) * (f - i);
}
/** 막대 폴 각(도): φ 0 … 33.5 는 0.5° 표, 그 뒤 마지막 점 */
export function tableB233(phi: number): number {
  const p = Math.max(0, phi);
  if (p >= B_LAST_PHI) return B_LAST;
  const f = p / 0.5;
  const i = Math.floor(f);
  if (i >= TAB_B.length - 1) {
    const lastTab = TAB_B[TAB_B.length - 1]!;
    const x0 = (TAB_B.length - 1) * 0.5;
    return lastTab + (B_LAST - lastTab) * ((p - x0) / (B_LAST_PHI - x0));
  }
  return TAB_B[i]! + (TAB_B[i + 1]! - TAB_B[i]!) * (f - i);
}

export interface State233 {
  theta: number;
  thetaMax: number;
  lamR: number;
  lamB: number;
  phase: 'turn' | 'back' | 'hold';
  u: number;
  n: number;
}

/** 233번 운동식(t = 장면 시간 초) */
export function state233(t: number): State233 {
  const n = Math.floor(t / K.Tb);
  const u = t - n * K.Tb;
  let theta: number;
  let thetaMax: number;
  let phase: 'turn' | 'back' | 'hold';
  if (u < 1.6) {
    const a = K.turn * sm(u / 1.6);
    theta = PIT * n + a;
    thetaMax = PIT * n + Math.max(K.back, a);
    phase = 'turn';
  } else if (u < 2.0) {
    theta = PIT * n + K.turn - K.back * sm((u - 1.6) / 0.4);
    thetaMax = PIT * n + K.turn;
    phase = 'back';
  } else {
    theta = PIT * (n + 1);
    thetaMax = PIT * n + K.turn;
    phase = 'hold';
  }
  const m = Math.floor((thetaMax - K.fall) / PIT) + 1;
  const phiB = Math.max(0, theta - PIT * m);
  return { theta, thetaMax, lamR: tableR233(mod(theta, PIT)), lamB: tableB233(phiB), phase, u, n };
}
