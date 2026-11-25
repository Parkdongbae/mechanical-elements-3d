// 140·141·142번 전용 키트
//  140 토글 조인트 펀칭기: 프레임(기둥·옆판·안내 레일), 램(펀치 슬라이드), ㄱ자 레버, 무릎 핀, 운동식
//  141 띠톱: C 자 주물 기둥, 톱 테이블(받침 기둥·곡선 받침 포함)
//  142 이송 거리 가변 장치: 원판(기어 스터드 포함), 크랭크 막대, 운동식
// 치수 상수(K140·K141·K142)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s140.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, annularSector, circlePath, circlePts, extrude, hexPrism, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
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

/** 네모 윤곽(반시계) */
function rectPts(x0: number, y0: number, x1: number, y1: number): V2[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ];
}

/** 핀 표식(빈 Object3D) */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

// ═══════════════════════════ 140 토글 조인트 펀칭기 ═══════════════════════════

/** 판화(4배 확대) 픽셀 → 전시 좌표. 1px = 0.0019, 바닥선 1600px = y 0.18 */
function w140(px: number, py: number): V2 {
  return [(px - 1400) * 0.0019, 0.18 + (1600 - py) * 0.0019];
}

/** 140번 치수(판화 비 그대로). 좌표는 전시 좌표(x, y) */
export const K140 = {
  /** 위 고정 핀 A(프레임 옆판) */
  A: [-0.58, 2.66] as V2,
  /** 레버 받침 핀 O(기둥 꼭대기) */
  O: [-0.1, 1.9] as V2,
  /** 토글 위·아래 링크 길이(핀 사이) */
  link: 0.74,
  /** 판화 자세의 무릎 치우침(무릎 핀이 A–램 핀 세로선에서 왼쪽으로 벗어난 거리) */
  off0: 0.39,
  /** 레버 짧은 팔 길이(O ~ 가로 링크 핀 P) */
  arm: 0.224,
  /** 판화 자세에서 짧은 팔의 방향각(rad) — 왼쪽 위 143.6° */
  beta0: 143.6 * DEG,
  /** 레버 손잡이 길이(O ~ 끝) */
  handle: 1.265,
  /** 판화 자세에서 손잡이의 방향각(rad) — 오른쪽 위 22.5° */
  handle0: 22.5 * DEG,
  /** 손잡이를 내리는 각(rad) — 한 번 누르는 흔들림 폭 */
  swing: 75 * DEG,
  /** 램 몸통 폭·높이, 램 핀에서 몸통 윗면까지 */
  ramW: 0.17,
  ramH: 0.33,
  ramNeck: 0.086,
  /** 램 핀에서 펀치 끝까지 */
  punchTip: 0.675,
  /** 안내 레일과 램 사이 틈(좌우 각각) */
  clear: 0.003,
  /** 안내 레일의 세로 범위 */
  railY: [0.72, 1.37] as V2,
  /** 층(z 가운데): 위 링크, 아래 링크·레버, 가로 링크 */
  zUp: 0.045,
  zLow: 0.105,
  zBar: 0.165
} as const;

/** 가로 링크 길이(무릎 핀 ~ 짧은 팔 핀) — 판화 자세에서 정해진다 */
export function barLen140(): number {
  const k = knee140(K140.off0);
  const p = armPin140(K140.beta0);
  return Math.hypot(k[0] - p[0], k[1] - p[1]);
}

function knee140(off: number): V2 {
  return [K140.A[0] - off, K140.A[1] - Math.sqrt(K140.link * K140.link - off * off)];
}
function armPin140(beta: number): V2 {
  return [K140.O[0] + K140.arm * Math.cos(beta), K140.O[1] + K140.arm * Math.sin(beta)];
}

export interface Toggle140 {
  /** 0(판화 자세 = 손잡이 올림) ~ 1(손잡이 다 내림) */
  u: number;
  /** 레버 그룹의 rotation.z (손잡이 방향각) */
  lever: number;
  /** 짧은 팔 핀 P */
  P: V2;
  /** 무릎 핀 K */
  K: V2;
  /** 램 핀 S */
  S: V2;
  /** 무릎 치우침(0 이면 일직선) */
  off: number;
  /** 위 링크(A → K), 아래 링크(K → S), 가로 링크(K → P)의 방향각 */
  upAng: number;
  lowAng: number;
  barAng: number;
  /** 판화 자세에서 램이 내려간 거리 */
  drop: number;
}

/**
 * 140번 운동식. theta = 구동 누적각. t = 1(theta = 1.6)이 판화 자세(손잡이 올림), 반 주기 뒤가 다 내린 자세.
 * 레버 각 → 짧은 팔 핀 P → 무릎 K(A 둘레 원과 P 둘레 원의 왼쪽 교점) → 램 핀 S(A 의 세로선 위).
 */
export function toggle140(theta: number): Toggle140 {
  const u = (1 - Math.cos(theta - 1.6)) / 2;
  const turn = K140.swing * u;
  const P = armPin140(K140.beta0 - turn);
  const A = K140.A;
  const L = K140.link;
  const Lb = barLen140();
  const dx = P[0] - A[0];
  const dy = P[1] - A[1];
  const d = Math.hypot(dx, dy);
  const a = (L * L - Lb * Lb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L * L - a * a));
  // A→P 의 오른쪽(아래·왼쪽) 교점이 무릎
  const K: V2 = [A[0] + (a * dx) / d + (h * dy) / d, A[1] + (a * dy) / d - (h * dx) / d];
  const off = A[0] - K[0];
  const S: V2 = [A[0], K[1] - Math.sqrt(L * L - off * off)];
  const S0 = A[1] - 2 * Math.sqrt(L * L - K140.off0 * K140.off0);
  return {
    u,
    lever: K140.handle0 - turn,
    P,
    K,
    S,
    off,
    upAng: Math.atan2(K[1] - A[1], K[0] - A[0]),
    lowAng: Math.atan2(S[1] - K[1], S[0] - K[0]),
    barAng: Math.atan2(P[1] - K[1], P[0] - K[0]),
    drop: S0 - S[1]
  };
}

/**
 * 펀칭기 프레임(140번, 고정): 받침판 + 기둥 + 옆판(위 고정 핀 A, 램 안내 레일) + 뒤 보강 살 + 레버 받침 핀 O.
 * 좌표는 전시 좌표 그대로(그룹 원점 = 전시 원점). 몸통 z −0.20 ~ 0, 레일·핀은 앞으로.
 * child 'pinA'(위 링크 평면), 'pivotO'. userData.outlines.slot = 램 몸통이 다니는 레일 사이 네모(구멍 윤곽).
 */
export function pressFrame140(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.6 });
  // 받침판 + 기둥 + 옆판을 한 덩어리 윤곽으로
  const body: V2[] = [
    w140(800, 1600),
    w140(1800, 1600),
    w140(1800, 1480),
    w140(1400, 1480),
    w140(1335, 1440),
    w140(1310, 1380),
    w140(1310, 890),
    w140(1355, 890),
    w140(1355, 470),
    w140(1230, 470),
    w140(1160, 410),
    w140(1160, 190),
    w140(1020, 190),
    w140(1030, 1320),
    w140(1215, 1320),
    w140(1215, 1400),
    w140(1150, 1465),
    w140(1050, 1480),
    w140(800, 1480)
  ];
  g.add(meshAt(extrude(shapeFrom(body), 0.2, 0.008), iron, 0, 0, -0.1));
  // 뒤 보강 살(얇은 판)
  const web: V2[] = [
    w140(1310, 1380),
    w140(1310, 890),
    w140(1355, 810),
    w140(1450, 900),
    w140(1560, 1010),
    w140(1590, 1150),
    w140(1600, 1300),
    w140(1680, 1420),
    w140(1790, 1480),
    w140(1400, 1480)
  ];
  g.add(meshAt(extrude(shapeFrom(web), 0.07, 0.006), castIron({ roughness: 0.7 }), 0, 0, -0.1));
  // 레버 받침 귀(보스) + 받침 핀
  const [ox, oy] = K140.O;
  g.add(meshAt(cylZ(0.085, -0.2, 0.0, 0.008, 40), iron, ox, oy, 0));
  g.add(meshAt(cylZ(0.055, 0.0, 0.078, 0.006), darkSteel(), ox, oy, 0));
  g.add(meshAt(cylZ(0.036, 0.0, 0.145, 0.006), steel(), ox, oy, 0));
  g.add(pinMark('pivotO', ox, oy, K140.zLow));
  // 위 고정 핀 A
  const [ax, ay] = K140.A;
  g.add(meshAt(cylZ(0.05, 0.0, 0.018, 0.004), darkSteel(), ax, ay, 0));
  g.add(meshAt(cylZ(0.028, 0.0, 0.085, 0.005), steel(), ax, ay, 0));
  g.add(pinMark('pinA', ax, ay, K140.zUp));
  // 램 안내 레일 두 줄(옆판 앞면 z 0 ~ 0.07)
  const half = K140.ramW / 2 + K140.clear;
  const [y0, y1] = K140.railY;
  const railW = 0.036;
  for (const s of [-1, 1]) {
    const xa = ax + s * half;
    const xb = ax + s * (half + railW);
    g.add(meshAt(extrude(shapeFrom(rectPts(Math.min(xa, xb), y0, Math.max(xa, xb), y1)), 0.07, 0.005), darkSteel(), 0, 0, 0.035));
  }
  g.userData.outlines = { slot: rectPts(ax - half, y0, ax + half, y1) };
  setMM(g, { kind: 'frame', fn: 'pressFrame140' });
  return g;
}

/**
 * 램(펀치 슬라이드, 140번): 원점 = 램 핀 S 중심, 뒷면 z = 0(옆판 앞면에 닿음), 몸통 두께 0.08.
 * 몸통(레일 사이를 미끄럼) + 위 귀·핀 + 아래 펀치 물림쇠·펀치. child 'ramPin'(아래 링크 평면). 몸통 메시에 userData.outline.
 */
export function pressRam140(): THREE.Group {
  const g = new THREE.Group();
  const hw = K140.ramW / 2;
  const top = -K140.ramNeck;
  const bot = top - K140.ramH;
  const rect = rectPts(-hw, bot, hw, top);
  const body = meshAt(extrude(shapeFrom(rect), 0.08, 0.006), bronze({ roughness: 0.38 }), 0, 0, 0.04);
  body.userData.outline = rect;
  g.add(body);
  // 귀(목 + 눈)
  g.add(meshAt(extrude(shapeFrom(rectPts(-0.035, top - 0.01, 0.035, 0)), 0.075, 0.004), bronze({ roughness: 0.38 }), 0, 0, 0.0375));
  g.add(mesh(cylZ(0.05, 0.0, 0.078, 0.005, 32), bronze({ roughness: 0.38 })));
  g.add(mesh(cylZ(0.028, 0.0, 0.14, 0.005), steel()));
  g.add(meshAt(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), 0, 0, 0.142));
  // 몸통 가운데의 펀치 대(판화의 빗금 띠) — 앞면에 얕게
  g.add(meshAt(new THREE.BoxGeometry(0.04, K140.ramH - 0.02, 0.012), darkSteel(), 0, (top + bot) / 2, 0.082));
  // 물림쇠 + 펀치
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.034, 0.05), darkSteel(), 0, bot - 0.015, 0.04));
  g.add(meshAt(new THREE.BoxGeometry(0.13, 0.066, 0.07), darkSteel(), 0, bot - 0.063, 0.04));
  const tip = -K140.punchTip;
  const punchTop = bot - 0.096;
  const pg = lathe(rodProfile(0.036, tip, punchTop, 0.012, 0), 24);
  g.add(meshAt(pg, steel(), 0, 0, 0.04));
  g.add(pinMark('ramPin', 0, 0, K140.zLow));
  setMM(g, { kind: 'slider', axis: 'y', w: K140.ramW, h: K140.ramH });
  return g;
}

/**
 * ㄱ자 레버(140번): 원점 = 받침 핀 O, 긴 손잡이가 로컬 +X 로 K140.handle, 짧은 팔이 로컬 (beta0 − handle0) 방향으로 K140.arm.
 * 두께 0.05(가운데 z = 0). 짧은 팔 끝에 가로 링크를 꿰는 핀. child 'leverPin'(가로 링크 평면, 로컬 z = zBar − zLow).
 */
export function toggleLever140(): THREE.Group {
  const g = new THREE.Group();
  const st = steel();
  const ga = K140.beta0 - K140.handle0;
  const px = K140.arm * Math.cos(ga);
  const py = K140.arm * Math.sin(ga);
  // 손잡이: 뿌리 반폭 0.045 → 끝 0.03 인 사다리꼴 막대
  const L = K140.handle;
  const bar: V2[] = [
    [0, -0.045],
    [L - 0.16, -0.03],
    [L - 0.16, 0.03],
    [0, 0.045]
  ];
  g.add(mesh(extrude(shapeFrom(bar), 0.05, 0.006), st));
  // 손잡이 끝의 둥근 자루
  const grip = lathe(rodProfile(0.036, 0, 0.2, 0.01, 0.014), 24);
  grip.rotateZ(-Math.PI / 2);
  g.add(meshAt(grip, wood(), L - 0.2, 0, 0));
  // 짧은 팔 + 허브
  g.add(mesh(extrude(stadiumShape(0, 0, px, py, 0.04), 0.05, 0.006), st));
  g.add(mesh(tubeZ(0.037, 0.075, -0.025, 0.025, 0.006), darkSteel()));
  g.add(meshAt(tubeZ(0.028, 0.05, -0.025, 0.025, 0.005), darkSteel(), px, py, 0));
  // 짧은 팔 핀(가로 링크를 꿴다)
  const dz = K140.zBar - K140.zLow;
  g.add(meshAt(cylZ(0.028, -0.025, dz + 0.035, 0.005), steel(), px, py, 0));
  g.add(meshAt(new THREE.BoxGeometry(L * 0.25, 0.012, 0.006), paint(MARK), L * 0.5, 0, 0.027));
  g.add(pinMark('leverPin', px, py, dz));
  setMM(g, { kind: 'lever', length: L, pivot: [0, 0, 0], tip: [L, 0, 0] });
  return g;
}

/** 무릎 핀(140번): 세 링크를 꿰는 핀. 원점 = 핀 축, 로컬 z 0.015 ~ 0.2. 이름 'knee'(표식 z = zLow) */
export function kneePin140(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.028, 0.015, 0.2, 0.005), steel()));
  g.add(meshAt(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), 0, 0, 0.202));
  g.name = 'knee';
  markPin(g, [0, 0, K140.zLow]);
  return g;
}

// ═══════════════════════════ 141 띠톱 ═══════════════════════════

/** 판화(4배 확대) 픽셀 → 전시 좌표. 1px = 0.0017, 바닥선 1650px = y 0.18 */
function w141(px: number, py: number): V2 {
  return [(px - 950) * 0.0017, 0.18 + (1650 - py) * 0.0017];
}

/** 141번 치수(판화 비) */
export const K141 = {
  /** 두 바퀴 축의 x, 위·아래 바퀴 축의 y */
  x: 0.23,
  yU: 2.62,
  yL: 0.71,
  /** 바퀴 반지름·폭 */
  r: 0.3,
  width: 0.1,
  /** 톱날 띠 두께·폭 */
  bandT: 0.014,
  bandW: 0.07,
  /** 바퀴·톱날의 가운데 평면 z */
  z: 0.12,
  /** 테이블: x 범위, 윗면·아랫면 y, z 범위 */
  tableX: [-0.15, 1.38] as V2,
  tableY: [1.06, 1.11] as V2,
  tableZ: [-0.06, 0.42] as V2,
  /** 테이블 받침 기둥의 x, z */
  postX: 0.69,
  postZ: 0.18
} as const;

/**
 * 띠톱 주물 기둥(141번, 고정): 받침판 + 왼쪽으로 퍼진 C 자 기둥 + 위 팔(위 바퀴 축 자리) + 아래 팔(아래 바퀴 축 자리).
 * 좌표는 전시 좌표 그대로. 기둥 판 z −0.19 ~ −0.09(바퀴 뒤), 축 구멍 둘(반지름 0.06).
 */
export function sawFrame141(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.62 });
  const pts: V2[] = [
    w141(150, 1610),
    w141(330, 1400),
    w141(450, 1000),
    w141(520, 600),
    w141(640, 330),
    w141(780, 170),
    w141(880, 60),
    w141(1000, 45),
    w141(1100, 110),
    w141(1150, 215),
    w141(1100, 310),
    w141(1000, 400),
    w141(900, 430),
    w141(830, 500),
    w141(800, 620),
    w141(795, 1275),
    w141(1085, 1275),
    w141(1150, 1340),
    w141(1085, 1405),
    w141(800, 1405),
    w141(805, 1610)
  ];
  const s = shapeFrom(pts);
  s.holes.push(circlePath(K141.x, K141.yU, 0.06), circlePath(K141.x, K141.yL, 0.06));
  g.add(meshAt(extrude(s, 0.1, 0.008), iron, 0, 0, -0.14));
  // 받침판(바닥 위)
  const [bx0] = w141(140, 0);
  const [bx1] = w141(1500, 0);
  const base = new THREE.BoxGeometry(bx1 - bx0, 0.07, 0.66);
  g.add(meshAt(base, castIron({ roughness: 0.7 }), (bx0 + bx1) / 2, 0.215, 0.1));
  setMM(g, { kind: 'frame', fn: 'sawFrame141' });
  return g;
}

/**
 * 톱 테이블(141번, 고정): 톱날 두 가닥이 지나는 긴 구멍 둘이 뚫린 판 + 받침 기둥 + 곡선 받침(판화의 오른쪽 호).
 * 좌표는 전시 좌표 그대로. slotXs = 톱날 가닥의 x(구멍 가운데).
 */
export function sawTable141(slotXs: number[]): THREE.Group {
  const g = new THREE.Group();
  const [x0, x1] = K141.tableX;
  const [y0, y1] = K141.tableY;
  const [z0, z1] = K141.tableZ;
  // 판: (x, z) 평면 윤곽을 y 로 압출
  const s = shapeFrom(rectPts(x0, z0, x1, z1));
  for (const sx of slotXs) s.holes.push(pathFrom(rectPts(sx - 0.03, K141.z - 0.07, sx + 0.03, K141.z + 0.07).reverse()));
  const plate = extrude(s, y1 - y0, 0.006);
  plate.rotateX(Math.PI / 2); // 윤곽 (x, z) → 전시 (x, ∓두께, z)
  g.add(meshAt(plate, castIron({ roughness: 0.5 }), 0, (y0 + y1) / 2, 0));
  // 받침 기둥(받침판 윗면 0.25 → 테이블 아랫면)
  const post = lathe(
    [
      [0, 0.25],
      [0.12, 0.25],
      [0.12, 0.29],
      [0.085, 0.34],
      [0.075, 0.8],
      [0.1, 0.94],
      [0.1, y0],
      [0, y0]
    ],
    32
  );
  g.add(meshAt(post, castIron({ roughness: 0.6 }), K141.postX, 0, K141.postZ));
  // 곡선 받침: 기둥 오른쪽 아래에서 테이블 오른쪽 끝 밑으로 올라가는 1/4 호
  const rib = extrude(annularSector(0.47, 0.52, -Math.PI / 2, 0), 0.05, 0.006);
  g.add(meshAt(rib, castIron({ roughness: 0.6 }), K141.postX + 0.03, y0 + 0.005, K141.postZ));
  setMM(g, { kind: 'table', fn: 'sawTable141' });
  return g;
}

// ═══════════════════════════ 142 이송 거리 가변 장치 ═══════════════════════════

/** 142번 치수(판화 비: 원판 반지름 1.88·중심거리, 크랭크 1.06·중심거리) */
export const K142 = {
  /** 원판 중심(고정 스터드) */
  C: [0, 2.5] as V2,
  /** 기어 모듈, 고정 피니언 잇수, 스퍼 기어 잇수 */
  module: 0.026,
  zp: 6,
  zg: 20,
  /** 두 기어 중심 거리 = m(zp + zg)/2 */
  dist: 0.338,
  /** 크랭크 길이(스퍼 기어 중심 ~ 크랭크 핀) */
  crank: 0.358,
  /** 원판 반지름 */
  R: 0.635,
  /** 연결봉 길이 */
  rod: 1.46,
  /** 층(z): 원판 앞면, 기어 가운데·폭, 크랭크 막대 가운데·두께, 연결봉 가운데 */
  zDisc: 0.05,
  zGear: 0.1025,
  gearW: 0.065,
  zBar: 0.195,
  barT: 0.04,
  zRod: 0.265
} as const;

export interface Traverse142 {
  /** 원판 회전각 = 스퍼 기어 중심의 방향각 */
  alpha: number;
  /** 스퍼 기어 중심 */
  G: V2;
  /** 스퍼 기어 그룹의 rotation.z (고정 피니언과 물리는 위상) */
  gearRot: number;
  /** 크랭크 막대의 rotation.z (기어 중심 → 크랭크 핀 방향) */
  crankAng: number;
  /** 크랭크 핀 */
  pin: V2;
  /** 크랭크 핀이 원판 중심에서 떨어진 거리(= 이번 바퀴의 유효 크랭크 반지름) */
  rho: number;
  /** 안내 블록 핀의 y(x 는 C[0]) */
  sliderY: number;
  /** 연결봉(크랭크 핀 → 블록 핀)의 방향각 */
  rodAng: number;
}

/**
 * 142번 운동식. theta = 구동 누적각(원판 반시계). t = 1(theta = 1.6)이 판화 자세(기어가 바로 아래, 크랭크가 아래로 뻗어 가장 멂).
 * 고정 피니언 둘레를 구르는 스퍼 기어의 절대 회전 = (1 + zp/zg)·alpha. 원판에서 본 크랭크의 상대각 = (zp/zg)·(alpha + 90°).
 */
export function traverse142(theta: number): Traverse142 {
  const k = K142.zp / K142.zg;
  const alpha = theta - 1.6 - Math.PI / 2;
  const [cx, cy] = K142.C;
  const G: V2 = [cx + K142.dist * Math.cos(alpha), cy + K142.dist * Math.sin(alpha)];
  // kit/gear 의 meshAngle(C, zp, 0, G, zg) 와 같은 식(고정 피니언의 각 0)
  const s2 = TAU / K142.zg;
  const gearRot = alpha + Math.PI - s2 - k * (TAU / K142.zp / 2 - alpha);
  const crankAng = -Math.PI / 2 + (1 + k) * (alpha + Math.PI / 2);
  const pin: V2 = [G[0] + K142.crank * Math.cos(crankAng), G[1] + K142.crank * Math.sin(crankAng)];
  const dx = pin[0] - cx;
  const sliderY = pin[1] - Math.sqrt(K142.rod * K142.rod - dx * dx);
  return {
    alpha,
    G,
    gearRot,
    crankAng,
    pin,
    rho: Math.hypot(dx, pin[1] - cy),
    sliderY,
    rodAng: Math.atan2(sliderY - pin[1], cx - pin[0])
  };
}

/**
 * 원판(142번): 회전축 = 로컬 Z, 원점 = 중심, 뒷면 z = 0 · 앞면 z = K142.zDisc. 가운데 구멍(고정 스터드가 지남),
 * 앞면의 얕은 테 줄(판화의 점선 원), 로컬 +X 로 K142.dist 자리에 스퍼 기어가 도는 스터드. child 'gearStud'.
 */
export function carrierDisc142(): THREE.Group {
  const g = new THREE.Group();
  const R = K142.R;
  const t = K142.zDisc;
  const s = shapeFrom(circlePts(R, 96));
  s.holes.push(circlePath(0, 0, 0.034));
  g.add(meshAt(extrude(s, t, 0.006, 24), brass({ roughness: 0.42 }), 0, 0, t / 2));
  // 뒤 허브(스터드 위에서 도는 보스)
  g.add(mesh(tubeZ(0.034, 0.075, -0.05, 0.0, 0.006), darkSteel()));
  // 판화의 점선 원(반지름 0.88R) — 앞면의 가는 줄
  g.add(meshAt(tubeZ(R * 0.88 - 0.004, R * 0.88 + 0.004, 0, 0.003, 0, 96), darkSteel(), 0, 0, t));
  // 스퍼 기어 스터드
  const zTop = K142.zGear + K142.gearW / 2;
  g.add(meshAt(cylZ(0.034, t - 0.004, zTop, 0.004), steel(), K142.dist, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.014, 0.005), paint(MARK), -R * 0.7, 0, t + 0.003));
  g.add(pinMark('gearStud', K142.dist, 0, K142.zGear));
  setMM(g, { kind: 'disc', fn: 'carrierDisc142', r: R, axis: 'z' });
  return g;
}

/**
 * 크랭크 막대(142번): 원점 = 스퍼 기어 중심, 로컬 +X 로 K142.crank 자리에 크랭크 핀. 그룹 z = 0 이 전시 z = 0 이 되게 놓는다
 * (막대 z = zBar ± barT/2, 받침 고리는 기어 앞면까지 내려감). 가운데 육각 너트·네모 볼트(판화), 핀은 연결봉 평면 위까지.
 * child 'crankPin'(연결봉 평면 z = zRod).
 */
export function crankBar142(): THREE.Group {
  const g = new THREE.Group();
  const L = K142.crank;
  const zb = K142.zBar;
  const t = K142.barT;
  const zFace = K142.zGear + K142.gearW / 2;
  const bar = rectPts(-0.09, -0.052, L + 0.055, 0.052);
  g.add(meshAt(extrude(shapeFrom(bar), t, 0.005), steel(), 0, 0, zb));
  // 받침 고리 둘(기어 앞면 ~ 막대 뒷면): 기어 중심, 네모 볼트 자리
  const sq = L * 0.4;
  g.add(mesh(cylZ(0.05, zFace, zb - t / 2 + 0.002, 0.003), darkSteel()));
  g.add(meshAt(cylZ(0.032, zFace, zb - t / 2 + 0.002, 0.003), darkSteel(), sq, 0, 0));
  // 육각 너트(기어 중심), 네모 볼트 머리
  const nut = hexPrism(0.075, 0.013, false, true, 0);
  nut.rotateX(Math.PI / 2);
  g.add(meshAt(nut, darkSteel(), 0, 0, zb + t / 2 + 0.0065));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.05, 0.012), darkSteel(), sq, 0, zb + t / 2 + 0.006));
  // 크랭크 핀
  g.add(meshAt(cylZ(0.03, zb + t / 2 - 0.002, K142.zRod + 0.04, 0.005), steel(), L, 0, 0));
  g.add(meshAt(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), L, 0, K142.zRod + 0.042));
  g.add(pinMark('crankPin', L, 0, K142.zRod));
  setMM(g, { kind: 'crank', fn: 'crankBar142', length: L });
  return g;
}
