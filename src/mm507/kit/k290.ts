// 290번 탈진기 전용 키트 — 갈고리 이 7 바퀴 D, 고리 틀 진자(팔레트 A·B), 매단 곳 C, 이끝 접촉 계산. 설계표 docs/mm507-sheets/290.md
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

/** 팔레트(D 중심 기준 점열) */
export const PALLET_A290: V2[] = [[0.775, -0.045], [0.540, -0.045], [0.540, 0.010], [0.575, 0.045], [0.775, 0.045]];
export const PALLET_B290: V2[] = [[-0.775, 0.045], [-0.540, 0.045], [-0.540, -0.010], [-0.575, -0.045], [-0.775, -0.045]];
/** 이가 닿는 꺾은선(D 기준) */
export const FACE_A290: V2[] = [[0.775, 0.045], [0.575, 0.045], [0.540, 0.010], [0.540, -0.045]];
export const FACE_B290: V2[] = [[-0.775, -0.045], [-0.575, -0.045], [-0.540, -0.010], [-0.540, 0.045]];

/** 한 주기 기대값 (t, ψ, φ) */
export const EXPECT290: [number, number, number][] = [
  [0, 0, -85.588], [0.05, 0.704, -86.103], [0.1, 1.391, -87.421], [0.25, 3.182, -107.857], [0.5, 4.5, -106.276],
  [1.0, 0, -111.303], [1.1, -1.391, -115.818], [1.25, -3.182, -140.462], [1.5, -4.5, -142.044], [2.0, 0, -137.017], [30, 0, -857.017]
];

export const K290 = {
  D: [0, 1.36] as [number, number],
  C: [0, 3.10] as [number, number],
  Z: 7,
  PITCH: 360 / 7,
  RT: 0.585,
  RR: 0.335,
  LEAD: 6,
  BACK: 34,
  BULGE: 0.2,
  RIN: 0.755,
  ROUT: 0.885,
  AMP: 4.5,
  PERIOD: 2,
  DROP: 0.10682
} as const;
const K = K290;

// ───────────────────────── 접촉 계산 ─────────────────────────

function rotAbout(p: V2, deg: number, c: V2): V2 {
  const t = deg * D2R;
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(t) - y * Math.sin(t), c[1] + x * Math.sin(t) + y * Math.cos(t)];
}

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
  if (disc < 0) return out;
  const sq = Math.sqrt(disc);
  for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) if (s >= 0 && s <= 1) out.push([p[0] + s * dx, p[1] + s * dy]);
  return out;
}

/** 팔레트 pallet('A'|'B') 에 이 k 의 끝이 닿는 바퀴 각 φ(도), 진자 각 psi(도). 닿지 않으면 null */
export function contact290(pallet: 'A' | 'B', k: number, psi: number): number | null {
  const face = (pallet === 'A' ? FACE_A290 : FACE_B290).map(([x, y]) => [x + K.D[0], y + K.D[1]] as V2);
  const ref = pallet === 'A' ? 0 : -180;
  const dp = rotAbout(K.D, -psi, K.C);
  let best: number | null = null;
  for (let i = 0; i < face.length - 1; i++) {
    for (const q of circSeg(dp, K.RT, face[i]!, face[i + 1]!)) {
      const qw = rotAbout(q, psi, K.C);
      let al = Math.atan2(qw[1] - K.D[1], qw[0] - K.D[0]) / D2R;
      al = ((((al - ref + 180) % 360) + 360) % 360) - 180 + ref;
      if (best === null || al > best) best = al;
    }
  }
  return best === null ? null : best - (90 - K.PITCH * k);
}

export interface State290 {
  psi: number;
  phi: number;
  holder: 'A' | 'B';
  justDropped: boolean;
}

export function state290(t: number): State290 {
  const n = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - n * K.PERIOD;
  const psi = K.AMP * Math.sin(Math.PI * tau);
  let holder: 'A' | 'B' = 'A';
  let p: number | null;
  if (tau < 0.5) {
    p = contact290('A', 0, psi);
    if (p === null) {
      p = contact290('B', 3, psi);
      holder = 'B';
    }
  } else if (tau < 1.5) {
    p = contact290('B', 3, psi);
    holder = 'B';
    if (p === null) {
      p = contact290('A', -1, psi);
      holder = 'A';
    }
  } else {
    p = contact290('A', -1, psi);
  }
  const phi = (p ?? 0) - K.PITCH * n;
  const justDropped = (tau >= K.DROP && tau < K.DROP + 0.1) || (tau >= K.DROP + 1 && tau < K.DROP + 1.1);
  return { psi, phi, holder, justDropped };
}

// ───────────────────────── 탈진 바퀴 ─────────────────────────

/** 바퀴 윤곽(바퀴 좌표, 반시계로 돌려 줌) */
export function wheelOutline290(): V2[] {
  const pol = (r: number, a: number): V2 => [r * Math.cos(a * D2R), r * Math.sin(a * D2R)];
  const pts: V2[] = [];
  for (let k = 0; k < K.Z; k++) {
    const th = 90 - K.PITCH * k;
    const B = pol(K.RR, th + K.BACK);
    const T = pol(K.RT, th);
    const mx = B[0] + T[0];
    const my = B[1] + T[1];
    const ml = Math.hypot(mx, my);
    for (let i = 0; i < 12; i++) {
      const s = i / 12;
      pts.push([(1 - s) * B[0] + s * T[0] + K.BULGE * s * (1 - s) * (mx / ml), (1 - s) * B[1] + s * T[1] + K.BULGE * s * (1 - s) * (my / ml)]);
    }
    pts.push(T);
    // 앞면 → F_k, 뿌리 원호 → B_(k+1)
    const a0 = th + K.LEAD;
    const a1 = th - K.PITCH + K.BACK;
    const N = 8;
    for (let i = 0; i < N; i++) pts.push(pol(K.RR, a0 + ((a1 - a0) * i) / N));
  }
  return pts.reverse();
}

/** 탈진 바퀴 + 허브 칼라 + 표시 + 태엽통. 원점 = D 축, 회전축 = 로컬 Z */
export function escWheel290(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'escWheel';
  const outline = wheelOutline290();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.042));
  const geo = extrude(shape, 0.06, 0, 8);
  geo.translate(0, 0, 0.03);
  const mat = brass();
  const wheel = mesh(geo, mat);
  wheel.name = 'escapeWheel';
  wheel.userData.outline = outline;
  g.add(wheel);
  const colGeo = lathe(tubeProfile(0.042, 0.075, 0.06, 0.083, 0.003), 40);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, darkSteel()));
  const red = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.004), paint(0xd03020));
  red.position.set(0.22, 0, 0.062);
  g.add(red);
  // 태엽통
  const bGeo = lathe(tubeProfile(0.042, 0.45, -0.19, -0.08, 0.004), 64);
  bGeo.rotateX(Math.PI / 2);
  const barrel = mesh(bGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  const yel = mesh(new THREE.BoxGeometry(0.25, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.3, 0, -0.078);
  g.add(yel);
  g.userData.mat = mat;
  return g;
}

// ───────────────────────── 고리 틀(진자) ─────────────────────────

/** 고리 틀 진자. 원점 = C(세계 (0, 3.10)), 회전축 = 로컬 Z. 안의 좌표 = 세계 − C. name `pendulum` */
export function ringFrame290(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pendulum';
  const dy = K.D[1] - K.C[1]; // 바퀴 중심의 로컬 y
  const bz = bronze();
  // 고리
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, dy, K.ROUT, 0, Math.PI * 2, false);
  ringShape.holes.push(circlePath(0, dy, K.RIN));
  const ringGeo = extrude(ringShape, 0.1, 0, 64);
  ringGeo.translate(0, 0, 0.03);
  const ring = mesh(ringGeo, bz);
  ring.name = 'ringFrame';
  g.add(ring);
  // 위 허브
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.07, 0, Math.PI * 2, false);
  hubShape.holes.push(circlePath(0, 0, 0.032));
  const hubGeo = extrude(hubShape, 0.1, 0, 32);
  hubGeo.translate(0, 0, 0.03);
  const hub = mesh(hubGeo, bz);
  hub.name = 'ringHub';
  g.add(hub);
  // 위 막대 y 2.235~3.08, 아래 막대 y 0.40~0.485 (z 는 고리보다 얇게)
  const upLen = 3.08 - 2.235;
  const up = mesh(new THREE.BoxGeometry(0.05, upLen, 0.09), bz);
  up.position.set(0, (2.235 + 3.08) / 2 - K.C[1], 0.03);
  up.name = 'ringBar';
  g.add(up);
  const lo = mesh(new THREE.BoxGeometry(0.05, 0.085, 0.09), bz);
  lo.position.set(0, (0.4 + 0.485) / 2 - K.C[1], 0.03);
  lo.name = 'pendulumRod';
  g.add(lo);
  // 추
  const bobGeo = new THREE.SphereGeometry(0.11, 40, 24);
  bobGeo.scale(1, 1, 0.06 / 0.11);
  const bob = mesh(bobGeo, brass());
  bob.name = 'bob';
  bob.position.set(0, 0.33 - K.C[1], 0.03);
  g.add(bob);
  // 팔레트
  const mats: Record<string, THREE.MeshStandardMaterial> = {};
  for (const [name, pts] of [['palletA', PALLET_A290], ['palletB', PALLET_B290]] as const) {
    const local = pts.map(([x, y]) => [x, y + dy] as V2);
    const m = steel() as THREE.MeshStandardMaterial;
    mats[name] = m;
    const pg = extrude(shapeFrom(local), 0.12, 0, 6);
    pg.translate(0, 0, 0.03);
    const pm = mesh(pg, m);
    pm.name = name;
    pm.userData.outline = local;
    g.add(pm);
  }
  g.userData.matA = mats.palletA;
  g.userData.matB = mats.palletB;
  return g;
}

// ───────────────────────── 매단 곳 ─────────────────────────

/** 매단 곳 C: 받침 상자(name `suspension`) + 핀. 세계 좌표 그대로 */
export function suspension290(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'suspensionG';
  const box = mesh(new THREE.BoxGeometry(0.24, 0.12, 0.27), castIron());
  box.name = 'suspension';
  box.position.set(0, 3.08, -0.165);
  g.add(box);
  const pinGeo = lathe(rodProfile(0.03, 0, 0.13, 0, 0.003), 24);
  pinGeo.rotateX(Math.PI / 2);
  const pin = mesh(pinGeo, steel());
  pin.position.set(0, K.C[1], -0.03);
  pin.name = 'suspensionPin';
  g.add(pin);
  const headGeo = lathe(rodProfile(0.05, 0, 0.019, 0.003, 0.004), 32);
  headGeo.rotateX(Math.PI / 2);
  const head = mesh(headGeo, steel());
  head.position.set(0, K.C[1], 0.081);
  head.name = 'suspensionHead';
  g.add(head);
  return g;
}
