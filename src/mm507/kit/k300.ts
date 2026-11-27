// 300·301번 쌍바퀴 탈진기 전용 키트 — 같은 축에 앞뒤로 붙은 탈진 바퀴 둘(반 칸 어긋남), 가로축 팔레트 판·진자, 접촉 계산.
// 설계표 docs/mm507-sheets/300.md · 301(옆모습)도 같은 기구라 이 키트를 그대로 쓴다. 시점·이름표만 모델에 둔다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

export const K300 = {
  /** 바퀴 중심(축 = z) */
  WC: [0.15, 1.95] as V2,
  /** 팔레트 축선(축 = x) y, z */
  YA: 1.1408,
  ZM: 0.12,
  Z: 16,
  PITCH: 22.5,
  RT: 0.75,
  RR: 0.58,
  LEAD: 5,
  BACK: 14,
  HALF: 11.25,
  /** 팔레트 닿는 꺾은선(묶음 단면 x, y′) */
  FACE: [
    [0.065, -0.2],
    [0.065, 0.045],
    [0.095, 0.07],
    [0.135, 0.07]
  ] as V2[],
  /** 이가 닿는 바퀴 면 깊이(축선 z 기준) — [ψ ≥ 0, ψ < 0] */
  ZE: { front: [0.16, 0.12], back: [-0.12, -0.16] } as const,
  AMP: 20,
  PERIOD: 2,
  /** 드롭(이가 팔레트를 놓는 때, τ) */
  DROP_A: 0.08387431,
  DROP_B: 1.08387431,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 0, -16.1923],
    [0.04, 2.507, -15.758],
    [0.08, 4.974, -13.5822],
    [0.1, 6.18, -6.3909],
    [0.25, 14.142, -6.5075],
    [0.5, 20, -6.5075],
    [1.0, 0, -4.9423],
    [1.04, -2.507, -4.508],
    [1.08, -4.974, -2.3322],
    [1.1, -6.18, 4.8591],
    [1.5, -20, 4.7425],
    [2.0, 0, 6.3077],
    [30, 0, 321.3077]
  ] as [number, number, number][]
} as const;
const K = K300;

const pol = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];

// ───────────────────────── 접촉 계산 ─────────────────────────

const wrapNear = (a: number, ref: number): number => ((((a - ref + 180) % 360) + 360) % 360) - 180 + ref;

/** 이 k(앞 바퀴 θ = −90−22.5k, 뒤 바퀴는 +11.25°)의 이끝이 팔레트 머리 윤곽에 닿는 바퀴 각 φ(도). 안 닿으면 null */
export function contact300(front: boolean, k: number, psi: number, ref = -96): number | null {
  const sr = psi * D2R;
  const ze = (front ? K.ZE.front : K.ZE.back)[psi >= 0 ? 0 : 1];
  const pts = K.FACE.map(([x, y]) => [x, K.YA + y / Math.cos(sr) + ze * Math.tan(sr)] as V2);
  const [cx, cy] = K.WC;
  let best: number | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const fx = p[0] - cx;
    const fy = p[1] - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - K.RT * K.RT;
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a === 0) continue;
    const sq = Math.sqrt(disc);
    for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (s < -1e-12 || s > 1 + 1e-12) continue;
      const al = wrapNear(Math.atan2(p[1] + s * dy - cy, p[0] + s * dx - cx) / D2R, ref);
      if (best === null || al < best) best = al;
    }
  }
  if (best === null) return null;
  return best - (-90 - K.PITCH * k + (front ? 0 : K.HALF));
}

export interface State300 {
  psi: number;
  phi: number;
  holder: 'front' | 'back';
  justDropped: boolean;
}

export function justDropped300(t: number): boolean {
  const tau = t - Math.floor(t / K.PERIOD + 1e-12) * K.PERIOD;
  return (tau >= K.DROP_A && tau < K.DROP_A + 0.1) || (tau >= K.DROP_B && tau < K.DROP_B + 0.1);
}

export function state300(t: number): State300 {
  const n = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - n * K.PERIOD;
  const psi = K.AMP * Math.sin(Math.PI * tau);
  let phi: number | null;
  let holder: 'front' | 'back';
  if (tau < 0.5) {
    phi = contact300(false, 0, psi);
    holder = 'back';
    if (phi === null) {
      phi = contact300(true, 0, psi);
      holder = 'front';
    }
  } else if (tau < 1.5) {
    phi = contact300(true, 0, psi);
    holder = 'front';
    if (phi === null) {
      phi = contact300(false, 1, psi);
      holder = 'back';
    }
  } else {
    phi = contact300(false, 1, psi);
    holder = 'back';
  }
  // 설계표대로면 드롭 순간의 수치 경계에서만 — 튀지 않게 반대 바퀴로 한 번 더
  if (phi === null) {
    const alt = holder === 'back' ? contact300(true, 0, psi) : contact300(false, 1, psi);
    phi = alt ?? 0;
  }
  return { psi, phi: phi + K.PITCH * n, holder, justDropped: justDropped300(t) };
}

// ───────────────────────── 바퀴 ─────────────────────────

/** 탈진 바퀴 윤곽(바퀴 좌표, 시계 차례 단순 다각형) — off 만큼 돌려 둔다. 이 16, 이끝 반지름 0.75 */
export function wheelOutline300(off = 0): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < K.Z; k++) {
    const th = -90 - K.PITCH * k + off;
    out.push(pol(K.RR, th - K.LEAD)); // F_k
    const B = pol(K.RR, th - K.BACK);
    const T = pol(K.RT, th);
    const m = pol(1, th - K.BACK / 2);
    const P = (s: number): V2 => [(1 - s) * B[0] + s * T[0] + 0.03 * s * (1 - s) * m[0], (1 - s) * B[1] + s * T[1] + 0.03 * s * (1 - s) * m[1]];
    for (let i = 8; i >= 0; i--) out.push(P(i / 8)); // T_k … B_k
    const a0 = th - K.BACK;
    const a1 = th - K.PITCH - K.LEAD;
    for (let i = 1; i <= 3; i++) out.push(pol(K.RR, a0 + ((a1 - a0) * i) / 4));
  }
  return out;
}

function wheelMesh(off: number, z0: number, z1: number, mat: THREE.Material, name: string): THREE.Mesh {
  const outline = wheelOutline300(off);
  const shape = shapeFrom(outline);
  for (let j = 0; j < 3; j++) shape.holes.push(annularSector(0.15, 0.48, (120 * j + 15 + off) * D2R, (120 * j + 105 + off) * D2R));
  // 허브 관 바깥(0.09) 속에 묻히는 축 구멍 — 관 안벽(0.042)과 같은 자리 면을 피해 0.05
  shape.holes.push(circlePath(0, 0, 0.05));
  const geo = extrude(shape, z1 - z0, 0, 8);
  geo.translate(0, 0, (z0 + z1) / 2);
  const m = mesh(geo, mat);
  m.name = name;
  m.userData.outline = outline;
  return m;
}

/** 탈진 바퀴 둘 + 허브 관 + 빨간 표시 + 태엽통. 원점 = 바퀴 축(Wc), 회전축 = 로컬 Z.
 *  몸통 메시 name `frontWheel`(brass, z 0.24~0.28)·`backWheel`(bronze, z −0.04~0)·`barrel` */
export function escWheels300(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const mF = brass();
  const mB = bronze();
  g.add(wheelMesh(0, 0.24, 0.28, mF, 'frontWheel'));
  g.add(wheelMesh(K.HALF, -0.04, 0, mB, 'backWheel'));
  // 허브 관 — 태엽통 앞면(−0.08)에 0.002, 앞 바퀴 앞면(0.28)에서 0.004 나옴, 뒤 바퀴 뒷면(−0.04)은 속에 묻힘
  const hubGeo = lathe(tubeProfile(0.042, 0.09, -0.082, 0.284, 0.002), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 빨간 표시 — 앞 바퀴 앞면 테(반지름 0.48~0.58) 위, 각 90°
  const markMat = paint(0xd03020);
  const red = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.004), markMat);
  red.position.set(0, 0.53, 0.281);
  g.add(red);
  // 태엽통 z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.45, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  g.userData.matFront = mF;
  g.userData.matBack = mB;
  return g;
}

// ───────────────────────── 팔레트·진자 ─────────────────────────

/** 팔레트 묶음 — 원점 (0, YA, ZM), 회전축 = 로컬 X. 묶음 좌표 (x, y′, z′), x 는 세계 x 그대로.
 *  몸통 메시 name `pallet`·`palletAxle`·`pendulumRod`·`bob`, userData.matPallet = 팔레트 재질 */
export function pallet300(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'palletGroup';
  g.position.set(0, K.YA, K.ZM);
  const mP = steel();
  // 머리: 단면 (x, y′) 을 z′ −0.17~0.17 로 압출
  const headPts: V2[] = [
    [0.065, 0],
    [0.065, 0.045],
    [0.095, 0.07],
    [0.135, 0.07],
    [0.135, 0]
  ];
  const headGeo = extrude(shapeFrom(headPts), 0.34, 0, 4);
  // 반원 판: (u = −z′, v = y′) 평면 반원 반지름 0.24 + 머리 속에 묻히는 윗띠(y′ 0~0.03, |z′| ≤ 0.17), 축 구멍 0.024(축 0.025 가 구멍 벽에 0.001 박힘)
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.24, Math.PI, 2 * Math.PI, false);
  disc.lineTo(0.17, 0);
  disc.lineTo(0.17, 0.03);
  disc.lineTo(-0.17, 0.03);
  disc.lineTo(-0.17, 0);
  disc.closePath();
  disc.holes.push(circlePath(0, 0, 0.024));
  const discGeo = extrude(disc, 0.066, 0, 40);
  discGeo.rotateY(Math.PI / 2);
  discGeo.translate(0.1, 0, 0);
  // 머리와 반원 판을 한 메시 `pallet` 으로 합친다(같은 재질)
  const pallet = mesh(mergeGeos([headGeo, discGeo]), mP);
  pallet.name = 'pallet';
  pallet.userData.outline = headPts;
  g.add(pallet);

  // 팔레트 축 x −1.05~1.05 + 칼라 2(받침 안쪽 면 ±0.96 에서 0.005)
  const axGeo = lathe(rodProfile(0.025, -1.05, 1.05, 0.004, 0.004), 32);
  axGeo.rotateZ(-Math.PI / 2);
  const axle = mesh(axGeo, steel());
  axle.name = 'palletAxle';
  g.add(axle);
  for (const [x0, x1] of [
    [-0.955, -0.93],
    [0.93, 0.955]
  ] as V2[]) {
    const cg = lathe(tubeProfile(0.024, 0.045, x0, x1, 0.002), 32);
    cg.rotateZ(-Math.PI / 2);
    g.add(mesh(cg, steel()));
  }

  // 진자 막대 x 0.835~0.865, y′ −0.59~0.03 + 위 끝 고리(x 0.82~0.88)
  const rodM = brass();
  const rod = mesh(new THREE.BoxGeometry(0.03, 0.62, 0.03), rodM);
  rod.position.set(0.85, (-0.59 + 0.03) / 2, 0);
  rod.name = 'pendulumRod';
  g.add(rod);
  const ringGeo = lathe(tubeProfile(0.024, 0.05, 0.82, 0.88, 0.003), 32);
  ringGeo.rotateZ(-Math.PI / 2);
  g.add(mesh(ringGeo, rodM));
  // 추 — 구 반지름 0.11 을 x 로 0.4 배
  const bobGeo = new THREE.SphereGeometry(0.11, 40, 24);
  bobGeo.scale(0.4, 1, 1);
  const bob = mesh(bobGeo, brass());
  bob.position.set(0.85, -0.5908, 0);
  bob.name = 'bob';
  g.add(bob);
  g.userData.matPallet = mP;
  return g;
}

/** 팔레트 축 받침 2(고정) — 상자 x ±(0.96~1.04), y 1.06~1.22, z −0.302~0.18, 축 구멍 0.027. 몸통 name `axlePosts` */
export function axlePosts300(): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // (u = −z, v = y) 평면 사각 + 구멍 → x 로 0.08 압출
    const sh = new THREE.Shape();
    sh.moveTo(-0.18, 1.06);
    sh.lineTo(0.302, 1.06);
    sh.lineTo(0.302, 1.22);
    sh.lineTo(-0.18, 1.22);
    sh.closePath();
    sh.holes.push(circlePath(-K.ZM, K.YA, 0.027));
    const gg = extrude(sh, 0.08, 0, 32);
    gg.rotateY(Math.PI / 2);
    gg.translate(s * 1.0, 0, 0);
    geos.push(gg);
  }
  const merged = mergeGeos(geos);
  const m = mesh(merged, castIron());
  m.name = 'axlePosts';
  return m;
}

function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // 두 받침을 한 지오메트리로(재질 하나) — 인덱스 지오메트리를 풀어 이어 붙인다
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const p of parts) n += p.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    const c = p.getAttribute('position').count;
    pos.set(p.getAttribute('position').array as Float32Array, o * 3);
    nor.set(p.getAttribute('normal').array as Float32Array, o * 3);
    const u = p.getAttribute('uv');
    if (u) uv.set(u.array as Float32Array, o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
