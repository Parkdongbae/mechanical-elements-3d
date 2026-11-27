// 292번 스터드(핀 바퀴) 탈진기 전용 키트 — 핀 바퀴·닻·팔레트·진자와 접촉 계산(원·원, 원·선분 교점). 설계표 docs/mm507-sheets/292.md
// 진자(닻) 각 ψ 만 시간표이고, 바퀴 각 φ 는 핀(원)이 팔레트 윤곽에 처음 닿는 각으로 매번 계산한다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, lathe, merge, mesh, pathFrom, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

const WC: V2 = [-0.55, 1.25];
const RP = 0.95;
const L = 1.25;
const E: V2 = [WC[0] + RP * Math.cos(30 * D2R), WC[1] + RP * Math.sin(30 * D2R)];
const F: V2 = [E[0] - L * Math.sin(30 * D2R), E[1] + L * Math.cos(30 * D2R)];
const RPIN = 0.03;
const RHO = L + RPIN;
const T = 0.11;
const HI = 0.095;
const LAMD = 0.02;
const WS = 0.035;
const NOUT = 0.16;
const CHI_E = Math.atan2(E[1] - F[1], E[0] - F[0]) / D2R;

export const K292 = {
  WC,
  E,
  F,
  L,
  RP,
  RPIN,
  NALT: 30,
  ALT: 12,
  RHO,
  T,
  HI,
  LAMD,
  WS,
  NOUT,
  AMP: 5,
  PERIOD: 2,
  CHI_E,
  /** 앞 핀 0 이 φ = 0 에서 E 에 있는 바퀴 각 */
  TH0: 30,
  /** 놓는(드롭) 때 τ */
  DROP_B: 0.24138,
  DROP_A: 1.31695,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 0, 0],
    [0.05, 0.7822, 0],
    [0.1, 1.5451, -0.2058],
    [0.15, 2.27, -1.5467],
    [0.2, 2.9389, -4.3965],
    [0.24, 3.4227, -7.0399],
    [0.3, 4.0451, -12],
    [1.0, 0, -12],
    [1.1, -1.5451, -12.2055],
    [1.2, -2.9389, -15.623],
    [1.3, -4.0451, -19.123],
    [1.35, -4.455, -24],
    [2.0, 0, -24],
    [30, 0, -360]
  ] as [number, number, number][]
} as const;

// ───────────────────────── 팔레트 윤곽(닻 좌표, F 원점) ─────────────────────────

const polF = (r: number, chiDeg: number): V2 => [r * Math.cos(chiDeg * D2R), r * Math.sin(chiDeg * D2R)];
/** 옆 거리 n(바퀴 반지름 방향, 바깥 +) → F 에서 본 각 χ */
const chiOf = (n: number): number => CHI_E + (n / L) / D2R;
const arcF = (r: number, n0: number, n1: number, m: number): V2[] => {
  const o: V2[] = [];
  for (let i = 0; i <= m; i++) o.push(polF(r, chiOf(n0 + ((n1 - n0) * i) / m)));
  return o;
};
const ARC_N = 200;
const nTB = -LAMD - WS;
const nTA = LAMD + WS;

/** 팔레트 B(앞): 잠금면 원호 → 비탈 → 끝면 → 아랫면 원호. 앞 ARC_N+1 점이 잠금면 */
export const PAL_B: V2[] = [
  ...arcF(RHO, NOUT, nTB + WS, ARC_N),
  polF(RHO + HI, chiOf(nTB)),
  polF(RHO + T, chiOf(nTB)),
  ...arcF(RHO + T, nTB, NOUT, ARC_N)
];
/** 팔레트 A(뒤) */
export const PAL_A: V2[] = [
  ...arcF(RHO, -NOUT, nTA - WS, ARC_N),
  polF(RHO + HI, chiOf(nTA)),
  polF(RHO + T, chiOf(nTA)),
  ...arcF(RHO + T, nTA, -NOUT, ARC_N)
];

// ───────────────────────── 접촉 계산 ─────────────────────────

type Kind = 'lock' | 'impulse';

const rotP = (p: V2, deg: number): V2 => {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** 원(c1, r1) ∩ 원(c2, r2) */
function circCirc(c1: V2, r1: number, c2: V2, r2: number): V2[] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const ex = dx / d;
  const ey = dy / d;
  const mx = c1[0] + a * ex;
  const my = c1[1] + a * ey;
  return [
    [mx - h * ey, my + h * ex],
    [mx + h * ey, my - h * ex]
  ];
}

/** 원(c, R) ∩ 선분(p, q) */
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
  for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) if (s >= 0 && s <= 1) out.push([p[0] + s * dx, p[1] + s * dy]);
  return out;
}

function inPoly(pt: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distPoly(pt: V2, poly: V2[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l2 = dx * dx + dy * dy;
    let u = l2 === 0 ? 0 : ((pt[0] - p[0]) * dx + (pt[1] - p[1]) * dy) / l2;
    u = Math.max(0, Math.min(1, u));
    best = Math.min(best, Math.hypot(pt[0] - p[0] - u * dx, pt[1] - p[1] - u * dy));
  }
  return best;
}

/** 바퀴 중심에서 잰 각(ref 둘레 ±180°) */
const angAbout = (p: V2, ref: number): number => {
  const a = Math.atan2(p[1] - WC[1], p[0] - WC[0]) / D2R;
  return ((((a - ref + 180) % 360) + 360) % 360) - 180 + ref;
};

/**
 * 핀(바퀴 좌표 각 base, φ = 0)이 팔레트(F 좌표 윤곽 local, ψ 만큼 F 둘레로 돌림)에 처음 닿는 바퀴 각 φ(도)와 닿은 면.
 * 후보: 잠금면·아랫면의 정확한 원호(원·원), 꼭짓점 둘레 원(원·원), 곧은 변을 0.03 평행이동한 선분(원·선분)
 */
function contactPoly(local: V2[], base: number, psi: number): { phi: number; face: Kind } | null {
  const poly = local.map((p) => {
    const r = rotP(p, psi);
    return [r[0] + F[0], r[1] + F[1]] as V2;
  });
  const n = poly.length;
  const cand: { p: V2; face: Kind }[] = [];
  cand.push(...circCirc(WC, RP, F, RHO - RPIN).map((p) => ({ p, face: 'lock' as Kind })));
  cand.push(...circCirc(WC, RP, F, RHO + T + RPIN).map((p) => ({ p, face: 'impulse' as Kind })));
  for (let i = 0; i < n; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % n]!;
    const kind: Kind = i < ARC_N ? 'lock' : 'impulse';
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const ln = Math.hypot(dx, dy);
    if (ln < 1e-12) continue;
    // 가까이 안 오는 변은 건너뜀(바퀴 중심에서 핀 길 원까지 거리 > 변 길이 + 핀 반지름 + 여유)
    const dm = Math.hypot((p[0] + q[0]) / 2 - WC[0], (p[1] + q[1]) / 2 - WC[1]);
    if (Math.abs(dm - RP) > ln / 2 + RPIN + 1e-3) continue;
    for (const pt of circCirc(WC, RP, p, RPIN)) cand.push({ p: pt, face: kind });
    const nx = -dy / ln;
    const ny = dx / ln;
    for (const sg of [1, -1]) {
      const p2: V2 = [p[0] + sg * RPIN * nx, p[1] + sg * RPIN * ny];
      const q2: V2 = [q[0] + sg * RPIN * nx, q[1] + sg * RPIN * ny];
      for (const pt of circSeg(WC, RP, p2, q2)) cand.push({ p: pt, face: kind });
    }
  }
  let best: { a: number; face: Kind } | null = null;
  for (const c of cand) {
    if (inPoly(c.p, poly)) continue;
    const dd = distPoly(c.p, poly);
    if (dd < RPIN - 1e-6 || dd > RPIN + 1e-6) continue;
    const a = angAbout(c.p, 30);
    if (best === null || a > best.a) best = { a, face: c.face };
  }
  return best === null ? null : { phi: best.a - base, face: best.face };
}

/** 팔레트 B/A 에 핀 j 가 닿는 바퀴 각 φ(도). 안 닿으면 null */
export function contact292(pallet: 'B' | 'A', j: number, psi: number): number | null {
  const r = contactPoly(pallet === 'B' ? PAL_B : PAL_A, K292.TH0 + K292.ALT * j, psi);
  return r === null ? null : r.phi;
}

export interface State292 {
  psi: number;
  phi: number;
  holder: 'B' | 'A';
  face: Kind;
  justDropped: boolean;
}

export function state292(t: number): State292 {
  const n = Math.floor(t / K292.PERIOD + 1e-12);
  const tau = t - n * K292.PERIOD;
  const psi = K292.AMP * Math.sin(Math.PI * tau);
  const tryB = (j: number) => contactPoly(PAL_B, K292.TH0 + K292.ALT * j, psi);
  const tryA = (j: number) => contactPoly(PAL_A, K292.TH0 + K292.ALT * j, psi);
  let r: { phi: number; face: Kind } | null;
  let holder: 'B' | 'A';
  if (tau < 0.5) {
    r = tryB(0);
    holder = 'B';
    if (r === null) {
      r = tryA(1);
      holder = 'A';
    }
  } else if (tau < 1.5) {
    r = tryA(1);
    holder = 'A';
    if (r === null) {
      r = tryB(2);
      holder = 'B';
    }
  } else {
    r = tryB(2);
    holder = 'B';
  }
  // 설계표대로면 일어나지 않는다(드롭 순간의 수치 경계만) — 반대 팔레트로 한 번 더 시도
  if (r === null) {
    r = holder === 'B' ? tryA(tau < 1.5 ? 1 : 3) : tryB(2);
    holder = holder === 'B' ? 'A' : 'B';
  }
  const res = r ?? { phi: 0, face: 'lock' as Kind };
  const jd = (tau >= K292.DROP_B && tau < K292.DROP_B + 0.1) || (tau >= K292.DROP_A && tau < K292.DROP_A + 0.1);
  return { psi, phi: res.phi - 2 * K292.ALT * n, holder, face: res.face, justDropped: jd };
}

// ───────────────────────── 핀 바퀴 ─────────────────────────

/** 바퀴 판 윤곽(바퀴 중심 원점): 테 0.88~1.02 + 살 4(폭 0.08, 45°·135°·225°·315°) + 허브 원판 0.12. 한 다각형(바깥 원 + 창 구멍 4) */
function wheelShape(): THREE.Shape {
  const RO = 1.02;
  const RI = 0.88;
  const RH = 0.12;
  const hw = 0.04;
  const shape = shapeFrom(circlePts(RO, 160));
  const at = (dirDeg: number, s: number, o: number): V2 => {
    const ux = Math.cos(dirDeg * D2R);
    const uy = Math.sin(dirDeg * D2R);
    return [s * ux - o * uy, s * uy + o * ux];
  };
  const sOut = Math.sqrt(RI * RI - hw * hw);
  const sIn = Math.sqrt(RH * RH - hw * hw);
  const angOf = (p: V2): number => Math.atan2(p[1], p[0]) / D2R;
  for (let j = 0; j < 4; j++) {
    const ta = 45 + 90 * j;
    const tb = ta + 90;
    const pts: V2[] = [at(ta, sIn, hw), at(ta, sOut, hw)];
    const a0 = angOf(pts[1]!);
    const bOut = at(tb, sOut, -hw);
    const a1 = angOf(bOut) + (angOf(bOut) < a0 ? 360 : 0);
    for (let i = 1; i < 20; i++) {
      const a = a0 + ((a1 - a0) * i) / 20;
      pts.push([RI * Math.cos(a * D2R), RI * Math.sin(a * D2R)]);
    }
    pts.push(bOut, at(tb, sIn, -hw));
    const last = pts[pts.length - 1]!;
    const b0 = angOf(last) + (angOf(last) < a0 ? 360 : 0);
    const b1 = angOf(at(ta, sIn, hw)) + (angOf(at(ta, sIn, hw)) < a0 ? 360 : 0);
    for (let i = 1; i < 8; i++) {
      const a = b0 + ((b1 - b0) * i) / 8;
      pts.push([RH * Math.cos(a * D2R), RH * Math.sin(a * D2R)]);
    }
    shape.holes.push(pathFrom(pts));
  }
  shape.holes.push(circlePath(0, 0, 0.042));
  return shape;
}

function studs(js: number[], z0: number, z1: number, mat: THREE.Material, name: string): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  for (const j of js) {
    const a = (K292.TH0 + K292.ALT * j) * D2R;
    const g = new THREE.CylinderGeometry(RPIN, RPIN, z1 - z0, 24);
    g.rotateX(Math.PI / 2);
    g.translate(RP * Math.cos(a), RP * Math.sin(a), (z0 + z1) / 2);
    geos.push(g);
  }
  const m = mesh(merge(geos), mat);
  m.name = name;
  return m;
}

/** 핀 바퀴 + 핀 30 + 허브 칼라 + 빨간 표시 + 태엽통. 원점 = 바퀴 축, 회전축 = 로컬 Z. 몸통 메시 name `escapeWheel`·`frontStuds`·`backStuds`·`barrel` */
export function pinWheel292(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const geo = extrude(wheelShape(), 0.06, 0, 8);
  geo.translate(0, 0, 0.03);
  const wmat = brass();
  wmat.transparent = true;
  wmat.opacity = 0.55;
  wmat.depthWrite = false;
  const plate = mesh(geo, wmat);
  plate.name = 'escapeWheel';
  g.add(plate);
  const front: number[] = [];
  const back: number[] = [];
  for (let j = 0; j < K292.NALT; j++) (j % 2 === 0 ? front : back).push(j);
  // 핀은 판 속에 0.002 박음
  g.add(studs(front, 0.058, 0.15, steel(), 'frontStuds'));
  g.add(studs(back, -0.09, 0.002, steel(), 'backStuds'));
  // 허브 칼라 z 0.058~0.09
  const colGeo = lathe(tubeProfile(0.042, 0.08, 0.058, 0.09), 40);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, darkSteel()));
  // 뒤 칼라(판과 태엽통을 이음) z −0.082~0.002
  const rColGeo = lathe(tubeProfile(0.042, 0.07, -0.082, 0.002), 32);
  rColGeo.rotateX(Math.PI / 2);
  g.add(mesh(rColGeo, darkSteel()));
  // 빨간 표시 — 살(45°) 위, 반지름 0.60, 길이 0.12(살 방향) × 0.03 × 0.004, 판 앞면에 0.001 박음
  const red = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.004), paint(0xd03020));
  red.position.set(0.6 * Math.cos(45 * D2R), 0.6 * Math.sin(45 * D2R), 0.061);
  red.rotation.z = 45 * D2R;
  g.add(red);
  // 태엽통 z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.4, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  const yel = mesh(new THREE.BoxGeometry(0.25, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.225, 0, -0.079);
  g.add(yel);
  g.userData.wheelMat = wmat;
  return g;
}

// ───────────────────────── 닻 ─────────────────────────

function slab(outline: V2[], z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const geo = extrude(shapeFrom(outline), z1 - z0, 0, 6);
  geo.translate(0, 0, (z0 + z1) / 2);
  return mesh(geo, mat);
}

/** 두 점(F 좌표)을 잇는 폭 w 막대, z0~z1 */
function bar(a: V2, b: V2, w: number, z0: number, z1: number, mat: THREE.Material, name?: string): THREE.Mesh {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = mesh(new THREE.BoxGeometry(len, w, z1 - z0), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z0 + z1) / 2);
  m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (name) m.name = name;
  return m;
}

/** 닻(허브·팔레트 둘·다리 둘·뒤 기둥·진자). 원점 = 닻 축 F, 회전축 = 로컬 Z. 몸통 메시 name `anchorHub`·`palletB`·`palletA`·`armB`·`armA`·`pendulumRod`·`pendulumBob` */
export function anchor292(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'anchorGroup';
  const hubGeo = lathe(tubeProfile(0.042, 0.1, -0.19, 0.14), 48);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.name = 'anchorHub';
  g.add(hub);
  const bossGeo = lathe(tubeProfile(0.042, 0.06, 0.138, 0.2), 40);
  bossGeo.rotateX(Math.PI / 2);
  g.add(mesh(bossGeo, darkSteel()));

  const mB = steel();
  const mA = steel();
  const pB = slab(PAL_B, 0.08, 0.14, mB);
  pB.name = 'palletB';
  pB.userData.outline = PAL_B;
  const pA = slab(PAL_A, -0.08, -0.02, mA);
  pA.name = 'palletA';
  pA.userData.outline = PAL_A;
  g.add(pB, pA);

  // 앞 다리: 팔레트 B 바깥끝 가운데(r 1.355 — 팔레트 속에 0.02) 에서 F 까지, z 0.082~0.138(허브·팔레트와 끝면이 겹치지 않게 0.002 안쪽)
  const endB = polF(RHO + T / 2 + 0.02, chiOf(NOUT));
  g.add(bar([0, 0], endB, 0.06, 0.082, 0.138, darkSteel(), 'armB'));
  // 뒤 기둥: 팔레트 A 안쪽끝 가운데(r 1.335), z −0.134~−0.062(팔레트 속에 박힘), 뒤 다리와 0.002 겹침
  const postP = polF(RHO + T / 2, chiOf(-NOUT));
  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.072, 24);
  postGeo.rotateX(Math.PI / 2);
  const post = mesh(postGeo, darkSteel());
  post.position.set(postP[0], postP[1], -0.098);
  post.name = 'postA';
  g.add(post);
  g.add(bar(postP, [0, 0], 0.06, -0.188, -0.132, darkSteel(), 'armA'));

  // 진자: 막대 F → y −2.2575(추 중심), z 0.168~0.198 / 추 반지름 0.13, z 0.155~0.215
  const by = 0.55 - F[1];
  const rod = mesh(new THREE.BoxGeometry(0.03, -by, 0.03), steel());
  rod.position.set(0, by / 2, 0.183);
  rod.name = 'pendulumRod';
  g.add(rod);
  const bobGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 48);
  bobGeo.rotateX(Math.PI / 2);
  const bobMat = brass();
  const bob = mesh(bobGeo, bobMat);
  bob.position.set(0, by, 0.185);
  bob.name = 'pendulumBob';
  g.add(bob);
  g.userData.matB = mB;
  g.userData.matA = mA;
  g.userData.bobMat = bobMat;
  return g;
}
