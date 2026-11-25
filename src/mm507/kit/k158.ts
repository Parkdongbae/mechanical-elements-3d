// 158·159·160번 전용 키트 — 발판(트레들) 묶음
//  158 발판과 원판: 종 모양 받침대, 크랭크 원판, 눈 달린 연결봉, 발판 막대(+ 봉 핀 귀), 4절 링크 풀이
//  159 줄과 도르래 발판: 같은 원판·발판 + 줄 매듭 고리, 줄 길이로 발판 각을 푸는 식
//  160 스프링 발판과 띠: 장대 스프링(휘는 나무 장대), 스프링 물림쇠, 띠 고리쇠, 한 바퀴 감는 띠 경로, 풀이
// 치수 상수(K158·K159·K160)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s158.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, rubber, steel, wood } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markAnchor, markPin, setMM, tagArc } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1, 양끝 모따기 c) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function circlePoly(cx: number, cy: number, r: number, n = 32): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) out.push([cx + r * Math.cos((i * TAU) / n), cy + r * Math.sin((i * TAU) / n)]);
  return out;
}

/** 두 원의 교점 가운데 c1→c2 방향의 왼쪽(left = true) 또는 오른쪽 해. 못 만나면 가장 가까운 점 */
function twoCircle(c1: V2, r1: number, c2: V2, r2: number, left: boolean): V2 {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy) || 1e-9;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const s = left ? 1 : -1;
  return [c1[0] + a * ux - s * h * uy, c1[1] + a * uy + s * h * ux];
}

/** 점 → 원(시계 방향으로 감음) 접선: 접점과 접선 길이. 점이 원 밖이어야 한다 */
function tanIn(p: V2, c: V2, r: number, ccw: boolean): { q: V2; len: number; ang: number } {
  const dx = c[0] - p[0];
  const dy = c[1] - p[1];
  const D = Math.hypot(dx, dy);
  const s = ccw ? 1 : -1;
  const k = Math.max(-0.999 * D, Math.min(0.999 * D, s * r));
  const tau = Math.atan2(dy, dx) - Math.asin(k / D);
  const q: V2 = [c[0] + r * s * Math.sin(tau), c[1] - r * s * Math.cos(tau)];
  return { q, len: Math.hypot(q[0] - p[0], q[1] - p[1]), ang: Math.atan2(q[1] - c[1], q[0] - c[0]) };
}

/** 원(감는 방향 ccw) → 점 접선 */
function tanOut(c: V2, r: number, p: V2, ccw: boolean): { q: V2; len: number; ang: number } {
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  const D = Math.hypot(dx, dy);
  const s = ccw ? 1 : -1;
  const k = Math.max(-0.999 * D, Math.min(0.999 * D, -s * r));
  const tau = Math.atan2(dy, dx) - Math.asin(k / D);
  const q: V2 = [c[0] + r * s * Math.sin(tau), c[1] - r * s * Math.cos(tau)];
  return { q, len: Math.hypot(q[0] - p[0], q[1] - p[1]), ang: Math.atan2(q[1] - c[1], q[0] - c[0]) };
}

/** 각 차를 (−π, π] 로 */
function wrapPi(a: number): number {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
}

// ═══════════════════════════ 158 발판과 원판 ═══════════════════════════

/** 158번 치수 — 판화 비 그대로(원판 반지름 0.8 기준). 좌표는 전시대(바닥 = 받침 윗면 0.18) */
export const K158 = {
  /** 받침(바닥) 높이 */
  floor: 0.18,
  /** 원판 축 중심 */
  O: [0, 1.75] as V2,
  /** 원판 반지름 */
  R: 0.8,
  /** 크랭크 반지름(축 ~ 크랭크 핀) = 0.83R */
  crank: 0.66,
  /** 연결봉 핀 사이 길이 */
  rod: 0.945,
  /** 발판 받침 핀(오른쪽 귀의 구멍) */
  Q: [1.0, 0.5] as V2,
  /** 받침 핀에서 봉 핀까지 막대를 따라 잰 거리 */
  a: 1.735,
  /** 봉 핀이 막대 가운데선에서 아래로 내려온 거리(막대 밑의 귀) */
  e: 0.09,
  /** 발판 막대 길이(받침 핀 ~ 왼쪽 끝) */
  bar: 2.48,
  /** 발판 막대 높이(두께) */
  barH: 0.06,
  /** t = 1(판화 자세)에서 크랭크 핀의 각 — 왼쪽 아래 */
  pose: -146 * DEG
} as const;

export interface Pose158 {
  /** 원판 회전각(= 크랭크 핀의 각) */
  a: number;
  /** 크랭크 핀 */
  pin: V2;
  /** 발판 봉 핀(막대 밑 귀의 핀) */
  T: V2;
  /** 발판 기울기: 왼쪽 끝이 받침 핀보다 올라간 각(rad, + = 위). 막대 그룹의 rotation.z = −tilt */
  tilt: number;
  /** 연결봉이 +X 와 이루는 각(크랭크 핀 → 봉 핀) */
  rodAngle: number;
}

/** 158번 4절 링크 풀이. theta = 구동 누적각(원판 반시계). t = 1(theta 1.6)에서 판화 자세 */
export function treadle158(theta: number): Pose158 {
  const K = K158;
  const a = theta - 1.6 + K.pose;
  const pin: V2 = [K.O[0] + K.crank * Math.cos(a), K.O[1] + K.crank * Math.sin(a)];
  const b = Math.hypot(K.a, K.e);
  // 봉 핀 T: 원(pin, rod) ∩ 원(Q, b). pin → Q 방향의 오른쪽(아래쪽) 해
  const T = twoCircle(pin, K.rod, K.Q, b, false);
  // 막대 방향(받침 핀 → 왼쪽 끝)이 −X 에서 위로 tilt 만큼. T = Q + a·u + e·(u 를 +90° 돌린 것 = 아래)
  const angT = Math.atan2(T[1] - K.Q[1], T[0] - K.Q[0]);
  const phi = angT - Math.atan2(K.e, K.a);
  const tilt = wrapPi(Math.PI - phi);
  return { a, pin, T, tilt, rodAngle: Math.atan2(T[1] - pin[1], T[0] - pin[0]) };
}

export interface BellStandardOpts {
  /** 꼭대기 둥근 머리 반지름. 기본 0.2 */
  topR?: number;
  /** 허리 반폭(머리 아래 곧은 부분). 기본 topR */
  waist?: number;
  /** 발 반폭(받침판에 닿는 곳). 기본 waist */
  foot?: number;
  /** 발이 벌어지기 시작하는 높이(받침판 윗면에서). 기본 (pinY − baseH)·0.45 */
  flareH?: number;
  /** 세운 판 두께(z). 기본 0.12 — 그룹 z = 0 이 두께 가운데 */
  thick?: number;
  /** 구멍 반지름. 0 이면 구멍 없음. 기본 0.05 */
  bore?: number;
  /** 구멍 둘레 보스 반지름(0 이면 없음)과 한쪽 돌출 길이 */
  bossR?: number;
  bossLen?: number;
  /** 받침판 x 범위(그룹 원점 기준). 없으면 받침판 없음 */
  base?: [number, number];
  /** 받침판 두께. 기본 0.09 */
  baseH?: number;
  /** 받침판 z 범위(그룹 원점 기준). 기본 [−thick/2 − 0.06, thick/2 + 0.06] */
  baseZ?: [number, number];
}

/** 종 모양 받침대의 정면 윤곽(반시계): 둥근 머리 → 곧은 허리 → 벌어진 발. y0 = 발 높이 */
function bellPts(pinY: number, topR: number, waist: number, foot: number, flareH: number, y0: number): V2[] {
  const out: V2[] = [];
  const yF = y0 + flareH;
  // 오른쪽 발 → 허리 (2차 베지에: 조절점 (waist, y0))
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    out.push([u * u * foot + 2 * u * t * waist + t * t * waist, u * u * y0 + 2 * u * t * y0 + t * t * yF]);
  }
  // 허리 → 머리(어깨에서 머리 원으로)
  const sh = Math.acos(Math.min(1, waist / topR));
  if (waist >= topR - 1e-9) out.push([waist, pinY]);
  for (let i = 0; i <= 20; i++) {
    const ang = (waist >= topR - 1e-9 ? 0 : -sh) + ((Math.PI + (waist >= topR - 1e-9 ? 0 : 2 * sh)) * i) / 20;
    out.push([topR * Math.cos(ang), pinY + topR * Math.sin(ang)]);
  }
  if (waist >= topR - 1e-9) out.push([-waist, pinY]);
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    const u = 1 - t;
    out.push([-(u * u * foot + 2 * u * t * waist + t * t * waist), u * u * y0 + 2 * u * t * y0 + t * t * yF]);
  }
  return out;
}

/**
 * 종 모양 받침대(주철): 원점 = 바닥(받침판 밑면)에서 구멍 바로 아래, 구멍 중심 = (0, pinY), 구멍 축 = Z.
 * 받침판(base)을 주면 userData.outlines.base(받침판 정면 네모)를 남긴다. 원판 축 받침·발판 받침 귀·작은 받침쇠에 모두 쓴다.
 */
export function bellStandard158(pinY: number, o: BellStandardOpts = {}): THREE.Group {
  const topR = o.topR ?? 0.2;
  const waist = Math.min(o.waist ?? topR, topR);
  const foot = Math.max(o.foot ?? waist, waist);
  const baseH = o.base ? (o.baseH ?? 0.09) : 0;
  const flareH = o.flareH ?? (pinY - baseH) * 0.45;
  const thick = o.thick ?? 0.12;
  const bore = o.bore ?? 0.05;
  const g = new THREE.Group();
  const shape = shapeFrom(bellPts(pinY, topR, waist, foot, flareH, baseH - 0.004));
  if (bore > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, pinY, bore, 0, TAU, true);
    shape.holes.push(hole);
  }
  g.add(mesh(extrude(shape, thick, 0.008, 20), castIron({ roughness: 0.6 })));
  const bossR = o.bossR ?? 0;
  if (bossR > bore && bore > 0) {
    const bl = o.bossLen ?? 0.02;
    g.add(meshAt(tubeZ(bore, bossR, -thick / 2 - bl, thick / 2 + bl, 0.006), darkSteel(), 0, pinY, 0));
  }
  if (o.base) {
    const [x0, x1] = o.base;
    const [z0, z1] = o.baseZ ?? [-thick / 2 - 0.06, thick / 2 + 0.06];
    const plate = mesh(new THREE.BoxGeometry(x1 - x0, baseH, z1 - z0), castIron({ roughness: 0.65 }));
    plate.position.set((x0 + x1) / 2, baseH / 2, (z0 + z1) / 2);
    g.add(plate);
    g.userData.outlines = { base: [[x0, 0], [x1, 0], [x1, baseH], [x0, baseH]] as V2[] };
  }
  setMM(g, { kind: 'standard', pinY, topR, thick, bore });
  return g;
}

export interface CrankDiscOpts {
  /** 원판 두께(z). 기본 0.1 — 그룹 z = 0 이 두께 가운데 */
  thick?: number;
  /** 허브 반지름. 기본 0.14 */
  hubR?: number;
  /** 축 반지름. 기본 0.06 */
  shaftR?: number;
  /** 축 뒤끝·앞끝의 로컬 z. 기본 −0.3, thick/2 + 0.03 */
  shaftBack?: number;
  shaftFront?: number;
  /** 크랭크 핀 반지름. 기본 0.04 */
  pinR?: number;
  /** 핀 끝의 로컬 z. 기본 0.2 */
  pinTop?: number;
  /** 연결봉(줄) 평면의 로컬 z — 표식 child 'crankPin' 자리. 기본 0.15 */
  pinZ?: number;
  /** 핀 윤곽(원)을 userData.outlines.stud 로 남길지(같은 층의 부품과 부딪힘 검사용). 기본 false */
  studOutline?: boolean;
}

/**
 * 민 크랭크 원판(158·159): 회전축 = 로컬 Z, 원점 = 중심, 두께 가운데 z = 0. 축이 함께 돈다(뒤끝이 받침대 구멍을 지난다).
 * 로컬 +X 의 crankR 자리에 크랭크 핀이 +Z 로 솟는다. 핀 표식 child 이름 'crankPin'(z = pinZ).
 */
export function crankDisc158(R: number, crankR: number, o: CrankDiscOpts = {}): THREE.Group {
  const thick = o.thick ?? 0.1;
  const hubR = o.hubR ?? 0.14;
  const shaftR = o.shaftR ?? 0.06;
  const zb = o.shaftBack ?? -0.3;
  const zf = o.shaftFront ?? thick / 2 + 0.03;
  const pinR = o.pinR ?? 0.04;
  const pinTop = o.pinTop ?? 0.2;
  const pinZ = o.pinZ ?? 0.15;
  const g = new THREE.Group();
  g.add(mesh(tubeZ(shaftR, R, -thick / 2, thick / 2, 0.012, 96), brass()));
  g.add(mesh(tubeZ(shaftR, hubR, -thick / 2 - 0.02, thick / 2 + 0.015, 0.008, 48), darkSteel()));
  g.add(mesh(cylZ(shaftR, zb, zf, 0.01, 32), steel()));
  // 크랭크 핀 + 뿌리 보스
  g.add(meshAt(cylZ(pinR * 1.7, thick / 2 - 0.004, thick / 2 + 0.014, 0.004), darkSteel(), crankR, 0, 0));
  g.add(meshAt(cylZ(pinR, thick / 2 - 0.004, pinTop, 0.006), steel(), crankR, 0, 0));
  // 표시: 핀 맞은편 반지름 줄 — 회전이 보이게
  g.add(meshAt(new THREE.BoxGeometry(R * 0.3, 0.02, 0.006), paint(MARK), -R * 0.72, 0, thick / 2 + 0.002));
  const pin = new THREE.Object3D();
  pin.name = 'crankPin';
  pin.position.set(crankR, 0, pinZ);
  g.add(markPin(pin));
  if (o.studOutline === true) g.userData.outlines = { stud: circlePoly(crankR, 0, pinR) };
  setMM(g, { kind: 'crankWheel', r: R, width: thick, crankR, axis: 'z' });
  return g;
}

export interface EyeRodOpts {
  /** 원점 쪽(크랭크 핀) 눈의 바깥·구멍 반지름. 기본 0.09, 0.042 */
  eyeR0?: number;
  hole0?: number;
  /** +X 끝(발판 핀) 눈의 바깥·구멍 반지름. 기본 0.07, 0.032 */
  eyeR1?: number;
  hole1?: number;
  /** 막대 반폭. 기본 0.028 */
  half?: number;
  /** 두께(z). 기본 0.05 */
  thick?: number;
}

/** 눈 달린 연결봉: 원점 = 크랭크 핀 쪽 눈 중심, +X 로 length 떨어진 곳이 발판 핀 쪽 눈. 두께 가운데 z = 0 */
export function eyeRod158(length: number, o: EyeRodOpts = {}): THREE.Group {
  const e0 = o.eyeR0 ?? 0.09;
  const h0 = o.hole0 ?? 0.042;
  const e1 = o.eyeR1 ?? 0.07;
  const h1 = o.hole1 ?? 0.032;
  const half = o.half ?? 0.028;
  const thick = o.thick ?? 0.05;
  const g = new THREE.Group();
  g.add(meshAt(extrude(stadiumShape(e0 * 0.92, 0, length - e1 * 0.92, 0, half), thick * 0.7, 0.005), steel(), 0, 0, 0));
  g.add(mesh(tubeZ(h0, e0, -thick / 2, thick / 2, 0.006), steel()));
  g.add(meshAt(tubeZ(h1, e1, -thick / 2, thick / 2, 0.006), steel(), length, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(length * 0.3, 0.012, 0.006), paint(MARK), length * 0.5, 0, thick * 0.35 + 0.002));
  setMM(g, { kind: 'link', length, a: [0, 0, 0], b: [length, 0, 0] });
  return g;
}

export interface TreadleBarOpts {
  /** 막대가 뻗는 쪽: −1 = 로컬 −X(받침 핀이 오른쪽, 158·159), 1 = 로컬 +X(받침 핀이 왼쪽, 160). 기본 −1 */
  dir?: 1 | -1;
  /** 막대 높이(두께). 기본 0.06 */
  h?: number;
  /** 막대 깊이(z, 발판 너비). 기본 0.1 — 그룹 z = 0 이 가운데 */
  depth?: number;
  /** 받침 핀 쪽 허브의 바깥·구멍 반지름. 기본 0.08, 0.042 */
  hubR?: number;
  holeR?: number;
}

/**
 * 발판 막대: 원점 = 받침 핀 중심(구멍 축 = Z), 막대는 로컬 dir·X 로 len. 로컬 +Y 가 위.
 * userData.outline = 막대 몸통 네모(허브 밖 ~ 끝). 기울기는 모델이 rotation.z 로 준다.
 */
export function treadleBar158(len: number, o: TreadleBarOpts = {}): THREE.Group {
  const dir = o.dir ?? -1;
  const h = o.h ?? 0.06;
  const depth = o.depth ?? 0.1;
  const hubR = o.hubR ?? 0.08;
  const holeR = o.holeR ?? 0.042;
  const g = new THREE.Group();
  const x0 = dir * hubR * 0.9;
  const x1 = dir * len;
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const bar = mesh(new THREE.BoxGeometry(xb - xa, h, depth), steel({ roughness: 0.4 }));
  bar.position.set((xa + xb) / 2, 0, 0);
  g.add(bar);
  g.add(mesh(tubeZ(holeR, hubR, -depth / 2, depth / 2, 0.008), darkSteel()));
  // 표시: 앞면 가운데 줄
  g.add(meshAt(new THREE.BoxGeometry(len * 0.18, 0.012, 0.006), paint(MARK), dir * len * 0.55, 0, depth / 2 + 0.002));
  g.userData.outline = [[xa, -h / 2], [xb, -h / 2], [xb, h / 2], [xa, h / 2]] as V2[];
  setMM(g, { kind: 'lever', length: len, pivot: [0, 0, 0], tip: [x1, 0, 0] });
  return g;
}

/**
 * 받침 핀(고정): 원점 = 핀 중심, Z 방향 z0~z1. 받침 귀·발판 허브를 함께 꿴다. 양 끝 머리.
 */
export function pivotPin158(z0: number, z1: number, r = 0.04): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(r, z0, z1, 0.006), steel()));
  g.add(mesh(cylZ(r * 1.5, z1 - 0.012, z1 + 0.012, 0.004), darkSteel()));
  g.add(mesh(cylZ(r * 1.5, z0 - 0.012, z0 + 0.012, 0.004), darkSteel()));
  setMM(g, { kind: 'pin', r, z0, z1 });
  return g;
}

/**
 * 발판 밑의 봉 핀 귀(158): 원점 = 핀 중심. 귀는 원점에서 위로 drop 만큼 올라가 막대 가운데선에 닿는다(막대의 child 로 (−a, −e, 0) 에 둔다).
 * 핀은 귀에서 pinEnd(로컬 z, 앞이면 +)까지 나와 연결봉 눈을 꿴다. 표식 child 'treadlePin'(z = rodZ).
 */
export function rodLug158(drop: number, depth: number, pinEnd: number, rodZ: number, pinR = 0.03): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(extrude(stadiumShape(0, 0, 0, drop, pinR * 1.9), depth, 0.006), darkSteel()));
  const z0 = Math.min(pinEnd, -depth / 2 - 0.012);
  const z1 = Math.max(pinEnd, depth / 2 + 0.012);
  g.add(mesh(cylZ(pinR, z0, z1, 0.005), steel()));
  // 봉이 빠지지 않게 막는 끝 머리
  const zh = pinEnd >= 0 ? z1 : z0;
  g.add(mesh(cylZ(pinR * 1.5, zh - 0.006, zh + 0.006, 0.003), darkSteel()));
  const p = new THREE.Object3D();
  p.name = 'treadlePin';
  p.position.set(0, 0, rodZ);
  g.add(markPin(p));
  return g;
}

// ═══════════════════════════ 159 줄과 도르래 발판 ═══════════════════════════

/** 홈(V) 풀리에 줄(단면 반지름 rho)이 앉는 중심선 반지름 — kit/pulley.ts 의 grooved 림 치수와 autocheck 의 자리 식을 그대로 */
export function vSeat158(r: number, width: number, rho: number): number {
  const gd = r * 0.16 + 0.006;
  const gw = Math.min(width * 0.32, 0.055);
  const apex = r - gw / 2 / 0.7;
  return Math.max(r - gd + rho, apex + rho / Math.sin(Math.atan(0.7)));
}

const RHO159 = 0.014;
const RP159 = 0.33;
const WP159 = 0.12;

/** 159번 치수 — 판화 배치 그대로(원판 반지름 0.66 기준). 크랭크 반지름만 판화(0.78R)보다 줄였다 */
export const K159 = {
  floor: 0.18,
  /** 원판 축 중심 */
  O: [-1.1, 1.54] as V2,
  R: 0.66,
  /** 크랭크 반지름(판화는 0.515 — 그대로면 발판이 바닥을 뚫는다) */
  crank: 0.27,
  /** 도르래 중심·반지름·폭 */
  C: [0.08, 2.7] as V2,
  rp: RP159,
  wp: WP159,
  /** 줄 단면 반지름과 도르래 위 줄 중심선 반지름 */
  rho: RHO159,
  rc: vSeat158(RP159, WP159, RHO159),
  /** 발판 받침 핀 */
  Q: [1.37, 0.91] as V2,
  /** 받침 핀 ~ 줄 맨 곳(막대를 따라) */
  a: 1.01,
  /** 줄 끝(매듭)이 막대 가운데선에서 위로 올라간 거리 */
  up: 0.055,
  /** 막대 길이·높이 */
  bar: 2.16,
  barH: 0.06,
  /** 발판이 가장 내려갔을 때의 기울기(왼쪽 끝이 아래로, rad) */
  low: 15 * DEG,
  /** t = 1 에서 크랭크 핀의 각 — 판화는 오른쪽 아래 −31° 이지만, 줄인 크랭크로는 그 각에서 발판이 수평이라 발판 기울기가 판화에 가까운 +10° 로 */
  pose: 10 * DEG
} as const;

/** 발판 기울기 down(왼쪽 끝이 내려간 각)일 때 줄 끝(매듭) 자리 */
export function cordEnd159(down: number): V2 {
  const K = K159;
  const ux = -Math.cos(down);
  const uy = -Math.sin(down);
  // 막대 위쪽 법선 = u 를 −90° 돌린 것
  return [K.Q[0] + K.a * ux + K.up * uy, K.Q[1] + K.a * uy - K.up * ux];
}

interface Cord159 {
  len: number;
  /** 핀 쪽 가닥·발판 쪽 가닥 길이, 감긴 각(rad), 발판 쪽 접점의 각 */
  l1: number;
  l2: number;
  wrap: number;
  aOut: number;
}

/** 핀 → 도르래(위로 시계 방향) → 줄 끝의 줄 길이 */
function cord159(pin: V2, end: V2): Cord159 {
  const K = K159;
  const i = tanIn(pin, K.C, K.rc, false);
  const o = tanOut(K.C, K.rc, end, false);
  const wrap = (((i.ang - o.ang) % TAU) + TAU) % TAU;
  return { len: i.len + K.rc * wrap + o.len, l1: i.len, l2: o.len, wrap, aOut: o.ang };
}

/** 핀이 도르래에 가장 가까울 때(발판 최저)의 줄 길이 = 줄의 온 길이 */
function cordTotal159(): number {
  const K = K159;
  const dir = Math.atan2(K.C[1] - K.O[1], K.C[0] - K.O[0]);
  // 가장 짧은 핀 쪽 가닥은 핀이 O→C 방향 근처일 때 — 근처를 촘촘히 훑어 최소를 잡는다
  let best = Infinity;
  for (let k = -200; k <= 200; k++) {
    const a = dir + (k / 200) * 0.6;
    const pin: V2 = [K.O[0] + K.crank * Math.cos(a), K.O[1] + K.crank * Math.sin(a)];
    const c = cord159(pin, cordEnd159(K.low));
    best = Math.min(best, c.len);
  }
  return best;
}
let total159: number | null = null;
/** 159번 줄의 온 길이(핀 고리 중심 ~ 발판 매듭) */
export function cordLength159(): number {
  if (total159 === null) total159 = cordTotal159();
  return total159;
}

export interface Pose159 {
  /** 원판 회전각(= 핀의 각) */
  a: number;
  pin: V2;
  /** 발판 기울기: 왼쪽 끝이 받침 핀보다 내려간 각(rad, + = 아래). 막대 그룹의 rotation.z = +down */
  down: number;
  /** 줄 끝(발판 매듭) */
  end: V2;
  /** 도르래 회전각(미끄럼 없이 줄을 따라 돎) */
  pulley: number;
  /** 도르래에 감긴 각(도) */
  wrapDeg: number;
}

let ref159: { aOut: number; l2: number } | null = null;

/** 159번 풀이. theta = 구동 누적각(원판 반시계). 줄 길이가 일정하도록 발판 각을 이분법 40회로 푼다 */
export function treadle159(theta: number): Pose159 {
  const K = K159;
  const a = theta - 1.6 + K.pose;
  const pin: V2 = [K.O[0] + K.crank * Math.cos(a), K.O[1] + K.crank * Math.sin(a)];
  const L = cordLength159();
  // 줄 길이는 down 에 대해 단조 증가
  let lo = -60 * DEG;
  let hi = K.low + 1e-6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cord159(pin, cordEnd159(mid)).len < L) lo = mid;
    else hi = mid;
  }
  const down = (lo + hi) / 2;
  const end = cordEnd159(down);
  const c = cord159(pin, end);
  if (ref159 === null) {
    const e0 = cordEnd159(K.low);
    const dir = Math.atan2(K.C[1] - K.O[1], K.C[0] - K.O[0]);
    const c0 = cord159([K.O[0] + K.crank * Math.cos(dir), K.O[1] + K.crank * Math.sin(dir)], e0);
    ref159 = { aOut: c0.aOut, l2: c0.l2 };
  }
  // 줄 위의 한 점이 도르래에 붙어 돈다: psi = (aOut − aOut0) − (l2 − l20)/rc
  const pulley = wrapPi(c.aOut - ref159.aOut) - (c.l2 - ref159.l2) / K.rc;
  return { a, pin, down, end, pulley, wrapDeg: c.wrap / DEG };
}

/**
 * 줄 매는 고리(159): 원점 = 막대 가운데선 위의 점(막대 child 로 (−a, 0, 0) 에). 막대를 꿰는 고리 볼트 — 위에 매듭 자리, 아래에 고리.
 * 표식 child 'cordEye'(anchor) = 막대 윗면 위 up 높이(줄 끝이 붙는 매듭 중심).
 */
export function cordEye158(barH: number, up: number): THREE.Group {
  const g = new THREE.Group();
  const ringR = 0.04;
  // 볼트 자루(막대를 꿰어 아래 고리까지)
  const shank = mesh(new THREE.CylinderGeometry(0.014, 0.014, up + barH / 2 + 0.012, 16), darkSteel());
  shank.position.y = (up - barH / 2 - 0.012) / 2;
  g.add(shank);
  g.add(meshAt(new THREE.TorusGeometry(ringR, 0.013, 12, 28), darkSteel(), 0, -barH / 2 - ringR - 0.008, 0));
  const knotMat = rubber().clone();
  knotMat.color.set(0x6f5230);
  g.add(meshAt(new THREE.SphereGeometry(0.03, 16, 12), knotMat, 0, up, 0));
  const eye = new THREE.Object3D();
  eye.name = 'cordEye';
  eye.position.set(0, up, 0);
  g.add(markAnchor(eye));
  return g;
}

/** 핀에 거는 줄 고리(159): 원점 = 핀 중심. 줄 끝이 핀을 감아 맨 눈 — 핀 둘레를 자유롭게 돈다. 표식 child 'cordLoop'(anchor) */
export function cordLoop158(pinR = 0.04): THREE.Group {
  const g = new THREE.Group();
  const mat = rubber().clone();
  mat.color.set(0x6f5230);
  g.add(mesh(new THREE.TorusGeometry(pinR + 0.016, 0.016, 12, 28), mat));
  const p = new THREE.Object3D();
  p.name = 'cordLoop';
  g.add(markAnchor(p));
  return g;
}

// ═══════════════════════════ 160 스프링 발판과 띠 ═══════════════════════════

const R160 = 0.345;
const RHO160 = 0.016;

/** 160번 치수 — 판화 비 그대로(도르래 반지름 0.345 기준) */
export const K160 = {
  floor: 0.18,
  /** 발판 받침 핀(왼쪽) */
  Q: [-0.66, 0.56] as V2,
  /** 받침 핀 ~ 띠 고리쇠(막대를 따라) */
  a: 1.65,
  /** 띠 끝이 막대 가운데선에서 위로 올라간 거리(고리쇠 꼭대기) */
  up: 0.085,
  /** 막대 길이·높이 */
  bar: 2.36,
  barH: 0.055,
  /** 도르래(납작 림 북) 중심·반지름·폭 */
  C: [0.63, 1.84] as V2,
  r: R160,
  w: 0.16,
  /** 띠(둥근 줄) 단면 반지름, 북 위 띠 중심선 반지름 */
  rho: RHO160,
  rc: R160 + RHO160 + 0.002,
  /** 한 바퀴 감는 동안 축 방향으로 옮겨 가는 거리(위 가닥이 앞, 아래 가닥이 뒤) */
  pitch: 0.06,
  /** 장대 스프링(쉴 때): 원호의 중심·반지름, 왼쪽 끝·오른쪽 끝의 각(도) */
  sc: [0.26, 0.075] as V2,
  sR: 2.935,
  sA0: 130.5,
  sA1: 66.6,
  /** 물림쇠에 잡혀 휘지 않는 길이(왼쪽 끝에서) */
  grip: 0.3,
  /** 띠를 맨 곳(왼쪽 끝에서 잰 호 길이) */
  tie: 2.816,
  /** 장대 높이(두께)·깊이(z) */
  sH: 0.13,
  sD: 0.12,
  /** 발판 기울기(오른쪽 끝이 받침 핀보다 올라간 각, 도): 가운데·진폭. 위 12° ~ 아래 −6° */
  mid: 3,
  amp: 9,
  /** t = 1(theta 1.6)에서 판화 자세(10° 올라감, 밟아 내려가는 중)가 되게 하는 위상 */
  phase: 1.6 - Math.acos(7 / 9)
} as const;

const NS160 = 48;

/** 장대 스프링 가운데선(왼쪽 끝 → 오른쪽 끝, NS160 + 1 점)과 각 점의 접선 각. kappa = 휨(끝 하중 외팔보의 곡률 계수, 0 = 쉼) */
export function springCurve160(kappa: number): { pts: V2[]; ang: number[]; len: number } {
  const K = K160;
  const len = K.sR * (K.sA0 - K.sA1) * DEG;
  const a0 = K.sA0 * DEG;
  const start: V2 = [K.sc[0] + K.sR * Math.cos(a0), K.sc[1] + K.sR * Math.sin(a0)];
  // 쉴 때 접선 각: 원호를 시계 방향으로 따라감 → a0 − 90° 에서 s/R 씩 줄어듦
  const psi = (s: number): number => {
    const sb = Math.min(Math.max(s - K.grip, 0), K.tie - K.grip);
    const lt = K.tie - K.grip;
    // 끝 하중 외팔보: 곡률 ∝ (lt − sb) → 접선 각 변화 = kappa·(lt·sb − sb²/2)
    return a0 - Math.PI / 2 - s / K.sR - kappa * (lt * sb - (sb * sb) / 2);
  };
  const pts: V2[] = [start];
  const ang: number[] = [psi(0)];
  const ds = len / NS160;
  let x = start[0];
  let y = start[1];
  for (let i = 0; i < NS160; i++) {
    // 구간마다 8 등분 중점 적분
    for (let j = 0; j < 8; j++) {
      const s = (i + (j + 0.5) / 8) * ds;
      const p = psi(s);
      x += (Math.cos(p) * ds) / 8;
      y += (Math.sin(p) * ds) / 8;
    }
    pts.push([x, y]);
    ang.push(psi((i + 1) * ds));
  }
  return { pts, ang, len };
}

/** 띠를 맨 자리: 가운데선 위 점 S, 그 아랫면의 점 under(띠 끝이 붙는 곳), 접선 각 */
export function springTie160(kappa: number): { S: V2; under: V2; ang: number } {
  const K = K160;
  const cv = springCurve160(kappa);
  const f = (K.tie / cv.len) * NS160;
  const i = Math.min(NS160 - 1, Math.floor(f));
  const t = f - i;
  const p0 = cv.pts[i]!;
  const p1 = cv.pts[i + 1]!;
  const S: V2 = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
  const ang = cv.ang[i]! + (cv.ang[i + 1]! - cv.ang[i]!) * t;
  // 아랫면 = 접선을 −90° 돌린 쪽으로 sH/2
  const under: V2 = [S[0] + (Math.sin(ang) * K.sH) / 2, S[1] - (Math.cos(ang) * K.sH) / 2];
  return { S, under, ang };
}

/** 발판 기울기 up(오른쪽 끝이 올라간 각, rad)일 때 띠 아래 끝(고리쇠 꼭대기) */
export function bandEnd160(up: number): V2 {
  const K = K160;
  return [K.Q[0] + K.a * Math.cos(up) - K.up * Math.sin(up), K.Q[1] + K.a * Math.sin(up) + K.up * Math.cos(up)];
}

export interface Band160 {
  /** 위 가닥·아래 가닥 길이, 감긴 각(rad, 2π 안팎), 위 접점·아래 접점의 각, 온 길이 */
  l1: number;
  l2: number;
  wrap: number;
  aIn: number;
  aOut: number;
  len: number;
}

/** 스프링 맨 곳 S → 북(오른쪽으로 내려와 시계 방향 한 바퀴) → 발판 고리쇠 A */
export function band160(S: V2, A: V2): Band160 {
  const K = K160;
  const i = tanIn(S, K.C, K.rc, false);
  const o = tanOut(K.C, K.rc, A, false);
  const d = wrapPi(i.ang - o.ang);
  const wrap = TAU + d;
  return { l1: i.len, l2: o.len, wrap, aIn: i.ang, aOut: o.ang, len: i.len + K.rc * wrap + o.len };
}

let total160: { len: number; aIn: number; l1: number } | null = null;
function ref160(): { len: number; aIn: number; l1: number } {
  if (total160 === null) {
    const K = K160;
    const b = band160(springTie160(0).under, bandEnd160((K.mid + K.amp) * DEG));
    total160 = { len: b.len, aIn: b.aIn, l1: b.l1 };
  }
  return total160;
}
/** 160번 띠의 온 길이(스프링이 쉬고 발판이 가장 올라갔을 때로 정함) */
export function bandLength160(): number {
  return ref160().len;
}

export interface Pose160 {
  /** 발판 기울기(오른쪽 끝이 올라간 각, rad). 막대 그룹의 rotation.z = up */
  up: number;
  /** 띠 아래 끝(고리쇠) */
  A: V2;
  /** 스프링 휨 계수와 띠 위 끝(스프링 아랫면) */
  kappa: number;
  S: V2;
  /** 북(도르래) 회전각 — 밟으면 시계 방향(−) */
  drum: number;
  /** 감긴 각(도) */
  wrapDeg: number;
  /** 스프링 끝이 쉴 때보다 내려간 높이 */
  drop: number;
}

/** 160번 풀이. theta = 구동 누적각(발판의 위상). 띠 길이가 일정하도록 스프링 휨을 이분법 40회로 푼다 */
export function treadle160(theta: number): Pose160 {
  const K = K160;
  const up = (K.mid + K.amp * Math.cos(theta - K.phase)) * DEG;
  const A = bandEnd160(up);
  const R0 = ref160();
  // 띠 길이는 kappa 에 대해 단조 감소
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (band160(springTie160(mid).under, A).len > R0.len) lo = mid;
    else hi = mid;
  }
  const kappa = (lo + hi) / 2;
  const t = springTie160(kappa);
  const b = band160(t.under, A);
  // 띠 위의 한 점이 북에 붙어 돈다: psi = (aIn − aIn0) + (l1 − l10)/rc
  const drum = wrapPi(b.aIn - R0.aIn) + (b.l1 - R0.l1) / K.rc;
  return { up, A, kappa, S: t.under, drum, wrapDeg: b.wrap / DEG, drop: springTie160(0).under[1] - t.under[1] };
}

/**
 * 띠 경로(160): S → 위 접점 → 시계 방향으로 한 바퀴(축 방향으로 zS → zA 로 옮겨 가는 나선) → 아래 접점 → A.
 * 점 개수 일정(seg + 3). 호 점에는 검사 표식(tagArc)을 단다.
 */
export function bandPath160(S: V2, A: V2, zS: number, zA: number, seg = 72): THREE.Vector3[] {
  const K = K160;
  const b = band160(S, A);
  const out: THREE.Vector3[] = [new THREE.Vector3(S[0], S[1], zS)];
  const arc: THREE.Vector3[] = [];
  for (let k = 0; k <= seg; k++) {
    const ang = b.aIn - (b.wrap * k) / seg;
    arc.push(new THREE.Vector3(K.C[0] + K.rc * Math.cos(ang), K.C[1] + K.rc * Math.sin(ang), zS + ((zA - zS) * k) / seg));
  }
  tagArc(arc, { c: [K.C[0], K.C[1], (zS + zA) / 2], r: K.rc, ccw: false, src: 'bandPath160' });
  out.push(...arc, new THREE.Vector3(A[0], A[1], zA));
  return out;
}

/**
 * 장대 스프링(160): 휘는 나무 장대. 그룹은 전시대 좌표 그대로(원점 = 전시대 원점), 가운데 평면 z = zc.
 * setBend(kappa) 가 형상·윤곽(userData.outline)·맨 곳 표식(child 'springTie', anchor)을 다시 놓는다.
 */
export class PoleSpring160 {
  readonly group = new THREE.Group();
  private readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly lash: THREE.Mesh;
  private readonly tie = new THREE.Object3D();
  private readonly zc: number;

  constructor(zc: number) {
    this.zc = zc;
    // 구간마다 네 옆면(사각 2개씩) + 양 끝 마구리
    this.pos = new Float32Array((NS160 * 4 * 6 + 12) * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const body = mesh(this.geo, wood(0x8a5a2b));
    body.frustumCulled = false;
    this.group.add(body);
    const lashMat = rubber().clone();
    lashMat.color.set(0x6f5230);
    this.lash = mesh(new THREE.BoxGeometry(0.07, K160.sH + 0.024, K160.sD + 0.024), lashMat);
    this.group.add(this.lash);
    this.tie.name = 'springTie';
    this.group.add(markAnchor(this.tie));
    this.group.userData.outline = [] as V2[];
    setMM(this.group, { kind: 'spring', style: 'pole' });
    this.setBend(0);
  }

  setBend(kappa: number): void {
    const K = K160;
    const cv = springCurve160(kappa);
    const hh = K.sH / 2;
    const z0 = this.zc - K.sD / 2;
    const z1 = this.zc + K.sD / 2;
    const top: V2[] = [];
    const bot: V2[] = [];
    for (let i = 0; i <= NS160; i++) {
      const p = cv.pts[i]!;
      const a = cv.ang[i]!;
      top.push([p[0] - Math.sin(a) * hh, p[1] + Math.cos(a) * hh]);
      bot.push([p[0] + Math.sin(a) * hh, p[1] - Math.cos(a) * hh]);
    }
    let n = 0;
    const P = this.pos;
    const put = (x: number, y: number, z: number): void => {
      P[n++] = x;
      P[n++] = y;
      P[n++] = z;
    };
    const quad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): void => {
      put(...a);
      put(...b);
      put(...c);
      put(...a);
      put(...c);
      put(...d);
    };
    for (let i = 0; i < NS160; i++) {
      const t0 = top[i]!;
      const t1 = top[i + 1]!;
      const b0 = bot[i]!;
      const b1 = bot[i + 1]!;
      quad([b0[0], b0[1], z1], [b1[0], b1[1], z1], [t1[0], t1[1], z1], [t0[0], t0[1], z1]); // 앞
      quad([b1[0], b1[1], z0], [b0[0], b0[1], z0], [t0[0], t0[1], z0], [t1[0], t1[1], z0]); // 뒤
      quad([t0[0], t0[1], z1], [t1[0], t1[1], z1], [t1[0], t1[1], z0], [t0[0], t0[1], z0]); // 위
      quad([b1[0], b1[1], z1], [b0[0], b0[1], z1], [b0[0], b0[1], z0], [b1[0], b1[1], z0]); // 아래
    }
    const tA = top[0]!;
    const bA = bot[0]!;
    const tB = top[NS160]!;
    const bB = bot[NS160]!;
    quad([bA[0], bA[1], z0], [bA[0], bA[1], z1], [tA[0], tA[1], z1], [tA[0], tA[1], z0]);
    quad([bB[0], bB[1], z1], [bB[0], bB[1], z0], [tB[0], tB[1], z0], [tB[0], tB[1], z1]);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.geo.computeBoundingBox();
    const t = springTie160(kappa);
    this.lash.position.set(t.S[0], t.S[1], this.zc);
    this.lash.rotation.z = t.ang;
    this.tie.position.set(t.under[0], t.under[1], this.zc);
    const ol = this.group.userData.outline as V2[];
    ol.length = 0;
    for (const p of top) ol.push(p);
    for (let i = NS160; i >= 0; i--) ol.push(bot[i]!);
  }
}

/**
 * 스프링 물림쇠(160, 판화에 없음): 장대의 왼쪽 끝 grip 길이를 감싸 쥐고 뒤판까지 뻗은 받침. 그룹은 전시대 좌표 그대로.
 * zc = 장대 가운데 평면, backZ = 뒤판 앞면.
 */
export function springClamp160(zc: number, backZ = -0.3): THREE.Group {
  const K = K160;
  const cv = springCurve160(0);
  const p0 = cv.pts[0]!;
  const a = cv.ang[0]!;
  const g = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(p0[0] + (Math.cos(a) * K.grip) / 2, p0[1] + (Math.sin(a) * K.grip) / 2, 0);
  holder.rotation.z = a;
  // 위·아래 물림 판 + 뒤 벽(장대를 세 면에서 감싼다)
  const L = K.grip + 0.04;
  const plateT = 0.035;
  for (const sy of [-1, 1]) {
    const pl = mesh(new THREE.BoxGeometry(L, plateT, zc + K.sD / 2 - backZ), castIron());
    pl.position.set(0, sy * (K.sH / 2 + plateT / 2), (zc + K.sD / 2 + backZ) / 2);
    holder.add(pl);
  }
  const wall = mesh(new THREE.BoxGeometry(L, K.sH + 2 * plateT, zc - K.sD / 2 - backZ), castIron());
  wall.position.set(0, 0, (zc - K.sD / 2 + backZ) / 2);
  holder.add(wall);
  // 조임 볼트 머리 둘
  for (const sx of [-1, 1]) {
    const bolt = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), darkSteel());
    bolt.position.set(sx * L * 0.28, K.sH / 2 + plateT + 0.01, zc);
    holder.add(bolt);
  }
  g.add(holder);
  setMM(g, { kind: 'clamp' });
  return g;
}

/**
 * 띠 고리쇠(160): 원점 = 막대 가운데선 위의 점(막대 child 로 (a, 0, z) 에). 막대 윗면에 선 반고리(아치)와 꼭대기의 매듭.
 * 표식 child 'bandEye'(anchor) = 가운데선 위 up 높이(띠 아래 끝).
 */
export function bandStaple158(barH: number, up: number): THREE.Group {
  const g = new THREE.Group();
  const r = Math.max(0.03, up - barH / 2);
  const arch = mesh(new THREE.TorusGeometry(r, 0.012, 12, 28, Math.PI), darkSteel());
  arch.position.y = barH / 2 - 0.004;
  g.add(arch);
  const knotMat = rubber().clone();
  knotMat.color.set(0x6f5230);
  g.add(meshAt(new THREE.SphereGeometry(0.026, 16, 12), knotMat, 0, up, 0));
  const eye = new THREE.Object3D();
  eye.name = 'bandEye';
  eye.position.set(0, up, 0);
  g.add(markAnchor(eye));
  return g;
}
