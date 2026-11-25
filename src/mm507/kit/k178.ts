// 178번 전용 키트 — 속도를 바꾸는 홈 크랭크 (절삭 공구 슬라이드의 느린 절삭·빠른 복귀)
// 고정 원판(축이 지나는 구멍 + 편심된 원형 홈), 홈 크랭크, 미끄럼쇠 핀, 연결 막대, 공구 슬라이드(레일).
// 운동식 kin178(theta): 크랭크 방향 (cos θ, sin θ) 와 원형 홈의 교점이 핀 → 연결 막대 → 슬라이드 x.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 판(Shape)을 z0~z1 에 놓는다 */
function plate(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material, c = 0.004): THREE.Mesh {
  return meshAt(extrude(shape, z1 - z0, c, 32), mat, 0, 0, (z0 + z1) / 2);
}
function named(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/** 178번 치수. 판화: 원형 홈 반지름 ≈ 145px, 편심 ≈ 65px(비 0.45), 축은 홈 중심 아래 */
export const K178 = {
  /** 고정 원판·홈의 중심, 축 중심(홈 중심의 e 아래) */
  C: [1.05, 1.9] as V2,
  S: [1.05, 1.6] as V2,
  /** 원형 홈 중심선 반지름, 홈 반폭, 편심 e = 축 ~ 홈 중심 */
  r: 0.7,
  grooveHalf: 0.045,
  e: 0.3,
  /** 원판 바깥·축 구멍 반지름 */
  diskR: 0.86,
  openR: 0.4,
  /** 연결 막대 길이(눈 ~ 눈), 슬라이드 가이드 높이 */
  rodL: 2.0,
  guideY: 1.9,
  pinR: 0.03,
  /** 층(z) */
  zBase0: STAGE.backZ + 0.05,
  zBase1: STAGE.backZ + 0.09,
  zRing1: STAGE.backZ + 0.13,
  zCrank0: 0.02,
  zCrank1: 0.07,
  zFlange1: 0.09,
  zRod0: 0.09,
  zRod1: 0.13,
  zPinTop: 0.15,
  /** 크랭크 몸 길이(축에서 끝까지), 홈 중심 범위 */
  crankLen: 1.2,
  slot0: 0.37,
  slot1: 1.03
} as const;

export interface Kin178 {
  /** 축 ~ 핀 거리(= 지금의 유효 크랭크 길이) r−e ~ r+e */
  rho: number;
  /** 핀(미끄럼쇠) 위치 */
  P: V2;
  /** 슬라이드 x (y = guideY) */
  xc: number;
  /** 연결 막대 방향 각(슬라이드 눈 → 핀 눈) */
  rodAng: number;
}

/** theta 의 닫힌 식 — 핀은 크랭크 반직선과 원형 홈의 교점 */
export function kin178(theta: number): Kin178 {
  const k = K178;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  const bd = k.e * dy;
  const rho = bd + Math.sqrt(bd * bd + k.r * k.r - k.e * k.e);
  const P: V2 = [k.S[0] + rho * dx, k.S[1] + rho * dy];
  const h = Math.sqrt(k.rodL * k.rodL - (P[1] - k.guideY) * (P[1] - k.guideY));
  return { rho, P, xc: P[0] - h, rodAng: Math.atan2(P[1] - k.guideY, h) };
}

/** 크랭크 몸의 홈(자유 공간) 윤곽 — 핀이 다니는 자리, 크랭크 로컬 */
export function crankSlot178(): V2[] {
  const k = K178;
  const hw = 0.04;
  const pts: V2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    pts.push([k.slot1 + hw * Math.cos(a), hw * Math.sin(a)]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    pts.push([k.slot0 + hw * Math.cos(a), hw * Math.sin(a)]);
  }
  return pts;
}

/** 고정 원판: 아래층(축 구멍) + 윗층(원형 홈 — 안·바깥 두 고리) + 뒤판 쪽 버팀 기둥 4개. 원점 = 홈 중심 C */
export function fixedDisk178(): THREE.Group {
  const k = K178;
  const g = new THREE.Group();
  const iron = castIron();
  const base = shapeFrom(circlePts(k.diskR, 96));
  base.holes.push(pathFrom(circlePts(k.openR, 64)));
  g.add(plate(base, k.zBase0, k.zBase1, iron));
  const inner = shapeFrom(circlePts(k.r - k.grooveHalf, 96));
  inner.holes.push(pathFrom(circlePts(k.openR, 64)));
  const outer = shapeFrom(circlePts(k.diskR, 96));
  outer.holes.push(pathFrom(circlePts(k.r + k.grooveHalf, 96)));
  g.add(plate(inner, k.zBase1, k.zRing1, iron));
  g.add(plate(outer, k.zBase1, k.zRing1, iron));
  // 버팀 기둥(뒤판 ↔ 아래층)
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 4) * (2 * i + 1);
    g.add(meshAt(cylZ(0.035, STAGE.backZ, k.zBase0 + 0.004, 0.003, 20), steel(), 0.62 * Math.cos(a), 0.62 * Math.sin(a), 0));
  }
  setMM(g, { kind: 'plate' });
  return g;
}

/** 홈 크랭크: 원점 = 축 중심, 몸은 로컬 +X, 길게 뚫린 홈, 허브·표식. z 는 세계값 그대로 */
export function crank178(): THREE.Group {
  const k = K178;
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, k.crankLen - 0.1, 0, 0.1);
  bar.holes.push(pathFrom(crankSlot178()));
  g.add(plate(bar, k.zCrank0, k.zCrank1, steel(), 0.005));
  g.add(meshAt(cylZ(0.115, k.zCrank0, k.zCrank1 + 0.012, 0.005, 36), darkSteel(), 0, 0, 0));
  g.add(meshAt(cylZ(0.05, k.zCrank1 + 0.012, k.zCrank1 + 0.03, 0.004, 28), steel(), 0, 0, 0));
  // 회전이 보이는 표식(밝은 띠)
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.02, 0.008), paint(0xf2b619), 0.2, 0.075, k.zCrank1 + 0.004));
  g.userData.outlines = { slotHole: crankSlot178() };
  setMM(g, { kind: 'lever', length: k.crankLen, pivot: [0, 0, 0], tip: [k.crankLen, 0, 0] });
  return g;
}

/** 축(고정): 뒤판 보스에서 크랭크 허브까지. 원점 = (S, z 0) */
export function shaft178(): THREE.Group {
  const k = K178;
  const g = new THREE.Group();
  g.add(meshAt(cylZ(0.045, STAGE.backZ, k.zCrank1 + 0.02, 0.004, 28), steel(), 0, 0, 0));
  g.add(meshAt(cylZ(0.1, STAGE.backZ, STAGE.backZ + 0.05, 0.006, 32), darkSteel(), 0, 0, 0));
  g.add(named('shaftPin', 0, 0, 0.05));
  setMM(g, { kind: 'shaft', axis: 'z', r: 0.045 });
  return g;
}

/** 미끄럼쇠 핀: 원점 = 핀 중심(원판 홈 ↔ 크랭크 홈 ↔ 연결 막대 눈을 꿴다) */
export function slidePin178(): THREE.Group {
  const k = K178;
  const g = new THREE.Group();
  const pin = meshAt(cylZ(k.pinR, k.zBase1, k.zPinTop, 0.003, 24), darkSteel(), 0, 0, 0);
  pin.userData.outline = circlePts(k.pinR, 24);
  g.add(pin);
  g.add(meshAt(cylZ(0.065, k.zCrank1, k.zFlange1, 0.003, 28), darkSteel(), 0, 0, 0));
  g.add(meshAt(cylZ(0.05, k.zRod1, k.zPinTop, 0.003, 24), steel(), 0, 0, 0));
  g.add(named('pinMark', 0, 0, 0.1));
  setMM(g, { kind: 'pin' });
  return g;
}

/** 연결 막대: 원점 = 슬라이드 쪽 눈, 로컬 +X 로 rodL 에서 핀 쪽 눈 */
export function rod178(): THREE.Group {
  const k = K178;
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, k.rodL, 0, 0.04);
  for (const x of [0, k.rodL]) bar.holes.push(pathFrom(circlePts(k.pinR + 0.002, 20, x, 0)));
  g.add(plate(bar, k.zRod0, k.zRod1, steel(), 0.004));
  for (const x of [0, k.rodL]) {
    const eye = shapeFrom(circlePts(0.065, 32));
    eye.holes.push(pathFrom(circlePts(k.pinR + 0.002, 20)));
    g.add(meshAt(extrude(eye, k.zRod1 - k.zRod0, 0.004, 24), darkSteel(), x, 0, (k.zRod0 + k.zRod1) / 2));
  }
  setMM(g, { kind: 'rod', length: k.rodL });
  return g;
}

/** 공구 슬라이드: 원점 = 연결 막대가 거는 핀 중심. 블록 + 공구대 + 바이트 + 핀. 블록 z −0.04~0.09 */
export function toolSlide178(): THREE.Group {
  const k = K178;
  const g = new THREE.Group();
  const iron = castIron();
  g.add(meshAt(new THREE.BoxGeometry(0.3, 0.18, 0.13), iron, 0, 0, 0.025));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.1, 0.09), iron, -0.25, 0, 0.005));
  const bit = shapeFrom([
    [0, 0.04],
    [0, -0.04],
    [-0.11, -0.01],
    [-0.11, 0.01]
  ]);
  g.add(meshAt(extrude(bit, 0.05, 0.003, 4), darkSteel(), -0.34, 0, 0.005));
  g.add(meshAt(cylZ(k.pinR, 0.09, k.zPinTop, 0.003, 24), darkSteel(), 0, 0, 0));
  g.add(meshAt(cylZ(0.05, k.zRod1, k.zPinTop, 0.003, 24), steel(), 0, 0, 0));
  g.add(named('crossMark', 0, 0, 0.1));
  setMM(g, { kind: 'slider' });
  return g;
}

/** 공구 슬라이드 레일(고정): 길이 X, 두 기둥으로 뒤판에 선다. 레일 z −0.18~−0.04 */
export function rail178(x0: number, x1: number): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  g.add(meshAt(new THREE.BoxGeometry(x1 - x0, 0.14, 0.14), iron, (x0 + x1) / 2, 0, -0.11));
  for (const x of [x0 + 0.16, x1 - 0.16]) g.add(meshAt(new THREE.BoxGeometry(0.16, 0.14, 0.14), iron, x, 0, STAGE.backZ + 0.07));
  setMM(g, { kind: 'pillow' });
  return g;
}
