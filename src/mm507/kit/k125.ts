// 125·126·127번 전용 키트
//  125 복잡한 변형 운동: 크랭크 핀이 달린 민판 기어 3개, 눈 달린 막대, 저울대(세 핀 보), 세로 미끄럼 막대, 세로 홈 안내판
//  126 벨 크랭크 레버: ㄱ자 레버(끝 핀·줄 고리), 되돌림 스프링
//  127 공기 펌프용 랙과 피니언: 세로 랙(+피스톤 막대·피스톤), 펌프 실린더, 랙 등받이 롤러, 양끝 손잡이 레버
// 치수 상수(K125·K126·K127)와 운동식(solve125·bell126·pump127)은 순수 함수라 node 검사 스크립트(shots/_verify/s125.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, glass, paint, rubber, steel, wood } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { meshAngle, spurGear } from './gear';
import { coilSpring } from './gear2';
import { markAnchor, markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1, 양끝 모따기 c) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 36): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 스타디움(양끝 둥근 홈) 다각형 — 두 중심 c0, c1, 반지름 r. 반시계 */
function stadium(c0: V2, c1: V2, r: number, n = 12): V2[] {
  const a = Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a - Math.PI / 2 + (Math.PI * i) / n;
    out.push([c1[0] + r * Math.cos(t), c1[1] + r * Math.sin(t)]);
  }
  for (let i = 0; i <= n; i++) {
    const t = a + Math.PI / 2 + (Math.PI * i) / n;
    out.push([c0[0] + r * Math.cos(t), c0[1] + r * Math.sin(t)]);
  }
  return out;
}

/** 이름 붙은 핀 표식(빈 물체) — 검사 선언 links·joints 가 이름으로 찾는다 */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/** 구간 [lo, hi] 에서 g 의 근(양 끝 부호가 달라야 한다). 60번 이분 — 구동 각만의 함수라 누적 오차가 없다 */
function bisect(g: (x: number) => number, lo: number, hi: number): number {
  let a = g(lo);
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const v = g(mid);
    if (a * v <= 0) hi = mid;
    else {
      lo = mid;
      a = v;
    }
  }
  return (lo + hi) / 2;
}

// ═══════════════════════════ 125 복잡한 변형 운동 ═══════════════════════════

/**
 * 125번 치수. 판화 px 에 0.00648 을 곱해 옮겼다(기어 1 피치 반지름 50px → 0.324).
 * 판화와 다르게 잡은 것: 기어 2·3 크랭크 반지름 0.19(판화 0.227), 아래 저울대 반길이 0.38(판화 0.34),
 * 아래 저울대 가운데 핀의 세로 안내선 XG 0.15(판화의 핀 자리 0.095) — 판화 치수로는 저울대가 버티는 자세가 생겨 계속 돌지 못한다.
 */
export const K125 = {
  /** 모듈 */
  m: 0.036,
  /** 잇수(왼쪽부터) */
  z: [18, 24, 30] as const,
  /** 기어 축 중심(왼쪽부터) */
  G: [[-0.972, 0.85], [-0.216, 0.85], [0.756, 0.85]] as const,
  /** 크랭크 반지름 */
  crank: [0.18, 0.19, 0.19] as const,
  /** 판화 자세(theta = theta0)에서 크랭크 핀의 방향(rad) */
  pose: [161 * DEG, 180 * DEG, 180 * DEG] as const,
  /** 판화 자세가 되는 구동 각(t = 1) */
  theta0: 1.6,
  /** 기어 1 핀 ~ 위 저울대 왼쪽 핀 */
  L1: 1.549,
  /** 기어 2 핀 ~ 아래 저울대 왼쪽 핀 */
  L2: 1.024,
  /** 기어 3 핀 ~ 아래 저울대 오른쪽 핀 */
  L3: 1.005,
  /** 짧은 이음대(위 저울대 오른쪽 핀 ~ 아래 저울대 가운데 핀) */
  Ls: 0.525,
  /** 세로 미끄럼 막대의 x(위 저울대 가운데 핀이 다니는 세로선) */
  XB: -0.423,
  /** 아래 저울대 가운데 핀이 다니는 세로 홈의 x(판화에 없는 안내) */
  XG: 0.15,
  /** 위 저울대: 가운데 핀에서 왼쪽·오른쪽 끝 핀까지 가로 거리, 끝 핀이 가운데 핀보다 낮은 양 */
  uL: 0.44,
  uR: 0.5,
  uE: 0.06,
  /** 아래 저울대: 반길이, 끝 핀이 가운데 핀보다 낮은 양 */
  lH: 0.38,
  lE: 0.03,
  /** 층(z): 기어 가운데, 막대, 저울대, 미끄럼 막대, 홈 안내판 */
  ZG: 0,
  ZR: 0.16,
  ZB: 0.225,
  ZV: 0.285,
  ZS: 0,
  /** 기어 폭, 핀 반지름, 막대·저울대 두께 */
  gearW: 0.1,
  pinR: 0.028,
  thick: 0.04
} as const;

export interface Pose125 {
  /** 기어 세 개의 rotation.z */
  th: [number, number, number];
  /** 크랭크 핀 세 개 */
  pin: [V2, V2, V2];
  /** 아래 저울대: 가운데 핀 C, 기울기 q, 왼쪽·오른쪽 끝 핀 */
  C: V2;
  q: number;
  E2: V2;
  E3: V2;
  /** 위 저울대: 가운데 핀 B(= 미끄럼 막대 핀), 기울기 p, 왼쪽 끝 핀 A, 오른쪽 끝 핀 D */
  B: V2;
  p: number;
  A: V2;
  D: V2;
  /** 막대 각: 기어1 핀→A, 기어2 핀→E2, 기어3 핀→E3, C→D */
  rod: [number, number, number, number];
}

/** 저울대 끝 핀의 자리(가운데 핀 기준): 기울기 q, 가로 sx·len, 아래로 e */
function beamOff(q: number, sx: number, len: number, e: number): V2 {
  return [Math.cos(q) * sx * len + Math.sin(q) * e, Math.sin(q) * sx * len - Math.cos(q) * e];
}

/** 기어 i 의 크랭크 핀이 기어 로컬에서 놓인 각 — 판화 자세(theta0)에서 pose 방향이 되게 */
export function pinBeta125(i: 0 | 1 | 2): number {
  return K125.pose[i] - gearAngles125(K125.theta0)[i];
}

/** 기어 세 개의 rotation.z (기어 1 = theta, 2·3 은 맞물림 위상) */
export function gearAngles125(theta: number): [number, number, number] {
  const G = K125.G;
  const th2 = meshAngle([G[0][0], G[0][1]], K125.z[0], theta, [G[1][0], G[1][1]], K125.z[1]);
  const th3 = meshAngle([G[1][0], G[1][1]], K125.z[1], th2, [G[2][0], G[2][1]], K125.z[2]);
  return [theta, th2, th3];
}

/**
 * 125번 모든 부품의 자세 = 구동 각 theta 만의 함수(이분법 두 번, 앞 프레임 값을 쓰지 않아 누적 없음).
 * 아래 저울대: 가운데 핀이 세로선 XG 위, 두 끝이 막대 L2·L3 로 기어 2·3 핀에. 위 저울대: 가운데 핀이 세로선 XB 위,
 * 왼쪽 끝이 막대 L1 로 기어 1 핀에, 오른쪽 끝이 이음대 Ls 로 아래 저울대 가운데 핀에.
 */
export function solve125(theta: number): Pose125 {
  const K = K125;
  const th = gearAngles125(theta);
  const pin = [0, 1, 2].map((i) => {
    const a = th[i as 0 | 1 | 2] + pinBeta125(i as 0 | 1 | 2);
    return [K.G[i]![0] + K.crank[i]! * Math.cos(a), K.G[i]![1] + K.crank[i]! * Math.sin(a)] as V2;
  }) as [V2, V2, V2];
  const [P1, P2, P3] = pin;
  const Q = 50 * DEG;
  // 아래 저울대
  const ycOf = (q: number): number => {
    const v = beamOff(q, -1, K.lH, K.lE);
    return P2[1] - v[1] + Math.sqrt(Math.max(0, K.L2 * K.L2 - (K.XG + v[0] - P2[0]) ** 2));
  };
  const q = bisect((x) => {
    const v = beamOff(x, 1, K.lH, K.lE);
    return Math.hypot(K.XG + v[0] - P3[0], ycOf(x) + v[1] - P3[1]) - K.L3;
  }, -Q, Q);
  const C: V2 = [K.XG, ycOf(q)];
  const v2 = beamOff(q, -1, K.lH, K.lE);
  const v3 = beamOff(q, 1, K.lH, K.lE);
  const E2: V2 = [C[0] + v2[0], C[1] + v2[1]];
  const E3: V2 = [C[0] + v3[0], C[1] + v3[1]];
  // 위 저울대
  const ybOf = (p: number): number => {
    const v = beamOff(p, -1, K.uL, K.uE);
    return P1[1] - v[1] + Math.sqrt(Math.max(0, K.L1 * K.L1 - (K.XB + v[0] - P1[0]) ** 2));
  };
  // 근이 둘(이음대가 위로 서는 쪽 / 아래로 처지는 쪽)이라, 위에서부터 2° 씩 훑어 처음 부호가 바뀌는 구간(= 이음대가 위로 서는 쪽)만 이분한다
  const gp = (x: number): number => {
    const v = beamOff(x, 1, K.uR, K.uE);
    return Math.hypot(K.XB + v[0] - C[0], ybOf(x) + v[1] - C[1]) - K.Ls;
  };
  let hi = Q;
  let ghi = gp(hi);
  let lo = hi;
  for (let k = 0; k < 50; k++) {
    lo = hi - 2 * DEG;
    const glo = gp(lo);
    if (ghi * glo <= 0) break;
    hi = lo;
    ghi = glo;
  }
  const p = bisect(gp, lo, hi);
  const B: V2 = [K.XB, ybOf(p)];
  const va = beamOff(p, -1, K.uL, K.uE);
  const vd = beamOff(p, 1, K.uR, K.uE);
  const A: V2 = [B[0] + va[0], B[1] + va[1]];
  const D: V2 = [B[0] + vd[0], B[1] + vd[1]];
  const ang = (a: V2, b: V2): number => Math.atan2(b[1] - a[1], b[0] - a[0]);
  return { th, pin, C, q, E2, E3, B, p, A, D, rod: [ang(P1, A), ang(P2, E2), ang(P3, E3), ang(C, D)] };
}

/**
 * 크랭크 핀이 달린 민판 기어(125번). 원점 = 축 중심, 두께 가운데 z = 0(폭 K125.gearW).
 * 핀은 로컬 각 pinBeta125(i), 반지름 K125.crank[i] 에서 앞으로 솟아 막대 층(K125.ZR)을 꿴다.
 * 핀 표식 child 이름 = pinName(막대 층 높이).
 */
export function crankGear125(i: 0 | 1 | 2, pinName: string): THREE.Group {
  const K = K125;
  const g = spurGear(K.z[i], K.m, { width: K.gearW, spokes: 0, driver: i === 0 });
  const b = pinBeta125(i);
  const x = K.crank[i] * Math.cos(b);
  const y = K.crank[i] * Math.sin(b);
  const zr = K.ZR - K.ZG;
  g.add(meshAt(cylZ(K.pinR + 0.016, K.gearW / 2 - 0.004, zr - K.thick / 2 - 0.003), darkSteel(), x, y, 0));
  g.add(meshAt(cylZ(K.pinR, K.gearW / 2, zr + K.thick / 2 + 0.02), steel(), x, y, 0));
  g.add(pinMark(pinName, x, y, zr));
  return g;
}

/** 눈 달린 납작 막대: 원점 = 한쪽 핀 구멍, +X 로 length 떨어진 곳이 다른 쪽. 두께 가운데 z = 0 */
export function eyeBar125(length: number, thick: number = K125.thick): THREE.Group {
  const eyeR = 0.05;
  const g = new THREE.Group();
  g.add(mesh(extrude(stadiumShape(eyeR * 0.9, 0, length - eyeR * 0.9, 0, 0.02), thick * 0.7, 0.004), steel()));
  for (const x of [0, length]) g.add(meshAt(tubeZ(K125.pinR + 0.002, eyeR, -thick / 2, thick / 2, 0.005), steel(), x, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(Math.min(0.3, length * 0.3), 0.01, 0.005), paint(MARK), length * 0.5, 0, thick * 0.35 + 0.002));
  setMM(g, { kind: 'link', length, a: [0, 0, 0], b: [length, 0, 0] });
  return g;
}

export interface Beam125Opts {
  /** 끝 핀 표식 이름 [왼쪽, 오른쪽] */
  names: [string, string];
  /** 가운데 핀을 저울대가 갖는가(아래 저울대). 값 = 뒤로 뻗는 길이(로컬 −z). 없으면 가운데는 구멍만(위 저울대) */
  centerPinBack?: number;
  /** 가운데 핀 표식 이름(막대 층 높이) */
  centerName?: string;
}

/**
 * 저울대(세 핀 보): 원점 = 가운데 핀, 왼쪽 끝 핀 (−aL, −e), 오른쪽 끝 핀 (aR, −e). 두께 가운데 z = 0(저울대 층 K125.ZB 에 둔다).
 * 끝 핀은 뒤(−z)로 내려가 막대 층(K125.ZR)의 눈을 꿴다. 끝 핀 표식은 막대 층 높이.
 * centerPinBack 이 있으면 가운데 핀이 뒤로 뻗어 홈 안내판까지 가고, 그 핀 메시에 userData.outline(원)을 남긴다.
 */
export function beam125(aL: number, aR: number, e: number, o: Beam125Opts): THREE.Group {
  const K = K125;
  const t = K.thick;
  const zr = K.ZR - K.ZB;
  const g = new THREE.Group();
  const body = bronze({ roughness: 0.4 });
  g.add(mesh(extrude(stadiumShape(0, 0, -aL, -e, 0.034), t * 0.8, 0.005), body));
  g.add(mesh(extrude(stadiumShape(0, 0, aR, -e, 0.034), t * 0.8, 0.005), body));
  const ends: V2[] = [[-aL, -e], [aR, -e]];
  ends.forEach(([x, y], k) => {
    g.add(meshAt(cylZ(0.052, -t / 2, t / 2), body, x, y, 0));
    g.add(meshAt(cylZ(K.pinR, zr - t / 2 - 0.02, t / 2 + 0.02), steel(), x, y, 0));
    g.add(pinMark(o.names[k as 0 | 1], x, y, zr));
  });
  if (o.centerPinBack !== undefined) {
    g.add(meshAt(cylZ(0.06, -t / 2, t / 2), body, 0, 0, 0));
    const pin = mesh(cylZ(K.pinR, -o.centerPinBack, t / 2 + 0.02), steel());
    pin.userData.outline = circlePts(K.pinR, 24);
    g.add(pin);
    if (o.centerName) g.add(pinMark(o.centerName, 0, 0, zr));
  } else {
    g.add(mesh(tubeZ(K.pinR + 0.002, 0.065, -t / 2, t / 2, 0.005), body));
  }
  setMM(g, { kind: 'beam', aL, aR, e });
  return g;
}

/**
 * 세로 미끄럼 막대(125번): 원점 = 아래 눈의 핀 중심(= 위 저울대 가운데 핀). 납작한 아래 머리(반폭 0.07, 높이 headH) 위로
 * 둥근 줄기(반지름 stemR)가 stemTop 까지 올라간다. 두께 가운데 z = 0(미끄럼 막대 층 K125.ZV 에 둔다).
 * 핀은 뒤로 내려가 저울대 층(K125.ZB)의 가운데 구멍을 꿴다. 핀 표식 child 이름 'barPin'(저울대 층 높이).
 */
export function slideBar125(stemTop: number, stemR = 0.035, headH = 0.2): THREE.Group {
  const K = K125;
  const t = K.thick;
  const zb = K.ZB - K.ZV;
  const g = new THREE.Group();
  g.add(mesh(extrude(stadiumShape(0, 0, 0, headH - 0.07, 0.07), t, 0.006), steel()));
  g.add(mesh(lathe(rodProfile(stemR, headH - 0.02, stemTop, 0.004, 0.008), 24), steel()));
  g.add(mesh(cylZ(K.pinR, zb - t / 2 - 0.02, t / 2 + 0.02), darkSteel()));
  g.add(meshAt(new THREE.CylinderGeometry(K.pinR * 0.5, K.pinR * 0.5, 0.005, 14).rotateX(Math.PI / 2), paint(MARK), 0, 0, t / 2 + 0.022));
  g.add(pinMark('barPin', 0, 0, zb));
  setMM(g, { kind: 'slider', axis: 'y', stemR, stemTop });
  return g;
}

/**
 * 세로 홈 안내판(125번, 판화에 없음): 원점 = 홈 가운데. 홈은 세로로 ±halfLen(핀 중심이 다니는 범위), 반폭 = 핀 반지름 + 0.004.
 * 판 두께 0.05(가운데 z = 0), 뒤판까지 기둥 2개(back = 판 가운데에서 뒤판 앞면까지 거리).
 * userData.outlines.slotHole = 홈 윤곽(핀이 이 안에 있어야 한다).
 */
export function slotGuide125(halfLen: number, back: number, pinR: number = K125.pinR): THREE.Group {
  const hw = pinR + 0.004;
  const w = 0.11;
  const top = halfLen + hw + 0.07;
  const g = new THREE.Group();
  const shape = stadiumShape(0, -top + w, 0, top - w, w);
  const hole = stadium([0, -halfLen], [0, halfLen], hw, 10);
  shape.holes.push(pathFrom(hole));
  g.add(mesh(extrude(shape, 0.05, 0.005), castIron({ roughness: 0.6 })));
  for (const sx of [-1, 1]) g.add(meshAt(cylZ(0.022, -back, -0.02, 0.004, 16), darkSteel(), sx * (w - 0.035), 0, 0));
  g.userData.outlines = { slotHole: hole };
  setMM(g, { kind: 'guide', axis: 'y', halfLen, hw });
  return g;
}

/**
 * 세로 막대 안내 부시(125번, 판화에 없음): 뒤판에서 나온 팔 끝의 고리. 반환 그룹 원점 = (x, y, 0),
 * 고리 중심 = (x, y, zc), 구멍 축 = Y(세로 막대가 그대로 지나간다), 고리 높이 h. holeR = 막대 반지름.
 */
export function barGuide125(x: number, y: number, zc: number, holeR: number, h = 0.08): THREE.Group {
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

// ═══════════════════════════ 126 벨 크랭크 레버 ═══════════════════════════

/** 126번 치수(판화 px × 0.00625: 줄 중심 반지름 64px → 0.40, 가로 팔 146px → 0.91, 세로 팔 121px → 0.76) */
export const K126 = {
  /** 풀리 축 중심 */
  C: [-1.125, 2.45] as const,
  /** pulley() 에 넣는 반지름(줄 중심 반지름 = r + 0.01) */
  r: 0.39,
  /** 줄 중심 반지름 */
  Rr: 0.4,
  /** 벨 크랭크 받침점(고정 핀) */
  P: [0.185, 1.39] as const,
  /** 가로 팔(받침점 ~ 줄 핀 A), 세로 팔(받침점 ~ 줄 핀 B) */
  a: 0.91,
  b: 0.76,
  /** 흔들림 진폭 */
  PHI: 15 * DEG,
  /** 스프링 고정 못 */
  S: [1.52, 0.63] as const,
  /** 가로 줄 길이(핀 B ~ 스프링 고리) */
  cord: 0.6,
  /** 판화 자세(레버가 반듯한 때)에서 왼쪽 가닥 끝(손잡이)의 높이 */
  yL0: 1.47,
  /** 판화 자세가 되는 구동 각(t = 1) */
  theta0: 1.6,
  /** 층(z): 풀리·줄, 레버 판 */
  ZP: 0.1,
  ZL: -0.02,
  /** 레버 두께, 핀 반지름 */
  thick: 0.06,
  pinR: 0.03
} as const;

export interface Pose126 {
  /** 레버 각(반시계 +). 0 = 판화 자세(가로 팔 수평) */
  phi: number;
  /** 줄 핀 A(가로 팔 끝), B(세로 팔 끝) */
  A: V2;
  B: V2;
  /** 왼쪽 가닥 끝(손잡이) 높이 — x 는 C.x − Rr */
  yL: number;
  /** 풀리 rotation.z (줄이 미끄러지지 않는다) */
  pulley: number;
  /** 가로 줄의 스프링 쪽 끝(스프링 고리) */
  H: V2;
  /** 스프링 길이(고정 못 S ~ 고리 H)와 방향(S 에서 H 로) */
  springLen: number;
  springAngle: number;
  /** 풀리에 감긴 각(도) */
  wrapDeg: number;
}

/** 줄 길이: 손잡이 → 풀리 왼쪽 접점 + 감긴 호 + 오른쪽 접점 → 핀 A. 판화 자세에서 정해지는 상수 */
function ropeLen126(): number {
  const K = K126;
  const h = K.C[1] - K.P[1];
  return K.C[1] - K.yL0 + K.Rr * Math.PI + h;
}

/** 126번 모든 부품의 자세 = 구동 각 theta 의 닫힌 식. phi = −PHI·sin(theta − theta0) — 손잡이를 당길 때(−) 핀 A 가 올라간다 */
export function bell126(theta: number): Pose126 {
  const K = K126;
  const phi = -K.PHI * Math.sin(theta - K.theta0);
  const A: V2 = [K.P[0] - K.a * Math.cos(phi), K.P[1] - K.a * Math.sin(phi)];
  const B: V2 = [K.P[0] + K.b * Math.sin(phi), K.P[1] - K.b * Math.cos(phi)];
  // 풀리 오른쪽 접점: 중심에서 본 각 at = ∠(A − C) + acos(Rr/d). A 가 접점 바로 아래면 0
  const dx = A[0] - K.C[0];
  const dy = A[1] - K.C[1];
  const d = Math.hypot(dx, dy);
  const at = Math.atan2(dy, dx) + Math.acos(K.Rr / d);
  const wrap = Math.PI - at;
  const yL = K.C[1] - (ropeLen126() - K.Rr * wrap - Math.sqrt(d * d - K.Rr * K.Rr));
  const sx = B[0] - K.S[0];
  const sy = B[1] - K.S[1];
  const sd = Math.hypot(sx, sy);
  const springLen = sd - K.cord;
  const H: V2 = [K.S[0] + (sx / sd) * springLen, K.S[1] + (sy / sd) * springLen];
  return { phi, A, B, yL, pulley: (K.yL0 - yL) / K.Rr, H, springLen, springAngle: Math.atan2(sy, sx), wrapDeg: wrap / DEG };
}

/**
 * 벨 크랭크(ㄱ자 레버, 126번): 원점 = 받침점(고정 핀 구멍, 반지름 bore). 가로 팔은 −X 로 a, 세로 팔은 −Y 로 b.
 * 두께 가운데 z = 0(레버 층 K126.ZL 에 둔다). 두 팔 끝의 핀이 앞으로 솟아 줄 층(K126.ZP)까지 가고,
 * 핀마다 줄 고리(핀 축 둘레 토러스)가 걸려 있다. 핀 표식 child 이름 'pinA'(가로 팔), 'pinB'(세로 팔) — 줄 층 높이, 줄 끝이 붙는 자리.
 */
export function bellCrank126(a: number = K126.a, b: number = K126.b, bore = 0.042): THREE.Group {
  const K = K126;
  const t = K.thick;
  const zp = K.ZP - K.ZL;
  const g = new THREE.Group();
  const body = castIron({ roughness: 0.5 });
  g.add(mesh(extrude(stadiumShape(-0.06, 0, -a, 0, 0.04), t * 0.8, 0.006), body));
  g.add(mesh(extrude(stadiumShape(0, -0.06, 0, -b, 0.04), t * 0.8, 0.006), body));
  g.add(mesh(tubeZ(bore, 0.095, -t / 2 - 0.01, t / 2 + 0.01, 0.006), body));
  const ropeMat = rubber().clone();
  ropeMat.color.set(0x8a6a3a);
  const ends: [string, number, number][] = [['pinA', -a, 0], ['pinB', 0, -b]];
  for (const [name, x, y] of ends) {
    g.add(meshAt(cylZ(0.062, -t / 2, t / 2), body, x, y, 0));
    g.add(meshAt(cylZ(K.pinR, t / 2 - 0.005, zp + 0.07), steel(), x, y, 0));
    g.add(meshAt(cylZ(K.pinR + 0.018, zp + 0.05, zp + 0.07, 0.004), darkSteel(), x, y, 0));
    g.add(meshAt(new THREE.TorusGeometry(K.pinR + 0.03, 0.03, 10, 28), ropeMat, x, y, zp));
    const mk = pinMark(name, x, y, zp);
    markAnchor(mk, [0, 0, 0], { of: 'bellCrank126' });
    g.add(mk);
  }
  g.add(meshAt(new THREE.BoxGeometry(a * 0.3, 0.012, 0.006), paint(MARK), -a * 0.5, 0, t * 0.4 + 0.002));
  setMM(g, { kind: 'lever', a, b, bore });
  return g;
}

/**
 * 되돌림 스프링(126번, 판화에 없음): 원점 = 고정 못 중심, +X 로 len 떨어진 곳이 줄이 묶이는 고리(표식 child 이름 'springEye').
 * 양끝 고리(토러스) 사이를 코일이 채운다. 길이는 setSpring126 으로 바꾼다.
 */
export function pullSpring126(len: number, radius = 0.05): THREE.Group {
  const g = new THREE.Group();
  const coil = coilSpring(radius, 0.011, 9);
  coil.name = 'coil';
  g.add(coil);
  const fixedEye = meshAt(new THREE.TorusGeometry(0.04, 0.011, 8, 24), steel(), 0, 0, 0);
  g.add(fixedEye);
  const eye = new THREE.Group();
  eye.name = 'springEyeRing';
  eye.add(mesh(new THREE.TorusGeometry(0.04, 0.011, 8, 24), steel()));
  g.add(eye);
  const mk = pinMark('springEye', 0, 0, 0);
  markAnchor(mk, [0, 0, 0], { of: 'pullSpring126' });
  g.add(mk);
  setMM(g, { kind: 'pullSpring', radius });
  setSpring126(g, len);
  return g;
}

/** pullSpring126 의 길이를 len 으로(코일 x 0.05 ~ len − 0.05, 고리와 표식은 x = len) */
export function setSpring126(g: THREE.Group, len: number): void {
  const coil = g.getObjectByName('coil');
  const eye = g.getObjectByName('springEyeRing');
  const mk = g.getObjectByName('springEye');
  if (coil) {
    coil.position.x = 0.05;
    coil.scale.x = Math.max(0.05, len - 0.1);
  }
  if (eye) eye.position.x = len;
  if (mk) mk.position.x = len;
}

// ═══════════════════════════ 127 공기 펌프용 랙과 피니언 ═══════════════════════════

/** 127번 치수(판화: 피니언 18잇수 피치 반지름 69px → 0.405, 랙 13잇수, 레버 반길이 약 3.2 × 피치 반지름) */
export const K127 = {
  m: 0.045,
  /** 피니언 잇수, 랙 잇수 */
  z: 18,
  n: 13,
  /** 피니언 축 중심 */
  C: [0, 2.0] as const,
  /** 레버 흔들림 진폭 */
  PHI: 30 * DEG,
  /** 판화 자세(t = 1, theta = theta0)의 레버 각 — 시계 방향 24.3° */
  pose: -24.3 * DEG,
  theta0: 1.6,
  /** 레버 반길이(축 ~ 손잡이 공) */
  lever: 1.3,
  /** 랙 몸통 두께(이뿌리에서 등까지), 랙 폭(z), 피니언 폭 */
  bodyT: 0.13,
  rackW: 0.1,
  gearW: 0.12,
  /** 피스톤 막대 길이(랙 아래 끝 ~ 피스톤 윗면), 막대 반지름, 피스톤 반지름·두께 */
  stem: 0.57,
  stemR: 0.03,
  pistonR: 0.145,
  pistonT: 0.05,
  /** 실린더: 안 반지름, 바깥 반지름, 바닥 y, 뚜껑 아랫면 y, 뚜껑 윗면 y */
  cylIn: 0.15,
  cylOut: 0.17,
  cylY0: 0.18,
  capY0: 0.74,
  capY1: 0.8,
  /** 등받이 롤러 반지름, 축에서 위아래 거리 */
  rollerR: 0.07,
  rollerDy: 0.5,
  /** 층(z): 피니언·랙, 레버 */
  ZG: 0,
  ZLv: -0.16
} as const;

/** 랙 피치선의 x 거리(= 피니언 피치 반지름) */
export function rp127(): number {
  return (K127.z * K127.m) / 2;
}

/** 랙 한 개의 피스톤 막대 중심선이 피치선에서 떨어진 거리(등 쪽으로) */
export function stemOff127(): number {
  return 1.25 * K127.m + K127.bodyT / 2;
}

export interface Pose127 {
  /** 피니언·레버 rotation.z (반시계 +) */
  phi: number;
  /** 왼쪽·오른쪽 랙 원점(가운데 이의 중심)의 y */
  yL: number;
  yR: number;
}

/**
 * 127번 자세 = 구동 각의 닫힌 식. phi = PHI·sin(theta − theta0 + asin(pose/PHI)) → t = 1 에서 판화 자세(−24.3°).
 * 피니언이 반시계로 phi 돌면 왼쪽 랙은 rp·phi 내려가고 오른쪽 랙은 그만큼 올라간다.
 * phi = 0 에서 피니언 이골이 정확히 좌우(0°·180°)를 향하고 두 랙의 가운데 이가 축 높이에 온다.
 */
export function pump127(theta: number): Pose127 {
  const K = K127;
  const phi = K.PHI * Math.sin(theta - K.theta0 + Math.asin(K.pose / K.PHI));
  const rp = rp127();
  return { phi, yL: K.C[1] - rp * phi, yR: K.C[1] + rp * phi };
}

/** 랙 윤곽(로컬): 피치선 x = 0, 이는 side·(+X) 쪽으로 뻗는다. 가운데 이의 중심 = 원점, 이 j 의 중심 y = (j − (n−1)/2)·π·m */
export function rackOutline127(side: 1 | -1, n: number = K127.n, m: number = K127.m, bodyT: number = K127.bodyT): V2[] {
  const pc = Math.PI * m;
  const t0 = 0.46 * pc;
  const ta = Math.tan(20 * DEG);
  const half = (x: number): number => t0 / 2 - x * ta;
  const xr = -1.25 * m;
  const xt = m;
  const y0 = (-n * pc) / 2;
  const pts: V2[] = [[xr - bodyT, y0], [xr, y0]];
  for (let j = 0; j < n; j++) {
    const yc = (j - (n - 1) / 2) * pc;
    pts.push([xr, yc - half(xr)], [xt, yc - half(xt)], [xt, yc + half(xt)], [xr, yc + half(xr)]);
  }
  pts.push([xr, -y0], [xr - bodyT, -y0]);
  if (side === 1) return pts;
  return pts.map(([x, y]) => [-x, y] as V2).reverse();
}

/**
 * 세로 랙 + 피스톤 막대 + 피스톤(127번). 원점 = 피치선 위 가운데 이의 중심, 이는 side·(+X) 쪽(왼쪽 랙 side = 1, 오른쪽 랙 side = −1).
 * 폭 가운데 z = 0. 20° 직선 이(피치선 이 두께 0.46 피치) — spurGear 인벌류트와 물린다(shots/_verify/s127.mjs 침범 0).
 * 랙 메시에 userData.outline. 아래 끝에서 막대가 stem 만큼 내려가고 그 밑에 피스톤(표식 child 이름 'piston' = 피스톤 윗면 가운데).
 */
export function rack127(side: 1 | -1): THREE.Group {
  const K = K127;
  const g = new THREE.Group();
  const outline = rackOutline127(side);
  const body = mesh(extrude(shapeFrom(outline), K.rackW, 0.004, 4), brass());
  body.userData.outline = outline;
  g.add(body);
  const pc = Math.PI * K.m;
  const yb = (-K.n * pc) / 2;
  const sx = -side * stemOff127();
  g.add(meshAt(lathe(rodProfile(K.stemR, yb - K.stem, yb + 0.01, 0.003, 0.003), 20), steel(), sx, 0, 0));
  g.add(meshAt(lathe(rodProfile(K.pistonR, yb - K.stem - K.pistonT, yb - K.stem, 0.006, 0.006), 36), darkSteel(), sx, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.012, pc * 3, 0.005), paint(MARK), -side * (1.25 * K.m + K.bodyT * 0.5), 0, K.rackW / 2 + 0.002));
  g.add(pinMark('piston', sx, yb - K.stem, 0));
  setMM(g, { kind: 'rack', teeth: K.n, module: K.m, side, axis: 'y', width: K.rackW });
  return g;
}

/**
 * 펌프 실린더(127번, 판화에 없음 — 원문의 "펌프 피스톤"을 보이게): 원점 = 바닥 가운데(받침대 윗면에 세운다), 축 = Y.
 * 바닥판 + 유리 통 + 가운데 구멍(막대 안내) 뚫린 뚜껑. 높이는 K127.capY1 − K127.cylY0.
 */
export function pumpCylinder127(): THREE.Group {
  const K = K127;
  const h0 = 0.02;
  const capB = K.capY0 - K.cylY0;
  const capT = K.capY1 - K.cylY0;
  const g = new THREE.Group();
  g.add(mesh(lathe(rodProfile(K.cylOut + 0.03, 0, h0, 0.004, 0.004), 40), castIron()));
  g.add(mesh(lathe(tubeProfile(K.cylIn, K.cylOut, h0, capB, 0), 48), glass()));
  g.add(mesh(lathe(tubeProfile(K.stemR + 0.004, K.cylOut + 0.015, capB, capT, 0.006), 40), castIron()));
  setMM(g, { kind: 'cylinder', axis: 'y', rIn: K.cylIn, rOut: K.cylOut, h: capT });
  return g;
}

/**
 * 랙 등받이 롤러(127번, 판화에 없음): 원점 = 롤러 중심(랙 층에 둔다), 회전축 = Z. 뒤판까지 가는 굴대(back = 원점에서 뒤판 앞면까지 거리).
 */
export function backRoller127(back: number, r: number = K127.rollerR, w = 0.08): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(tubeZ(0.024, r, -w / 2, w / 2, 0.006), steel()));
  g.add(mesh(cylZ(0.022, -back, w / 2 + 0.02, 0.004, 16), darkSteel()));
  g.add(meshAt(cylZ(0.04, w / 2 + 0.004, w / 2 + 0.02, 0.004, 16), darkSteel(), 0, 0, 0));
  setMM(g, { kind: 'roller', r, width: w, axis: 'z' });
  return g;
}

/**
 * 양끝 손잡이 레버(127번): 원점 = 축 중심, ±X 로 half 까지 둥근 막대, 양 끝에 나무 공 손잡이. 가운데 허브(구멍 bore, z ±0.04).
 * 손잡이 표식 child 이름 'knobL'(−X 끝), 'knobR'(+X 끝).
 */
export function handLever127(half: number = K127.lever, bore = 0.056): THREE.Group {
  const g = new THREE.Group();
  const bar = lathe(rodProfile(0.025, -half, half, 0.004, 0.004), 20);
  bar.rotateZ(Math.PI / 2);
  g.add(mesh(bar, steel()));
  g.add(mesh(tubeZ(bore, bore + 0.04, -0.04, 0.04, 0.006), darkSteel()));
  for (const s of [-1, 1]) {
    g.add(meshAt(new THREE.SphereGeometry(0.06, 20, 14), wood(), s * half, 0, 0));
    g.add(pinMark(s < 0 ? 'knobL' : 'knobR', s * half, 0, 0));
  }
  setMM(g, { kind: 'lever', half, bore });
  return g;
}
