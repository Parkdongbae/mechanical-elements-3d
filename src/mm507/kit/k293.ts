// 293번 듀플렉스(이중) 탈진기 전용 키트 — 잠금 이가 난 탈진 바퀴(+왕관 이), 홈 롤러·충격 팔레트·밸런스 테, 접촉 계산. 설계표 docs/mm507-sheets/293.md
// 밸런스 각 ψ 만 시간표이고 바퀴 각 φ 는 (잠금 이 끝 ↔ 롤러 윤곽) 또는 (왕관 이 원 ↔ 팔레트 B 윤곽) 접촉에서 구한다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, merge, mesh, pathFrom, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const WC: V2 = [0, 1.62];
const AC: V2 = [0, 2.84];
const RT = 1.09;
const RR = 0.16;

// ───────────────────────── 기하 도우미 ─────────────────────────
const P = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
const add = (p: V2, q: V2): V2 => [p[0] + q[0], p[1] + q[1]];
/** 원·원 교점 */
function cc(c1: V2, r1: number, c2: V2, r2: number): V2[] {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const ex = [(c2[0] - c1[0]) / d, (c2[1] - c1[1]) / d];
  const m = [c1[0] + a * ex[0]!, c1[1] + a * ex[1]!];
  return [
    [m[0]! - h * ex[1]!, m[1]! + h * ex[0]!],
    [m[0]! + h * ex[1]!, m[1]! - h * ex[0]!]
  ];
}
/** 원(c, R) ∩ 선분 p-q (매개변수 0~1) */
function circSeg(c: V2, R: number, p: V2, q: V2): V2[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const fx = p[0] - c[0];
  const fy = p[1] - c[1];
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const k = fx * fx + fy * fy - R * R;
  const disc = b * b - 4 * a * k;
  const out: V2[] = [];
  if (disc < 0) return out;
  const sq = Math.sqrt(disc);
  for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) if (s >= 0 && s <= 1) out.push([p[0] + s * dx, p[1] + s * dy]);
  return out;
}
/** p 의 c 에서 본 각(도), ref 둘레 ±180 */
function ang(p: V2, c: V2, ref: number): number {
  const a = Math.atan2(p[1] - c[1], p[0] - c[0]) * R2D;
  return ((((a - ref + 180) % 360) + 360) % 360) - 180 + ref;
}
const wrap360 = (a: number): number => ((a % 360) + 360) % 360;

// 잠긴 이 0 끝: 이끝 원과 롤러 원의 왼쪽 교점 PL
const PLc = cc(WC, RT, AC, RR);
const PL: V2 = PLc[0]![0] < PLc[1]![0] ? PLc[0]! : PLc[1]!;
const TH0 = Math.atan2(PL[1] - WC[1], PL[0] - WC[0]) * R2D;
const NUPL = Math.atan2(PL[1] - AC[1], PL[0] - AC[0]) * R2D;

export const K293 = {
  WC,
  A: AC,
  Z: 12,
  PITCH: 30,
  RT,
  RRIM: 0.86,
  RIN: 0.7,
  TH0,
  TL: 5,
  TB: 12,
  RC: 0.76,
  RCP: 0.035,
  DC: 12,
  RR,
  HN: 0.08,
  N1: -105.4,
  WN: 40,
  CH: 10,
  CHD: 0.02,
  WT: 15,
  CHB: -131.2,
  RB0: 0.07,
  RBT: 0.44,
  BW: 0.06,
  AMP: 150,
  PL,
  NUPL,
  TA: 0,
  TX: 0,
  TE: 0,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, -150, 0],
    [0.4, -46.353, 0],
    [0.45, -23.465, -0.4426],
    [0.47, -14.116, -1.2904],
    [0.5, 0, -2.6696],
    [0.55, 23.465, -5.4468],
    [0.58, 37.303, -7.9282],
    [0.59, 41.849, -12.6651],
    [0.6, 46.353, -15.1625],
    [0.62, 55.219, -20.8906],
    [0.7, 88.168, -30],
    [1.5, 0, -32.6696],
    [1.55, -23.465, -30.4426],
    [2.0, -150, -30],
    [30, -150, -450]
  ] as [number, number, number][]
};
const K = K293;
const psiOf = (tau: number): number => -K.AMP * Math.cos(Math.PI * tau);

// ───────────────────────── 접촉 계산 ─────────────────────────
/** 잠금 이 k 끝이 롤러에 닿는 바퀴 각 φ. onlyFront: 비탈·앞벽만(이 끝이 홈 안). wall: 홈 벽에 닿았는가 */
function tipContact(psi: number, k: number, onlyFront = false): { phi: number; wall: boolean } | null {
  const n1 = K.N1 + psi;
  const n2 = n1 - K.WN;
  const cand: { q: V2; wall: boolean }[] = [];
  if (!onlyFront) {
    for (const q of cc(WC, RT, AC, RR)) {
      const a = wrap360(Math.atan2(q[1] - AC[1], q[0] - AC[0]) * R2D - n2);
      if (a >= wrap360(n1 + K.CH - n2)) cand.push({ q, wall: false });
    }
  }
  const seg = (r0: number, a0: number, r1: number, a1: number): void => {
    for (const q of circSeg(WC, RT, add(AC, P(r0, a0)), add(AC, P(r1, a1)))) cand.push({ q, wall: true });
  };
  seg(RR, n1 + K.CH, RR - K.CHD, n1);
  seg(RR - K.CHD, n1, RR - K.HN, n1 - K.WT);
  if (!onlyFront) seg(RR, n2, RR - K.HN, n2);
  let best: { al: number; wall: boolean } | null = null;
  for (const c of cand) {
    const al = ang(c.q, WC, 90);
    if (best === null || al > best.al) best = { al, wall: c.wall };
  }
  return best === null ? null : { phi: best.al - (TH0 + K.PITCH * k), wall: best.wall };
}

function palletPoly(psi: number): V2[] {
  const d = (K.CHB + psi) * D2R;
  const u: V2 = [Math.cos(d), Math.sin(d)];
  const v: V2 = [-u[1], u[0]];
  return (
    [
      [K.RB0, -K.BW / 2],
      [K.RBT, -K.BW / 2],
      [K.RBT, K.BW / 2],
      [K.RB0, K.BW / 2]
    ] as V2[]
  ).map(([r, s]) => [AC[0] + u[0] * r + v[0] * s, AC[1] + u[1] * r + v[1] * s] as V2);
}
function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const s = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy);
}
/** 왕관 이 0 이 팔레트 B 시계 쪽 면에 닿는 바퀴 각 φ(핀 원 ↔ 꼭짓점·평행이동 선분) */
function pinContact(poly: V2[]): number | null {
  const n = poly.length;
  const inside = (c: V2): boolean => {
    let sgn = 0;
    for (let i = 0; i < n; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % n]!;
      const cr = (q[0] - p[0]) * (c[1] - p[1]) - (q[1] - p[1]) * (c[0] - p[0]);
      if (cr !== 0) {
        if (sgn !== 0 && Math.sign(cr) !== sgn) return false;
        sgn = Math.sign(cr);
      }
    }
    return true;
  };
  const cand: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % n]!;
    cand.push(...cc(WC, K.RC, p, K.RCP));
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const ln = Math.hypot(dx, dy);
    const nx = -dy / ln;
    const ny = dx / ln;
    for (const sg of [1, -1]) cand.push(...circSeg(WC, K.RC, [p[0] + sg * K.RCP * nx, p[1] + sg * K.RCP * ny], [q[0] + sg * K.RCP * nx, q[1] + sg * K.RCP * ny]));
  }
  let best: number | null = null;
  for (const c of cand) {
    if (inside(c)) continue;
    let dd = Infinity;
    for (let i = 0; i < n; i++) dd = Math.min(dd, segDist(c, poly[i]!, poly[(i + 1) % n]!));
    if (Math.abs(dd - K.RCP) > 1e-7) continue;
    const al = ang(c, WC, 90);
    if (best === null || al > best) best = al;
  }
  return best === null ? null : best - (TH0 + K.DC);
}

/** 설계표 '동작' 2·3 의 접촉. kind 'tip'(잠금 이 k) 또는 'pin'(왕관 이 0). 반환 φ 또는 null */
export function contact293(kind: 'tip' | 'pin', k: number, psi: number): number | null {
  if (kind === 'pin') return pinContact(palletPoly(psi));
  const r = tipContact(psi, k);
  return r === null ? null : r.phi;
}

function bis(a: number, b: number, f: (x: number) => boolean): number {
  let lo = a;
  let hi = b;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m)) hi = m;
    else lo = m;
  }
  return hi;
}
const TA = bis(0, 0.75, (t) => K.N1 + psiOf(t) >= NUPL);
const TX = bis(TA + 1e-9, 0.9, (t) => tipContact(psiOf(t), 0, true) === null);
const TE = bis(TX + 1e-6, 1.0, (t) => pinContact(palletPoly(psiOf(t))) === null);
(K as { TA: number }).TA = TA;
(K as { TX: number }).TX = TX;
(K as { TE: number }).TE = TE;

export interface State293 {
  psi: number;
  phi: number;
  holder: 'roller' | 'notch' | 'pallet';
  justDropped: boolean;
}

export function state293(t: number): State293 {
  const n = Math.floor(t / 2 + 1e-12);
  const tau = t - 2 * n;
  const psi = psiOf(tau);
  let phi = 0;
  let holder: 'roller' | 'notch' | 'pallet' = 'roller';
  const tip = (k: number, front: boolean): void => {
    const r = tipContact(psi, k, front);
    if (r !== null) {
      phi = r.phi;
      holder = r.wall ? 'notch' : 'roller';
    }
  };
  if (tau < TA) tip(0, false);
  else if (tau < TX) tip(0, true);
  else if (tau < TE) {
    const p = pinContact(palletPoly(psi));
    if (p !== null) {
      phi = p;
      holder = 'pallet';
    } else tip(1, false);
  } else tip(1, false);
  const justDropped = (tau >= TX && tau < TX + 0.1) || (tau >= TE && tau < TE + 0.1);
  return { psi, phi: phi - K.PITCH * n, holder, justDropped };
}

// ───────────────────────── 부품 ─────────────────────────
function slab(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const geo = extrude(shape, z1 - z0, 0, 6);
  geo.translate(0, 0, (z0 + z1) / 2);
  return mesh(geo, mat);
}

/** 바퀴 판 윤곽(WC 원점, 반시계) — 잠금 이 12 */
export function wheelOutline293(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < K.Z; k++) {
    const th = K.TH0 + K.PITCH * k;
    pts.push(P(K.RT, th));
    const a0 = th + K.TB;
    const a1 = th + K.PITCH + K.TL;
    pts.push(P(K.RRIM, a0));
    for (let i = 1; i < 6; i++) pts.push(P(K.RRIM, a0 + ((a1 - a0) * i) / 6));
  }
  return pts;
}

/** 살 사이 창 — 살 폭 0.07 (x·y 축 살 둘 사이), 안 0.10 ~ 밖 0.70 */
function windowPath(rot: number): THREE.Path {
  const w = 0.035;
  const ri = 0.1;
  const ro = K.RIN;
  const pts: V2[] = [];
  const xi = Math.sqrt(ri * ri - w * w);
  const xo = Math.sqrt(ro * ro - w * w);
  const a0 = Math.atan2(w, xi) * R2D;
  const a1 = 90 - a0;
  for (let i = 0; i <= 6; i++) pts.push(P(ri, a0 + ((a1 - a0) * i) / 6));
  const b0 = Math.atan2(xo, w) * R2D;
  const b1 = Math.atan2(w, xo) * R2D;
  for (let i = 0; i <= 12; i++) pts.push(P(ro, b0 + ((b1 - b0) * i) / 12));
  const c = Math.cos(rot * D2R);
  const s = Math.sin(rot * D2R);
  return pathFrom(pts.map(([x, y]) => [x * c - y * s, x * s + y * c] as V2));
}

/** 탈진 바퀴 + 왕관 이 + 허브 칼라 + 빨간 표시 + 태엽통. 원점 = 바퀴 축, 회전축 = 로컬 Z. 몸통 메시 name `escapeWheel`·`crownPins`·`barrel` */
export function duplexWheel293(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const outline = wheelOutline293();
  const shape = shapeFrom(outline);
  for (let j = 0; j < 4; j++) shape.holes.push(windowPath(90 * j));
  shape.holes.push(circlePath(0, 0, 0.042));
  const wmat = brass();
  const plate = slab(shape, 0, 0.05, wmat);
  plate.name = 'escapeWheel';
  plate.userData.outline = outline;
  g.add(plate);
  // 왕관 이 — 원기둥 반지름 0.035, z 0.05~0.17(아래 끝을 판 속에 0.002 박음)
  const pins: THREE.BufferGeometry[] = [];
  for (let k = 0; k < K.Z; k++) {
    const [x, y] = P(K.RC, K.TH0 + K.DC + K.PITCH * k);
    const cg = new THREE.CylinderGeometry(K.RCP, K.RCP, 0.122, 20, 1);
    cg.rotateX(Math.PI / 2);
    cg.translate(x, y, 0.109);
    pins.push(cg);
  }
  const crown = mesh(merge(pins), steel());
  crown.name = 'crownPins';
  g.add(crown);
  // 허브 칼라 z 0.048(판 속에 0.002 박음)~0.09
  const colGeo = lathe(tubeProfile(0.042, 0.08, 0.048, 0.09, 0.002), 40);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, darkSteel()));
  // 빨간 표시 — 판 앞면 반지름 0.50 의 위쪽 살 위(z 0.0495~0.0535)
  const red = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.004), paint(0xd03020));
  red.position.set(0, 0.5, 0.0515);
  g.add(red);
  // 태엽통 z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.45, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  const yel = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.25, 0, -0.0785);
  g.add(yel);
  g.userData.wheelMat = wmat;
  return g;
}

/** 롤러 윤곽(A 원점, ψ = 0) */
export function rollerOutline293(): V2[] {
  const pts: V2[] = [];
  const a0 = K.N1 + K.CH;
  const a1 = K.N1 - K.WN + 360;
  const n = Math.round((a1 - a0) / 0.5);
  for (let i = 0; i <= n; i++) pts.push(P(K.RR, a0 + ((a1 - a0) * i) / n));
  const n2 = K.N1 - K.WN;
  pts.push(P(K.RR - K.HN, n2));
  for (let i = 1; i <= 5; i++) pts.push(P(K.RR - K.HN, n2 + ((K.N1 - K.WT - n2) * i) / 5));
  pts.push(P(K.RR - K.CHD, K.N1));
  return pts;
}

/** 밸런스(롤러·팔레트 B·허브·밸런스 테). 원점 = 밸런스 축 A, 회전축 = 로컬 Z. 몸통 메시 name `roller`·`palletB`·`balanceRing` */
export function balance293(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'balanceGroup';
  const rOut = rollerOutline293();
  const rs = shapeFrom(rOut);
  rs.holes.push(circlePath(0, 0, 0.042));
  const roller = slab(rs, 0, 0.05, steel());
  roller.name = 'roller';
  roller.userData.outline = rOut;
  g.add(roller);
  // 팔레트 B z 0.09~0.15
  const d = K.CHB * D2R;
  const u: V2 = [Math.cos(d), Math.sin(d)];
  const v: V2 = [-u[1], u[0]];
  const pOut = (
    [
      [K.RB0, -K.BW / 2],
      [K.RBT, -K.BW / 2],
      [K.RBT, K.BW / 2],
      [K.RB0, K.BW / 2]
    ] as V2[]
  ).map(([r, s]) => [u[0] * r + v[0] * s, u[1] * r + v[1] * s] as V2);
  const pallet = slab(shapeFrom(pOut), 0.09, 0.15, steel());
  pallet.name = 'palletB';
  pallet.userData.outline = pOut;
  g.add(pallet);
  // 허브 z 0.048(롤러 속에 0.002 박음)~0.17
  const hubGeo = lathe(tubeProfile(0.042, 0.075, 0.048, 0.17, 0.002), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 밸런스 테 z −0.16~−0.12: 고리 0.40~0.44 + 살 3 + 뒤 허브(롤러 뒷면에 0.002 박음)
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.44, 0, Math.PI * 2, false);
  ring.holes.push(circlePath(0, 0, 0.4));
  const parts: THREE.BufferGeometry[] = [];
  const rg = extrude(ring, 0.04, 0, 48);
  rg.translate(0, 0, -0.14);
  parts.push(rg);
  for (let j = 0; j < 3; j++) {
    const bg = new THREE.BoxGeometry(0.355, 0.04, 0.036);
    bg.translate(0.2275, 0, -0.14);
    bg.rotateZ((90 + 120 * j) * D2R);
    parts.push(bg);
  }
  const bh = lathe(tubeProfile(0.042, 0.06, -0.16, 0.002, 0.002), 40);
  bh.rotateX(Math.PI / 2);
  parts.push(bh);
  const balRing = mesh(merge(parts), brass());
  balRing.name = 'balanceRing';
  g.add(balRing);
  g.userData.rollerMat = roller.material;
  g.userData.palletMat = pallet.material;
  return g;
}
