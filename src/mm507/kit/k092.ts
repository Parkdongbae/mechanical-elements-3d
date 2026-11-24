// 92·93·94번 전용 키트 — 크랭크 묶음
//  92 보통의 크랭크: 살 6개 크랭크 바퀴, 연결봉, 크로스헤드(미끄럼 블록), ㄷ자 안내틀
//  93 홈 요크 크랭크: 크랭크 원판(핀), 홈 요크 + 위아래 막대, 막대 안내 부시
//  94 가변 크랭크: 방사 홈 판, 나선 홈 판, 볼트, 주기 시간표
// 치수 상수(K92·K93·K94)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s092.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, glass, paint, steel } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, hexPrism, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

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

/** 원호 점열(a0 → a1, 양끝 포함 n+1 점) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** 스타디움(양끝 둥근 홈) 다각형 — 두 중심 c0, c1, 반지름 r. 반시계 */
export function stadiumPts(c0: V2, c1: V2, r: number, n = 12): V2[] {
  const a = Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
  return [...arc(c1[0], c1[1], r, a - Math.PI / 2, a + Math.PI / 2, n), ...arc(c0[0], c0[1], r, a + Math.PI / 2, a + Math.PI * 1.5, n)];
}

// ═══════════════════════════ 92 보통의 크랭크 ═══════════════════════════

/** 92번 치수(판화 비: 크랭크 반지름 0.6R, 연결봉 2.0R, 블록이 축과 같은 높이) */
export const K92 = {
  /** 바퀴 바깥 반지름 */
  R: 0.85,
  /** 크랭크 반지름(축 중심 ~ 크랭크 핀) */
  crank: 0.51,
  /** 연결봉 핀 사이 길이 */
  rod: 1.74,
  /** 안내틀 안쪽 틈(세로) */
  gap: 0.38,
  /** 안내틀 가로대 높이 */
  barH: 0.13,
  /** 안내틀 왼쪽 끝 막이 두께 */
  endT: 0.08,
  /** 블록 가로 */
  blockW: 0.48,
  /** 블록 몸통과 안내면 사이 틈(위아래 각각) */
  clear: 0.003,
  /** 판화 자세(t = 1)에서 크랭크 핀의 각(rad) — 오른쪽 아래 −60° */
  pose: -60 * DEG
} as const;

/**
 * 92번 운동식. theta = 구동 누적각(바퀴 반시계). 축 중심을 원점으로 한 평면 좌표.
 * a = 핀 각, pin = 크랭크 핀, x = 블록 핀(손목 핀)의 x(높이는 0), rodAngle = 연결봉이 +X 와 이루는 각.
 */
export function sliderCrank92(theta: number): { a: number; pin: V2; x: number; rodAngle: number } {
  const a = theta - 1.6 + K92.pose;
  const px = K92.crank * Math.cos(a);
  const py = K92.crank * Math.sin(a);
  const x = px + Math.sqrt(K92.rod * K92.rod - py * py);
  return { a, pin: [px, py], x, rodAngle: Math.atan2(-py, x - px) };
}

export interface CrankWheelOpts {
  /** 테 폭(z). 기본 0.12 */
  width?: number;
  /** 살 수. 기본 6 */
  spokes?: number;
  /** 테 두께(반지름 방향). 기본 0.14R */
  rimT?: number;
  /** 허브 반지름. 기본 0.29R */
  hubR?: number;
  /** 축 구멍 반지름. 기본 0.08 */
  boreR?: number;
  /** 살 반폭. 기본 0.04 */
  spokeHalf?: number;
  /** 크랭크 핀 반지름. 기본 0.045 */
  pinR?: number;
  /** 핀 끝의 로컬 z. 기본 0.25 */
  pinTop?: number;
  /** 연결봉 평면의 로컬 z(검사용 핀 표식 자리). 기본 0.19 */
  pinZ?: number;
}

/** 살 사이 창(둥근 모서리 부채꼴) 윤곽 — 살 k 와 k+1 사이 */
function windowPts(a0: number, a1: number, rh: number, ri: number, hw: number, rc: number): V2[] {
  const off = hw + rc;
  const r1 = rh + rc;
  const r2 = ri - rc;
  const d1 = Math.asin(off / r1);
  const d2 = Math.asin(off / r2);
  const at = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];
  const c1 = at(r1, a0 + d1);
  const c2 = at(r2, a0 + d2);
  const c3 = at(r2, a1 - d2);
  const c4 = at(r1, a1 - d1);
  return [
    ...arc(c2[0], c2[1], rc, a0 - Math.PI / 2, a0 + d2, 6),
    ...arc(0, 0, ri, a0 + d2, a1 - d2, 14),
    ...arc(c3[0], c3[1], rc, a1 - d2, a1 + Math.PI / 2, 6),
    ...arc(c4[0], c4[1], rc, a1 + Math.PI / 2, a1 - d1 + Math.PI, 6),
    ...arc(0, 0, rh, a1 - d1, a0 + d1, 8),
    ...arc(c1[0], c1[1], rc, a0 + d1 + Math.PI, a0 + Math.PI * 1.5, 6)
  ];
}

/**
 * 살 달린 크랭크 바퀴(92번): 회전축 = 로컬 Z, 원점 = 중심, 테 폭의 가운데가 z = 0.
 * 살 0 번(+X)의 crankR 자리에 크랭크 핀이 +Z 로 솟는다. 핀 표식 child 이름 'crankPin'(연결봉 평면 z = pinZ).
 */
export function crankWheel(R: number, crankR: number, o: CrankWheelOpts = {}): THREE.Group {
  const width = o.width ?? 0.12;
  const n = Math.max(3, o.spokes ?? 6);
  const ri = R - (o.rimT ?? R * 0.14);
  const rh = o.hubR ?? R * 0.29;
  const bore = o.boreR ?? 0.08;
  const hw = o.spokeHalf ?? 0.04;
  const pinR = o.pinR ?? 0.045;
  const pinTop = o.pinTop ?? 0.25;
  const pinZ = o.pinZ ?? 0.19;
  const g = new THREE.Group();
  // 살 판(창 n 개)
  const shape = shapeFrom(circlePts(ri + 0.01, 96));
  shape.holes.push(circlePath(0, 0, bore));
  for (let k = 0; k < n; k++) shape.holes.push(pathFrom(windowPts((k * TAU) / n, ((k + 1) * TAU) / n, rh, ri, hw, R * 0.075)));
  g.add(mesh(extrude(shape, width * 0.5, 0.008, 16), castIron({ roughness: 0.55 })));
  // 테·허브
  g.add(mesh(tubeZ(ri, R, -width / 2, width / 2, 0.012, 96), castIron({ roughness: 0.5 })));
  g.add(mesh(tubeZ(bore, rh, -width / 2 - 0.01, width / 2 + 0.03, 0.01, 48), darkSteel()));
  // 크랭크 핀 + 보스
  g.add(meshAt(cylZ(pinR * 1.9, 0, width / 2 + 0.03, 0.008), darkSteel(), crankR, 0, 0));
  g.add(meshAt(cylZ(pinR, 0, pinTop, 0.008), steel(), crankR, 0, 0));
  g.add(meshAt(new THREE.CylinderGeometry(pinR * 0.5, pinR * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), crankR, 0, pinTop + 0.002));
  const pin = new THREE.Object3D();
  pin.name = 'crankPin';
  pin.position.set(crankR, 0, pinZ);
  g.add(markPin(pin));
  setMM(g, { kind: 'crankWheel', r: R, width, crankR, axis: 'z' });
  return g;
}

export interface ConnectingRodOpts {
  /** 눈(끝 고리) 바깥 반지름. 기본 0.08 */
  eyeR?: number;
  /** 핀 구멍 반지름. 기본 0.046 */
  holeR?: number;
  /** 막대 반폭. 기본 0.035 */
  barHalf?: number;
  /** 두께(z). 기본 0.06 */
  thick?: number;
}

/** 연결봉: 원점 = 한쪽 핀 중심, +X 로 length 떨어진 곳이 다른 쪽 핀. 두께 가운데 z = 0 */
export function connectingRod(length: number, o: ConnectingRodOpts = {}): THREE.Group {
  const eyeR = o.eyeR ?? 0.08;
  const holeR = o.holeR ?? 0.046;
  const half = o.barHalf ?? 0.035;
  const thick = o.thick ?? 0.06;
  const g = new THREE.Group();
  g.add(mesh(extrude(stadiumShape(eyeR * 0.9, 0, length - eyeR * 0.9, 0, half), thick * 0.7, 0.006), steel()));
  for (const x of [0, length]) g.add(meshAt(tubeZ(holeR, eyeR, -thick / 2, thick / 2, 0.006), steel(), x, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(length * 0.3, 0.012, 0.006), paint(MARK), length * 0.5, 0, thick * 0.35 + 0.002));
  setMM(g, { kind: 'link', length, a: [0, 0, 0], b: [length, 0, 0] });
  return g;
}

export interface GuideFrameOpts {
  /** 가로대 높이. 기본 K92.barH */
  barH?: number;
  /** 왼쪽 끝 막이 두께. 기본 K92.endT */
  endT?: number;
  /** 두께(z). 기본 0.12 */
  depth?: number;
  /** 틀의 가운데 평면에서 뒤판 앞면까지 거리(받침 기둥 길이). 0 이면 기둥 없음 */
  back?: number;
}

/**
 * ㄷ자 안내틀(92번): 위·아래 가로대 + 왼쪽 끝 막이. 원점 = 끝 막이 안쪽 면의 가운데 높이, 가로대는 +X 로 len.
 * 두께 가운데 z = 0. back > 0 이면 뒤판까지 받침 기둥 4개(판화에 없음).
 * userData.outlines.groove = 블록이 다니는 안쪽 네모(검사용 구멍 윤곽).
 */
export function guideFrame(len: number, gap: number, o: GuideFrameOpts = {}): THREE.Group {
  const barH = o.barH ?? K92.barH;
  const endT = o.endT ?? K92.endT;
  const depth = o.depth ?? 0.12;
  const back = o.back ?? 0;
  const h = gap / 2;
  const g = new THREE.Group();
  const pts: V2[] = [
    [-endT, -h - barH],
    [len, -h - barH],
    [len, -h],
    [0, -h],
    [0, h],
    [len, h],
    [len, h + barH],
    [-endT, h + barH]
  ];
  g.add(mesh(extrude(shapeFrom(pts), depth, 0.008), castIron({ roughness: 0.6 })));
  for (const sy of [-1, 1]) {
    for (const fx of [0.12, 0.9]) {
      const x = len * fx;
      const y = sy * (h + barH * 0.72); // 블록 앞 덮개판(반높이 ≤ h + 0.045)이 지나가도 닿지 않는 바깥쪽
      if (back > 0) g.add(meshAt(cylZ(0.04, -back, -depth / 2 + 0.004, 0.006), darkSteel(), x, y, 0));
      const nut = hexPrism(0.05, 0.03, false, true, 0);
      nut.rotateX(Math.PI / 2);
      g.add(meshAt(nut, darkSteel(), x, y, depth / 2 + 0.012));
    }
  }
  g.userData.outlines = {
    groove: [
      [0, -h],
      [len, -h],
      [len, h],
      [0, h]
    ] as V2[]
  };
  setMM(g, { kind: 'guide', axis: 'x', len, gap });
  return g;
}

export interface CrossheadOpts {
  /** 앞 덮개판 높이(가로대를 덮는다). 기본 gap + 0.09 */
  faceH?: number;
  /** 몸통 두께(z). 기본 0.12 */
  depth?: number;
  /** 앞 덮개판 두께. 기본 0.045 */
  faceT?: number;
  /** 손목 핀 반지름. 기본 0.045 */
  pinR?: number;
  /** 핀 끝 로컬 z. 기본 0.25 */
  pinTop?: number;
  /** 연결봉 평면의 로컬 z. 기본 0.19 */
  pinZ?: number;
}

/**
 * 크로스헤드(미끄럼 블록, 92번): 원점 = 블록 가운데(= 손목 핀 축). 몸통 w × bodyH 가 안내틀 틈에 들어가고,
 * 앞 덮개판이 가로대를 덮는다. 핀 표식 child 이름 'wristPin'. 몸통 메시에 userData.outline.
 */
export function crosshead(w: number, bodyH: number, o: CrossheadOpts = {}): THREE.Group {
  const depth = o.depth ?? 0.12;
  const faceT = o.faceT ?? 0.045;
  const faceH = o.faceH ?? bodyH + 0.09;
  const pinR = o.pinR ?? 0.045;
  const pinTop = o.pinTop ?? 0.25;
  const pinZ = o.pinZ ?? 0.19;
  const g = new THREE.Group();
  const rect: V2[] = [
    [-w / 2, -bodyH / 2],
    [w / 2, -bodyH / 2],
    [w / 2, bodyH / 2],
    [-w / 2, bodyH / 2]
  ];
  const body = mesh(extrude(shapeFrom(rect), depth, 0.006), bronze({ roughness: 0.36 }));
  body.userData.outline = rect;
  g.add(body);
  const face: V2[] = [
    [-w / 2, -faceH / 2],
    [w / 2, -faceH / 2],
    [w / 2, faceH / 2],
    [-w / 2, faceH / 2]
  ];
  g.add(meshAt(extrude(shapeFrom(face), faceT, 0.008), bronze({ roughness: 0.36 }), 0, 0, depth / 2 + faceT / 2));
  g.add(meshAt(cylZ(pinR, depth / 2 + faceT - 0.005, pinTop, 0.008), steel(), 0, 0, 0));
  g.add(meshAt(new THREE.CylinderGeometry(pinR * 0.5, pinR * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), 0, 0, pinTop + 0.002));
  const pin = new THREE.Object3D();
  pin.name = 'wristPin';
  pin.position.set(0, 0, pinZ);
  g.add(markPin(pin));
  setMM(g, { kind: 'slider', axis: 'x', w, h: bodyH });
  return g;
}

// ═══════════════════════════ 93 홈 요크 크랭크 ═══════════════════════════

/** 93번 치수(판화 비: 핀 원 반지름 0.78R, 홈 안쪽 반길이 1.37r, 막대 지름 ≈ 핀 지름의 0.75배) */
export const K93 = {
  /** 크랭크 원판 반지름 */
  R: 0.52,
  /** 크랭크 반지름 */
  crank: 0.4,
  /** 핀 반지름 */
  pinR: 0.075,
  /** 홈 반폭(핀 반지름 + 틈 0.003) */
  slotHalf: 0.078,
  /** 홈 반길이(끝 둥근 부분 포함) */
  slotLen: 0.55,
  /** 요크 테 두께 */
  frame: 0.07,
  /** 막대 반지름 */
  rodR: 0.06,
  /** 요크 중심에서 위 막대 끝까지 */
  rodUp: 1.12,
  /** 요크 중심에서 아래 막대 끝까지 */
  rodDown: 1.14,
  /** 판화 자세(t = 1)에서 핀의 각 — 오른쪽 위 33° */
  pose: 33 * DEG
} as const;

/** 93번 운동식: a = 핀 각(반시계), pin = 축 중심 기준 핀 자리, y = 요크(홈 중심)의 높이 */
export function scotchYoke93(theta: number): { a: number; pin: V2; y: number } {
  const a = theta - 1.6 + K93.pose;
  const pin: V2 = [K93.crank * Math.cos(a), K93.crank * Math.sin(a)];
  return { a, pin, y: pin[1] };
}

export interface CrankDiscOpts {
  /** 판 두께. 기본 0.08 */
  thick?: number;
  /** 축 구멍 반지름. 기본 0.06 */
  boreR?: number;
  /** 허브 반지름. 기본 0.13 */
  hubR?: number;
  /** 핀 반지름. 기본 K93.pinR */
  pinR?: number;
  /** 핀 끝 로컬 z. 기본 0.26 */
  pinTop?: number;
  /** 요크 평면의 로컬 z(핀 표식 자리). 기본 0.16 */
  pinZ?: number;
}

/**
 * 크랭크 원판(93번): 회전축 = 로컬 Z, 판 가운데 z = 0. +X 의 crankR 에 핀이 +Z 로 솟는다.
 * 핀 메시에 userData.outline(원), 핀 표식 child 이름 'crankPin'.
 */
export function crankDisc(R: number, crankR: number, o: CrankDiscOpts = {}): THREE.Group {
  const thick = o.thick ?? 0.08;
  const bore = o.boreR ?? 0.06;
  const hubR = o.hubR ?? 0.13;
  const pinR = o.pinR ?? K93.pinR;
  const pinTop = o.pinTop ?? 0.26;
  const pinZ = o.pinZ ?? 0.16;
  const g = new THREE.Group();
  const shape = shapeFrom(circlePts(R, 96));
  shape.holes.push(circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, thick, 0.008, 24), bronze({ roughness: 0.36 })));
  g.add(mesh(tubeZ(bore, hubR, -thick / 2 - 0.01, thick / 2 + 0.015, 0.008), darkSteel()));
  // 반지름 표시줄(회전이 보이게)
  g.add(meshAt(new THREE.BoxGeometry(crankR - hubR - pinR - 0.03, 0.014, 0.006), paint(MARK), (crankR + hubR - pinR) / 2, 0, thick / 2 + 0.002));
  const pin = meshAt(cylZ(pinR, thick / 2 - 0.004, pinTop, 0.01, 36), steel(), crankR, 0, 0);
  pin.userData.outline = circlePts(pinR, 32);
  g.add(pin);
  const mark = new THREE.Object3D();
  mark.name = 'crankPin';
  mark.position.set(crankR, 0, pinZ);
  g.add(markPin(mark));
  setMM(g, { kind: 'crankDisc', r: R, crankR, pinR, axis: 'z' });
  return g;
}

export interface SlotYokeOpts {
  /** 홈 반길이(끝 둥근 부분 포함). 기본 K93.slotLen */
  slotLen?: number;
  /** 홈 반폭. 기본 K93.slotHalf */
  slotHalf?: number;
  /** 테 두께. 기본 K93.frame */
  frame?: number;
  /** 판 두께(z). 기본 0.1 */
  thick?: number;
  /** 막대 반지름. 기본 K93.rodR */
  rodR?: number;
  /** 요크 중심에서 위 막대 끝까지. 기본 K93.rodUp */
  rodUp?: number;
  /** 요크 중심에서 아래 막대 끝까지. 기본 K93.rodDown */
  rodDown?: number;
}

/**
 * 홈 요크(93번): 가로로 긴 홈 테 + 위·아래로 뻗은 둥근 막대(한 몸). 원점 = 홈 중심, 홈의 긴 방향 = X, 막대 = Y.
 * 두께 가운데 z = 0. userData.outlines.slotHole = 홈 윤곽(핀이 이 안에 있어야 한다).
 */
export function slotYoke(o: SlotYokeOpts = {}): THREE.Group {
  const L = o.slotLen ?? K93.slotLen;
  const hw = o.slotHalf ?? K93.slotHalf;
  const fr = o.frame ?? K93.frame;
  const thick = o.thick ?? 0.1;
  const rodR = o.rodR ?? K93.rodR;
  const up = o.rodUp ?? K93.rodUp;
  const down = o.rodDown ?? K93.rodDown;
  const c = L - hw;
  const g = new THREE.Group();
  const hole = stadiumPts([-c, 0], [c, 0], hw, 14);
  const shape = shapeFrom(stadiumPts([-c, 0], [c, 0], hw + fr, 16));
  shape.holes.push(pathFrom(hole));
  g.add(mesh(extrude(shape, thick, 0.01, 16), brass()));
  const edge = hw + fr;
  // 막대(Y축 회전체) — 요크 테에 0.012 박혀 한 몸
  g.add(mesh(lathe(rodProfile(rodR, edge - 0.012, up, 0, rodR * 0.3), 28), steel()));
  g.add(mesh(lathe(rodProfile(rodR, -down, -edge + 0.012, rodR * 0.3, 0), 28), steel()));
  // 이음 깃(판화의 넓어지는 뿌리)
  g.add(mesh(lathe([[0, edge - 0.012], [rodR * 1.45, edge - 0.012], [rodR, edge + 0.04], [0, edge + 0.04]], 28), steel()));
  g.add(mesh(lathe([[0, -edge - 0.04], [rodR, -edge - 0.04], [rodR * 1.45, -edge + 0.012], [0, -edge + 0.012]], 28), steel()));
  g.userData.outlines = { slotHole: hole };
  setMM(g, { kind: 'yoke', slotLen: L, slotHalf: hw, rodR, top: [0, up, 0], bottom: [0, -down, 0] });
  return g;
}

/**
 * 세로 막대 안내 부시(93번, 판화에 없음): 뒤판에서 나온 팔 끝의 고리. 반환 그룹 원점 = (x, y, 0),
 * 고리 중심 = (x, y, zc), 구멍 축 = Y, 고리 높이 h. holeR = 막대 반지름.
 */
export function rodGuideY(x: number, y: number, zc: number, holeR: number, h = 0.1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const rOut = holeR + 0.045;
  g.add(meshAt(lathe(tubeProfile(holeR + 0.003, rOut, -h / 2, h / 2, 0.008), 36), darkSteel(), 0, 0, zc));
  const z1 = zc - holeR - 0.012;
  const len = z1 - STAGE.backZ;
  g.add(meshAt(new THREE.BoxGeometry(rOut * 1.6, h * 0.75, len), castIron(), 0, 0, STAGE.backZ + len / 2));
  setMM(g, { kind: 'guide', axis: 'y', holeR, h, center: [0, 0, zc] });
  return g;
}

// ═══════════════════════════ 94 가변 크랭크 ═══════════════════════════

/** 94번 치수(판화 비: 판 반지름 R, 방사 홈 0.35R~0.87R, 나선 홈 0.38R~0.80R 약 2바퀴, 허브 0.21R) */
export const K94 = {
  /** 두 판의 반지름 */
  R: 1.1,
  /** 방사 홈 수 */
  slots: 6,
  /** 방사 홈 양끝 중심 반지름 */
  slotR0: 0.4,
  slotR1: 0.9,
  /** 방사 홈·나선 홈 반폭 */
  half: 0.0425,
  /** 볼트 몸통 반지름 */
  boltR: 0.038,
  /** 나선 홈 안쪽 끝 중심 반지름 */
  rIn: 0.42,
  /** 나선 한 바퀴에 커지는 반지름 */
  pitch: 0.23,
  /** 나선 바퀴 수 */
  turns: 2,
  /** 나선 안쪽 끝의 판 로컬 각(판화: 위에서 살짝 왼쪽 95°). 바깥으로 갈수록 각이 줄어든다(정면에서 시계 방향으로 풀림) */
  phi0: 95 * DEG,
  /** 볼트가 든 방사 홈의 판 로컬 각(판화: 왼쪽 아래 240°) */
  boltSlot: 240 * DEG,
  /** 허브 반지름 / 축 구멍 */
  hubR: 0.23,
  boreR: 0.1,
  /** 시간표(θ rad): 돌리기 3π, 조절 2π — 한 주기 10π */
  run: 3 * Math.PI,
  adj: 2 * Math.PI
} as const;

/** 나선 홈 중심선의 반지름: s = 안쪽 끝에서 잰 감긴 각(rad, 0 ~ turns·2π) */
export function spiralR94(s: number): number {
  return K94.rIn + (K94.pitch * s) / TAU;
}

/** 판화 자세의 s(= 575°, 볼트 반지름 0.787) 와 조절 뒤의 s(= 35°, 0.442). 두 판을 서로 1.5바퀴 돌린 차 */
export const S94_BIG = K94.phi0 - K94.boltSlot + K94.turns * TAU;
export const S94_SMALL = S94_BIG - 1.5 * TAU;

const smooth = (u: number): number => u * u * (3 - 2 * u);

/**
 * 94번 주기 시간표(모두 theta 의 닫힌 식, 주기 10π):
 *  0 ~ 3π 함께 돎(큰 반지름) → 3π ~ 5π 방사 홈 판 정지, 나선 판만 시계로 1.5바퀴(볼트가 안으로)
 *  → 5π ~ 8π 함께 돎(작은 반지름) → 8π ~ 10π 정지, 나선 판만 반시계로 1.5바퀴(볼트가 밖으로).
 * slotPlate·spiralPlate = 두 판의 절대 회전각(반시계 +), s = 나선 위 볼트 자리, r = 크랭크 반지름,
 * bolt = 축 중심 기준 볼트 자리, phase = 0 돌리기(큰) / 1 줄이는 중 / 2 돌리기(작은) / 3 키우는 중.
 */
export function variableCrank94(theta: number): { slotPlate: number; spiralPlate: number; s: number; r: number; bolt: V2; phase: 0 | 1 | 2 | 3 } {
  const { run, adj } = K94;
  const P = 2 * (run + adj);
  const n = Math.floor(theta / P);
  const m = theta - n * P;
  let acc: number;
  let u: number;
  let phase: 0 | 1 | 2 | 3;
  if (m < run) {
    acc = m;
    u = 0;
    phase = 0;
  } else if (m < run + adj) {
    acc = run;
    u = smooth((m - run) / adj);
    phase = 1;
  } else if (m < 2 * run + adj) {
    acc = m - adj;
    u = 1;
    phase = 2;
  } else {
    acc = 2 * run;
    u = 1 - smooth((m - 2 * run - adj) / adj);
    phase = 3;
  }
  const slotPlate = n * 2 * run + acc - 1.6;
  const s = S94_BIG + (S94_SMALL - S94_BIG) * u;
  const spiralPlate = slotPlate + (s - S94_BIG);
  const r = spiralR94(s);
  const a = slotPlate + K94.boltSlot;
  return { slotPlate, spiralPlate, s, r, bolt: [r * Math.cos(a), r * Math.sin(a)], phase };
}

/** 방사 홈 k 의 윤곽(판 로컬) */
export function radialSlotPts94(k: number): V2[] {
  const a = (k * TAU) / K94.slots;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return stadiumPts([K94.slotR0 * c, K94.slotR0 * s], [K94.slotR1 * c, K94.slotR1 * s], K94.half, 10);
}

/** 나선 홈 윤곽(판 로컬, 양끝 둥글게). 중심선은 각 phi0 − s, 반지름 spiralR94(s) */
export function spiralGroovePts94(steps = 288): V2[] {
  const S = K94.turns * TAU;
  const hw = K94.half;
  const outer: V2[] = [];
  const inner: V2[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = (S * i) / steps;
    const a = K94.phi0 - s;
    const r = spiralR94(s);
    outer.push([(r + hw) * Math.cos(a), (r + hw) * Math.sin(a)]);
    inner.push([(r - hw) * Math.cos(a), (r - hw) * Math.sin(a)]);
  }
  const aEnd = K94.phi0 - S;
  const rEnd = spiralR94(S);
  const capEnd = arc(rEnd * Math.cos(aEnd), rEnd * Math.sin(aEnd), hw, aEnd, aEnd - Math.PI, 10).slice(1, -1);
  const r0 = spiralR94(0);
  const capStart = arc(r0 * Math.cos(K94.phi0), r0 * Math.sin(K94.phi0), hw, K94.phi0 + Math.PI, K94.phi0, 10).slice(1, -1);
  return [...outer, ...capEnd, ...inner.reverse(), ...capStart];
}

export interface SlotPlateOpts {
  /** 두께. 기본 0.06 */
  thick?: number;
  /** true(기본) 면 판 면을 반투명으로 — 판화의 점선(뒤에 가려진 나선 홈)이 비쳐 보이게. 테·허브·홈 테두리는 황동 */
  clear?: boolean;
}

/**
 * 방사 홈 판(94번, 앞판): 회전축 = 로컬 Z, 두께 가운데 z = 0. 방사 홈 6개(0°, 60°, …), 허브 고리.
 * userData.outlines.slotHole0..5 = 홈 윤곽.
 */
export function radialSlotPlate(o: SlotPlateOpts = {}): THREE.Group {
  const thick = o.thick ?? 0.06;
  const clear = o.clear ?? true;
  const { R, slots, hubR, boreR, half } = K94;
  const g = new THREE.Group();
  const shape = shapeFrom(circlePts(R - 0.03, 120));
  shape.holes.push(circlePath(0, 0, hubR - 0.01));
  const outlines: Record<string, V2[]> = {};
  const liners: THREE.Shape[] = [];
  for (let k = 0; k < slots; k++) {
    const pts = radialSlotPts94(k);
    outlines[`slotHole${k}`] = pts;
    shape.holes.push(pathFrom(pts));
    const a = (k * TAU) / slots;
    const c0: V2 = [K94.slotR0 * Math.cos(a), K94.slotR0 * Math.sin(a)];
    const c1: V2 = [K94.slotR1 * Math.cos(a), K94.slotR1 * Math.sin(a)];
    const ring = shapeFrom(stadiumPts(c0, c1, half + 0.016, 10));
    ring.holes.push(pathFrom(pts));
    liners.push(ring);
  }
  const face = clear ? glass(0xe2c070, 0.3) : brass();
  g.add(mesh(extrude(shape, thick * 0.8, 0.004, 24), face));
  // 홈 테두리(황동) — 판화의 굵은 실선
  g.add(mesh(extrude(liners, thick, 0.004, 12), brass()));
  // 테·허브
  g.add(mesh(tubeZ(R - 0.035, R, -thick / 2, thick / 2, 0.008, 120), brass()));
  g.add(mesh(tubeZ(boreR, hubR, -thick / 2, thick / 2 + 0.03, 0.008, 48), brass({ roughness: 0.4 })));
  g.userData.outlines = outlines;
  setMM(g, { kind: 'slotPlate', r: R, slots, axis: 'z' });
  return g;
}

export interface SpiralPlateOpts {
  /** 두께. 기본 0.07 */
  thick?: number;
  /** 홈 깊이(앞면에서). 기본 0.04 */
  groove?: number;
}

/**
 * 나선 홈 판(94번, 뒤판): 회전축 = 로컬 Z, 두께 가운데 z = 0. 앞면(+Z)에 나선 홈(깊이 groove, 약 2바퀴)이 파였다.
 * userData.outlines.spiralGroove = 홈 윤곽. 테에 표시 눈금 하나(회전이 보이게).
 */
export function spiralGroovePlate(o: SpiralPlateOpts = {}): THREE.Group {
  const thick = o.thick ?? 0.07;
  const groove = Math.min(o.groove ?? 0.04, thick - 0.01);
  const { R, boreR } = K94;
  const g = new THREE.Group();
  const pts = spiralGroovePts94();
  const floor = shapeFrom(circlePts(R, 120));
  floor.holes.push(circlePath(0, 0, boreR));
  g.add(meshAt(extrude(floor, thick - groove, 0.004, 24), darkSteel(), 0, 0, -groove / 2));
  const top = shapeFrom(circlePts(R, 120));
  top.holes.push(circlePath(0, 0, boreR));
  top.holes.push(pathFrom(pts));
  g.add(meshAt(extrude(top, groove, 0.004, 24), bronze({ roughness: 0.4 }), 0, 0, thick / 2 - groove / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.03, thick + 0.01), paint(MARK), R - 0.04, 0, 0));
  g.userData.outlines = { spiralGroove: pts };
  setMM(g, { kind: 'spiralPlate', r: R, turns: K94.turns, pitch: K94.pitch, axis: 'z' });
  return g;
}

/**
 * 볼트(94번, 크랭크 핀 구실): 축 = 로컬 Z, 원점 = 축 위 z = 0. 몸통은 z0 ~ z1, 너트·와셔는 nutZ(앞판 앞면)에 얹힌다.
 * 그룹에 userData.outline(몸통 원) 과 핀 표식. 모델이 name 'bolt' 를 붙인다.
 */
export function crankBolt(z0: number, z1: number, nutZ: number, r: number = K94.boltR): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(r, z0, z1, 0.006, 28), steel()));
  g.add(mesh(tubeZ(r, r * 2.3, nutZ, nutZ + 0.012, 0.003, 32), steel()));
  const nut = hexPrism(r * 3.4, 0.045, false, true, r);
  nut.rotateX(Math.PI / 2);
  g.add(meshAt(nut, darkSteel(), 0, 0, nutZ + 0.012 + 0.0225));
  g.add(meshAt(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), 0, 0, z1 + 0.002));
  g.userData.outline = circlePts(r, 28);
  markPin(g);
  setMM(g, { r, z0, z1 });
  return g;
}
