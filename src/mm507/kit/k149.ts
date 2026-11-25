// 149·150·151번 전용 키트 — 캠과 지레, 나사 묶음
//  149 캠 두 개가 지레 두 개를 번갈아 올린다: 달걀 꼴 캠, 굴림 바퀴 달린 지레, 매달린 막대
//  150 팽창 조절 밸브 장치: 양정이 다른 캠 묶음(축 방향으로 미끄러짐), 지레, 밸브 막대
//  151 웜과 좌우 나사: 한 축의 오른나사·왼나사(여러 줄), 미끄럼 너트, 너트 안내 레일
// 치수 상수(K149·K150·K151)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s149.mjs)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

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

/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 32): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function marker(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  markPin(o);
  return o;
}

// ═══════════════════════════ 공용: 혹 하나짜리 캠과 굴림 바퀴 지레 ═══════════════════════════

/**
 * 혹(lobe) 하나짜리 캠의 반지름. phi = 혹 꼭대기 방향에서 잰 각(rad).
 * |phi| < halfW 에서 rb + lift·cos²(π·phi / 2·halfW), 그 밖은 바탕 원 rb. 꼭대기 반지름 = rb + lift.
 */
export function lobeRadius(phi: number, rb: number, lift: number, halfW: number): number {
  const p = Math.atan2(Math.sin(phi), Math.cos(phi));
  if (Math.abs(p) >= halfW) return rb;
  const c = Math.cos((Math.PI * p) / (2 * halfW));
  return rb + lift * c * c;
}

/** 캠 윤곽(로컬, 혹 꼭대기 = +X, 반시계 n 점) */
export function lobeOutline(rb: number, lift: number, halfW: number, n = 240): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = lobeRadius(a, rb, lift, halfW);
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

export interface FollowerSpec {
  /** 캠 축 */
  S: V2;
  /** 지레 받침점 */
  P: V2;
  /** 받침점 ~ 굴림 바퀴 중심 */
  L: number;
  /** 굴림 바퀴 반지름 */
  rr: number;
  rb: number;
  lift: number;
  halfW: number;
  /** 바퀴가 캠 속에 묻히는 지레 각(rad) — 이분법의 안쪽 끝 */
  inAngle: number;
  /** 바퀴가 캠에서 완전히 떨어진 지레 각(rad) — 이분법의 바깥쪽 끝 */
  outAngle: number;
}

/** 지레 각 alpha 에서 굴림 바퀴와 캠(혹 방향 nose) 사이의 틈. 음수 = 파고듦 */
export function followerGap(s: FollowerSpec, nose: number, alpha: number): number {
  const cx = s.P[0] + s.L * Math.cos(alpha) - s.S[0];
  const cy = s.P[1] + s.L * Math.sin(alpha) - s.S[1];
  const d = Math.hypot(cx, cy);
  const psi = Math.atan2(cy, cx);
  if (d < lobeRadius(psi - nose, s.rb, s.lift, s.halfW)) return -s.rr;
  let best = Infinity;
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const a = psi - 1.1 + (2.2 * i) / N;
    const r = lobeRadius(a - nose, s.rb, s.lift, s.halfW);
    const q = Math.hypot(cx - r * Math.cos(a), cy - r * Math.sin(a));
    if (q < best) best = q;
  }
  return best - s.rr;
}

/** 혹 방향 nose 일 때 굴림 바퀴가 캠에 꼭 닿는 지레 각(이분법 44회 — 오차 1e-9 rad 아래) */
export function followerAngle(s: FollowerSpec, nose: number): number {
  let lo = s.inAngle;
  let hi = s.outAngle;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (followerGap(s, nose, mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 한 바퀴 주기 표(n 칸, 선형 보간)를 만들어 nose → 지레 각 함수를 돌려준다. 표는 처음 부를 때 한 번 계산 */
export function followerTable(s: FollowerSpec, n = 720): (nose: number) => number {
  let tab: Float64Array | null = null;
  return (nose: number): number => {
    if (tab === null) {
      tab = new Float64Array(n);
      for (let i = 0; i < n; i++) tab[i] = followerAngle(s, (i / n) * TAU);
    }
    const u = ((((nose / TAU) % 1) + 1) % 1) * n;
    const i0 = Math.floor(u) % n;
    const f = u - Math.floor(u);
    const a = tab[i0] ?? 0;
    const b = tab[(i0 + 1) % n] ?? 0;
    return a + (b - a) * f;
  };
}

export interface LobeCamOpts {
  /** 두께(기본 0.1) */
  thick?: number;
  /** 축 구멍 반지름(기본 0.1) */
  bore?: number;
  /** 구동 쪽이면 청동, 아니면 주철 */
  driver?: boolean;
  /** false 면 userData.outline 을 남기지 않는다(150번 묶음 캠 — 층이 붙어 있어 묶음이 따로 남긴다) */
  outline?: boolean;
}

/**
 * 혹 하나짜리 판 캠. **원점 = 축**, 혹 꼭대기 = 로컬 +X, 회전축 = 로컬 Z, 두께 가운데 z = 0.
 * userData.outline = lobeOutline(…). 꼭대기 쪽 앞면에 노란 표시점. 모델이 rotation.z = 혹 방향각.
 */
export function lobeCam(rb: number, lift: number, halfW: number, o: LobeCamOpts = {}): THREE.Group {
  const thick = o.thick ?? 0.1;
  const bore = o.bore ?? 0.1;
  const g = new THREE.Group();
  const outline = lobeOutline(rb, lift, halfW);
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, thick, 0.008, 48), o.driver === false ? castIron() : bronze({ roughness: 0.36 })));
  g.add(meshAt(cylZ(0.022, 0, 0.008, 0.002, 16), paint(MARK), rb + lift - 0.07, 0, thick / 2));
  if (o.outline !== false) g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'lobe', rb, lift, halfW, width: thick, axis: 'z' });
  return g;
}

export interface RollerLeverOpts {
  /** 받침점에서 막대 핀까지(기본 L·0.62) */
  pinAt?: number;
  /** 굴림 바퀴 반지름·폭 */
  rollerR?: number;
  rollerW?: number;
  /** 지레 판 가운데(z = 0)에서 굴림 바퀴 가운데까지의 z(±). 기본 0 */
  rollerDz?: number;
  /** 지레 판 가운데에서 막대 눈 가운데까지의 z(±). 기본 0.07 */
  pinDz?: number;
  /** 지레 판 두께(기본 0.06) */
  thick?: number;
  /** 받침 보스 반지름(기본 0.14), 받침 구멍 반지름(기본 0.052) */
  bossR?: number;
  bore?: number;
}

/**
 * 굴림 바퀴 달린 지레. **원점 = 받침점**, 막대는 로컬 +X 로 L, 회전축 = 로컬 Z, 판 가운데 z = 0.
 * 끝(L, 0)에 굴림 바퀴(child Group 'roller' — 제자리에서 도는 것은 rotation.z, userData.outline = 원 48점),
 * 가운데(pinAt, 0)에 막대 핀. child 표식 'rodPin'(막대 눈이 걸리는 자리), 'rollerAxis'(바퀴 중심).
 * 모델이 rotation.z = 지레 각.
 */
export function rollerLever(L: number, o: RollerLeverOpts = {}): THREE.Group {
  const pinAt = o.pinAt ?? L * 0.62;
  const rr = o.rollerR ?? 0.15;
  const rw = o.rollerW ?? 0.08;
  const dz = o.rollerDz ?? 0;
  const pz = o.pinDz ?? 0.07;
  const t = o.thick ?? 0.06;
  const bossR = o.bossR ?? 0.14;
  const bore = o.bore ?? 0.052;
  const g = new THREE.Group();
  // 막대(스타디움) + 받침 보스(고리) + 가운데 보스 + 끝 눈
  const bar = stadiumShape(bossR * 0.7, 0, L, 0, 0.05);
  g.add(mesh(extrude(bar, t, 0.006), steel()));
  g.add(mesh(tubeZ(bore, bossR, -t / 2 - 0.012, t / 2 + 0.012, 0.008), darkSteel()));
  g.add(meshAt(cylZ(0.085, -t / 2 - 0.008, t / 2 + 0.008, 0.006), steel(), pinAt, 0, 0));
  g.add(meshAt(cylZ(0.07, -t / 2 - 0.008, t / 2 + 0.008, 0.006), steel(), L, 0, 0));
  // 굴림 바퀴 굴대(지레 판에서 바퀴 바깥 면까지)
  // 바퀴 바깥쪽으로는 0.003 만 나온다(150번: 바로 옆 층의 캠과 0.009 떨어져 있다)
  const zA = Math.min(-t / 2 - 0.012, dz - rw / 2 - 0.003);
  const zB = Math.max(t / 2 + 0.012, dz + rw / 2 + 0.003);
  g.add(meshAt(cylZ(0.03, zA, zB, 0.004, 20), darkSteel(), L, 0, 0));
  // 굴림 바퀴
  const roller = new THREE.Group();
  roller.name = 'roller';
  roller.position.set(L, 0, dz);
  roller.add(mesh(tubeZ(0.031, rr, -rw / 2, rw / 2, 0.008), brass()));
  roller.add(mesh(tubeZ(rr * 0.5, rr * 0.58, rw / 2 - 0.002, rw / 2 + 0.006, 0.002), darkSteel()));
  roller.add(meshAt(new THREE.BoxGeometry(rr * 0.24, 0.018, 0.008), paint(MARK), rr * 0.78, 0, rw / 2 + 0.004));
  roller.userData.outline = circlePts(rr, 48);
  setMM(roller, { kind: 'roller', r: rr, width: rw, axis: 'z' });
  g.add(roller);
  // 막대 핀(지레 판에서 막대 눈 바깥까지)
  const s = pz >= 0 ? 1 : -1;
  const p0 = Math.min(-t / 2, pz - s * 0.035, pz + s * 0.035);
  const p1 = Math.max(t / 2, pz - s * 0.035, pz + s * 0.035);
  g.add(meshAt(cylZ(0.026, p0 - 0.008, p1 + 0.008, 0.004, 20), darkSteel(), pinAt, 0, 0));
  g.add(marker('rodPin', pinAt, 0, pz));
  g.add(marker('rollerAxis', L, 0, dz));
  setMM(g, { kind: 'lever', length: L, pivot: [0, 0, 0], tip: [L, 0, 0], width: t });
  return g;
}

/**
 * 매달린 막대(밸브 막대): **원점 = 위쪽 눈(핀 구멍) 중심**, 막대는 로컬 −Y 로 len. 눈 고리의 구멍은 로컬 Z(핀 방향).
 * child 표식 'rodEnd'(아래 끝). 모델이 position = 지레의 rodPin 세계 좌표, rotation.z = rodAim(핀, 안내 구멍).
 */
export function hangRod(len: number, r = 0.028): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(tubeZ(0.027, 0.062, -0.03, 0.03, 0.006), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.075, 0.07, 0.05), darkSteel(), 0, -0.085, 0));
  const body = lathe(rodProfile(r, -len, -0.11, 0.006, 0.006), 24);
  g.add(mesh(body, steel()));
  g.add(marker('rodEnd', 0, -len, 0));
  setMM(g, { kind: 'rod', r, a: [0, 0, 0], b: [0, -len, 0], length: len });
  return g;
}

/** 막대의 로컬 −Y 가 pin → guide 를 향하게 하는 rotation.z */
export function rodAim(pin: V2, guide: V2): number {
  return Math.atan2(guide[0] - pin[0], -(guide[1] - pin[1]));
}

// ═══════════════════════════ 149 캠 두 개와 지레 두 개 ═══════════════════════════

/** 149번 치수(판화 4배 확대 px ÷ 520). 세계 좌표 */
export const K149 = {
  /** 두 지레의 공통 받침점 */
  P: [-1.5, 1.95] as V2,
  /** 캠 축 */
  C: [0.9, 1.55] as V2,
  /** 받침점 ~ 굴림 바퀴 중심(두 지레 같음) */
  L: 2.52,
  /** 굴림 바퀴 반지름 */
  rr: 0.15,
  /** 달걀 꼴 캠: 바탕 원·양정·혹 반각 */
  rb: 0.26,
  lift: 0.46,
  halfW: 120 * DEG,
  /** t = 1(판화 자세)의 혹 방향: 앞 캠 200°(왼쪽 살짝 아래), 뒤 캠 85°(위) */
  noseFront: 200 * DEG,
  noseBack: 85 * DEG,
  /** 받침점 ~ 막대 핀: 뒤 지레(판화의 위 지레), 앞 지레(판화의 아래 지레) */
  pinBack: 1.44,
  pinFront: 1.66,
  /** 층(z): 뒤 지레 판, 뒤 캠·뒤 바퀴, 앞 캠·앞 바퀴, 앞 지레 판 */
  zBarBack: -0.12,
  zCamBack: 0,
  zCamFront: 0.36,
  zBarFront: 0.48,
  camT: 0.1,
  shaftR: 0.1,
  /** 막대 길이(뒤, 앞)와 안내 구멍 자리 */
  rodBack: 1.15,
  rodFront: 1.45,
  guideBack: [-0.06, 1.35] as V2,
  guideFront: [0.16, 0.95] as V2
} as const;

const spec149: FollowerSpec = {
  S: K149.C,
  P: K149.P,
  L: K149.L,
  rr: K149.rr,
  rb: K149.rb,
  lift: K149.lift,
  halfW: K149.halfW,
  inAngle: Math.atan2(K149.C[1] - K149.P[1], K149.C[0] - K149.P[0]),
  outAngle: Math.atan2(K149.C[1] - K149.P[1], K149.C[0] - K149.P[0]) + 0.7
};
const table149 = followerTable(spec149);

/** 149번: 혹 방향 nose(rad) 일 때 그 캠에 얹힌 지레의 각(받침점에서 바퀴 중심을 보는 방향, rad) */
export function leverAngle149(nose: number): number {
  return table149(nose);
}

export interface CamLevers149 {
  /** 캠 축이 판화 자세에서 돈 각(반시계 +) */
  a: number;
  /** 앞 캠·뒤 캠의 혹 방향 = 그 캠 그룹의 rotation.z */
  noseFront: number;
  noseBack: number;
  /** 앞 지레·뒤 지레의 rotation.z */
  alphaFront: number;
  alphaBack: number;
}

/** 149번 운동식. theta = 구동 누적각(캠 축 반시계). theta = 1.6(t = 1)이 판화 자세 */
export function camLevers149(theta: number): CamLevers149 {
  const a = theta - 1.6;
  const noseFront = K149.noseFront + a;
  const noseBack = K149.noseBack + a;
  return { a, noseFront, noseBack, alphaFront: table149(noseFront), alphaBack: table149(noseBack) };
}

/** 지레 각 alpha 일 때 받침점에서 d 만큼 떨어진 지레 위 점(세계 XY) */
export function leverPoint(P: V2, alpha: number, d: number): V2 {
  return [P[0] + d * Math.cos(alpha), P[1] + d * Math.sin(alpha)];
}

// ═══════════════════════════ 150 양정이 다른 캠 묶음 ═══════════════════════════

/** 150번 치수(판화 4배 확대 px ÷ 520). 세계 좌표 */
export const K150 = {
  /** 캠 축 */
  S: [-0.55, 1.6] as V2,
  /** 지레 받침점(오른쪽 큰 고리) */
  Q: [1.094, 1.773] as V2,
  /** 받침점 ~ 굴림 바퀴 중심, 받침점 ~ 밸브 막대 핀 */
  L: 1.446,
  pinAt: 0.866,
  rr: 0.12,
  /** 세 캠이 함께 쓰는 바탕 원, 혹 반각 */
  rb: 0.45,
  halfW: 60 * DEG,
  /** 양정: [작은 캠(맨 앞), 가운데, 큰 캠(맨 뒤)] */
  lifts: [0.065, 0.165, 0.265] as readonly number[],
  /** 캠 한 장의 폭(= 축 방향 한 칸) */
  camW: 0.11,
  /** 굴림 바퀴가 있는 평면, 지레 판의 평면 */
  zRoller: 0.085,
  zBar: 0.5,
  shaftR: 0.13,
  /** 캠 순서(한 바퀴에 하나씩): 큰 → 가운데 → 작은 → 가운데 → … (4바퀴 주기) */
  seq: [2, 1, 0, 1] as readonly number[],
  /** 묶음을 옮기는 창: 혹이 이 방향을 지날 때(굴림 바퀴의 반대쪽) 앞뒤 ±shiftHalf */
  shiftAt: 245 * DEG,
  shiftHalf: 45 * DEG,
  /** 밸브 막대 길이, 안내 구멍 자리 */
  rod: 1.0,
  guide: [0.26, 1.3] as V2
} as const;

function spec150(k: number): FollowerSpec {
  const dir = Math.atan2(K150.S[1] - K150.Q[1], K150.S[0] - K150.Q[0]);
  return {
    S: K150.S,
    P: K150.Q,
    L: K150.L,
    rr: K150.rr,
    rb: K150.rb,
    lift: K150.lifts[k] ?? 0,
    halfW: K150.halfW,
    // 받침점에서 본 축 방향(≈186°)보다 바퀴가 위(각이 작은 쪽)로 떨어진다
    inAngle: dir - 0.02,
    outAngle: dir - 0.75
  };
}
const tables150 = [followerTable(spec150(0)), followerTable(spec150(1)), followerTable(spec150(2))];

/** 150번: k 번 캠(0 작은 · 1 가운데 · 2 큰)의 혹 방향이 nose 일 때 지레 각(받침점에서 바퀴 중심을 보는 방향, rad) */
export function leverAngle150(k: number, nose: number): number {
  const f = tables150[Math.max(0, Math.min(2, Math.round(k)))];
  return f === undefined ? 0 : f(nose);
}

export interface Valve150 {
  /** 캠의 혹 방향 = 캠 묶음의 rotation.z (t = 1 에 0 = 판화처럼 오른쪽) */
  a: number;
  /** 굴림 바퀴 밑에 있는 캠의 자리(0 작은 ~ 2 큰, 옮기는 동안은 소수) */
  kPos: number;
  /** 지금 닿는 캠 번호(0·1·2) */
  k: number;
  /** 캠 묶음의 position.z */
  z: number;
  /** 지레의 rotation.z */
  alpha: number;
  /** 굴림 바퀴가 바탕 원 자리에서 올라간 높이(바퀴 중심 ~ 축 거리 − (rb + rr)) */
  rise: number;
}

/** 150번 운동식. theta = 구동 누적각(캠 축 반시계). 4바퀴(theta 8π)가 한 주기 */
export function valve150(theta: number): Valve150 {
  const a = theta - 1.6;
  const u = (a - K150.shiftAt) / TAU;
  const j = Math.round(u);
  const w = K150.shiftHalf / TAU;
  const x = Math.max(0, Math.min(1, (u - j + w) / (2 * w)));
  const s = x * x * (3 - 2 * x);
  const m = (i: number): number => K150.seq[((i % 4) + 4) % 4] ?? 0;
  const kPos = m(j) + (m(j + 1) - m(j)) * s;
  const k = Math.round(kPos);
  const alpha = leverAngle150(k, a);
  const c = leverPoint(K150.Q, alpha, K150.L);
  const rise = Math.hypot(c[0] - K150.S[0], c[1] - K150.S[1]) - (K150.rb + K150.rr);
  return { a, kPos, k, z: K150.zRoller + kPos * K150.camW, alpha, rise };
}

export interface CamStack150 {
  group: THREE.Group;
  /** 굴림 바퀴 밑의 캠 번호를 알린다 — 침범 검사용 윤곽(child 'camContact' 의 userData.outline)을 그 캠의 것으로 바꿔 쓴다 */
  setActive(k: number): void;
}

/**
 * 150번 캠 묶음: 양정이 다른 캠 세 장이 한 소매(슬리브)에 붙어 축 위를 미끄러진다. **원점 = 축, 작은 캠(맨 앞)의 두께 가운데**.
 * 가운데 캠은 로컬 z = −camW, 큰 캠은 −2·camW. 혹 꼭대기는 모두 로컬 +X, 바탕 원은 셋이 같다(그래서 바탕 원에 닿아 있을 때 옮길 수 있다).
 * 앞쪽에 옮김 고리 홈(두 턱). 모델이 rotation.z = valve150().a, position.z = valve150().z, setActive(valve150().k).
 */
export function camStack150(): CamStack150 {
  const K = K150;
  const g = new THREE.Group();
  const w = K.camW;
  const outlines: V2[][] = [];
  K.lifts.forEach((lift, k) => {
    const cam = lobeCam(K.rb, lift, K.halfW, { thick: w - 0.004, bore: K.shaftR + 0.06, outline: false });
    cam.position.z = -k * w;
    cam.name = `cam${k}`;
    g.add(cam);
    outlines.push(lobeOutline(K.rb, lift, K.halfW));
  });
  // 소매(뒤 끝 ~ 앞 고리)와 옮김 고리의 두 턱
  g.add(mesh(tubeZ(K.shaftR + 0.004, K.shaftR + 0.07, -2.5 * w - 0.005, 0.5 * w + 0.1, 0.006), darkSteel()));
  g.add(mesh(tubeZ(K.shaftR + 0.06, K.shaftR + 0.13, 0.5 * w + 0.01, 0.5 * w + 0.035, 0.005), darkSteel()));
  g.add(mesh(tubeZ(K.shaftR + 0.06, K.shaftR + 0.13, 0.5 * w + 0.075, 0.5 * w + 0.1, 0.005), darkSteel()));
  const contact = new THREE.Object3D();
  contact.name = 'camContact';
  const live: V2[] = (outlines[2] ?? []).map(([x, y]) => [x, y] as V2);
  contact.userData.outline = live;
  g.add(contact);
  setMM(g, { kind: 'camStack', rb: K.rb, lifts: [...K.lifts], camW: w, axis: 'z' });
  return {
    group: g,
    setActive(k: number): void {
      const kk = Math.max(0, Math.min(2, Math.round(k)));
      const src = outlines[kk];
      if (src === undefined) return;
      contact.position.z = -kk * w;
      for (let i = 0; i < live.length; i++) {
        const p = src[i];
        const q = live[i];
        if (p !== undefined && q !== undefined) {
          q[0] = p[0];
          q[1] = p[1];
        }
      }
    }
  };
}

// ═══════════════════════════ 151 웜과 좌우 나사 ═══════════════════════════

/** 151번 치수 */
export const K151 = {
  /** 나사 축 높이, 나사 축·웜 휠·웜의 z 가운데 */
  YS: 1.25,
  ZC: 0.28,
  /** 웜 휠 잇수·모듈(피치 반지름 0.456, 이끝 0.494), 웜 피치 반지름 */
  NW: 24,
  MOD: 0.038,
  RWP: 0.15,
  /** 웜 각속도 = KW × OMEGA */
  KW: 8,
  /** 방향을 바꾸는 반주기(구동 각 theta, rad) */
  half: 12 * Math.PI,
  /** 나사: 리드, 줄 수, 심·산 반지름 */
  lead: 0.36,
  starts: 4,
  coreR: 0.062,
  crestR: 0.1,
  /** 나사산 구간 |x| = thread0 ~ thread1, 축 끝 |x| */
  thread0: 0.51,
  thread1: 1.66,
  endX: 1.9,
  /** 너트: 가장 벌어졌을 때 중심 |x|, 폭(x)·높이(y)·깊이(z), 구멍 반지름 */
  XO: 1.48,
  nutW: 0.29,
  nutH: 0.4,
  nutD: 0.34,
  nutBore: 0.106,
  /** 너트 밑 홈(레일이 드는 자리): 폭(z)·깊이(y) */
  slotW: 0.07,
  slotD: 0.06,
  /** 레일 윗면의 y(축 기준) */
  railTop: -0.145
} as const;

export interface ScrewNuts151 {
  /** 삼각파 진행(0 ~ half) */
  a: number;
  /** +1 = 너트가 모이는 중, −1 = 벌어지는 중 */
  dir: 1 | -1;
  /** 웜의 회전각(자기 축 둘레, wormScrew 의 rotation.x) */
  worm: number;
  /** 웜 휠의 rotation.z(물림 위상 포함) */
  wheel: number;
  /** 나사 축의 rotation.x(세계 +X 둘레) */
  beta: number;
  /** 왼쪽·오른쪽 너트 중심 x */
  xL: number;
  xR: number;
  /** 너트가 한쪽으로 간 거리(0 ~ travel) */
  s: number;
}

/** 너트 한쪽 이동 거리의 최대 = lead·KW·half / (NW·2π) = 0.72 */
export const TRAVEL151 = (K151.lead * K151.KW * K151.half) / (K151.NW * TAU);

/**
 * 151번 운동식. theta = 구동 누적각. theta = 1.6(t = 1)이 판화 자세(너트가 가장 벌어짐)이고 거기서 모이기 시작한다.
 * 웜은 KW·OMEGA 로 돌다가 theta 가 half 만큼 갈 때마다 방향을 바꾼다(삼각파 — 누적 오차 없음).
 * 웜·휠은 m031 과 같은 자리 약속(웜 = 왼나사, 축 로컬 X, 휠 위 +Y, 휠 축 로컬 Z)의 묶음 안에서 쓰고 묶음을 rotation.y = −π/2 로 돌린다.
 */
export function screwNuts151(theta: number): ScrewNuts151 {
  const P = 2 * K151.half;
  const m = (((theta - 1.6) % P) + P) % P;
  const a = m < K151.half ? m : P - m;
  const dir: 1 | -1 = m < K151.half ? 1 : -1;
  const worm = -K151.KW * a;
  const S = TAU / K151.NW;
  const turn = -worm / K151.NW; // 묶음 안에서 휠이 돈 각(로컬 Z)
  const beta = -turn; // 묶음의 로컬 Z = 세계 −X
  const s = (K151.lead * -beta) / TAU;
  return { a, dir, worm, wheel: turn + Math.PI / 2 - S / 2, beta, xL: -K151.XO + s, xR: K151.XO - s, s };
}

/** 여러 줄 나사산(축 = 로컬 X, x0 ~ x1). hand +1 = 오른나사(정면에서 "\"), −1 = 왼나사("/") */
function threadX(coreR: number, outerR: number, lead: number, starts: number, x0: number, x1: number, hand: 1 | -1): THREE.BufferGeometry {
  const pitch = lead / starts;
  const wr = 0.3 * pitch;
  const wt = 0.18 * pitch;
  const rIn = coreR - 0.005;
  const prof: V2[] = [
    [-wr, rIn],
    [-wt, outerR],
    [wt, outerR],
    [wr, rIn]
  ];
  const xa = x0 + wr + 0.002;
  const xb = x1 - wr - 0.002;
  const steps = Math.max(8, Math.ceil(((xb - xa) / lead) * 64));
  const pos: number[] = [];
  const idx: number[] = [];
  for (let st = 0; st < starts; st++) {
    const ph = (st / starts) * TAU;
    const at = (u: number, r: number, j: number): [number, number, number] => {
      const xc = xa + ((xb - xa) * j) / steps;
      const psi = (hand * TAU * (xc - xa)) / lead + ph;
      return [xc + u, r * Math.cos(psi), r * Math.sin(psi)];
    };
    for (let e = 0; e < 4; e++) {
      const p = prof[e]!;
      const q = prof[(e + 1) % 4]!;
      const base = pos.length / 3;
      for (let j = 0; j <= steps; j++) pos.push(...at(p[0], p[1], j), ...at(q[0], q[1], j));
      for (let j = 0; j < steps; j++) {
        const i0 = base + j * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    for (const j of [0, steps]) {
      const base = pos.length / 3;
      for (const [u, r] of prof) pos.push(...at(u, r, j));
      if (j === 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  // 줄마다 따로 닫힌 면: 부피 부호로 바깥쪽이 앞면이 되게(왼나사는 거울상이라 뒤집힌다)
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const i = idx[k]! * 3;
    const j = idx[k + 1]! * 3;
    const l = idx[k + 2]! * 3;
    const ax = pos[i]!, ay = pos[i + 1]!, az = pos[i + 2]!;
    const bx = pos[j]!, by = pos[j + 1]!, bz = pos[j + 2]!;
    const cx = pos[l]!, cy = pos[l + 1]!, cz = pos[l + 2]!;
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  if (vol < 0) {
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1]!;
      idx[k + 1] = idx[k + 2]!;
      idx[k + 2] = t;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 151번 나사 축: 한 축의 왼쪽(x < 0)에 오른나사, 오른쪽(x > 0)에 왼나사(둘 다 4줄, 리드 0.36). **원점 = 축 가운데(웜 휠 자리)**, 축 = 로컬 X.
 * 가운데 민 부분(|x| 0.1 ~ 0.51, 반지름 = 산 반지름)과 휠 양옆 턱(|x| 0.1 ~ 0.17), 양끝 저널(|x| 1.66 ~ 1.9, 반지름 coreR).
 * 앞면에 노란 표시(돌아가는 것이 보이게). 모델이 rotation.x = screwNuts151().beta.
 */
export function twinScrew151(): THREE.Group {
  const K = K151;
  const g = new THREE.Group();
  g.add(mesh(cylX(K.coreR, -K.endX, K.endX, 0.008), steel()));
  for (const sx of [-1, 1] as const) {
    const x0 = sx < 0 ? -K.thread0 : 0.1;
    const x1 = sx < 0 ? -0.1 : K.thread0;
    g.add(mesh(cylX(K.crestR, x0, x1, 0.008), steel()));
    g.add(mesh(cylX(0.17, sx < 0 ? -0.17 : 0.1, sx < 0 ? -0.1 : 0.17, 0.008), darkSteel()));
    const th = threadX(K.coreR, K.crestR, K.lead, K.starts, sx < 0 ? -K.thread1 : K.thread0, sx < 0 ? -K.thread0 : K.thread1, sx < 0 ? 1 : -1);
    g.add(mesh(th, steel()));
    g.add(meshAt(new THREE.BoxGeometry(0.2, 0.02, 0.008), paint(MARK), sx * 0.34, 0, K.crestR + 0.002));
  }
  setMM(g, { kind: 'screw', fn: 'twinScrew151', axis: 'x', lead: K.lead, starts: K.starts, coreR: K.coreR, outerR: K.crestR, hands: ['right', 'left'] });
  return g;
}

/**
 * 151번 미끄럼 너트: 네모 블록(폭 nutW × 높이 nutH × 깊이 nutD)에 나사 구멍, 밑면에 레일 홈. **원점 = 나사 축 위 너트 가운데**, 구멍 = 로컬 X.
 * 레일 홈에 레일이 들어 있어 돌지 못하고 축 방향으로만 미끄러진다. 청동. child 표식 'nutMark'(가운데).
 */
export function slideNut151(): THREE.Group {
  const K = K151;
  const g = new THREE.Group();
  const hd = K.nutD / 2;
  const hh = K.nutH / 2;
  const sw = K.slotW / 2;
  // 단면(u = 세계 z 가 될 축, v = y): 밑변 가운데에 홈
  const pts: V2[] = [
    [-hd, -hh],
    [-sw, -hh],
    [-sw, -hh + K.slotD],
    [sw, -hh + K.slotD],
    [sw, -hh],
    [hd, -hh],
    [hd, hh],
    [-hd, hh]
  ];
  const shape = shapeFrom(pts);
  shape.holes.push(circlePath(0, 0, K.nutBore));
  const geo = extrude(shape, K.nutW, 0.008, 32);
  geo.rotateY(-Math.PI / 2); // 압출 방향 Z → X, 단면의 u → 세계 +Z
  g.add(mesh(geo, bronze({ roughness: 0.4 })));
  g.add(meshAt(new THREE.BoxGeometry(0.02, 0.16, 0.008), paint(MARK), 0, 0.02, hd + 0.003));
  g.add(marker('nutMark', 0, 0, 0));
  setMM(g, { kind: 'nut', width: K.nutW, height: K.nutH, depth: K.nutD, bore: K.nutBore, axis: 'x' });
  return g;
}

/**
 * 151번 너트 안내 레일(판화에 없음 — 너트가 따라 돌지 않게 잡는 최소 보충): 가로 레일 + 바닥까지 내려가는 다리 둘.
 * **원점 = 레일 윗면 가운데**, 레일은 로컬 X 로 len, 다리는 아래로 drop(바닥까지). 주철.
 */
export function guideRail151(len: number, drop: number): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  const fin = K151.slotW - 0.012;
  g.add(meshAt(new THREE.BoxGeometry(len, 0.07, fin), body, 0, -0.035, 0));
  g.add(meshAt(new THREE.BoxGeometry(len, 0.05, 0.16), body, 0, -0.095, 0));
  for (const sx of [-1, 1]) {
    const x = sx * (len / 2 - 0.07);
    g.add(meshAt(new THREE.BoxGeometry(0.08, drop - 0.12, 0.12), body, x, -0.12 - (drop - 0.12) / 2, 0));
    g.add(meshAt(new THREE.BoxGeometry(0.2, 0.03, 0.26), body, x, -drop + 0.015, 0));
  }
  setMM(g, { kind: 'frame', of: 'nutRail', length: len });
  return g;
}
