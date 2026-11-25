// 179번 전용 키트 — 단일 기관 역전 장치(슬립 편심)
// 축에 헐겁게 끼운 편심(바퀴), 축 단면의 돌기(스터드)가 편심 옆의 반원형 홈 벽을 밀어 구동한다.
// 세운 레버 → 링크 → 편심 막대(후크)를 들어 올리면 밸브 심축이 풀리고, 축이 반대로 돌며
// 돌기가 홈 반 바퀴를 미끄러져 반대쪽 벽 끝에 물린다(타이밍 180° 전환). 운동식 reverse179.
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';
import { circleIntersect, rotArrow } from './misc';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

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

/** 179번 치수(세계 좌표·길이). 판화 비: 스트랩 바깥 64px ≈ 0.42 — 편심 바깥 52px ≈ 0.34, 축 구멍 42px(과장) */
export const K179 = {
  /** 편심 축(기관 축) 중심 — 축은 Z 방향(판화 오른쪽 그림 = 정면) */
  E: [1.1, 1.62] as V2,
  /** 축 반지름, 편심 구멍(헐거움), 바퀴 바깥, 두르는 테 안·바깥 */
  shaftR: 0.13,
  boreR: 0.155,
  sheaveR: 0.34,
  rimR0: 0.28,
  rimR1: 0.315,
  /** 돌기(스터드): 축 단면에서의 거리, 반지름 — 홈 벽 안면 0.154 와 0.004 유격 */
  studRho: 0.115,
  studR: 0.035,
  pocketR0: 0.154,
  pocketR1: 0.199,
  /** 편심거리 e(심축 행정 = 2e)와 편심 막대 아래 핀 반지름 */
  throwR: 0.16,
  pinR: 0.04,
  /** 편심 막대: 핀눈→후크 거리, 홈선 높이, 심축 x = 후크 x − tenOff */
  rodL: 0.56,
  slotY: 1.55,
  tenOff: 0.36,
  /** 세운 레버: 받침 점, 기본 기울기, 팔 핀까지, 끝눈까지, 뒤꼬리 */
  leverP: [-0.6, 0.55] as V2,
  leverA0: 100 * DEG,
  leverArm: 1.3,
  leverLen: 2.05,
  leverTail: 0.16,
  /** 링크 길이(팔 핀 ↔ 후크 위 핀), 들어 올림 때 편심 막대가 핀 둘레에 휘는 각 */
  linkL: 1.4,
  /** 후크 머리(세계 방향 고정)에서 링크 거는 핀까지 위로 */
  crossDy: 0.04,
  liftSwing: 10 * DEG,
  /** 글랜드 x(세계) */
  glandX: -0.3,
  /** 층(세계 z) */
  zShaft1: 0.395,
  zSheave0: 0.26,
  zSheave1: 0.4,
  zRod0: 0.45,
  zLink0: 0.475,
  zSpindle: 0.14,
  zTenon1: 0.495,
  zArrow: 0.595,
  /** 한 주기 theta: 가 2π · 나 1.2 · 다 π · 마 1.2 · 라 2π · 바 1.2 · 사 π · 자 1.2 */
  period: 23.6496,
  phase: [6.2832, 1.2, 3.1416, 1.2, 6.2832, 1.2, 3.1416, 1.2] as [number, number, number, number, number, number, number, number]
} as const;

/** 돌기의 각반폭 = asin(studR/studRho) — 벽 끝면에 닿는 간격. 홈 호 = π − 2·offset (슬립이 정확히 반 바퀴) */
export const K179_A = {
  offset: Math.asin(K179.studR / K179.studRho),
  betaA: Math.asin(K179.studR / K179.studRho),
  span: Math.PI - 2 * Math.asin(K179.studR / K179.studRho)
} as const;

const smooth = (x: number): number => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

export interface Reverse179 {
  /** 주기 안의 자리 u = mod(theta, period) */
  u: number;
  /** 축 각(rad) — 가에서 u − 1 로 쌓인다(판화: 돌기가 오른쪽 = t 1) */
  sigma: number;
  /** 편심 각(rad) — 가·라는 축에 물려 따라가고, 나·다·바·사는 멈춘다(막대가 올라가 풀렸다) */
  psi: number;
  /** 레버 절대 각(rad) — lever.rotation.z 에 그대로 */
  leverAng: number;
  /** 후크 위치(U 홈 가운데, 세계) = 편심 막대 끝 */
  hook: V2;
  /** 편심 핀 위치(세계) — 편심 막대의 눈이 꿰는 자리 */
  pin: V2;
  /** 밸브 심축 x — 심축 그룹 position.x */
  spindleX: number;
  /** 축 방향 화살표: +1 반시계 · −1 시계 · 0 숨김(축이 멈춘 단계) */
  dir: 1 | -1 | 0;
  /** 단계 0~7 (가·나·다·마·라·바·사·자) */
  stage: number;
}

/** 맞물림 때의 후크(홈선 위): 편심 핀에서 홈선(y = slotY)에 이르는 막대 */
function slotHook(sigma: number, k: number): V2 {
  const psi = sigma + k;
  const px = K179.E[0] + K179.throwR * Math.cos(psi);
  const py = K179.E[1] + K179.throwR * Math.sin(psi);
  const dy = py - K179.slotY;
  const h = Math.sqrt(K179.rodL * K179.rodL - dy * dy);
  return [px - h, K179.slotY];
}

/** 레버 절대 각: 링크 길이를 맞추는 팔 핀 자리(L1) — 기본 기울기 a0 에 가까운 해 */
function leverAngFor(hook: V2): number {
  const top: V2 = [hook[0], hook[1] + K179.crossDy];
  const up = circleIntersect(K179.leverP, K179.leverArm, top, K179.linkL, true);
  const dn = circleIntersect(K179.leverP, K179.leverArm, top, K179.linkL, false);
  let best = K179.leverA0;
  let bestD = Infinity;
  for (const s of [up, dn]) {
    if (!s) continue;
    const ang = Math.atan2(s[1] - K179.leverP[1], s[0] - K179.leverP[0]);
    let d = Math.abs(ang - K179.leverA0);
    while (d > Math.PI) d = TAU - d;
    if (d < bestD) {
      bestD = d;
      best = ang;
    }
  }
  return best;
}

/** 179번 운동(theta 의 닫힌 식): 8 단계 주기표 — 원문의 들기·풀림·반 바퀴 미끄러짐·내리기가 한 주기 */
export function reverse179(theta: number): Reverse179 {
  const u = ((theta % K179.period) + K179.period) % K179.period;
  const P = K179.phase;
  const b1 = P[0];
  const b2 = b1 + P[1];
  const b3 = b2 + P[2];
  const b4 = b3 + P[3];
  const b5 = b4 + P[4];
  const b6 = b5 + P[5];
  const b7 = b6 + P[6];
  const pinAt = (psi: number): V2 => [K179.E[0] + K179.throwR * Math.cos(psi), K179.E[1] + K179.throwR * Math.sin(psi)];
  // 정지 핀(나~마 · 바~자 모두 같은 점)에서의 쉼 자리와 들아 올린 자리(막대가 핀 둘레에 휜다)
  const parkPsi = 5.2832;
  const parkPin = pinAt(parkPsi);
  const rest = slotHook(parkPsi, 0);
  const alpha0 = Math.atan2(rest[1] - parkPin[1], rest[0] - parkPin[0]);
  const hookAt = (s: number): V2 => [
    parkPin[0] + K179.rodL * Math.cos(alpha0 - K179.liftSwing * s),
    parkPin[1] + K179.rodL * Math.sin(alpha0 - K179.liftSwing * s)
  ];

  let sigma = 0;
  let psi = 0;
  let leverAng = K179.leverA0;
  let hook: V2 = [0, K179.slotY];
  let spindleX = rest[0] - K179.tenOff;
  let dir: 1 | -1 | 0 = 0;
  let stage = 0;
  let track = true;
  let s = 0;

  if (u < b1) {
    // 가 — 물림 A, 순행
    stage = 0;
    sigma = u - 1;
    psi = sigma;
    hook = slotHook(sigma, 0);
    dir = 1;
  } else if (u < b2) {
    // 나 — 레버가 링크를 당겨 편심 막대를 들어 올린다(축·편심 멈춤, 심축 풀림)
    stage = 1;
    sigma = parkPsi;
    psi = parkPsi;
    s = smooth((u - b1) / P[1]);
    dir = 0;
    track = false;
  } else if (u < b3) {
    // 다 — 축이 반대로 π: 편심은 멈춘 채 돌기가 홈을 반 바퀴 미끄러진다
    stage = 2;
    sigma = parkPsi - (u - b2);
    psi = parkPsi;
    s = 1;
    dir = -1;
    track = false;
  } else if (u < b4) {
    // 마 — 막대를 내려 물림 B에 얹는다(심축은 후크를 따라감)
    stage = 3;
    sigma = 2.1416;
    psi = parkPsi;
    s = 1 - smooth((u - b3) / P[3]);
    dir = 0;
  } else if (u < b5) {
    // 라 — 물림 B, 역행(밸브 타이밍이 반 바퀴 바뀌었다)
    stage = 4;
    sigma = 2.1416 - (u - b4);
    psi = sigma + Math.PI;
    hook = slotHook(sigma, Math.PI);
    dir = -1;
  } else if (u < b6) {
    // 바 — 다시 들어 올린다(되돌이를 위한 왕복)
    stage = 5;
    sigma = -4.1416;
    psi = sigma + Math.PI;
    s = smooth((u - b5) / P[5]);
    dir = 0;
    track = false;
    spindleX = slotHook(-4.1416, Math.PI)[0] - K179.tenOff;
  } else if (u < b7) {
    // 사 — 축이 순행으로 π: 돌기가 홈을 반 바퀴 되미끄러진다
    stage = 6;
    sigma = -4.1416 + (u - b6);
    psi = -1;
    s = 1;
    dir = 1;
    track = false;
    spindleX = slotHook(-4.1416, Math.PI)[0] - K179.tenOff;
  } else {
    // 자 — 내려 물림 A에 얹는다. u = period 에서 가 시작과 같은 자세
    stage = 7;
    sigma = -1;
    psi = -1;
    s = 1 - smooth((u - b7) / P[7]);
    dir = 0;
  }

  const pin = pinAt(psi);
  if ((stage >= 1 && stage <= 3) || stage >= 5) hook = hookAt(s);
  leverAng = leverAngFor(hook);
  if (track) spindleX = hook[0] - K179.tenOff;
  return { u, sigma, psi, leverAng, hook, pin, spindleX, dir, stage };
}

/** 홈 벽(반원형 돌기)의 자유 공간(홈 구멍) 윤곽 — 돌기가 미끄러져 다니는 자리 */
export function pocketHole179(): V2[] {
  const a0 = K179_A.betaA + K179_A.span;
  const a1 = K179_A.betaA + TAU;
  const pts: V2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24;
    pts.push([K179.pocketR0 * Math.cos(a), K179.pocketR0 * Math.sin(a)]);
  }
  for (let i = 24; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 24;
    pts.push([0.075 * Math.cos(a), 0.075 * Math.sin(a)]);
  }
  return pts;
}

/**
 * 기관 축(돌기와 한 몸, 돈다): 원점 = 축 축선. 축 z −0.20~0.395,
 * 단면 돌기 (0.115, 0) 반지름 0.035, z 0.395~0.44. child `studPin`(돌기 원 outline).
 */
export function shaft179(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(K179.shaftR, -0.185, K179.zShaft1, 0.006, 36), steel()));
  g.add(meshAt(cylZ(K179.studR, K179.zShaft1, 0.435, 0.004, 24), darkSteel(), K179.studRho, 0, 0));
  g.add(meshAt(cylZ(K179.studR + 0.008, 0.425, 0.44, 0.003, 24), darkSteel(), K179.studRho, 0, 0));
  const mark = pinMark('studPin', K179.studRho, 0, 0.42);
  mark.userData.outline = circlePts(K179.studR, 24);
  g.add(mark);
  setMM(g, { kind: 'shaft', r: K179.shaftR });
  return g;
}

/** 축 받침(고정): 뒤판 보스 + 칼라 관(구멍이 축 방향 Z) + 받침판. child `bearingPin`(축선 표식) */
export function shaftBearing179(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.17, STAGE.backZ, -0.185, 0.008, 32), castIron()));
  g.add(mesh(tubeZ(0.135, 0.19, -0.185, 0.1, 0.005, 36), castIron()));
  g.add(meshAt(new THREE.BoxGeometry(0.36, 0.3, 0.115), castIron(), 0, -0.16, -0.2425));
  g.add(pinMark('bearingPin', 0, 0, 0));
  setMM(g, { kind: 'pillow' });
  return g;
}

/**
 * 편심 바퀴(축에 헐겁게, 돈다): 원점 = 축 축선. 바퀴 z 0.26~0.40, 두르는 테 0.40~0.425,
 * 반원형 홈 벽 0.40~0.435, 위·아래 리벳 귀, 편심 핀(−0.16, 0).
 * userData.outlines.pocketHole = 홈 자유 공간(돌기가 다니는 자리).
 */
export function eccentric179(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  g.add(mesh(tubeZ(K179.boreR, K179.sheaveR, K179.zSheave0, K179.zSheave1, 0.006, 48), iron));
  g.add(mesh(tubeZ(K179.rimR0, K179.rimR1, K179.zSheave1, 0.425, 0.004, 44), iron));
  // 반원형 홈 벽 — 호는 π−2·offset 이면 슬립이 정확히 반 바퀴가 된다
  g.add(meshAt(extrude(shapeFromWall(), 0.035, 0.004, 40), brass(), 0, 0, K179.zSheave1));
  // 위·아래 리벳 귀(판화의 두 귀)
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const tab: V2[] = [
      [K179.sheaveR * ca - 0.035 * sa, K179.sheaveR * sa - 0.035 * ca],
      [K179.sheaveR * ca + 0.035 * sa, K179.sheaveR * sa + 0.035 * ca],
      [(K179.sheaveR + 0.02) * ca + 0.035 * sa, (K179.sheaveR + 0.02) * sa + 0.035 * ca],
      [(K179.sheaveR + 0.02) * ca - 0.035 * sa, (K179.sheaveR + 0.02) * sa - 0.035 * ca]
    ];
    g.add(meshAt(extrude(shapeFrom(tab), 0.08, 0.004, 8), iron, 0, 0, 0.33));
    g.add(meshAt(cylZ(0.018, 0.37, 0.385, 0.003, 16), steel(), 0.352 * ca, 0.352 * sa, 0));
  }
  // 편심 핀(편심 막대의 눈이 꿰는 자리) — 로컬 (−0.16, 0)
  g.add(meshAt(cylZ(0.075, K179.zSheave1, 0.44, 0.004, 28), steel(), -K179.throwR, 0, 0));
  g.add(meshAt(cylZ(K179.pinR, K179.zSheave1, 0.52, 0.004, 24), steel(), -K179.throwR, 0, 0));
  g.add(meshAt(cylZ(0.055, 0.51, 0.525, 0.003, 24), darkSteel(), -K179.throwR, 0, 0));
  g.add(pinMark('rodPin', -K179.throwR, 0, 0.48));
  g.userData.outlines = { pocketHole: pocketHole179() };
  setMM(g, { kind: 'eccentric', r: K179.sheaveR });
  return g;
}

/** 홈 벽 호의 Shape (반지름 0.154~0.199, 각 βA ~ βA+span) */
function shapeFromWall(): THREE.Shape {
  const pts: V2[] = [];
  const a0 = K179_A.betaA;
  const a1 = K179_A.betaA + K179_A.span;
  for (let i = 0; i <= 28; i++) {
    const a = a0 + ((a1 - a0) * i) / 28;
    pts.push([K179.pocketR1 * Math.cos(a), K179.pocketR1 * Math.sin(a)]);
  }
  for (let i = 28; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 28;
    pts.push([K179.pocketR0 * Math.cos(a), K179.pocketR0 * Math.sin(a)]);
  }
  return shapeFrom(pts);
}

/**
 * 편심 막대(후크 달림): 원점 = 아래 눈 중심(편심 핀), 로컬 +X 를 후크 쪽, z 0~0.06(세계 0.45~0.51).
 * 눈(구멍 0.048) → 막대 → 후크 덩이(U 홈은 아래가 열려 핀을 물고, 위로 들리면 빠진다).
 * child `hookPin`(U 가운데), `crossPin`(링크 거는 핀).
 */
export function eccRod179(): THREE.Group {
  const g = new THREE.Group();
  const steelM = steel();
  const eye = shapeFrom(circlePts(0.075, 32));
  eye.holes.push(pathFrom(circlePts(0.048, 24)));
  g.add(mesh(extrude(eye, 0.06, 0.004, 24), steelM));
  const bar: V2[] = [
    [0.055, -0.03],
    [0.44, -0.024],
    [0.44, 0.024],
    [0.055, 0.03]
  ];
  g.add(mesh(extrude(shapeFrom(bar), 0.06, 0.004, 8), steelM));
  // 후크 머리 — 세계 방향이 고정(모델이 rotation.z = −막대 각). 아래가 열린 U 홈(x ±0.07, 천장 y 0.004)
  const head = new THREE.Group();
  head.name = 'hookHead';
  head.position.set(0.56, 0, 0);
  const headShape = shapeFrom([
    [-0.12, -0.07],
    [0.12, -0.07],
    [0.12, 0.07],
    [-0.12, 0.07]
  ] as V2[]);
  headShape.holes.push(
    pathFrom([
      [-0.07, -0.072],
      [0.07, -0.072],
      [0.07, 0.004],
      [-0.07, 0.004]
    ] as V2[])
  );
  head.add(mesh(extrude(headShape, 0.06, 0.004, 8), darkSteel()));
  // 링크 거는 핀(머리 위쪽)
  head.add(meshAt(cylZ(0.02, 0, 0.105, 0.004, 20), steelM, 0, K179.crossDy, 0));
  head.add(meshAt(cylZ(0.026, 0.09, 0.105, 0.003, 20), darkSteel(), 0, K179.crossDy, 0));
  head.add(pinMark('hookPin', 0, 0, 0.03));
  head.add(pinMark('crossPin', 0, K179.crossDy, 0.075));
  g.add(head);
  setMM(g, { kind: 'rod', length: K179.rodL });
  return g;
}

/**
 * 밸브 심축(슬라이드): 원점 = 축선, 모델이 position.x = spindleX. 둥근 막대 x −0.97~0.16,
 * 홈 막대 0.16~0.75(위에 얕은 장식 홈), 심축 핀 받침(받침대 위) x 0.36 + 핀 z 0.445~0.495. child `tenonPin`.
 */
export function spindle179(): THREE.Group {
  const g = new THREE.Group();
  const steelM = steel();
  g.add(mesh(rodBarZ(), steelM));
  const bar: V2[] = [
    [0.16, -0.075],
    [0.5, -0.075],
    [0.5, 0.075],
    [0.16, 0.075]
  ];
  g.add(meshAt(extrude(shapeFrom(bar), 0.06, 0.004, 8), castIron(), 0, 0, K179.zSpindle + 0.03));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.07, 0.245), steelM, 0.36, 0.11, 0.3225));
  g.add(meshAt(cylZ(0.032, 0.445, K179.zTenon1, 0.003, 20), darkSteel(), 0.36, 0.11, 0));
  g.add(pinMark('tenonPin', 0.36, 0.11, 0.47));
  setMM(g, { kind: 'spindle' });
  return g;
}

/** 심축 둥근 막대(x −0.97~0.16, 반지름 0.038, z 0.14~0.20) */
function rodBarZ(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.038, 0.038, 1.13, 24);
  g.rotateZ(Math.PI / 2);
  g.translate(-0.405, 0, K179.zSpindle + 0.03);
  return g;
}

/** 글랜드(고정): 뒤판 받침 기둥 + 플랜지 디스크 둘 — 심축이 지나가는 구멍(0.044) */
export function spindleGuide179(): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(0.18, 0.18, 0.4), castIron(), 0, 0, -0.1));
  // 심축이 지나는 고리(구멍이 X 방향)
  const ring = lathe(tubeProfile(0.044, 0.1, -0.09, 0.09, 0.004), 32);
  ring.rotateZ(-Math.PI / 2);
  g.add(meshAt(ring, castIron(), 0, 0, K179.zSpindle + 0.03));
  setMM(g, { kind: 'pillow' });
  return g;
}

/**
 * 세운 레버(손잡이): 원점 = 받침 점, 로컬 +X 가 몸(모델이 rotation.z = leverAng).
 * 꼬리 −0.16, 받침 구멍 0.078, 끝눈(바깥 0.055·구멍 0.03), 팔 핀 x 1.30(child `leverPin`).
 */
export function lever179(): THREE.Group {
  const g = new THREE.Group();
  const bar: V2[] = [
    [0.09, -0.04],
    [0.5, -0.036],
    [K179.leverLen - 0.06, -0.028],
    [K179.leverLen - 0.06, 0.028],
    [0.5, 0.036],
    [0.09, 0.04]
  ];
  g.add(mesh(extrude(shapeFrom(bar), 0.06, 0.004, 12), steel()));
  const hub = shapeFrom(circlePts(0.11, 36));
  hub.holes.push(pathFrom(circlePts(0.078, 32)));
  g.add(mesh(extrude(hub, 0.06, 0.004, 24), steel()));
  const eye = shapeFrom(circlePts(0.055, 28));
  eye.holes.push(pathFrom(circlePts(0.03, 20)));
  g.add(meshAt(extrude(eye, 0.06, 0.004, 20), darkSteel(), K179.leverLen, 0, 0));
  g.add(meshAt(cylZ(0.02, 0, 0.105, 0.004, 20), steel(), K179.leverArm, 0, 0));
  g.add(meshAt(cylZ(0.026, 0.09, 0.105, 0.003, 20), darkSteel(), K179.leverArm, 0, 0));
  g.add(pinMark('leverPin', K179.leverArm, 0, 0.075));
  setMM(g, { kind: 'lever', length: K179.leverLen });
  return g;
}

/** 레버 받침(고정): 받침판 + 버팀삼각 둘 + 보스(레버 구멍 0.078 이 얹힌다). child `pivotPin` */
export function leverStand179(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  const p = K179.leverP;
  g.add(meshAt(new THREE.BoxGeometry(0.38, 0.06, 0.24), iron, p[0], 0.21, 0.54));
  const gusset: V2[] = [
    [p[0] - 0.19, 0.24],
    [p[0] + 0.19, 0.24],
    [p[0], 0.5]
  ];
  g.add(meshAt(extrude(shapeFrom(gusset), 0.02, 0.002, 8), iron, 0, 0, 0.39));
  g.add(meshAt(extrude(shapeFrom(gusset), 0.02, 0.002, 8), iron, 0, 0, 0.55));
  g.add(meshAt(cylZ(0.075, 0.39, 0.515, 0.005, 32), iron, p[0], p[1], 0));
  g.add(meshAt(cylZ(0.088, 0.515, 0.57, 0.004, 32), iron, p[0], p[1], 0));
  g.add(pinMark('pivotPin', p[0], p[1], 0.45));
  setMM(g, { kind: 'pillow' });
  return g;
}

/** 링크(레버 ↔ 편심 막대): 원점 = 아래눈(팔 핀), 로컬 +X 로 linkL. 위눈은 후크 위 핀에 건다 */
export function link179(): THREE.Group {
  const g = new THREE.Group();
  const dark = darkSteel();
  const eye = shapeFrom(circlePts(0.034, 24));
  eye.holes.push(pathFrom(circlePts(0.024, 20)));
  g.add(mesh(extrude(eye, 0.03, 0.003, 16), dark));
  g.add(meshAt(extrude(eye, 0.03, 0.003, 16), dark, K179.linkL, 0, 0));
  const body = new THREE.CylinderGeometry(0.016, 0.016, K179.linkL - 0.05, 16);
  body.rotateZ(Math.PI / 2);
  g.add(meshAt(body, dark, K179.linkL / 2, 0, 0));
  g.add(pinMark('linkBot', 0, 0, 0.015));
  g.add(pinMark('linkTop', K179.linkL, 0, 0.015));
  setMM(g, { kind: 'link', length: K179.linkL });
  return g;
}

/** 축 방향 화살표 쌍: set(dir) — +1 반시계(가·사), −1 시계(다·라), 0 숨김. 빈 곳은 아래 */
export function shaftArrows179(r: number): { group: THREE.Group; set(dir: number): void } {
  const group = new THREE.Group();
  const ccw = rotArrow(r, true);
  const cw = rotArrow(r, false);
  cw.visible = false;
  ccw.rotation.z = 28 * DEG;
  cw.rotation.z = 28 * DEG;
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

/** 레버 방향 화살표 쌍(받침 점 둘레): 빈 곳이 아래. dir +1 반시계 · −1 시계 · 0 숨김 */
export function leverArrows179(r: number): { group: THREE.Group; set(dir: number): void } {
  const group = new THREE.Group();
  const ccw = rotArrow(r, true);
  const cw = rotArrow(r, false);
  cw.visible = false;
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
