// 119·120·121번 전용 키트
//  119 미끄럼 홈의 이중 랙 피니언: 타원(스타디움) 무한 랙 + 랙을 싣는 막대, 홈 막대, 피니언·축, 틀 들보, 막대 안내
//  120 집게형 기어 장치: 바깥 이 부채꼴 + 왼쪽 턱, 안쪽 이 활 틀 + 오른쪽 턱, 한 축의 두 피니언
//  121 디스크 휠과 클릭: 디스크(걸쇠 못·막대 못), 코그휠, 뒤집을 수 있는 걸쇠(클릭), 걸쇠 들림 시간표
// 치수 상수(K119·K120·K121)와 운동식·윤곽은 순수 함수라 node 검사 스크립트(shots/_verify/s119.mjs 등)가 같은 식을 쓴다.
//   npx esbuild src/mm507/kit/k119.ts --bundle --format=esm --platform=node --outfile=shots/_verify/_k119.bundle.mjs
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, hexPrism, lathe, loft, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;
const PA = 20 * DEG;
const inv = (a: number): number => Math.tan(a) - a;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1, 양끝 모따기 c) */
function cylZ(r: number, z0: number, z1: number, c = 0.008, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.008, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

const pol = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];
const rot2 = (p: V2, a: number): V2 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

/** 원호 점열(a0 → a1, 양끝 포함 n+1 점) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// ───────────────────────── 다각형 도우미(검사·접촉 풀이) ─────────────────────────

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** 점 p 가 닫힌 다각형 안으로 들어간 깊이(밖이면 0) */
export function polyPen119(p: V2, poly: readonly V2[]): number {
  let m = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    if (pi[1] > p[1] !== pj[1] > p[1] && p[0] < ((pj[0] - pi[0]) * (p[1] - pi[1])) / (pj[1] - pi[1]) + pi[0]) inside = !inside;
    m = Math.min(m, segDist(p, pj, pi));
  }
  return inside ? m : 0;
}

/** 두 다각형이 서로 파고든 최대 깊이(양쪽 꼭짓점 모두 봄) */
export function polyPairPen119(a: readonly V2[], b: readonly V2[]): number {
  let w = 0;
  for (const p of a) w = Math.max(w, polyPen119(p, b));
  for (const p of b) w = Math.max(w, polyPen119(p, a));
  return w;
}

// ───────────────────────── 인벌류트 이(피치·이끝·이뿌리 반지름을 따로 줌) ─────────────────────────

/**
 * 인벌류트 이 하나의 점열: 중심각 c, 오른쪽 이뿌리 → 이끝 → 왼쪽 이뿌리(반시계).
 * Z = 온 둘레 잇수, rp 피치·ra 이끝·rf 이뿌리 반지름. thick = 피치원 위 이 두께 비(1 = 반 피치, 0.96 = 조금 얇게).
 * 안쪽 이(링)의 이골 꼴로 쓸 때는 thick 를 1.04 쯤으로(이골이 조금 넓게).
 */
export function involuteTooth119(Z: number, rp: number, ra: number, rf: number, c: number, thick = 0.96): V2[] {
  const rb = rp * Math.cos(PA);
  const psiP = (Math.PI / (2 * Z)) * thick;
  const psi = (R: number): number => (R <= rb ? psiP + inv(PA) : psiP + inv(PA) - inv(Math.acos(rb / R)));
  let rTip = ra;
  const minPsi = (0.05 * TAU) / Z;
  if (psi(ra) < minPsi) {
    let lo = Math.max(rb, rf);
    let hi = ra;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (psi(mid) > minPsi) lo = mid;
      else hi = mid;
    }
    rTip = lo;
  }
  const radii: number[] = [];
  const r0 = Math.max(rf, Math.min(rb, rTip));
  if (rf < r0 - 1e-9) radii.push(rf);
  const n = 7;
  for (let k = 0; k <= n; k++) radii.push(r0 + ((rTip - r0) * k) / n);
  const out: V2[] = [];
  for (const R of radii) out.push(pol(R, c - psi(R)));
  const pt = psi(rTip);
  out.push(pol(rTip, c - pt / 3), pol(rTip, c + pt / 3));
  for (let k = radii.length - 1; k >= 0; k--) out.push(pol(radii[k]!, c + psi(radii[k]!)));
  return out;
}

/** 온전한 인벌류트 기어 윤곽(반시계). 이 0 의 중심 = 로컬 +X */
export function gearOutline119(Z: number, module: number, add = 1, ded = 1.25, thick = 0.96): V2[] {
  const rp = (Z * module) / 2;
  const rf = rp - ded * module;
  const out: V2[] = [];
  const step = TAU / Z;
  for (let i = 0; i < Z; i++) {
    out.push(...involuteTooth119(Z, rp, rp + add * module, rf, i * step, thick));
    out.push(pol(rf, (i + 0.5) * step));
  }
  return out;
}

export interface PinionOpts119 {
  /** 이 폭(z). 기본 0.08 */
  width?: number;
  /** 축 구멍 반지름. 기본 0.045 */
  bore?: number;
  /** 구동 쪽이면 청동 */
  driver?: boolean;
}

/**
 * 민판 인벌류트 피니언. 회전축 = 로컬 Z, 원점 중심, **이 0 의 중심 = 로컬 +X**(spurGear 와 다르다).
 * userData.mm = { kind:'gear', … }, 몸통 메시에 userData.outline.
 */
export function pinion119(teeth: number, module: number, o: PinionOpts119 = {}): THREE.Group {
  const w = o.width ?? 0.08;
  const bore = o.bore ?? 0.045;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const outline = gearOutline119(teeth, module);
  const c = Math.min(module * 0.3, w * 0.14);
  const g = new THREE.Group();
  const layers = [
    { z: -w / 2, s: (ra - c) / ra, hs: (bore + c) / bore },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: (ra - c) / ra, hs: (bore + c) / bore }
  ];
  const body = mesh(loft(outline, [circlePts(bore, 32)], layers), o.driver === true ? bronze({ roughness: 0.34 }) : brass());
  body.userData.outline = outline;
  g.add(body);
  g.add(meshAt(new THREE.BoxGeometry(Math.max(0.025, (rf - bore) * 0.6), 0.016, 0.008), paint(MARK), (rf + bore) / 2, 0, w / 2 + 0.003));
  setMM(g, { kind: 'gear', fn: 'pinion119', teeth, module, internal: false, rp, ra, rf, width: w, axis: 'z' });
  return g;
}

// ═══════════════════════════ 119 타원 무한 랙 ═══════════════════════════

const M119 = 0.04;
const Z119 = 8;
const NS119 = 9;
const NE119 = 8;

/** 119번 치수 */
export const K119 = {
  /** 모듈, 피니언 잇수 */
  module: M119,
  teeth: Z119,
  /** 곧은 변의 이 수(위·아래 각각), 끝 반원의 이 수(각각) */
  nStraight: NS119,
  nEnd: NE119,
  /** 랙 온 둘레 이 수 */
  nRack: 2 * NS119 + 2 * NE119,
  /** 피니언 피치 반지름 */
  rp: (Z119 * M119) / 2,
  /** 랙 피치 곡선(스타디움)의 반높이 = 끝 반원 피치 반지름 */
  h: NE119 * M119,
  /** 곧은 변 길이(끝 반원 중심 사이) */
  L: NS119 * Math.PI * M119,
  /** 랙 이끝 높이·이뿌리 깊이(모듈 배수). 이끝을 0.8 로 낮춤(이 8개 피니언은 뿌리가 좁다) — s119.mjs 에서 한 주기 침범 0 */
  add: 0.8,
  ded: 1.25,
  /** 축 반지름, 홈 반폭 */
  shaftR: 0.045,
  slotHalf: 0.048,
  /** 랙 판 두께, 랙을 싣는 막대 반높이·두께·끝 토막 길이 */
  thick: 0.08,
  barHalf: 0.07,
  barT: 0.1,
  stub: 0.2,
  /** 랙 판 뒷면과 막대 앞면 사이 틈(피니언이 막대 끝 토막 앞을 스치지 않게) */
  barBack: 0.006
} as const;

/** 119 한 주기의 구동 각: 곧은 변 A(둘) + 끝 반원 B(둘) */
export const A119 = K119.L / K119.rp;
export const B119 = (Math.PI * (K119.h + K119.rp)) / K119.rp;
export const PERIOD119 = 2 * A119 + 2 * B119;

export interface Mangle119 {
  /** 주기 안 위상 각(0 ~ PERIOD119) */
  u: number;
  /** 랙 중심의 가로 자리(홈 막대 기준) */
  x: number;
  /** 피니언 중심의 높이(랙 가운데선 기준) */
  y: number;
  /** 피니언 회전각(이 0 = 로컬 +X) */
  spin: number;
  /** 0 위 변, 1 왼쪽 끝을 돎, 2 아래 변, 3 오른쪽 끝을 돎 */
  phase: 0 | 1 | 2 | 3;
  /** 랙에서 피니언 중심 쪽을 보는 바깥 법선(단위) — 위 변 (0,1), 아래 변 (0,−1), 끝에서는 (cos β, sin β). 이름표를 띄울 방향 */
  n: V2;
}

/**
 * 119 운동식(닫힌 식). theta = 피니언 구동 각(반시계 +). theta = 1.6(t = 1)에 피니언이 위 변 한가운데(판화 자세).
 * 위 변: 랙이 +x 로 rp·Δθ. 끝: 피니언 중심이 끝 반원 중심 둘레를 β = π/2 + Δθ·rp/(h+rp) 로 돈다(랙은 x 만, 피니언은 y 만).
 */
export function mangle119(theta: number): Mangle119 {
  const { rp, h, L } = K119;
  const d = h + rp;
  const raw = theta - 1.6 + A119 / 2;
  const u = raw - Math.floor(raw / PERIOD119) * PERIOD119;
  const spin = raw - Math.PI / 2;
  if (u < A119) return { u, x: -L / 2 + rp * u, y: d, spin, phase: 0, n: [0, 1] };
  if (u < A119 + B119) {
    const b = Math.PI / 2 + ((u - A119) * rp) / d;
    return { u, x: L / 2 - d * Math.cos(b), y: d * Math.sin(b), spin, phase: 1, n: [Math.cos(b), Math.sin(b)] };
  }
  if (u < 2 * A119 + B119) return { u, x: L / 2 - rp * (u - A119 - B119), y: -d, spin, phase: 2, n: [0, -1] };
  const b = 1.5 * Math.PI + ((u - 2 * A119 - B119) * rp) / d;
  return { u, x: -L / 2 - d * Math.cos(b), y: d * Math.sin(b), spin, phase: 3, n: [Math.cos(b), Math.sin(b)] };
}

/** 119 피니언 윤곽(이 0 = +X) */
export function pinionOutline119(): V2[] {
  return gearOutline119(K119.teeth, K119.module);
}

/**
 * 119 타원 무한 랙 윤곽(반시계, 랙 중심 원점). 피치 곡선 = 스타디움(위·아래 직선 y = ±h, 양끝 반지름 h 반원).
 * 곧은 변은 압력각 20° 사다리꼴 이, 끝 반원은 잇수 2·nEnd 인 인벌류트 기어의 반쪽. 이음 자리(네 곳)는 이골 중심.
 */
export function rackOutline119(): V2[] {
  const { module: m, h, L, add, ded, nStraight, nEnd } = K119;
  const p = Math.PI * m;
  const yr = h - ded * m;
  const yt = h + add * m;
  const half = (0.96 * p) / 4;
  const wt = half - add * m * Math.tan(PA);
  const wr = half + ded * m * Math.tan(PA);
  const ZE = 2 * nEnd;
  const stepE = TAU / ZE;
  const endPts: V2[] = [];
  for (let k = 0; k < nEnd; k++) {
    endPts.push(...involuteTooth119(ZE, h, yt, yr, -Math.PI / 2 + (k + 0.5) * stepE));
    if (k < nEnd - 1) endPts.push(pol(yr, -Math.PI / 2 + (k + 1) * stepE));
  }
  const out: V2[] = [];
  for (let k = 0; k < nStraight; k++) {
    const xc = -L / 2 + (k + 0.5) * p;
    out.push([xc - wr, -yr], [xc - wt, -yt], [xc + wt, -yt], [xc + wr, -yr]);
  }
  out.push([L / 2, -yr]);
  for (const q of endPts) out.push([q[0] + L / 2, q[1]]);
  out.push([L / 2, yr]);
  for (let k = 0; k < nStraight; k++) {
    const xc = L / 2 - (k + 0.5) * p;
    out.push([xc + wr, yr], [xc + wt, yt], [xc - wt, yt], [xc - wr, yr]);
  }
  out.push([-L / 2, yr]);
  for (const q of endPts) out.push([-q[0] - L / 2, -q[1]]);
  out.push([-L / 2, -yr]);
  return out;
}

// ═══════════════════════════ 120 집게형 기어 장치 ═══════════════════════════

const M120 = 0.048;

/**
 * 120번 치수. 각 a 는 "피벗에서 곧장 아래를 0, +x 쪽을 +" 로 잰 각(라디안), 점 = r·(sin a, −cos a).
 * 두 조각의 윤곽은 모두 **벌린 자세(판화 자세, c = 0)** 의 좌표이고 원점 = 피벗.
 */
export const K120 = {
  module: M120,
  /** 작은 피니언(바깥 이 부채꼴과), 큰 피니언(안쪽 이 활 틀과), 부채꼴·활 틀의 온 둘레 잇수 */
  zSmall: 12,
  zBig: 20,
  zSector: 32,
  zRing: 64,
  /** 피벗 ~ 피니언 축 거리 = m(32+12)/2 = m(64−20)/2 */
  D: 22 * M120,
  /** 부채꼴의 이 수와 첫 이골 중심 각, 활 틀의 이골 수(가운데 이골이 a = 0) */
  sectorTeeth: 8,
  sectorA0: -33.75 * DEG,
  ringGaps: 13,
  /** 벌림 → 다묾 사이 회전: 축 +64°(반시계), 부채꼴 −24°(시계), 활 틀 +20°(반시계) */
  shaftSwing: 64 * DEG,
  sectorSwing: 24 * DEG,
  ringSwing: 20 * DEG,
  /** 허브 반지름, 피벗 핀 구멍, 층 두께, 두 층 가운데 사이 거리 */
  hub: 0.12,
  bore: 0.052,
  layer: 0.07,
  layerGap: 0.1,
  /** 부채꼴: 테 두께(이뿌리 안쪽), 팔 반폭 */
  rimW: 0.065,
  armHalf: 0.04,
  /** 활 틀: 이뿌리 바깥 벽 두께(= 다리 굵기) */
  wall: 0.075,
  /** 턱(다문 자세 기준): 구멍 원 중심 높이·반지름, 끝 두께, 두 턱 끝 사이 틈의 반, 허브에 붙는 아래 끝 방향(도) */
  jawH: 0.52,
  jawR: 0.43,
  jawTip: 0.03,
  jawGap: 0.002,
  jawRootDeg: 160
} as const;

export interface Pincer120 {
  /** 다문 정도 0(벌림, 판화) ~ 1(다묾) */
  c: number;
  /** 피니언 축 각(반시계 +) */
  shaft: number;
  /** 부채꼴 조각·활 틀 조각의 rotation.z */
  sector: number;
  ring: number;
}

/** 120 운동식: theta = 1.6(t = 1)에 벌린 자세(판화), theta = 1.6 + π 에 다묾. 축이 ±로 오가며 돈다 */
export function pincer120(theta: number): Pincer120 {
  const c = (1 - Math.cos(theta - 1.6)) / 2;
  const shaft = K120.shaftSwing * c;
  return { c, shaft, sector: (-shaft * K120.zSmall) / K120.zSector, ring: (shaft * K120.zBig) / K120.zRing };
}

const down = (r: number, a: number): V2 => [r * Math.sin(a), -r * Math.cos(a)];

/** 바깥 이 부채꼴 조각의 판 윤곽(벌린 자세): outer = 허브 + 두 팔 + 이 난 테, window = 가운데 창(구멍) */
export function sectorOutline120(): { outer: V2[]; window: V2[] } {
  const m = K120.module;
  const Rs = (K120.zSector * m) / 2;
  const Rr = Rs - 1.25 * m;
  const Rin = Rr - K120.rimW;
  const rh = K120.hub;
  const hw = K120.armHalf;
  const step = TAU / K120.zSector;
  const a0 = K120.sectorA0;
  const a1 = a0 + K120.sectorTeeth * step;
  const aL = a0 + Math.asin(hw / Rr);
  const aR = a1 - Math.asin(hw / Rr);
  const kh = Math.asin(hw / rh);
  const outer: V2[] = [down(Rr, a0)];
  for (let k = 0; k < K120.sectorTeeth; k++) {
    outer.push(...involuteTooth119(K120.zSector, Rs, Rs + m, Rr, a0 + (k + 0.5) * step - Math.PI / 2));
    outer.push(down(Rr, a0 + (k + 1) * step));
  }
  // 오른팔 바깥 모서리 → 허브 위쪽 호(반시계) → 왼팔 바깥 모서리
  outer.push(...arc(0, 0, rh, aR + kh - Math.PI / 2, aL - kh - Math.PI / 2 + TAU, 28));
  const window: V2[] = [down(rh, aL + kh)];
  const b0 = aL + Math.asin(hw / Rin);
  const b1 = aR - Math.asin(hw / Rin);
  for (let i = 0; i <= 24; i++) window.push(down(Rin, b0 + ((b1 - b0) * i) / 24));
  window.push(...arc(0, 0, rh, aR - kh - Math.PI / 2, aL + kh - Math.PI / 2, 6).slice(0, -1));
  return { outer, window };
}

function bezier3(p0: V2, p1: V2, p2: V2, p3: V2, n: number): { p: V2; t: V2 }[] {
  const out: { p: V2; t: V2 }[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const u = 1 - s;
    const p: V2 = [
      u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0],
      u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1]
    ];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * s * (p2[0] - p1[0]) + 3 * s * s * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * s * (p2[1] - p1[1]) + 3 * s * s * (p3[1] - p2[1]);
    const l = Math.hypot(dx, dy) || 1;
    out.push({ p, t: [dx / l, dy / l] });
  }
  return out;
}

/** 활 틀 다리 하나: 띠 끝(각 aEnd, 반지름 Rc)에서 허브(방향 dirDeg)까지. left/right = 진행 방향의 왼쪽·오른쪽으로 hw 띄운 점열 */
function ringLimb(aEnd: number, sign: 1 | -1, dirDeg: number, k1: number, k2: number): { left: V2[]; right: V2[] } {
  const m = K120.module;
  const Rc = (K120.zRing * m) / 2 + 1.25 * m + K120.wall / 2;
  const hw = K120.wall / 2;
  const rh = K120.hub;
  const e = down(Rc, aEnd);
  // 띠에서 멀어지는 접선(오른쪽 끝이면 a 가 느는 쪽)
  const tg: V2 = [sign * Math.cos(aEnd), sign * Math.sin(aEnd)];
  const d = pol(1, dirDeg * DEG);
  const hr = Math.sqrt(rh * rh - hw * hw);
  const H: V2 = [d[0] * hr, d[1] * hr];
  const cv = bezier3(e, [e[0] + tg[0] * k1, e[1] + tg[1] * k1], [H[0] + d[0] * k2, H[1] + d[1] * k2], H, 28);
  return {
    left: cv.map(({ p, t }) => [p[0] - t[1] * hw, p[1] + t[0] * hw] as V2),
    right: cv.map(({ p, t }) => [p[0] + t[1] * hw, p[1] - t[0] * hw] as V2)
  };
}

/** 활 틀의 띠 반각(양끝은 이 중심) */
export const RING_HALF120 = ((K120.ringGaps / 2) * TAU) / K120.zRing;
/** 활 틀 다리가 허브로 들어오는 방향(도, 수학 각): 왼쪽 다리(굽음)·오른쪽 다리(곧은 버팀) */
export const RING_LIMB120 = { left: 210, right: 327 } as const;

/** 안쪽 이 활 틀 조각의 판 윤곽(벌린 자세): outer = 바깥 테두리(허브 포함), inner = 안쪽 구멍(아래에 안쪽 이) */
export function ringOutline120(): { outer: V2[]; inner: V2[] } {
  const m = K120.module;
  const Ri = (K120.zRing * m) / 2;
  const Rroot = Ri + 1.25 * m;
  const Rt = Ri - m;
  const Ro = Rroot + K120.wall;
  const rh = K120.hub;
  const step = TAU / K120.zRing;
  const aB = RING_HALF120;
  const kh = Math.asin(K120.wall / 2 / rh);
  const R = ringLimb(aB, 1, RING_LIMB120.right, 0.16, 0.95);
  const Lm = ringLimb(-aB, -1, RING_LIMB120.left, 0.25, 1.0);
  // 오른쪽 다리: 진행(띠 → 허브) 방향의 오른쪽이 바깥. 왼쪽 다리: 왼쪽이 바깥
  const outer: V2[] = [];
  for (let i = 0; i <= 40; i++) outer.push(down(Ro, -aB + (2 * aB * i) / 40));
  outer.push(...R.right.slice(1));
  outer.push(...arc(0, 0, rh, RING_LIMB120.right * DEG - TAU + kh, RING_LIMB120.left * DEG - kh, 26).slice(1, -1));
  outer.push(...[...Lm.left].reverse().slice(0, -1));
  const inner: V2[] = [down(Rt, -aB)];
  const half = (K120.ringGaps - 1) / 2;
  for (let k = -half; k <= half; k++) {
    inner.push(...involuteTooth119(K120.zRing, Ri, Rroot, Rt, k * step - Math.PI / 2, 1.04));
    inner.push(down(Rt, (k + 0.5) * step));
  }
  inner.push(...R.left);
  inner.push(...arc(0, 0, rh, RING_LIMB120.right * DEG - kh, RING_LIMB120.left * DEG + kh, 8).slice(1, -1));
  inner.push(...[...Lm.right].reverse());
  return { outer, inner };
}

function circum(a: V2, b: V2, c: V2): { o: V2; r: number } {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const o: V2 = [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d];
  return { o, r: Math.hypot(a[0] - o[0], a[1] - o[1]) };
}

/**
 * 턱(초승달) 윤곽 — **다문 자세**의 왼쪽 턱(원점 = 피벗, 반시계). 끝 면은 x = −jawGap 의 세로 면,
 * 안쪽은 중심 (0, jawH)·반지름 jawR 인 구멍 원, 아래 끝은 허브 원(반지름 hub) 위의 호에 붙는다.
 */
export function jawClosed120(): V2[] {
  const { jawH: hj, jawR: rj, jawTip: tw, jawGap: g, hub: rh } = K120;
  const yi = hj + Math.sqrt(rj * rj - g * g);
  const A: V2 = [-g, yi + tw];
  const B: V2 = [-(rj + 0.095), hj - 0.06];
  const C = pol(rh, K120.jawRootDeg * DEG);
  const { o, r } = circum(A, B, C);
  const aA = Math.atan2(A[1] - o[1], A[0] - o[0]);
  let aC = Math.atan2(C[1] - o[1], C[0] - o[0]);
  while (aC < aA) aC += TAU;
  const out: V2[] = arc(o[0], o[1], r, aA, aC, 40);
  // 허브 원을 따라 안쪽 구멍 원이 들어오는 자리까지(각이 주는 쪽)
  const ye = (rh * rh - rj * rj + hj * hj) / (2 * hj);
  const xe = -Math.sqrt(rh * rh - ye * ye);
  const aE = Math.atan2(ye, xe);
  out.push(...arc(0, 0, rh, K120.jawRootDeg * DEG, aE, 8).slice(1));
  let t0 = Math.atan2(ye - hj, xe);
  const t1 = Math.atan2(yi - hj, -g);
  while (t0 < t1) t0 += TAU;
  out.push(...arc(0, hj, rj, t0, t1, 40).slice(1));
  return out;
}

/** 턱 윤곽(벌린 자세 = 조각의 로컬 좌표). 'sector' = 왼쪽 턱(부채꼴 조각), 'ring' = 오른쪽 턱(활 틀 조각) */
export function jawOutline120(piece: 'sector' | 'ring'): V2[] {
  const base = jawClosed120();
  if (piece === 'sector') return base.map((p) => rot2(p, K120.sectorSwing));
  return base.map((p) => rot2([-p[0], p[1]] as V2, -K120.ringSwing)).reverse();
}

// ═══════════════════════════ 121 디스크 휠과 클릭 ═══════════════════════════

const N121 = 26;
const TOOTH121 = TAU / N121;

/**
 * 121번 치수(디스크 반지름 1.0 기준, 판화 비). 디스크 로컬 좌표는 **디스크 각 0 = 행정의 위 끝**(막대가 가장 올라간 자세)이고
 * 판화 자세는 디스크가 시계 방향으로 swing 만큼 돈 아래 끝(밀기를 마친 순간)이다.
 */
export const K121 = {
  /** 디스크 바깥 반지름·두께 */
  R: 1.0,
  diskT: 0.06,
  /** 코그휠: 잇수, 이끝·이뿌리 반지름, 폭 */
  teeth: N121,
  rTip: 0.652,
  rRoot: 0.53,
  cogW: 0.08,
  /** 걸쇠 못: 디스크 로컬 극좌표(반지름, 각). 판화 자세에서는 100° */
  clickR: 0.755,
  clickA: 130 * DEG,
  /** 막대 못: 반지름, 디스크 로컬 각(판화 자세에서는 −15°) */
  pinR: 0.768,
  pinA: 15 * DEG,
  /** 디스크가 한 번에 흔들리는 각(30°) = 이 2개 + 헛걸음 eps */
  swing: 30 * DEG,
  step: 2,
  eps: 30 * DEG - 2 * TOOTH121,
  /** 막대 핀 사이 길이, 막대 위 끝(미끄럼 블록 핀)이 다니는 세로선의 x(축 중심 기준) */
  rod: 1.25,
  guideX: 0.775,
  /** 걸쇠: 못에서 앞면까지, 갈래 반길이, 눈 반지름, 팔 반폭, 갈래 끝 두께, 판 두께 */
  clickArm: 0.408,
  clickProng: 0.232,
  clickEye: 0.07,
  clickHalf: 0.035,
  clickTip: 0.022,
  clickT: 0.06,
  /** 걸쇠가 가장 깊이 앉았을 때 갈래 끝과 이뿌리 사이 틈 */
  seatGap: 0.03
} as const;

/** 꼭짓점을 반지름 r 쯤으로 둥글린 다각형(각 꼭짓점을 2차 곡선으로) */
function roundCorners(pts: readonly V2[], radii: readonly number[], n = 3): V2[] {
  const out: V2[] = [];
  const N = pts.length;
  for (let i = 0; i < N; i++) {
    const v = pts[i]!;
    const a = pts[(i + N - 1) % N]!;
    const b = pts[(i + 1) % N]!;
    const r = radii[i % radii.length]!;
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]);
    const lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const d = Math.min(r, la * 0.45, lb * 0.45);
    if (d < 1e-6) {
      out.push(v);
      continue;
    }
    const p0: V2 = [v[0] + ((a[0] - v[0]) * d) / la, v[1] + ((a[1] - v[1]) * d) / la];
    const p1: V2 = [v[0] + ((b[0] - v[0]) * d) / lb, v[1] + ((b[1] - v[1]) * d) / lb];
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const u = 1 - s;
      out.push([u * u * p0[0] + 2 * u * s * v[0] + s * s * p1[0], u * u * p0[1] + 2 * u * s * v[1] + s * s * p1[1]]);
    }
  }
  return out;
}

/** 코그휠 윤곽(반시계). 이 k 의 중심 = k·(2π/26), 네모꼴 이(끝·뿌리 둥글림) — 뒤집어도 되게 좌우 대칭 */
export function cogOutline121(from = 0, count: number = N121): V2[] {
  const { rTip, rRoot } = K121;
  const raw: V2[] = [];
  for (let i = 0; i < count; i++) {
    const c = (from + i) * TOOTH121;
    raw.push(pol(rRoot, c - 0.2 * TOOTH121), pol(rTip, c - 0.16 * TOOTH121), pol(rTip, c + 0.16 * TOOTH121), pol(rRoot, c + 0.2 * TOOTH121));
  }
  return roundCorners(raw, [0.014, 0.018, 0.018, 0.014]);
}

/**
 * 걸쇠(클릭) 윤곽 — 로컬: 원점 = 못 구멍, +X = 팔 방향. 앞면(x = clickArm)은 곧은 면이고 위아래 갈래가 대칭(뒤집어 쓸 수 있다).
 * 아래 갈래(−Y 쪽) 끝이 이골에 들어가 앞면 아래 모서리로 이를 민다.
 */
export function clickOutline121(): V2[] {
  const { clickArm: La, clickProng: Lp, clickEye: re, clickHalf: ah, clickTip: tw } = K121;
  const q = (p0: V2, c: V2, p1: V2, n: number): V2[] => {
    const o: V2[] = [];
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      const u = 1 - s;
      o.push([u * u * p0[0] + 2 * u * s * c[0] + s * s * p1[0], u * u * p0[1] + 2 * u * s * c[1] + s * s * p1[1]]);
    }
    return o;
  };
  const neck = La - 0.2;
  const a0 = Math.asin(ah / re);
  const out: V2[] = [];
  // 아래 갈래 끝(둥근 끝) → 앞면 → 위 갈래 끝
  out.push([La - tw, -Lp + 0.004], [La - tw * 0.72, -Lp], [La - tw * 0.28, -Lp], [La, -Lp + 0.006]);
  out.push([La, Lp - 0.006], [La - tw * 0.28, Lp], [La - tw * 0.72, Lp], [La - tw, Lp - 0.004]);
  // 위 갈래 등 → 팔 윗변 → 눈 → 팔 아랫변 → 아래 갈래 등
  out.push(...q([La - tw, Lp - 0.004], [La - tw - 0.006, ah + 0.03], [neck, ah], 10));
  out.push(...arc(0, 0, re, a0, TAU - a0, 20));
  out.push([neck, -ah]);
  out.push(...q([neck, -ah], [La - tw - 0.006, -ah - 0.03], [La - tw, -Lp + 0.004], 10).slice(0, -1));
  return out;
}

interface Seat121 {
  /** 디스크 로컬에서 걸쇠의 기준 각(가장 깊이 앉은 자세의 rotation.z) */
  base: number;
  /** 디스크 각 0 에서 걸쇠가 이에 닿아 앉는 코그휠 각 */
  cog: number;
  /** 걸쇠 들림 표: q = 0 … 한 이 피치(코그휠 기준으로 디스크가 반시계로 물러난 각)를 LIFT_N 등분 */
  lift: number[];
}
const LIFT_N = 120;
let seatCache: Seat121 | null = null;

let clickPts: V2[] | null = null;
let cogPts: V2[] | null = null;

function clickAt(angle: number): V2[] {
  const pv = pol(K121.clickR, K121.clickA);
  clickPts ??= clickOutline121();
  return clickPts.map((p) => {
    const r = rot2(p, angle);
    return [r[0] + pv[0], r[1] + pv[1]] as V2;
  });
}

/** 코그휠(각 cog) 가운데 걸쇠 코 근처 이 7개만 떼어 낸 조각(중심을 지나 닫음) — 접촉 풀이를 빠르게 */
function cogNear(cog: number, at: number): V2[] {
  const k0 = Math.round((at - cog) / TOOTH121) - 3;
  cogPts ??= cogOutline121();
  const per = cogPts.length / N121;
  const c = Math.cos(cog);
  const s = Math.sin(cog);
  const sec: V2[] = [];
  for (let i = 0; i < 7 * per; i++) {
    const p = cogPts[(((k0 * per + i) % cogPts.length) + cogPts.length) % cogPts.length]!;
    sec.push([p[0] * c - p[1] * s, p[0] * s + p[1] * c]);
  }
  sec.push([0, 0]);
  return sec;
}

function solveSeat121(): Seat121 {
  if (seatCache) return seatCache;
  const { clickArm: La, clickProng: Lp, clickTip: tw, rRoot, seatGap } = K121;
  const pv = pol(K121.clickR, K121.clickA);
  const tipR = (b: number): number => {
    const t = rot2([La - tw / 2, -Lp], b);
    return Math.hypot(t[0] + pv[0], t[1] + pv[1]);
  };
  // 기준 각: 갈래 끝이 이뿌리 + seatGap 에 오는 각(각이 줄수록 끝이 바퀴로 들어간다)
  let lo = 0;
  let hi = 60 * DEG;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (tipR(mid) > rRoot + seatGap) hi = mid;
    else lo = mid;
  }
  const base = (lo + hi) / 2;
  const tip0 = rot2([La - tw / 2, -Lp], base);
  const tipA = Math.atan2(tip0[1] + pv[1], tip0[0] + pv[0]);
  const click0 = clickAt(base);
  // 접촉 깊이(빠른 판): 걸쇠 점은 이끝원 안쪽 것만, 코그휠 점은 걸쇠 상자 안 것만 본다
  const pen = (click: V2[], cog: number): number => {
    const sec = cogNear(cog, tipA);
    let w = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of click) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
      if (Math.hypot(p[0], p[1]) < K121.rTip + 0.004) w = Math.max(w, polyPen119(p, sec));
    }
    for (const p of sec) if (p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1) w = Math.max(w, polyPen119(p, click));
    return w;
  };
  // 이골 중심이 갈래 끝에 오는 코그휠 각에서 반시계로 돌려(= 시계 쪽 이가 다가옴) 앞면에 닿는 각
  const g0 = tipA + TOOTH121 / 2;
  let c0 = g0;
  let c1 = g0 + TOOTH121 / 2;
  for (let i = 0; i < 40; i++) {
    const mid = (c0 + c1) / 2;
    if (pen(click0, mid) > 0) c1 = mid;
    else c0 = mid;
  }
  const cog = c0 - 0.0006;
  // 들림 표: 코그휠을 cog − q 에 두고(디스크가 q 만큼 반시계로 물러난 것과 같다) 닿지 않는 가장 작은 들림 각
  const raw: number[] = [];
  for (let i = 0; i < LIFT_N; i++) {
    const q = (i / LIFT_N) * TOOTH121;
    if (pen(click0, cog - q) <= 0) {
      raw.push(0);
      continue;
    }
    let a = 0;
    let b = 0.5;
    for (let k = 0; k < 14; k++) {
      const mid = (a + b) / 2;
      if (pen(clickAt(base + mid), cog - q) > 0) a = mid;
      else b = mid;
    }
    raw.push(b);
  }
  // 이를 넘어 떨어지는 쪽을 조금 늦춰 부드럽게(접촉 곡선보다 낮아지지 않는다). 마지막 칸은 다음 이골의 0 으로 이어진다
  const maxDrop = 0.5 / 14;
  const lift = [...raw];
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < LIFT_N; i++) lift[i] = Math.max(lift[i]!, lift[i - 1]! - maxDrop);
  seatCache = { base, cog, lift };
  return seatCache;
}

/** 걸쇠의 기준 각(디스크 로컬 rotation.z, 가장 깊이 앉은 자세) */
export function clickBase121(): number {
  return solveSeat121().base;
}

/** 걸쇠 들림 각: q = 코그휠 기준으로 디스크가 앉은 자리에서 반시계로 물러난 각(아무 값이나, 한 이 피치 주기) */
export function clickLift121(q: number): number {
  const s = solveSeat121();
  const f = (((q / TOOTH121) % 1) + 1) % 1;
  const x = f * LIFT_N;
  const i = Math.floor(x) % LIFT_N;
  const a = s.lift[i]!;
  const b = s.lift[(i + 1) % LIFT_N]!;
  return a + (b - a) * (x - Math.floor(x));
}

export interface Feed121 {
  /** 주기 안 위상(0 ~ 2π). 0~π = 미는 행정(디스크 시계 방향), π~2π = 되돌아가는 행정 */
  v: number;
  /** 지난 주기 수 */
  n: number;
  /** 디스크 rotation.z (0 ~ −swing) */
  disk: number;
  /** 코그휠 rotation.z (시계 방향으로 주기마다 이 step 개) */
  cog: number;
  /** 걸쇠의 디스크 로컬 rotation.z */
  click: number;
  /** 막대 못의 자리(축 중심 기준) */
  pin: V2;
  /** 막대 위 끝(미끄럼 블록 핀)의 높이(축 중심 기준, x = guideX) */
  top: number;
  /** 막대 rotation.z (못 → 위 끝 방향) */
  rodAngle: number;
  /** 지금 이를 밀고 있는가 */
  driving: boolean;
}

/**
 * 121 운동식(닫힌 식 + 들림 표). theta = 1.6(t = 1)에 판화 자세(미는 행정의 끝, 막대가 가장 내려감).
 * 디스크 = −swing·(1 − cos v)/2. 코그휠은 미는 행정에서 헛걸음 eps 뒤부터 디스크와 함께 돌고(이 step 개), 돌아갈 때는 선다.
 */
export function feed121(theta: number): Feed121 {
  const { swing, eps, step, pinR, pinA, rod, guideX } = K121;
  const s = solveSeat121();
  const u = theta - 1.6 + Math.PI;
  const n = Math.floor(u / TAU);
  const v = u - n * TAU;
  const w = (swing * (1 - Math.cos(v))) / 2;
  const full = step * TOOTH121;
  const adv = v <= Math.PI ? Math.min(full, Math.max(0, w - eps)) : full;
  const q = eps + adv - w;
  const disk = -w;
  const cog = s.cog - eps - n * full - adv;
  const pa = pinA + disk;
  const pin: V2 = [pinR * Math.cos(pa), pinR * Math.sin(pa)];
  const dx = guideX - pin[0];
  const top = pin[1] + Math.sqrt(rod * rod - dx * dx);
  return { v, n, disk, cog, click: s.base + clickLift121(q), pin, top, rodAngle: Math.atan2(top - pin[1], dx), driving: v <= Math.PI && w > eps && adv < full };
}

/** 걸쇠 윤곽을 축 중심 좌표(디스크 각 disk, 걸쇠 각 click)로 — 검사 스크립트용 */
export function clickWorld121(disk: number, click: number): V2[] {
  return clickAt(click).map((p) => rot2(p, disk));
}

// ═══════════════════════════ 부품(메시) ═══════════════════════════

/** Z축 관(끼움 고리·사이 띄우개). 로컬 z0 ~ z1 */
export function spacer119(rIn: number, rOut: number, z0: number, z1: number): THREE.Mesh {
  return mesh(tubeZ(rIn, rOut, z0, z1, Math.min(0.006, (z1 - z0) * 0.2)), darkSteel());
}

// ───────────────────────── 119 ─────────────────────────

/**
 * 타원 무한 랙 + 랙을 싣는 막대(119). 원점 = 랙 중심, z = 0 이 랙 판의 가운데 평면.
 * 막대는 랙 뒤(가운데 z = −thick/2 − barBack − barT/2)에 리벳으로 붙어 양끝으로 stub 만큼 나온다. 리벳 4개. 랙 판 메시에 userData.outline.
 */
export function oblongRack119(): THREE.Group {
  const { L, h, add, module: m, thick, barHalf, barT, stub } = K119;
  const g = new THREE.Group();
  const outline = rackOutline119();
  const plate = mesh(extrude(shapeFrom(outline), thick, 0.006), brass());
  plate.userData.outline = outline;
  g.add(plate);
  const hl = L / 2 + h + add * m + stub;
  const pts: V2[] = [...arc(hl - barHalf, 0, barHalf, -Math.PI / 2, Math.PI / 2, 10), ...arc(-hl + barHalf, 0, barHalf, Math.PI / 2, 1.5 * Math.PI, 10)];
  g.add(meshAt(extrude(shapeFrom(pts), barT, 0.008), steel(), 0, 0, -thick / 2 - K119.barBack - barT / 2));
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) g.add(meshAt(cylZ(0.026, -thick / 2 - K119.barBack - 0.004, thick / 2 + 0.012, 0.005, 16), darkSteel(), (sx * L) / 2, sy * 0.045, 0));
  }
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.014, 0.006), paint(MARK), 0, 0, thick / 2 + 0.002));
  setMM(g, { kind: 'rack', fn: 'oblongRack119', module: m, teeth: K119.nRack, width: thick, halfLen: hl });
  return g;
}

/**
 * 119 피니언 + 축(한 몸으로 돈다). 원점 = 피니언 중심, z = 0 이 랙·피니언의 가운데 평면, 이 0 = 로컬 +X.
 * 축은 앞으로 나와 홈 막대(로컬 z barZ0 ~ barZ1)의 홈을 지나고, 막대 앞뒤에 턱(고리)과 가로 핀이 있다.
 * 돌려주는 그룹이 곧 기어(userData.mm kind 'gear') — name 을 여기에 붙인다.
 */
export function manglePinion119(barZ0 = 0.12, barZ1 = 0.18): THREE.Group {
  const { shaftR, thick } = K119;
  const g = pinion119(K119.teeth, K119.module, { width: thick, bore: shaftR, driver: true });
  g.add(mesh(cylZ(shaftR, -thick / 2, barZ1 + 0.12, 0.008), steel()));
  g.add(spacer119(shaftR, 0.075, thick / 2 + 0.004, barZ0 - 0.004));
  g.add(spacer119(shaftR, 0.08, barZ1 + 0.004, barZ1 + 0.044));
  const pinGeo = lathe(rodProfile(0.012, -0.1, 0.1, 0.003, 0.003), 12);
  pinGeo.rotateZ(Math.PI / 2);
  g.add(meshAt(pinGeo, darkSteel(), 0, 0, barZ1 + 0.08));
  return g;
}

/**
 * 홈 막대(119, 고정): 세로 막대(폭 w)에 축이 오르내리는 긴 홈. 원점 = 홈 가운데, z = 0 이 막대 가운데 평면.
 * yDown·yUp = 원점에서 막대 아래·위 끝까지, slotHalfLen = 홈 양끝 반원 중심까지의 거리. 위아래 끝에 볼트 머리 둘씩.
 */
export function slottedBar119(yDown: number, yUp: number, slotHalfLen: number, w = 0.3, t = 0.06): THREE.Group {
  const r = K119.slotHalf;
  const g = new THREE.Group();
  const shape = shapeFrom([
    [-w / 2, -yDown],
    [w / 2, -yDown],
    [w / 2, yUp],
    [-w / 2, yUp]
  ]);
  const slot: V2[] = [...arc(0, slotHalfLen, r, 0, Math.PI, 12), ...arc(0, -slotHalfLen, r, Math.PI, TAU, 12)];
  shape.holes.push(pathFrom(slot));
  g.add(mesh(extrude(shape, t, 0.008), castIron({ roughness: 0.55 })));
  const nut = hexPrism(0.05, 0.03, false, true, 0);
  nut.rotateX(Math.PI / 2);
  for (const y of [-yDown + 0.09, yUp - 0.09]) {
    for (const sx of [-1, 1]) g.add(meshAt(nut.clone(), darkSteel(), sx * w * 0.28, y, t / 2 + 0.012));
  }
  setMM(g, { kind: 'guide', fn: 'slottedBar119', axis: 'y', slotHalfLen, slotHalf: r });
  return g;
}

/** 틀 들보(119, 고정): 뒤판에 붙는 나무 들보. 원점 = 들보 가운데, 크기 w × h × depth */
export function frameBeam119(w: number, h: number, depth: number): THREE.Mesh {
  const geo = extrude(shapeFrom([
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2]
  ]), depth, 0.012);
  return mesh(geo, wood());
}

/**
 * 랙 막대 안내(119, 고정, 판화에 없음): 뒤판에서 나온 받침 + 막대 위아래를 감싸는 턱. 원점 = 막대 중심선 위, z = 0 이 막대 가운데 평면.
 * back = 막대 가운데 평면에서 뒤판 앞면까지 거리.
 */
export function barGuide119(back: number, w = 0.3): THREE.Group {
  const { barHalf, barT } = K119;
  const g = new THREE.Group();
  const body = castIron();
  const gap = 0.004;
  const z0 = -back;
  const zb = -barT / 2 - gap;
  g.add(meshAt(new THREE.BoxGeometry(w, 2 * barHalf + 0.12, zb - z0), body, 0, 0, (z0 + zb) / 2));
  for (const sy of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(w, 0.05, barT - 0.01), body, 0, sy * (barHalf + gap + 0.025), zb + (barT - 0.01) / 2));
  setMM(g, { kind: 'guide', fn: 'barGuide119', axis: 'x' });
  return g;
}

// ───────────────────────── 120 ─────────────────────────

/**
 * 바깥 이 부채꼴 + 왼쪽 턱(120). 원점 = 피벗, z = 0 이 **앞 층**(부채꼴·작은 피니언)의 가운데 평면. 윤곽은 벌린 자세.
 * 판(허브 + 두 팔 + 이 난 테)은 앞 층 두께, 턱은 두 층에 걸친 두께(로컬 z −layerGap − layer/2 ~ layer/2).
 * 그룹이 기어 표식(kind 'gear', 잇수 32, 바깥 이) — name 을 여기에. userData.outlines.jaw = 턱 윤곽.
 */
export function sectorJaw120(): THREE.Group {
  const { module: m, layer, layerGap, bore } = K120;
  const g = new THREE.Group();
  const o = sectorOutline120();
  const shape = shapeFrom(o.outer);
  shape.holes.push(pathFrom(o.window), circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, layer, 0.006), brass()));
  const jaw = jawOutline120('sector');
  g.add(meshAt(extrude(shapeFrom(jaw), layer + layerGap, 0.008), steel(), 0, 0, -layerGap / 2));
  g.userData.outlines = { jaw };
  const rp = (K120.zSector * m) / 2;
  setMM(g, { kind: 'gear', fn: 'sectorJaw120', teeth: K120.zSector, module: m, internal: false, rp, ra: rp + m, rf: rp - 1.25 * m, width: layer, axis: 'z', count: K120.sectorTeeth });
  return g;
}

/**
 * 안쪽 이 활 틀 + 오른쪽 턱(120). 원점 = 피벗, z = 0 이 **뒤 층**(활 틀·큰 피니언)의 가운데 평면. 윤곽은 벌린 자세.
 * 턱은 두 층에 걸친 두께(로컬 z −layer/2 ~ layerGap + layer/2). 그룹이 기어 표식(kind 'gear', 잇수 64, 안쪽 이).
 * userData.outlines.jaw = 턱 윤곽.
 */
export function ringJaw120(): THREE.Group {
  const { module: m, layer, layerGap, bore, wall } = K120;
  const g = new THREE.Group();
  const o = ringOutline120();
  const shape = shapeFrom(o.outer);
  shape.holes.push(pathFrom(o.inner), circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, layer, 0.006), bronze({ roughness: 0.4 })));
  const jaw = jawOutline120('ring');
  g.add(meshAt(extrude(shapeFrom(jaw), layer + layerGap, 0.008), steel(), 0, 0, layerGap / 2));
  g.userData.outlines = { jaw };
  const rp = (K120.zRing * m) / 2;
  setMM(g, { kind: 'gear', fn: 'ringJaw120', teeth: K120.zRing, module: m, internal: true, rp, ra: rp - m, rf: rp + 1.25 * m, rOut: rp + 1.25 * m + wall, width: layer, axis: 'z', count: K120.ringGaps - 1 });
  return g;
}

// ───────────────────────── 121 ─────────────────────────

/**
 * 디스크 휠(121). 원점 = 축 중심, z = 0 이 디스크 가운데 평면. 디스크 각 0 = 행정의 위 끝.
 * 앞면에 걸쇠 못(child 'clickPivot', 로컬 z = clickZ)과 막대 못(child 'rodPin', 로컬 z = rodZ)이 솟아 있다.
 */
export function diskWheel121(clickZ = 0.09, rodZ = 0.1): THREE.Group {
  const { R, diskT, clickR, clickA, pinR, pinA, clickT } = K121;
  const g = new THREE.Group();
  g.add(mesh(tubeZ(0.062, R, -diskT / 2, diskT / 2, 0.01, 96), castIron({ roughness: 0.5 })));
  for (let i = 0; i < 3; i++) {
    const a = 200 * DEG + i * 40 * DEG;
    g.add(meshAt(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), 0.9 * R * Math.cos(a), 0.9 * R * Math.sin(a), diskT / 2 + 0.002));
  }
  const cp = pol(clickR, clickA);
  g.add(meshAt(cylZ(0.03, diskT / 2 - 0.004, clickZ + clickT / 2 + 0.014, 0.005, 20), steel(), cp[0], cp[1], 0));
  g.add(meshAt(cylZ(0.05, diskT / 2 - 0.004, clickZ - clickT / 2 - 0.003, 0.004, 20), darkSteel(), cp[0], cp[1], 0));
  const c = new THREE.Object3D();
  c.name = 'clickPivot';
  c.position.set(cp[0], cp[1], clickZ);
  g.add(markPin(c));
  const rp = pol(pinR, pinA);
  g.add(meshAt(cylZ(0.045, diskT / 2 - 0.004, rodZ + 0.05, 0.006, 24), steel(), rp[0], rp[1], 0));
  g.add(meshAt(cylZ(0.07, diskT / 2 - 0.004, rodZ - 0.034, 0.004, 24), darkSteel(), rp[0], rp[1], 0));
  const p = new THREE.Object3D();
  p.name = 'rodPin';
  p.position.set(rp[0], rp[1], rodZ);
  g.add(markPin(p));
  setMM(g, { kind: 'disk', fn: 'diskWheel121', r: R, width: diskT, axis: 'z' });
  return g;
}

/** 코그휠(121). 원점 = 축 중심, z = 0 이 가운데 평면, 이 0 = 로컬 +X. 그룹이 기어 표식, 몸통 메시에 userData.outline */
export function cogWheel121(): THREE.Group {
  const { rTip, rRoot, cogW, teeth } = K121;
  const g = new THREE.Group();
  const outline = cogOutline121();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.062));
  const body = mesh(extrude(shape, cogW, 0.006), brass());
  body.userData.outline = outline;
  g.add(body);
  g.add(mesh(tubeZ(0.062, 0.2, -cogW / 2 - 0.004, cogW / 2 + 0.014, 0.008, 48), darkSteel()));
  g.add(mesh(tubeZ(0.062, 0.12, cogW / 2 + 0.01, cogW / 2 + 0.034, 0.006, 40), steel()));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.02, 0.006), paint(MARK), 0.36, 0, cogW / 2 + 0.002));
  const rp = (rTip + rRoot) / 2;
  setMM(g, { kind: 'gear', fn: 'cogWheel121', teeth, module: (2 * rp) / teeth, internal: false, rp, ra: rTip, rf: rRoot, width: cogW, axis: 'z' });
  return g;
}

/** 걸쇠(클릭, 121). 원점 = 못 구멍, +X = 팔 방향, z = 0 이 가운데 평면. 판 메시에 userData.outline */
export function click121(): THREE.Group {
  const g = new THREE.Group();
  const outline = clickOutline121();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.032));
  const plate = mesh(extrude(shape, K121.clickT, 0.006), steel());
  plate.userData.outline = outline;
  g.add(plate);
  setMM(g, { kind: 'pawl', fn: 'click121', arm: K121.clickArm, prong: K121.clickProng });
  return g;
}

/** 전시대 뒤판 앞면의 z (모델이 받침 길이를 셈할 때) */
export const BACK119 = STAGE.backZ;
