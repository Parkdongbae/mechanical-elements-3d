// 177번 전용 키트 — 기관 분리 장치(풀림)
// 크랭크 몸통(축·팔·눈 밑동), 홈 난 고리(눈 위에서 돌아감), 유령 손목 핀(왕복),
// 통과 방향 화살표(판화의 검은 화살표 2개), 링 회전 방향 화살표 쌍, 운동식 release177.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';
import { rotArrow } from './misc';

const DEG = Math.PI / 180;
const ARROW = 0xd8362f;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
/** Z축 원기둥(z0~z1, 양끝 모따기) */
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 이름만 있는 핀 자리 표식 */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/** 177번 치수(세계 좌표·길이). 판화 비(1 px ≈ 0.006, 고리 바깥 반지름 67 px): 축 사이 287 : 축 바깥 71 : 고리 바깥 67 : 눈 돌기 23 */
export const K177 = {
  /** 크랭크 축 중심(세계) */
  S: [0, 1.06] as V2,
  /** 눈(고리 중심) — 팔이 축에서 눈까지 1.72 */
  E: [0, 2.78] as V2,
  /** 크랭크 축: 표 반지름, 칼라, 플랜지, 뒤 보스 */
  shaftR: 0.26,
  collarR: 0.375,
  flangeR: 0.42,
  bossR: 0.13,
  /** 팔: 눈쪽 반폭, 축쪽 반폭, 윗면(눈 중심에서 +0.21), 두께, 축 구멍 */
  webHalfEye: 0.24,
  webHalfShaft: 0.29,
  webTop: 1.93,
  webT: 0.07,
  bore: 0.27,
  /** 눈: 밑동(고리 받침 관), 가운데 돌기(판화의 해칭 원) */
  beadR: 0.205,
  beadIn: 0.14,
  stubR: 0.135,
  /** 고리: 바깥 반지름, 안쪽 끝 반지름, 통로 반폭, 두께 */
  ringR: 0.4,
  ringIn: 0.19,
  band: 0.09,
  ringT: 0.06,
  /** 숨은 연결 띠(고리 C 둘을 뒤에서 이음 — 판화에 없음) */
  strapR0: 0.21,
  strapR1: 0.27,
  /** 유령 손목 핀: 반지름, 길이, 왕복 절반, 주차 자리 */
  pinR: 0.03,
  pinL: 0.052,
  stroke: 0.72,
  /** 층(세계 z): 팔 몸통, 밑동·돌기, 고리, 핀, 통과 화살표, 방향 화살표 */
  zWeb: -0.02,
  zRing: 0.07,
  zPin: 0.074,
  zPass: 0.136,
  zSwing: 0.18,
  /** 맞물림(176) 자세의 홈 각(세로) */
  slotV: Math.PI / 2,
  /** 한 주기 theta: 가 통과 4.8 · 나 되통과 4.8 · 다 재결합 3.2 · 라 맞물림 대기 3.2 · 마 풀기 3.2 */
  period: 19.2,
  phase: [4.8, 4.8, 3.2, 3.2, 3.2]
} as const;

const smooth = (x: number): number => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

export interface Release177 {
  /** 주기 안의 자리 u = mod(theta, 19.2) */
  u: number;
  /** 고리 회전각(rad). 0 = 홈 수평(177 풀림), −90° = 홈 세로(176 맞물림) */
  beta: number;
  /** 손목 핀의 x(눈 중심 기준) */
  pinX: number;
  /** 방향 화살표: +1 반시계(마 풀기), −1 시계(다 재결합), 0 숨김 */
  dir: 1 | -1 | 0;
}

/** 177번 운동(theta 의 닫힌 식): 고리가 세로(176)에서 수평(177)으로 돌면 핀이 홈 통로를 그냥 지나간다 */
export function release177(theta: number): Release177 {
  const u = ((theta % K177.period) + K177.period) % K177.period;
  const P = K177.phase;
  let beta = 0;
  let pinX = -K177.stroke;
  let dir: 1 | -1 | 0 = 0;
  if (u < P[0]) {
    pinX = -K177.stroke + 2 * K177.stroke * smooth(u / P[0]);
  } else if (u < P[0] + P[1]) {
    pinX = K177.stroke - 2 * K177.stroke * smooth((u - P[0]) / P[1]);
  } else if (u < P[0] + P[1] + P[2]) {
    beta = -K177.slotV * smooth((u - P[0] - P[1]) / P[2]);
    dir = -1;
  } else if (u < P[0] + P[1] + P[2] + P[3]) {
    beta = -K177.slotV;
  } else {
    beta = -K177.slotV * (1 - smooth((u - P[0] - P[1] - P[2] - P[3]) / P[4]));
    dir = 1;
  }
  return { u, beta, pinX, dir };
}

/** 고리 C 조각 윤곽(통로 반폭 band 로 고리 면을 가른 위·아래 조각, 반시계) */
export function ringHalfOutline177(sign: 1 | -1): V2[] {
  const aR = Math.asin(K177.band / K177.ringR);
  const aI = Math.asin(K177.band / K177.ringIn);
  const xi = Math.sqrt(K177.ringIn * K177.ringIn - K177.band * K177.band);
  const pts: V2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = aR + ((Math.PI - 2 * aR) * i) / 20;
    pts.push([K177.ringR * Math.cos(a), sign * K177.ringR * Math.sin(a)]);
  }
  pts.push([-xi, sign * K177.band]);
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - aI - ((Math.PI - 2 * aI) * i) / 16;
    pts.push([K177.ringIn * Math.cos(a), sign * K177.ringIn * Math.sin(a)]);
  }
  pts.push([K177.ringR * Math.cos(aR), sign * K177.band]);
  return sign === 1 ? pts : pts.slice().reverse();
}

/**
 * 크랭크 몸통(177번, 고정): 원점 = 축 축선과 뒤판 사이 평면(z 0), 축 중심 (0, 0). 뒤 보스(뒤판에 붙임) → 축 표 →
 * 팔 몸통(축 구멍) → 칼라 → 플랜지 → 눈 밑동·가운데 돌기(눈 중심 로컬 (0, 1.72)). 모델은 (0, 1.06, 0) 에 놓는다.
 */
export function crankBody177(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  // 뒤 보스(뒤판 받침 — 판화에 없음) + 축 표
  g.add(meshAt(cylZ(K177.bossR, STAGE.backZ, -0.22, 0.008, 32), iron, 0, 0, 0));
  g.add(meshAt(cylZ(K177.shaftR, -0.22, 0.09, 0.006, 36), steel(), 0, 0, 0));
  // 팔 몸통(축 구멍, 눈까지)
  const sh = shapeFrom([
    [-K177.webHalfShaft, -0.16],
    [K177.webHalfShaft, -0.16],
    [K177.webHalfShaft, 0.8],
    [K177.webHalfEye, 1.87],
    [0.185, K177.webTop],
    [-0.185, K177.webTop],
    [-K177.webHalfEye, 1.87],
    [-K177.webHalfShaft, 0.8]
  ] as V2[]);
  sh.holes.push(pathFrom(circlePts(K177.bore, 32)));
  g.add(meshAt(extrude(sh, K177.webT, 0.006, 12), iron, 0, 0, K177.zWeb));
  // 칼라·플랜지(판화의 동심원 둘)
  g.add(meshAt(cylZ(K177.collarR, 0.05, 0.08, 0.006, 44), iron, 0, 0, 0));
  g.add(meshAt(cylZ(K177.flangeR, 0.08, 0.105, 0.006, 48), iron, 0, 0, 0));
  // 눈 밑동(관) + 가운데 돌기 — 팔 앞면 z 0.05 에 얹힘
  g.add(meshAt(tubeZ(K177.beadIn, K177.beadR, 0.05, 0.07, 0.004, 40), darkSteel(), 0, 1.72, 0));
  g.add(meshAt(cylZ(K177.stubR, 0.05, 0.068, 0.004, 28), darkSteel(), 0, 1.72, 0));
  setMM(g, { kind: 'crank', axis: 'z', r: K177.flangeR, eye: [0, 1.72] });
  return g;
}

/**
 * 홈 난 고리(177번, 눈 위에서 돌아감): 원점 = 눈 중심, 로컬 z 0~0.06(세계 0.07~0.13). 통로(|y| ≤ 0.09)가 면을 가른
 * C 조각 둘 + 뒤의 숨은 연결 띠(판화에 없음 — 두 조각을 한 몸으로). 밑동 앞면(로컬 z 0) 위에서 맞물려 돈다.
 * userData.outlines.slotHole = 통로(손목 핀이 지나가는 열린 구역).
 */
export function releaseRing177(): THREE.Group {
  const g = new THREE.Group();
  const shapes = [ringHalfOutline177(1), ringHalfOutline177(-1)].map((p) => shapeFrom(p));
  g.add(mesh(extrude(shapes, K177.ringT, 0.004, 24), brass()));
  g.add(meshAt(tubeZ(K177.strapR0, K177.strapR1, -0.006, 0, 0.003, 40), darkSteel(), 0, 0, 0));
  g.userData.outlines = {
    slotHole: [
      [-K177.ringR, -K177.band],
      [K177.ringR, -K177.band],
      [K177.ringR, K177.band],
      [-K177.ringR, K177.band]
    ] as V2[]
  };
  setMM(g, { kind: 'ring', r: K177.ringR, slotHalf: K177.band, slotDeg: 177 });
  return g;
}

/**
 * 유령 손목 핀(177번, 보이지 않는 크랭크의 손목 — 판화에 없는 보충): 원점 = 핀 중심, 로컬 z 0~0.052(세계 0.074~0.126).
 * 홈 통로 평면에서 좌우로 왕복한다. child 'pinMark' 에 핀 원 outline — 고리의 slotHole 과 짝이 된다.
 */
export function wristPin177(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(K177.pinR, 0, K177.pinL, 0.004, 24), steel()));
  g.add(mesh(cylZ(K177.pinR + 0.007, K177.pinL - 0.01, K177.pinL, 0.003, 24), darkSteel()));
  const mark = pinMark('pinMark', 0, 0, K177.pinL / 2);
  mark.userData.outline = circlePts(K177.pinR, 24);
  g.add(mark);
  setMM(g, { kind: 'pin', r: K177.pinR, length: K177.pinL });
  return g;
}

/** 통과 방향 화살표 2개(판화의 검은 화살표 — 안쪽을 향해 나란히). 원점 = 눈 중심 바로 아래 자리, 로컬 z 0~0.008 */
export function passageArrows177(): THREE.Group {
  const g = new THREE.Group();
  const right: V2[] = [
    [0.62, -0.017],
    [0.49, -0.017],
    [0.49, -0.034],
    [0.42, 0],
    [0.49, 0.034],
    [0.49, 0.017],
    [0.62, 0.017]
  ];
  const left: V2[] = right.map(([x, y]): V2 => [-x, y]).reverse();
  g.add(mesh(extrude(shapeFrom(right), 0.008, 0.001, 8), paint(ARROW)));
  g.add(mesh(extrude(shapeFrom(left), 0.008, 0.001, 8), paint(ARROW)));
  return g;
}

/**
 * 고리 회전 방향 화살표 쌍: set(dir) 로 지금 도는 쪽만 보인다(+1 반시계 — 풀기, −1 시계 — 재결합, 0 숨김).
 * 110° 빈 곳을 아래(팔 쪽)로 돌려 팔을 가리지 않는다. 라벨 토글이 두 화살표를 모두 켜면 모델이 set(dir) 을 다시 불러 준다.
 */
export function swingArrows177(r: number): { group: THREE.Group; set(dir: number): void } {
  const group = new THREE.Group();
  const ccw = rotArrow(r, true);
  const cw = rotArrow(r, false);
  cw.visible = false;
  ccw.rotation.z = 28 * DEG;
  cw.rotation.z = -82 * DEG;
  group.add(ccw, cw);
  return {
    group,
    set(dir: number): void {
      if (dir === 0) return;
      ccw.visible = dir > 0;
      cw.visible = dir < 0;
    }
  };
}
