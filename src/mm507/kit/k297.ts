// 297 랜턴 바퀴 탈진기 — 핀 8 개의 랜턴 바퀴와 팔 A(진자)가 지닌 두 팔레트 B·C. 바퀴 각은 핀(원)과 팔레트 윤곽(캡슐)의 교점으로 구한다.
// 설계표 docs/mm507-sheets/297.md
import * as THREE from 'three';
import { bronze, brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, lathe, merge, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

const WC: V2 = [-0.15, 1.4];
const P: V2 = [0.463, 2.657];
const pol = (r: number, deg: number, c: V2): V2 => [c[0] + r * Math.cos(deg * D2R), c[1] + r * Math.sin(deg * D2R)];

/** 팔레트 윤곽(세계 좌표, ψ = 0): 극좌표 (r, θ) Wc 중심 */
const PALLET_B: V2[] = [pol(1.22, 37, WC), pol(0.9, 37, WC), pol(0.87, 49, WC), pol(1.22, 52, WC)];
const PALLET_C: V2[] = [pol(0.45, 14, WC), pol(0.79, 14, WC), pol(0.835, 26, WC), pol(0.45, 29, WC)];

export const K297 = {
  WC,
  P,
  RD: 1.05,
  RPC: 0.84,
  RPIN: 0.07,
  NP: 8,
  PITCH: 45,
  TH0: 4,
  AMP: 12,
  PERIOD: 2,
  /** 드롭(팔레트가 핀을 놓는 때, τ) */
  DROP_B: 0.15958,
  DROP_C: 1.11964,
  PALLET_B,
  PALLET_C,
  ARM_DIR: -95.2174,
  ARM_LEN: 1.51,
  BOB: [0.326, 1.153] as V2,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 0, 30.6239],
    [0.05, 1.877, 34.0091],
    [0.1, 3.708, 37.6796],
    [0.15, 5.448, 40.9997],
    [0.2, 7.053, 49.0865],
    [0.5, 12, 47.507],
    [1.0, 0, 51.5538],
    [1.05, -1.877, 59.4028],
    [1.1, -3.708, 65.7564],
    [1.15, -5.448, 75.6525],
    [1.5, -12, 78.0381],
    [2.0, 0, 75.6239],
    [30, 0, 705.6239]
  ] as [number, number, number][]
} as const;
const K = K297;

// ───────────────────────── 접촉 계산(캡슐 교점) ─────────────────────────

const rotAbout = (p: V2, deg: number, c: V2): V2 => {
  const cs = Math.cos(deg * D2R);
  const sn = Math.sin(deg * D2R);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
};
const wrapRef = (a: number, ref: number): number => ((((a - ref + 180) % 360) + 360) % 360) - 180 + ref;
const segDist = (p: V2, a: V2, b: V2): number => {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const s = Math.max(0, Math.min(1, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / (ax * ax + ay * ay)));
  return Math.hypot(p[0] - a[0] - s * ax, p[1] - a[1] - s * ay);
};
/** 원(c, R) 과 선분 pq 의 교점 */
function circSeg(c: V2, R: number, p: V2, q: V2): V2[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const fx = p[0] - c[0];
  const fy = p[1] - c[1];
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - R * R;
  const disc = b * b - 4 * a * cc;
  const out: V2[] = [];
  if (disc < 0 || a === 0) return out;
  const sq = Math.sqrt(disc);
  for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) if (s >= -1e-12 && s <= 1 + 1e-12) out.push([p[0] + s * dx, p[1] + s * dy]);
  return out;
}
/** 원 둘의 교점 */
function circCirc(c1: V2, r1: number, c2: V2, r2: number): V2[] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
  const xm = c1[0] + (a * dx) / d;
  const ym = c1[1] + (a * dy) / d;
  return [
    [xm + (h * dy) / d, ym - (h * dx) / d],
    [xm - (h * dy) / d, ym + (h * dx) / d]
  ];
}
/** 원(c, Rp) 위에서 선분 ab 까지 거리가 정확히 r 인 점들 */
function capsuleHits(c: V2, Rp: number, a: V2, b: V2, r: number): V2[] {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const L = Math.hypot(ax, ay);
  const nx = -ay / L;
  const ny = ax / L;
  const pts: V2[] = [];
  for (const sg of [1, -1]) {
    pts.push(...circSeg(c, Rp, [a[0] + sg * r * nx, a[1] + sg * r * ny], [b[0] + sg * r * nx, b[1] + sg * r * ny]));
  }
  pts.push(...circCirc(c, Rp, a, r), ...circCirc(c, Rp, b, r));
  return pts.filter((p) => Math.abs(segDist(p, a, b) - r) < 1e-9);
}

/** 한 팔레트(윤곽 4 점)의 세 변에 핀 k 가 닿는 바퀴 각 φ(도). 안 닿으면 null — α 가 가장 작은 교점 */
export function contact297(pallet: 'B' | 'C', k: number, psi: number, ref: number): number | null {
  const face = pallet === 'B' ? K.PALLET_B : K.PALLET_C;
  const fw = face.map((q) => rotAbout(q, psi, K.P));
  let best: number | null = null;
  for (let i = 0; i < fw.length - 1; i++) {
    for (const q of capsuleHits(K.WC, K.RPC, fw[i]!, fw[i + 1]!, K.RPIN)) {
      const a = wrapRef(Math.atan2(q[1] - K.WC[1], q[0] - K.WC[0]) / D2R, ref);
      if (best === null || a < best) best = a;
    }
  }
  return best === null ? null : best - (K.TH0 + K.PITCH * k);
}

export interface State297 {
  psi: number;
  phi: number;
  holder: 'B' | 'C';
  justDropped: boolean;
}

export function justDropped297(t: number): boolean {
  const tau = t - Math.floor(t / K.PERIOD + 1e-12) * K.PERIOD;
  return (tau >= K.DROP_B && tau < K.DROP_B + 0.1) || (tau >= K.DROP_C && tau < K.DROP_C + 0.1);
}

export function state297(t: number): State297 {
  const n = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - n * K.PERIOD;
  const psi = K.AMP * Math.sin(Math.PI * tau);
  let phi: number | null;
  let holder: 'B' | 'C';
  if (tau < 0.5) {
    phi = contact297('B', 0, psi, 33);
    holder = 'B';
    if (phi === null) {
      phi = contact297('C', -1, psi, 10);
      holder = 'C';
    }
  } else if (tau < 1.5) {
    phi = contact297('C', -1, psi, 10);
    holder = 'C';
    if (phi === null) {
      phi = contact297('B', -1, psi, 33);
      holder = 'B';
    }
  } else {
    phi = contact297('B', -1, psi, 33);
    holder = 'B';
  }
  if (phi === null) {
    // 설계표대로면 일어나지 않는다(드롭 순간의 수치 경계만) — 반대 팔레트로 한 번 더
    phi = holder === 'B' ? contact297('C', -1, psi, 10) : contact297('B', -1, psi, 33);
    holder = holder === 'B' ? 'C' : 'B';
    if (phi === null) phi = 0;
  }
  return { psi, phi: phi + K.PITCH * n, holder, justDropped: justDropped297(t) };
}

// ───────────────────────── 부품 ─────────────────────────

const zCyl = (r: number, z0: number, z1: number, x: number, y: number, c0 = 0, c1 = 0): THREE.BufferGeometry => {
  const g = lathe(rodProfile(r, z0, z1, c0, c1), 40);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, 0);
  return g;
};

/** 랜턴 바퀴 묶음(원점 = Wc, 회전축 Z): 원판 `pinWheel`, 핀 `pins`, 태엽통 `barrel` */
export function pinWheel297(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const wmat = brass();
  const shape = shapeFrom(circlePts(K.RD, 96));
  shape.holes.push(circlePath(0, 0, 0.047));
  const geo = extrude(shape, 0.06, 0, 8);
  geo.translate(0, 0, -0.03);
  const disc = mesh(geo, wmat);
  disc.name = 'pinWheel';
  g.add(disc);
  // 테두리 홈 고리 z -0.001~0.004
  const ringGeo = lathe(tubeProfile(0.975, 0.985, -0.001, 0.004), 96);
  ringGeo.rotateX(Math.PI / 2);
  g.add(mesh(ringGeo, darkSteel()));
  // 핀 8
  const pinGeos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < K.NP; k++) {
    const [x, y] = pol(K.RPC, K.TH0 + K.PITCH * k, [0, 0]);
    pinGeos.push(zCyl(K.RPIN, -0.03, 0.12, x, y, 0, 0.004));
  }
  const pins = mesh(merge(pinGeos), steel());
  pins.name = 'pins';
  g.add(pins);
  const [mx, my] = pol(K.RPC, K.TH0, [0, 0]);
  g.add(mesh(zCyl(0.035, 0.118, 0.124, mx, my), paint(0xd03020)));
  // 칼라 z -0.002~0.05
  const colGeo = lathe(tubeProfile(0.047, 0.16, -0.002, 0.05), 48);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, darkSteel()));
  // 태엽통 z -0.19~-0.08
  const barGeo = lathe(tubeProfile(0.047, 0.5, -0.19, -0.08), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  g.userData.wheelMat = wmat;
  return g;
}

/** 팔 A 묶음(원점 = P, 회전축 Z): 팔 `pendulumArm`(반투명), 허브, 추 `bob`, 팔레트 `palletB`·`palletC` */
export function arm297(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'armGroup';
  const loc = (p: V2): V2 => [p[0] - K.P[0], p[1] - K.P[1]];
  // 팔 띠 윤곽(P 원점): 위 끝 반지름 0.085 반원, 아래로 길이 1.51, 반폭 0.07
  const R = 0.085;
  const w = 0.07;
  const L = K.ARM_LEN;
  const l0 = Math.sqrt(R * R - w * w);
  const a0 = Math.atan2(w, l0);
  const ux = Math.cos(K.ARM_DIR * D2R);
  const uy = Math.sin(K.ARM_DIR * D2R);
  const at = (l: number, o: number): V2 => [l * ux - o * uy, l * uy + o * ux];
  const outline: V2[] = [at(l0, -w), at(L, -w), at(L, w), at(l0, w)];
  const dir = K.ARM_DIR * D2R;
  for (let i = 0; i <= 24; i++) {
    const a = dir + a0 + ((2 * Math.PI - 2 * a0) * i) / 24;
    outline.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  const armShape = shapeFrom(outline);
  armShape.holes.push(circlePath(0, 0, 0.032));
  const armGeo = extrude(armShape, 0.04, 0, 8);
  armGeo.translate(0, 0, 0.15);
  const plates = [K.PALLET_B, K.PALLET_C].map((pts) => {
    const gg = extrude(shapeFrom(pts.map(loc)), 0.04, 0, 4);
    gg.translate(0, 0, 0.15);
    return gg;
  });
  const armMat = bronze();
  armMat.transparent = true;
  armMat.opacity = 0.45;
  armMat.depthWrite = false;
  const armMesh = mesh(merge([armGeo, ...plates]), armMat);
  armMesh.name = 'pendulumArm';
  armMesh.castShadow = false;
  g.add(armMesh);
  // 허브 z 0.168~0.20
  const hubGeo = lathe(tubeProfile(0.032, 0.06, 0.168, 0.2), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 추
  const [bx, by] = loc(K.BOB);
  const bob = mesh(zCyl(0.12, 0.129, 0.19, bx, by, 0, 0.004), brass());
  bob.name = 'bob';
  g.add(bob);
  // 팔레트
  const mB = steel();
  const mC = steel();
  const mk = (pts: V2[], name: string, mat: THREE.Material): void => {
    const lp = pts.map(loc);
    const geo = extrude(shapeFrom(lp), 0.111, 0, 4);
    geo.translate(0, 0, 0.0755);
    const m = mesh(geo, mat);
    m.name = name;
    m.userData.outline = lp;
    g.add(m);
  };
  mk(K.PALLET_B, 'palletB', mB);
  mk(K.PALLET_C, 'palletC', mC);
  g.userData.matB = mB;
  g.userData.matC = mC;
  return g;
}
