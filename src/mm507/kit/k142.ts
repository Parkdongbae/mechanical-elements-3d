// 142번 전용 키트
//  142 변하는 이송 거리 장치(원판 → 고정 피니언 → 평기어(유성) → 크랭크 → 연결 막대 → 안내 막대):
//  중앙 스터드 위 고정 피니언, 그 위에서 도는 큰 원판, 원판에 실려 피니언에 물려 자전하는 평기어,
//  평기어에 볼트된 작은 크랭크, 눈 달린 세로 연결 막대, 세로로 왕복하는 안내 막대와 안내 둘,
//  운동식(planet142). 판화 비: 원판 반지름 148px, 평기어 편심 67px, 피니언:평기어 이 수 ≈ 1:2 (1px ≈ 0.0042)
// 치수 상수(K142)와 운동식은 순수 함수라 node 검사 스크립트가 번들해 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePts, extrude, hexPrism, lathe, loft, mesh, pathFrom, rodProfile, roundedRect, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { LoftLayer, V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function boxAt(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  return meshAt(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
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
/** 이름만 있는 표식(핀 자리) */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
/** 기어판 층(양끝 모따기) — 구멍은 원점 척이라 hs 1(구멍이 어긋나지 않게) */
function gearLayers(width: number, ra: number, m: number): LoftLayer[] {
  const c = Math.min(m * 0.3, width * 0.12);
  return [
    { z: -width / 2, s: (ra - c) / ra, hs: 1 },
    { z: -width / 2 + c, s: 1, hs: 1 },
    { z: width / 2 - c, s: 1, hs: 1 },
    { z: width / 2, s: (ra - c) / ra, hs: 1 }
  ];
}

// ═══════════════════════════ 142 치수·운동식 ═══════════════════════════

/** 142번 치수(세계 좌표·길이) */
export const K142 = {
  /** 원판 중심(세계) — 피니언 축과 같은 점(고정 스터드) */
  O: [0, 1.9] as V2,
  /** 원판 반지름·두께, 테 띠 안쪽 반지름(판화의 두 겹 원) */
  R: 0.62,
  T: 0.07,
  rimIn: 0.55,
  /** 이: 피니언 8 · 평기어 16 · 모듈 0.025 → 축 사이 = (8+16)·0.025/2 = 0.3 = 편심 d (판화 67px) */
  zp: 8,
  zs: 16,
  m: 0.025,
  d: 0.3,
  /** 크랭크 반지름, 크랭크의 기어 위 로컬 각(도) — t=1(판화 자세)에 크랭크가 왼쪽 170° */
  c: 0.09,
  crankDeg: 158.75,
  /** 연결 막대: 윗눈 → 아래 볼트 거리, 판 반폭, 판 위 끝(눈 중심 위), 판 아랫단(눈 보스를 덮고 자루로 좁아진다) */
  L: 0.85,
  plateHalf: 0.068,
  plateTop: 0.088,
  plateBottom: -0.46,
  /** 윗눈(링) 바깥·구멍, 네모 구멍 반폭·y, 아래 눈 바깥·구멍·y, 자루 반폭·끝, 볼트 구멍 y */
  eyeROut: 0.066,
  eyeRHole: 0.033,
  sqHalf: 0.021,
  sqY: -0.155,
  lowROut: 0.084,
  lowRHole: 0.038,
  lowY: -0.369,
  stemHalf: 0.042,
  stemEnd: -0.885,
  boltY: -0.855,
  /** 안내 막대: 반 길이, 몸통 아래·위(볼트 구멍이 y 0), 볼트 반지름 */
  barHalf: 0.66,
  barH: 0.16,
  barTop: 0.025,
  boltR: 0.02,
  /** 안내: x(±), 판 세로 중심·높이, 두께, 폭 — 판 y 0.495~1.545 (막대 행정 0.551~1.464를 감쌈) */
  guideX: 0.78,
  guideY: 1.02,
  guideH: 1.05,
  guideT: 0.03,
  guideW: 0.12,
  /** 층(세계 z): 기어 판 가운데·두께, 크랭크 팔 가운데·두께, 연결 막대 판 */
  zGear: 0.185,
  gearW: 0.06,
  zArm: 0.259,
  armT: 0.042,
  rodZ0: 0.305,
  rodZ1: 0.375,
  /** 판화 자세: theta = 1.6 에서 u = 0 (t = 1) */
  pose: 1.6
} as const;

/** 피니언·평기어 피치 반지름, 축 사이(= 편심) */
export const K142_RP: number = (K142.zp * K142.m) / 2;
export const K142_RS: number = (K142.zs * K142.m) / 2;
export const K142_C: number = K142_RP + K142_RS;

export interface Planet142 {
  /** 원판 rotation.z (t=1 판화 자세가 0, 반시계 +) */
  disk: number;
  /** 평기어 rotation.z (자전 — meshAngle 식과 동치, 피니언과 정확히 물림) */
  spur: number;
  /** 크랭크의 세계 각(rad) */
  psi: number;
  /** 평기어 중심(세계) */
  S: V2;
  /** 크랭크 핀(세계) */
  pin: V2;
  /** 핀이 원판 중심에서 떨어진 거리 — 0.21 ~ 0.39 로 천천히 오르내린다(이송 거리의 원) */
  R: number;
  /** 연결 막대 rotation.z */
  rod: number;
  /** 안내 막대 원점(볼트 점)의 높이 */
  barY: number;
  /** 막대 기울기(rad) = rod 와 같은 값 */
  tilt: number;
}

/**
 * 142번 운동(theta 의 닫힌 식, 주기 4π = 7.854 s):
 * u = theta − 1.6 로 판화 자세(t=1)가 u = 0. 원판 반시계, 평기어는 원판과 같은 방향으로 1.5배(자전),
 * 크랭크는 평기어에 158.75° 로 볼트 — 막대는 핀에 매달려 세로 안내 막대를 위아래로 밀어 올린다.
 */
export function planet142(theta: number): Planet142 {
  const K = K142;
  const u = theta - K.pose;
  const S: V2 = [K.O[0] + K.d * Math.sin(u), K.O[1] - K.d * Math.cos(u)];
  // 평기어 자전: gear.ts 의 meshAngle(P, zp, 0, S, zs) 와 같은 식(α = u − π/2 가 정확히 u 로 도니 감기지 않게 전개)
  const a = u - Math.PI / 2;
  const s1 = TAU / K.zp;
  const s2 = TAU / K.zs;
  const spur = a + Math.PI - s2 - (s2 / s1) * (s1 / 2 - a);
  const psi = spur + K.crankDeg * DEG;
  const pin: V2 = [S[0] + K.c * Math.cos(psi), S[1] + K.c * Math.sin(psi)];
  const R = Math.hypot(pin[0] - K.O[0], pin[1] - K.O[1]);
  const q = Math.max(-1, Math.min(1, -pin[0] / K.L));
  const tilt = Math.asin(q);
  const barY = pin[1] - Math.sqrt(Math.max(0, K.L * K.L - pin[0] * pin[0]));
  return { disk: u, spur, psi, S, pin, R, rod: tilt, barY, tilt };
}

// ═══════════════════════════ 142 부품 ═══════════════════════════

/**
 * 중앙 스터드 위 고정 피니언(142번, 고정): 원점 = (0, 1.9, 0) — 모델이 K142.O 에 놓는다.
 * 축(뒤판 → z 0.15) + 뒤쪽 보스 + 피니언 판(8T, z 0.15~0.21) + 허브 + 끝 너트. child 'mainStud'.
 * mm.kind = 'gear' (자리는 고정 — 회전하지 않는다).
 */
export function studPinion142(): THREE.Group {
  const K = K142;
  const g = new THREE.Group();
  const rp = K142_RP;
  const ra = rp + K.m;
  const rf = rp - 1.25 * K.m;
  g.add(mesh(cylZ(0.03, STAGE.backZ, 0.15), steel())); // 중앙 축 — 원판 구멍(0.033)을 꿴다
  g.add(mesh(cylZ(0.07, STAGE.backZ, STAGE.backZ + 0.09), darkSteel())); // 뒤판 보스
  const outline = involuteOutline(K.zp, ra, rf);
  g.add(meshAt(loft(outline, [circlePts(0.032, 28)], gearLayers(K.gearW, ra, K.m)), brass(), 0, 0, K.zGear));
  g.add(mesh(tubeZ(0.032, 0.07, K.zGear - K.gearW / 2 - 0.005, K.zGear + K.gearW / 2 + 0.007), darkSteel())); // 허브 0.15~0.222
  const nut = hexPrism(0.05, 0.024, true, true, 0);
  nut.rotateX(Math.PI / 2);
  g.add(meshAt(nut, darkSteel(), 0, 0, K.zGear + 0.041)); // 끝 너트 0.214~0.238
  g.add(pinMark('mainStud', 0, 0, 0.01));
  setMM(g, { kind: 'gear', fn: 'studPinion142', teeth: K.zp, module: K.m, rp, ra, rf, width: K.gearW, axis: 'z', internal: false, fixed: true });
  return g;
}

/**
 * 큰 원판(142번, 구동): 원점 = (0, 1.9, 0), rotation.z = planet142(theta).disk. 판 + 앞 테 띠(판화의 두 겹 원) + 허브.
 * 아래 (0, −0.3) 자리에 평기어 받침 스터드(보스·몸·끝 캡 — 원판과 같이 돈다)가 앞으로 나와 있다.
 * 표식 'diskHub'(축 자리)·'spurStud'(스터드, 평기어 허브 표식 gearHub 와 짝).
 */
export function disk142(): THREE.Group {
  const K = K142;
  const g = new THREE.Group();
  const bronzeBody = bronze({ roughness: 0.36 });
  g.add(mesh(tubeZ(0.033, K.R, -K.T / 2, K.T / 2), bronzeBody)); // 판(중앙 구멍 0.033 — 축 0.03)
  g.add(mesh(tubeZ(K.rimIn, K.R, -K.T / 2 + 0.005, K.T / 2 + 0.014), bronzeBody)); // 테 띠(앞 0.014 돌출)
  g.add(mesh(tubeZ(0.033, 0.1, -K.T / 2 - 0.012, K.T / 2 + 0.012), darkSteel())); // 허브
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.014, 0.006), paint(MARK), -0.44, 0.3, K.T / 2 + 0.006)); // 도는 표시줄
  g.add(meshAt(cylZ(0.075, 0.02, 0.07), darkSteel(), 0, -K.d, 0)); // 스터드 보스
  g.add(meshAt(cylZ(0.04, 0.02, K.zGear - K.gearW / 2), steel(), 0, -K.d, 0)); // 스터드(평기어 허브 구멍 0.042 이 앉는다)
  g.add(meshAt(cylZ(0.056, K.zGear + 0.039, K.zGear + 0.053), darkSteel(), 0, -K.d, 0)); // 스터드 끝 캡 0.224~0.238
  g.add(pinMark('diskHub', 0, 0, 0.01));
  g.add(pinMark('spurStud', 0, -K.d, 0.16));
  setMM(g, { kind: 'disk', fn: 'disk142', r: K.R, width: K.T, axis: 'z' });
  return g;
}

/**
 * 평기어(142번, 유성 — 원판에 실려 피니언에 물려 자전): 원점 = 평기어 중심, position = planet142(theta).S,
 * rotation.z = planet142(theta).spur. 판(16T, z 0.155~0.215) + 허브 + 크랭크 팔(로컬 158.75°, 볼트 둘) + 핀(덮개).
 * 표식 'gearHub'(허브 — 스터드 표식 spurStud 와 짝), 'crankPin'(z 0 표식 — userData.outline 핀 원, 막대 윗눈 구멍과 짝).
 * mm.kind = 'gear'.
 */
export function spurGear142(): THREE.Group {
  const K = K142;
  const g = new THREE.Group();
  const rp = K142_RS;
  const ra = rp + K.m;
  const rf = rp - 1.25 * K.m;
  const outline = involuteOutline(K.zs, ra, rf);
  g.add(meshAt(loft(outline, [circlePts(0.042, 28)], gearLayers(K.gearW, ra, K.m)), brass(), 0, 0, K.zGear));
  g.add(mesh(tubeZ(0.042, 0.075, K.zGear - K.gearW / 2 - 0.005, K.zGear + K.gearW / 2 + 0.007), darkSteel())); // 허브 0.15~0.222
  const px = K.c * Math.cos(K.crankDeg * DEG);
  const py = K.c * Math.sin(K.crankDeg * DEG);
  const arm = extrude(stadiumShape(0, 0, px, py, 0.028), K.armT, 0.004, 12);
  g.add(meshAt(arm, steel(), 0, 0, K.zGear + K.gearW / 2 + 0.023)); // 팔 z 0.238~0.28
  const dx = Math.cos(K.crankDeg * DEG);
  const dy = Math.sin(K.crankDeg * DEG);
  for (const s of [-1, 1]) {
    g.add(meshAt(cylZ(0.014, K.zGear + K.gearW / 2 + 0.057, K.zGear + K.gearW / 2 + 0.073), darkSteel(), px * 0.5 - dy * 0.045 * s, py * 0.5 + dx * 0.045 * s, 0)); // 볼트 머리
  }
  g.add(meshAt(cylZ(0.03, 0.28, 0.41, 0.004, 24), steel(), px, py, 0)); // 크랭크 핀(눈이 앉는 자리)
  g.add(meshAt(cylZ(0.044, 0.402, 0.42, 0.004, 24), darkSteel(), px, py, 0)); // 핀 덮개
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.012, 0.006), paint(MARK), 0.13, -0.13, K.zGear + K.gearW / 2 + 0.003)); // 자전 표시줄
  const pin = pinMark('crankPin', px, py, 0); // 표식 층 z 0 — 막대 윗눈 구멍 윤곽과 다각형 짝
  pin.userData.outline = circlePts(0.028, 24);
  g.add(pin);
  g.add(pinMark('gearHub', 0, 0, 0.16));
  setMM(g, { kind: 'gear', fn: 'spurGear142', teeth: K.zs, module: K.m, rp, ra, rf, width: K.gearW, axis: 'z', internal: false });
  return g;
}

/**
 * 연결 막대(142번): 원점 = 윗눈(크랭크 핀) 중심, position = planet142(theta).pin, rotation.z = planet142(theta).rod.
 * 로컬 −Y 로 L(0.85) 까지: 윗눈 판(구멍) + 네모 구멍 + 아래 눈 판(구멍) + 자루(끝 볼트 구멍).
 * 표식 'rodEye'(원점 — crankPin 과 짝), 'rodEnd'(z 0.34 — barBolt 와 짝). userData.outlines.eyeHole·squareHole.
 */
export function rod142(): THREE.Group {
  const K = K142;
  const g = new THREE.Group();
  const pts: V2[] = [
    [-K.plateHalf, K.plateTop], [-K.plateHalf, K.plateBottom],
    [-K.stemHalf, K.plateBottom], [-K.stemHalf, K.stemEnd],
    [K.stemHalf, K.stemEnd], [K.stemHalf, K.plateBottom],
    [K.plateHalf, K.plateBottom], [K.plateHalf, K.plateTop]
  ];
  const sq = K.sqHalf;
  const square: V2[] = [
    [-sq, K.sqY + sq], [-sq, K.sqY - sq], [sq, K.sqY - sq], [sq, K.sqY + sq]
  ];
  const layers: LoftLayer[] = [
    { z: K.rodZ0, s: 0.96, hs: 1 },
    { z: K.rodZ0 + 0.008, s: 1, hs: 1 },
    { z: K.rodZ1 - 0.008, s: 1, hs: 1 },
    { z: K.rodZ1, s: 0.96, hs: 1 }
  ];
  const holes: V2[][] = [
    circlePts(K.eyeRHole, 24),
    square,
    circlePts(K.lowRHole, 24, 0, K.lowY),
    circlePts(0.023, 20, 0, K.boltY)
  ];
  g.add(mesh(loft(pts, holes, layers), steel({ roughness: 0.4 })));
  g.add(mesh(tubeZ(K.eyeRHole, K.eyeROut, 0.295, 0.385), darkSteel())); // 윗눈 보스(판에서 앞뒤 0.01 돌출)
  g.add(meshAt(tubeZ(K.lowRHole, K.lowROut, 0.295, 0.385), darkSteel(), 0, K.lowY, 0)); // 아래 눈 보스(판화의 두꺼운 고리)
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.012, 0.006), paint(MARK), 0, -0.24, K.rodZ1 + 0.003)); // 기울기 표시줄
  g.add(pinMark('rodEye', 0, 0, 0));
  g.add(pinMark('rodEnd', 0, -K.L, 0.34));
  g.userData.outlines = { eyeHole: circlePts(K.eyeRHole, 24), squareHole: square };
  setMM(g, { kind: 'link', fn: 'rod142', length: K.L, a: [0, 0, 0], b: [0, -K.L, 0] });
  return g;
}

/**
 * 안내 막대(142번, 세로 왕복): 원점 = 볼트 점(막대 몸통 위), position = (0, planet142(theta).barY, 0).
 * 가로 막대(x ±0.66, 볼트 구멍) + 볼트 핀(연결 막대 자루 구멍을 꿴다) + 머리. 표식 'barBolt'. 판화에 없음(보충).
 */
export function guideBar142(): THREE.Group {
  const K = K142;
  const g = new THREE.Group();
  // 막대 판은 연결 막대 판(0.305~0.375) 뒤 0.006 틈 — extrude 는 z 중심 정렬이라 자리는 판 중심
  const plateZ = K.rodZ0 - 0.006 - (K.rodZ1 - K.rodZ0) / 2; // 0.264 → 막대 판 z 0.229~0.299
  const sh = roundedRect(-K.barHalf, -K.barH, K.barHalf, K.barTop, 0.02);
  sh.holes.push(pathFrom(circlePts(0.0225, 20, 0, 0)));
  g.add(meshAt(extrude(sh, K.rodZ1 - K.rodZ0, 0.006, 16), steel({ roughness: 0.45 }), 0, 0, plateZ)); // 막대 판 0.229~0.299
  g.add(meshAt(cylZ(K.boltR, plateZ - 0.031, 0.402, 0.004, 20), steel(), 0, 0, 0)); // 볼트 핀 0.233~0.402 — 막대·자루 구멍(0.0225/0.023)을 꿴다
  g.add(meshAt(cylZ(0.032, 0.392, 0.408, 0.004, 20), darkSteel(), 0, 0, 0)); // 볼트 머리
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.012, 0.006), paint(MARK), -0.3, -0.08, plateZ + 0.038)); // 왕복 표시줄(막대 판 앞면 + 0.003)
  g.add(pinMark('barBolt', 0, 0, 0.34));
  setMM(g, { kind: 'slide', fn: 'guideBar142', axis: 'y', half: K.barHalf, height: K.barH });
  return g;
}

/**
 * 안내(142번, 고정 — 판화에 없음): side = ±1. 원점 = (side·0.78, 0, 0). 안내 막대의 앞·뒷면을 감싼 C 짝(틈 0.004,
 * 세로 미끄럼) + 바깥 허리 + 뒤판까지 기둥. 판 y 0.495~1.545 — 막대 행정(barY 0.711~1.439, 몸 ±0.16)을 감싼다.
 */
export function barGuide142(side: number): THREE.Group {
  const K = K142;
  const g = new THREE.Group();
  g.position.set(side * K.guideX, 0, 0);
  const iron = castIron();
  const barZ0 = K.rodZ0 - 0.076; // 0.229 — 안내 막대 판 뒷면(연결 막대 판 뒤 0.006 틈)
  const barZ1 = K.rodZ0 - 0.006; // 0.299 — 안내 막대 판 앞면
  const z0 = barZ0 - 0.004 - K.guideT; // 0.268
  const z1 = barZ1 + 0.004 + K.guideT; // 0.406
  g.add(boxAt(K.guideW, K.guideH, K.guideT, iron, 0, K.guideY, (z0 + barZ0 - 0.004) / 2)); // 뒤판
  g.add(boxAt(K.guideW, K.guideH, K.guideT, iron, 0, K.guideY, (barZ1 + 0.004 + z1) / 2)); // 앞판
  g.add(boxAt(K.guideT, K.guideH, z1 - z0, iron, side * 0.045, K.guideY, (z0 + z1) / 2)); // 바깥 허리
  g.add(boxAt(0.07, 0.1, z0 - STAGE.backZ, iron, 0, K.guideY, (STAGE.backZ + z0) / 2)); // 뒤판까지 기둥
  setMM(g, { kind: 'guide', fn: 'barGuide142', axis: 'y' });
  return g;
}
