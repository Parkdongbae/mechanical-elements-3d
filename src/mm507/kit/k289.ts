// 289번 데드비트(정지) 탈진기 전용 키트 — 탈진 바퀴·닻·팔레트·진자와 접촉 계산(원·원, 원·선분 교점). 설계표 docs/mm507-sheets/289.md
// 288번(되튐)도 같은 바퀴·닻 틀·진자를 쓰므로 k288.ts 가 여기 공용 부분(buildWheel·buildAnchor·contactFaces·stateGeneric)을 불러 쓴다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;
const D = 0.85 * Math.SQRT2;

export const K289 = {
  W: [0, 1.72] as V2,
  A_AXIS: [0, 2.922082] as V2,
  D,
  Z: 30,
  RT: 0.85,
  RR: 0.72,
  LEAD: 3,
  BACK: 8,
  CONC: 0.02,
  RKO: 0.8875,
  RKI: 0.8125,
  U: 0.5,
  LAM: 2,
  AMP: 4,
  PERIOD: 2,
  /** 드롭(이가 팔레트를 놓는 때, τ) */
  DROP_A: 0.11736,
  DROP_B: 1.11778,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 0, -10.142],
    [0.1, 1.236, -7.001],
    [0.2, 2.351, -5.5286],
    [0.5, 4.0, -5.5286],
    [0.9, 1.236, -5.5286],
    [1.0, 0, -4.315],
    [1.1, -1.236, -1.115],
    [1.2, -2.351, 0.4715],
    [1.5, -4.0, 0.4715],
    [2.0, 0, 1.858],
    [30, 0, 169.858]
  ] as [number, number, number][]
} as const;
const K = K289;

export const pol = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
const arcPts = (r: number, d0: number, d1: number, n = 24): V2[] => {
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) o.push(pol(r, d0 + ((d1 - d0) * i) / n));
  return o;
};

// ───────────────────────── 접촉 계산 ─────────────────────────

type Kind = 'lock' | 'impulse';
/** 팔레트 닿는 면(닻 좌표, a 원점). seg 는 곧은 선분, arc 는 a 중심 원호(각 도) */
export type Face =
  | { kind: 'seg'; a: V2; b: V2; face: Kind }
  | { kind: 'arc'; r: number; th0: number; th1: number; face: Kind };

const wrap180 = (a: number): number => {
  let x = a % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
};

/** 이끝(바퀴 좌표 반지름 RT 원)이 면에 닿는 각 α(도, 0~360) 후보들 — 면을 ψ 만큼 a 둘레로 돌려 W 원점 좌표로 옮겨서 구함 */
function hits(f: Face, psi: number): { alpha: number; face: Kind }[] {
  const out: { alpha: number; face: Kind }[] = [];
  const c = Math.cos(psi * D2R);
  const s = Math.sin(psi * D2R);
  const toW = (p: V2): V2 => [p[0] * c - p[1] * s, p[0] * s + p[1] * c + K.D];
  const ang = (x: number, y: number): number => {
    const a = Math.atan2(y, x) / D2R;
    return a < 0 ? a + 360 : a;
  };
  if (f.kind === 'seg') {
    const p = toW(f.a);
    const q = toW(f.b);
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const A = dx * dx + dy * dy;
    const B = 2 * (p[0] * dx + p[1] * dy);
    const C = p[0] * p[0] + p[1] * p[1] - K.RT * K.RT;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return out;
    const sq = Math.sqrt(disc);
    for (const u of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
      if (u < 0 || u > 1) continue;
      out.push({ alpha: ang(p[0] + u * dx, p[1] + u * dy), face: f.face });
    }
    return out;
  }
  // 원(a, r) ∩ 원(W, RT): |P − (0, D)| = r
  const sinA = (K.RT * K.RT + K.D * K.D - f.r * f.r) / (2 * K.RT * K.D);
  if (Math.abs(sinA) > 1) return out;
  const a1 = Math.asin(sinA);
  for (const al of [a1, Math.PI - a1]) {
    const px = K.RT * Math.cos(al);
    const py = K.RT * Math.sin(al);
    const th = wrap180(Math.atan2(py - K.D, px) / D2R - psi);
    if (th >= Math.min(f.th0, f.th1) && th <= Math.max(f.th0, f.th1)) out.push({ alpha: ang(px, py), face: f.face });
  }
  return out;
}

/** 한 팔레트의 면들에 이 k 가 닿는 바퀴 각 φ(도)와 닿은 면 종류. 안 닿으면 null — α 가 가장 작은 교점을 고른다 */
export function contactFaces(faces: Face[], k: number, psi: number): { phi: number; face: Kind } | null {
  let best: { alpha: number; face: Kind } | null = null;
  for (const f of faces) for (const h of hits(f, psi)) if (best === null || h.alpha < best.alpha) best = h;
  if (best === null) return null;
  return { phi: wrap180(best.alpha - (90 + 12 * k)), face: best.face };
}

// 팔레트 면(닻 좌표)
const EK = pol(K.RKI, -46.5);
const LK = pol(K.RKO, -44.5);
const EH = pol(K.RKO, -133.5);
const LH = pol(K.RKI, -135.5);
export const FACES289 = {
  K: [
    { kind: 'seg', a: EK, b: LK, face: 'impulse' },
    { kind: 'arc', r: K.RKO, th0: -44.5, th1: -33, face: 'lock' }
  ] as Face[],
  H: [
    { kind: 'seg', a: EH, b: LH, face: 'impulse' },
    { kind: 'arc', r: K.RKI, th0: -147, th1: -135.5, face: 'lock' }
  ] as Face[]
};

/** 두 탈진기 공용 한 시각 계산(설계표 '동작' 1~3) */
export function stateGeneric(faces: { K: Face[]; H: Face[] }, t: number): { psi: number; phi: number; holder: 'K' | 'H'; face: Kind } {
  const n = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - n * K.PERIOD;
  const psi = K.AMP * Math.sin(Math.PI * tau);
  let r: { phi: number; face: Kind } | null;
  let holder: 'K' | 'H';
  if (tau < 0.5) {
    r = contactFaces(faces.K, -3, psi);
    holder = 'K';
    if (r === null) {
      r = contactFaces(faces.H, 4, psi);
      holder = 'H';
    }
  } else if (tau < 1.5) {
    r = contactFaces(faces.H, 4, psi);
    holder = 'H';
    if (r === null) {
      r = contactFaces(faces.K, -4, psi);
      holder = 'K';
    }
  } else {
    r = contactFaces(faces.K, -4, psi);
    holder = 'K';
  }
  // 설계표대로면 일어나지 않는다(드롭 순간의 수치 경계만) — 0 으로 두면 튀므로 아주 작은 각 이동으로 한 번 더 시도
  if (r === null) {
    const alt = holder === 'K' ? contactFaces(faces.H, 4, psi) : contactFaces(faces.K, -4, psi);
    r = alt ?? { phi: 0, face: 'lock' };
  }
  return { psi, phi: r.phi + 12 * n, holder, face: r.face };
}

export interface State289 {
  psi: number;
  phi: number;
  holder: 'K' | 'H';
  face: Kind;
  justDropped: boolean;
}

export function justDropped(t: number): boolean {
  const tau = t - Math.floor(t / K.PERIOD + 1e-12) * K.PERIOD;
  return (tau >= K.DROP_A && tau < K.DROP_A + 0.1) || (tau >= K.DROP_B && tau < K.DROP_B + 0.1);
}

export function state289(t: number): State289 {
  return { ...stateGeneric(FACES289, t), justDropped: justDropped(t) };
}

export function contact289(pallet: 'K' | 'H', k: number, psi: number): number | null {
  const r = contactFaces(FACES289[pallet], k, psi);
  return r === null ? null : r.phi;
}

// ───────────────────────── 바퀴 ─────────────────────────

/** 바퀴 윤곽(W 원점, 반시계) — 이 30. B → 오목한 등면 → 이끝 T → 앞면 → 뿌리 원호 */
export function wheelOutline(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < K.Z; k++) {
    const base = 90 + 12 * k;
    const B = pol(K.RR, base - K.BACK);
    const T = pol(K.RT, base);
    const mx = B[0] + T[0];
    const my = B[1] + T[1];
    const ml = Math.hypot(mx, my);
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      const bulge = 0.08 * s * (1 - s);
      pts.push([(1 - s) * B[0] + s * T[0] - (bulge * mx) / ml, (1 - s) * B[1] + s * T[1] - (bulge * my) / ml]);
    }
    const a0 = base - K.LEAD;
    pts.push(pol(K.RR, a0));
    const a1 = base + 4;
    for (let i = 1; i < 6; i++) pts.push(pol(K.RR, a0 + ((a1 - a0) * i) / 6));
  }
  return pts;
}

/** 탈진 바퀴 + 허브 칼라 + 빨간 표시 + 태엽통. 원점 = W 축, 회전축 = 로컬 Z. 몸통 메시 name `escapeWheel`·`barrel` */
export function buildWheel(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const outline = wheelOutline();
  const shape = shapeFrom(outline);
  for (let j = 0; j < 4; j++) shape.holes.push(annularSector(0.18, 0.6, (90 * j + 12) * D2R, (90 * j + 78) * D2R));
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
  // 빨간 표시 — 바퀴 앞면 z 0.06 위(0.001 박음), 반지름 0.66, 각 90°
  const markMat = paint(0xd03020);
  const red = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.004), markMat);
  red.position.set(0, 0.66, 0.061);
  g.add(red);
  // 태엽통 z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.45, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  // 노란 막대 — 태엽통 앞면(z −0.08) 위, 반지름 0.25 자리 가운데(0.10~0.40)
  const yel = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.25, 0, -0.079);
  g.add(yel);
  g.userData.wheelMat = wmat;
  g.userData.markMat = markMat;
  return g;
}

// ───────────────────────── 닻 ─────────────────────────

/** 닻 틀 윤곽: 허브 원판 반지름 0.10 + 팔 둘(θ −35°·−145°, 반폭 0.04, 길이 0.8825)을 한 다각형으로 */
export function anchorFrameOutline(): V2[] {
  const R = 0.1;
  const w = 0.04;
  const L = 0.8825;
  const s0 = Math.sqrt(R * R - w * w);
  const da = Math.asin(w / R) / D2R;
  const at = (dir: number, l: number, o: number): V2 => {
    const ux = Math.cos(dir * D2R);
    const uy = Math.sin(dir * D2R);
    return [l * ux - o * uy, l * uy + o * ux];
  };
  const pts: V2[] = [];
  const hub = (a0: number, a1: number): void => {
    const n = Math.max(2, Math.round(Math.abs(a1 - a0) / 6));
    for (let i = 0; i <= n; i++) pts.push(pol(R, a0 + ((a1 - a0) * i) / n));
  };
  const rA = -35;
  const lA = 215;
  hub(rA + da, lA - da);
  pts.push(at(lA, s0, -w), at(lA, L, -w), at(lA, L, w), at(lA, s0, w));
  hub(lA + da, rA + 360 - da);
  pts.push(at(rA, s0, -w), at(rA, L, -w), at(rA, L, w), at(rA, s0, w));
  return pts;
}

/** 팔레트 윤곽(닻 좌표) — recoil=false: 잠금면이 a 중심 원호, recoil=true: 비스듬한 곧은 선 */
export function palletOutlines(recoil: boolean): { K: V2[]; H: V2[] } {
  const Kp: V2[] = [EK, LK];
  const Hp: V2[] = [EH, LH];
  if (!recoil) {
    Kp.push(...arcPts(K.RKO, -44.5, -33).slice(1));
    Kp.push(...arcPts(K.RKI, -33, -46.5).slice(0, -1));
    Hp.push(...arcPts(K.RKI, -135.5, -147).slice(1));
    Hp.push(...arcPts(K.RKO, -147, -133.5).slice(0, -1));
  } else {
    Kp.push([0.7431, -0.5999], pol(K.RKO, -33));
    Kp.push(...arcPts(K.RKI, -33, -46.5).slice(0, -1));
    Hp.push([-0.5942, -0.4646], pol(K.RKI, -147), pol(K.RKO, -147));
    Hp.push(...arcPts(K.RKO, -147, -133.5).slice(1, -1));
  }
  return { K: Kp, H: Hp };
}

function slab(outline: V2[], z0: number, z1: number, mat: THREE.Material, holeR = 0): THREE.Mesh {
  const shape = shapeFrom(outline);
  if (holeR > 0) shape.holes.push(circlePath(0, 0, holeR));
  const geo = extrude(shape, z1 - z0, 0, 6);
  geo.translate(0, 0, (z0 + z1) / 2);
  return mesh(geo, mat);
}

/** 닻(틀·앞 보스·팔레트 둘·진자). 원점 = 닻 축 a, 회전축 = 로컬 Z. 몸통 메시 name `anchorFrame`·`palletK`·`palletH`·`pendulumRod`·`pendulumBob` */
export function buildAnchor(recoil: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'anchorGroup';
  const frame = slab(anchorFrameOutline(), -0.01, 0.07, darkSteel(), 0.042);
  frame.name = 'anchorFrame';
  g.add(frame);
  // 앞 보스 z 0.068(틀 속에 0.002 박음)~0.20
  const bossGeo = lathe(tubeProfile(0.042, 0.06, 0.068, 0.2, 0.002), 40);
  bossGeo.rotateX(Math.PI / 2);
  g.add(mesh(bossGeo, darkSteel()));
  const po = palletOutlines(recoil);
  const mK = steel();
  const mH = steel();
  const pK = slab(po.K, -0.02, 0.08, mK);
  pK.name = 'palletK';
  pK.userData.outline = po.K;
  const pH = slab(po.H, -0.02, 0.08, mH);
  pH.name = 'palletH';
  pH.userData.outline = po.H;
  g.add(pK, pH);
  // 진자: 막대 y +0.03 → −2.302, z 0.15~0.18 / 추 반지름 0.15, z 0.135~0.195
  const rod = mesh(new THREE.BoxGeometry(0.03, 2.332, 0.03), steel());
  rod.position.set(0, (0.03 - 2.302) / 2, 0.165);
  rod.name = 'pendulumRod';
  g.add(rod);
  const bobGeo = lathe(rodProfile(0.15, 0.135, 0.195, 0.004, 0.004), 48);
  bobGeo.rotateX(Math.PI / 2);
  const bob = mesh(bobGeo, brass());
  bob.position.set(0, -2.302, 0);
  bob.name = 'pendulumBob';
  g.add(bob);
  g.userData.matK = mK;
  g.userData.matH = mH;
  return g;
}

export function escWheel289(): THREE.Group {
  return buildWheel();
}
export function anchor289(): THREE.Group {
  return buildAnchor(false);
}
