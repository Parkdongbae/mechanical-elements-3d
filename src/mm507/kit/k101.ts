// 101·102·103번 전용 키트 — 직선 운동 묶음
//  101 매달린 홈 막대 슬라이더: 천장 걸이, 홈 막대(흔들 팔), 수평 미끄럼 막대(핀), 막대 안내 받침
//  102 볼트와 너트: 네모 나사산, 육각 머리 볼트, 육각 너트, 머리 받침 선반, 너트 돌림 막이 레일
//  103 나사로 미는 슬라이드: ㄴ자 틀(기둥·바닥·베드·안내 레일), 이송 나사, T자 슬라이드(너트)
// 치수 상수(K101·K102·K103)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s101.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, hexPrism, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { rotArrow } from './misc';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Y축 원기둥(y0~y1, 양끝 모따기 c) */
function cylY(r: number, y0: number, y1: number, c = 0.008, segs = 32): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}
/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.008, segs = 32): THREE.BufferGeometry {
  const g = cylY(r, z0, z1, c, segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.008, segs = 32): THREE.BufferGeometry {
  const g = cylY(r, x0, x1, c, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 36): THREE.BufferGeometry {
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
function rect(x0: number, y0: number, x1: number, y1: number): V2[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ];
}
/** (z, y) 단면을 X 방향으로 len 만큼 압출(가운데가 x = 0). holes 도 (z, y) */
function extrudeX(zy: V2[], holes: V2[][], len: number, c = 0.006): THREE.BufferGeometry {
  const flip = (p: V2[]): V2[] => p.map(([z, y]): V2 => [-z, y]).reverse();
  const shape = shapeFrom(flip(zy));
  for (const h of holes) shape.holes.push(pathFrom(flip(h)));
  const g = extrude(shape, len, c, 32);
  g.rotateY(Math.PI / 2);
  return g;
}
/** (x, z) 단면을 Y 방향으로 t 만큼 압출(가운데가 y = 0). 원 구멍(hx, hz, hr) 하나 가능 */
function extrudeY(xz: V2[], t: number, hole: { x: number; z: number; r: number } | null, c = 0.006): THREE.BufferGeometry {
  const shape = shapeFrom(xz);
  if (hole) shape.holes.push(circlePath(hole.x, hole.z, hole.r));
  const g = extrude(shape, t, c, 40);
  g.rotateX(Math.PI / 2);
  return g;
}

// ═══════════════════════════ 공용: 왕복 시간표·나사산·방향 화살표 ═══════════════════════════

/**
 * 삼각파(누적 오차 없는 왕복 시간표). u 가 0 → T 로 갈 때 a 가 0 → T, 다시 T → 2T 에서 a 가 T → 0. 주기 2T.
 * dir = +1(a 가 느는 중) / −1(주는 중). u 가 음수여도 같은 식.
 */
export function triWave(u: number, T: number): { a: number; dir: 1 | -1 } {
  const P = 2 * T;
  const m = ((u % P) + P) % P;
  return m < T ? { a: m, dir: 1 } : { a: P - m, dir: -1 };
}

/**
 * 나사가 각 beta(rad, 나사 축의 + 방향 둘레 반시계 = three.js rotation 의 + 방향)만큼 돌 때,
 * 돌지 못하게 잡힌 너트가 축의 + 방향으로 가는 거리. 오른나사는 −pitch·beta/2π, 왼나사는 +pitch·beta/2π.
 */
export function screwAdvance(pitch: number, beta: number, leftHand: boolean): number {
  return ((leftHand ? 1 : -1) * pitch * beta) / TAU;
}

export interface ScrewThreadOpts {
  /** 왼나사면 true. 기본 false(오른나사) */
  leftHand?: boolean;
  /** 산 끝 반폭 / 피치. 기본 0.2 */
  crest?: number;
  /** 산 뿌리 반폭 / 피치. 기본 0.25 */
  root?: number;
  /** 재질. 기본 steel */
  mat?: THREE.Material;
}

/**
 * 네모(각) 나사산 한 줄: 축 = 로컬 +Y, y = 0 ~ length. 심(coreR)에 0.006 묻힌 나선 띠 메시 하나를 돌려준다.
 * 산 중심선: 로컬 각 psi(+Z 에서 +X 쪽으로 잼)에서 y = root·pitch + pitch·psi/2π (오른나사). 왼나사는 x 를 뒤집은 거울상.
 * 정면(+Z)에서 세로 나사를 보면 오른나사 산은 "/" , 왼나사 산은 "\" 로 기운다(가로 +X 나사로 눕히면 오른나사가 "\").
 */
export function screwThread(coreR: number, outerR: number, pitch: number, length: number, o: ScrewThreadOpts = {}): THREE.Mesh {
  const hand = o.leftHand === true ? -1 : 1;
  const wt = (o.crest ?? 0.2) * pitch;
  const wr = (o.root ?? 0.25) * pitch;
  const rIn = coreR - 0.006;
  const prof: V2[] = [
    [-wr, rIn],
    [-wt, outerR],
    [wt, outerR],
    [wr, rIn]
  ];
  const turns = (length - 2 * wr) / pitch;
  const steps = Math.max(8, Math.ceil(turns * 48));
  const pos: number[] = [];
  const idx: number[] = [];
  const at = (u: number, r: number, j: number): [number, number, number] => {
    const psi = (j / steps) * TAU * turns;
    return [hand * r * Math.sin(psi), wr + (pitch * psi) / TAU + u, r * Math.cos(psi)];
  };
  for (let e = 0; e < 4; e++) {
    const a = prof[e]!;
    const b = prof[(e + 1) % 4]!;
    const base = pos.length / 3;
    for (let j = 0; j <= steps; j++) pos.push(...at(a[0], a[1], j), ...at(b[0], b[1], j));
    for (let j = 0; j < steps; j++) {
      const i0 = base + j * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
  }
  for (const j of [0, steps]) {
    const base = pos.length / 3;
    for (const [u, r] of prof) pos.push(...at(u, r, j));
    if (j === 0) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // 부피 부호로 바깥쪽이 앞면이 되게 감김 방향을 맞춘다(옆면이 부피를 정한다)
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
  const m = mesh(geo, o.mat ?? steel());
  setMM(m, { kind: 'thread', pitch, coreR, outerR, length, leftHand: hand < 0, axis: 'y' });
  return m;
}

/**
 * 방향이 바뀌는 회전 화살표 한 쌍. axis 의 + 방향 둘레로 도는 것을 보여 준다(원점 = 축 위).
 * set(+1) = 축 + 방향 둘레 반시계(three.js rotation 이 느는 쪽), set(−1) = 그 반대, set(0) = 둘 다 숨김.
 * axis 'z' 는 정면에서 보이는 보통 화살표, 'y' 는 눕힌 고리(세로축), 'x' 는 세운 고리(가로축).
 */
export function turnArrows(r: number, axis: 'x' | 'y' | 'z'): { group: THREE.Group; set(dir: number): void } {
  const group = new THREE.Group();
  const pos = rotArrow(r, true);
  const neg = rotArrow(r, false);
  group.add(pos, neg);
  if (axis === 'x') group.rotation.y = Math.PI / 2;
  if (axis === 'y') group.rotation.x = -Math.PI / 2;
  neg.visible = false;
  setMM(group, { kind: 'arrow', r, axis });
  return {
    group,
    set(dir: number): void {
      pos.visible = dir > 0;
      neg.visible = dir < 0;
    }
  };
}

// ═══════════════════════════ 101 매달린 홈 막대 슬라이더 ═══════════════════════════

/** 101번 치수(판화 비: 걸이 축 ~ 수평 막대 가운데선 H, 홈 0.75H ~ 1.55H, 팔 길이 2.4H, 판화 자세 28°) */
export const K101 = {
  /** 걸이 축에서 수평 막대 가운데선까지(세로) */
  H: 0.86,
  /** 흔들림 반각(rad) — 판화 자세 = 오른쪽 끝 */
  amp: 28 * DEG,
  /** 홈 막대: 눈 바깥 반지름·걸이 핀 반지름 */
  eyeR: 0.12,
  pivotR: 0.05,
  /** 홈 양끝 둥근 중심의 거리(걸이 축에서) */
  slot0: 0.7,
  slot1: 1.27,
  /** 홈 반폭(= 핀 반지름 + 틈 0.003) */
  slotHalf: 0.058,
  /** 홈 둘레 몸통 반폭 / 자루 반폭 / 꼬리 반폭 */
  bodyHalf: 0.125,
  stemHalf: 0.055,
  tailHalf: 0.045,
  /** 팔 전체 길이(걸이 축 ~ 꼬리 끝 둥근 중심) */
  len: 2.05,
  /** 팔 두께(z) */
  armT: 0.06,
  /** 미끄럼 핀 반지름 */
  pinR: 0.055,
  /** 수평 막대: 길이·높이(y)·두께(z) */
  barL: 3.24,
  barH: 0.2,
  barT: 0.1,
  /** 안내 받침: 가로(x)·세로(y)·두께(z), 구멍과 막대 사이 틈 */
  guideW: 0.22,
  guideH: 0.68,
  guideT: 0.22,
  clear: 0.003
} as const;

/**
 * 101번 운동식. phi = 홈 막대의 기울기(rad, + 면 아래 끝이 +X 쪽), x = 수평 막대(핀)의 가로 이동,
 * s = 걸이 축에서 핀까지의 거리(홈 안에서 핀이 있는 자리), dir = 지금 도는 방향(+1 = 반시계).
 * t = 1(theta = 1.6)이 판화 자세(오른쪽 끝 28°).
 */
export function swing101(theta: number): { phi: number; x: number; s: number; dir: 1 | -1 } {
  const u = theta - 1.6;
  const phi = K101.amp * Math.cos(u);
  return { phi, x: K101.H * Math.tan(phi), s: K101.H / Math.cos(phi), dir: Math.sin(u) > 0 ? -1 : 1 };
}

/**
 * 천장 걸이(101번): 원점 = 걸이 축(핀) 중심, 로컬 z = 0 은 걸이 귀(판)의 가운데 평면.
 * 천장 들보(나무)는 뒤판(로컬 z = −back)에 붙어 앞으로 나오고, 귀가 들보 밑에 달린다. 걸이 핀은 z = −0.03 ~ pinTop.
 * x0·x1 = 들보의 가로 범위(로컬). 들보 아랫면 y = drop.
 */
export function ceilingHanger101(back: number, pinTop: number, o: { x0?: number; x1?: number; drop?: number; beamH?: number; front?: number } = {}): THREE.Group {
  const x0 = o.x0 ?? -0.94;
  const x1 = o.x1 ?? 1.02;
  const drop = o.drop ?? 0.16;
  const beamH = o.beamH ?? 0.14;
  const front = o.front ?? 0.23;
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(x1 - x0, beamH, back + front), wood(), (x0 + x1) / 2, drop + beamH / 2, (front - back) / 2));
  const lug: V2[] = [[-0.22, drop + 0.004], ...arc(0, 0, 0.105, 200 * DEG, 340 * DEG, 14), [0.22, drop + 0.004]];
  const shape = shapeFrom(lug);
  shape.holes.push(circlePath(0, 0, K101.pivotR + 0.002));
  g.add(mesh(extrude(shape, 0.06, 0.006, 16), castIron({ roughness: 0.6 })));
  g.add(mesh(cylZ(K101.pivotR, -0.03, pinTop, 0.006), steel()));
  g.add(mesh(cylZ(K101.pivotR * 1.6, pinTop, pinTop + 0.02, 0.005), darkSteel()));
  g.add(mesh(tubeZ(K101.pivotR + 0.002, K101.pivotR * 1.7, 0.03, 0.07, 0.004), darkSteel())); // 귀와 팔 사이 와셔
  const p = new THREE.Object3D();
  p.name = 'hangPivot';
  g.add(markPin(p));
  setMM(g, { kind: 'hanger', pivot: [0, 0, 0] });
  return g;
}

/** 홈 막대의 홈 윤곽(팔 로컬: 원점 = 걸이 축, 팔은 −Y 로 늘어진다) */
export function slotPts101(): V2[] {
  const r = K101.slotHalf;
  return [...arc(0, -K101.slot1, r, Math.PI, TAU, 12), ...arc(0, -K101.slot0, r, 0, Math.PI, 12)];
}

/**
 * 홈 막대(101번, 흔들 팔): 원점 = 걸이 축 구멍 중심, 팔은 로컬 −Y 로 늘어진다. 두께 가운데 z = 0.
 * 눈(고리) → 가는 자루 → 홈 난 넓은 몸통 → 가는 꼬리(손으로 잡는 끝). rotation.z = phi 로 흔든다.
 * userData.outlines.slotHole = 홈 윤곽(미끄럼 핀이 이 안에 있어야 한다).
 */
export function slottedArm101(): THREE.Group {
  const k = K101;
  const g = new THREE.Group();
  const y0 = -(k.slot0 - k.slotHalf - 0.06); // 넓은 몸통이 시작하는 곳
  const y1 = -(k.slot1 + k.slotHalf + 0.06);
  const right: V2[] = [
    [k.stemHalf, -0.09],
    [k.stemHalf, y0 + 0.1],
    [k.bodyHalf, y0],
    [k.bodyHalf, y1],
    [k.tailHalf, y1 - 0.12],
    ...arc(0, -k.len, k.tailHalf, 0, -Math.PI, 10)
  ];
  const left: V2[] = [
    [-k.tailHalf, y1 - 0.12],
    [-k.bodyHalf, y1],
    [-k.bodyHalf, y0],
    [-k.stemHalf, y0 + 0.1],
    [-k.stemHalf, -0.09]
  ];
  const hole = slotPts101();
  const shape = shapeFrom([...right, ...left].reverse());
  shape.holes.push(pathFrom(hole));
  g.add(mesh(extrude(shape, k.armT, 0.008, 16), steel()));
  g.add(mesh(tubeZ(k.pivotR + 0.002, k.eyeR, -k.armT / 2, k.armT / 2, 0.008), steel()));
  g.add(meshAt(new THREE.BoxGeometry(0.014, 0.3, 0.006), paint(MARK), 0, -(k.slot1 + k.len) / 2 - 0.05, k.armT / 2 + 0.002));
  g.userData.outlines = { slotHole: hole };
  const tip = new THREE.Object3D();
  tip.name = 'armTip';
  tip.position.set(0, -k.len, 0);
  g.add(tip);
  setMM(g, { kind: 'lever', length: k.len, pivot: [0, 0, 0], tip: [0, -k.len, 0] });
  return g;
}

/**
 * 수평 미끄럼 막대(101번): 원점 = 핀 축이 막대 가운데선과 만나는 점(막대 길이의 한가운데), 막대는 X 로 길다.
 * 네모 단면(barH × barT), 두께 가운데 z = 0. 핀은 앞면에서 +Z 로 pinTop 까지 솟고, capZ 에 빠짐 막이 원판(홈 막대 앞면 바로 앞).
 * 핀 메시에 userData.outline(원), 핀 표식 child 'barPin'(z = armZ).
 */
export function slideBar101(armZ: number, capZ: number, pinTop: number): THREE.Group {
  const k = K101;
  const g = new THREE.Group();
  g.add(mesh(extrude(shapeFrom(rect(-k.barL / 2, -k.barH / 2, k.barL / 2, k.barH / 2)), k.barT, 0.008), bronze({ roughness: 0.4 })));
  const pin = mesh(cylZ(k.pinR, k.barT / 2 - 0.004, pinTop, 0.008, 36), steel());
  pin.userData.outline = circlePts(k.pinR, 32);
  g.add(pin);
  g.add(mesh(tubeZ(k.pinR - 0.002, k.pinR * 1.65, capZ, capZ + 0.022, 0.004), darkSteel()));
  for (const x of [-0.55, 0.5]) g.add(meshAt(new THREE.BoxGeometry(0.014, k.barH * 0.7, 0.006), paint(MARK), x, 0, k.barT / 2 + 0.002));
  const p = new THREE.Object3D();
  p.name = 'barPin';
  p.position.set(0, 0, armZ);
  g.add(markPin(p));
  setMM(g, { kind: 'slider', axis: 'x', len: k.barL, h: k.barH });
  return g;
}

/**
 * 막대 안내 받침(101번): 원점 = 네모 구멍의 중심(= 막대 가운데선), 구멍은 X 방향으로 뚫렸다(막대가 꿰어 지나감).
 * 세로로 긴 판(guideW × guideH × guideT) + 위·아래 볼트 머리 + 뒤판(로컬 z = −back)까지의 받침 덩이.
 */
export function barGuide101(back: number): THREE.Group {
  const k = K101;
  const g = new THREE.Group();
  const hh = k.barH / 2 + k.clear;
  const ht = k.barT / 2 + k.clear;
  g.add(mesh(extrudeX(rect(-k.guideT / 2, -k.guideH / 2, k.guideT / 2, k.guideH / 2), [rect(-ht, -hh, ht, hh)], k.guideW, 0.008), castIron({ roughness: 0.6 })));
  for (const sy of [-1, 1]) {
    // 받침 덩이는 구멍 위·아래로 나눠 뒤판까지(막대가 지나는 자리는 비운다)
    const y = sy * (hh + (k.guideH / 2 - hh) / 2);
    g.add(meshAt(new THREE.BoxGeometry(k.guideW * 0.8, k.guideH / 2 - hh - 0.01, back - k.guideT / 2 + 0.004), castIron(), 0, y, (-back - k.guideT / 2 + 0.004) / 2));
    const nut = hexPrism(0.07, 0.03, false, true, 0);
    nut.rotateX(Math.PI / 2);
    g.add(meshAt(nut, darkSteel(), 0, sy * (k.guideH / 2 - 0.1), k.guideT / 2 + 0.013));
  }
  setMM(g, { kind: 'guide', axis: 'x', hole: [k.barT + 2 * k.clear, k.barH + 2 * k.clear] });
  return g;
}

// ═══════════════════════════ 102 볼트와 너트 ═══════════════════════════

/** 102번 치수(판화 비: 머리 맞모 0.83 = 나사 바깥지름의 1.57배, 피치 0.2, 머리 밑 ~ 너트 밑 1.78) */
export const K102 = {
  /** 육각 맞변 거리(머리·너트 같음). 모서리 반지름 = af/√3 = 0.4157 */
  af: 0.72,
  headH: 0.4,
  nutH: 0.42,
  coreR: 0.19,
  outerR: 0.265,
  pitch: 0.2,
  /** 나사부 길이(머리 밑면에서 아래로) */
  threadL: 1.78,
  /** 둥근 끝 높이 */
  dome: 0.07,
  /** 판화의 나사산은 정면에서 "\" 로 기운다 = 왼나사 */
  leftHand: true,
  /** 너트가 한쪽으로 가는 동안 볼트가 도는 바퀴 수 */
  turns: 3,
  /** 선반 두께·구멍 반지름 */
  shelfT: 0.08,
  shelfHole: 0.275
} as const;

/** 육각 모서리 반지름 */
export const HEX_R102 = K102.af / Math.sqrt(3);

/**
 * 102번 주기 시간표(주기 = 2·turns·2π rad = 12π). a = 볼트가 돈 양(0 ~ turns·2π), beta = 볼트의 rotation.y,
 * rise = 너트가 가장 낮은 자리(판화 자세)에서 올라간 높이 = pitch·a/2π, dir = 볼트 회전 방향(rotation.y 가 느는 쪽 +1).
 * t = 1(theta = 1.6)에 너트가 맨 아래(판화 자세)에서 올라가기 시작한다.
 */
export function bolt102(theta: number): { a: number; beta: number; rise: number; dir: 1 | -1 } {
  const w = triWave(theta - 1.6, K102.turns * TAU);
  const hand = K102.leftHand ? 1 : -1;
  const beta = hand * w.a;
  return { a: w.a, beta, rise: screwAdvance(K102.pitch, beta, K102.leftHand), dir: (hand * w.dir) as 1 | -1 };
}

/**
 * 육각 머리 볼트(102번): 축 = 로컬 Y, 원점 = 머리 밑면의 중심. 머리는 위(+Y)로 headH, 나사부는 아래로 threadL, 그 밑에 둥근 끝.
 * 육각의 납작한 면이 ±Z 를 본다(정면에서 세 면이 보임). rotation.y = beta 로 돌린다. 머리 윗면에 표시줄.
 */
export function screwBolt102(): THREE.Group {
  const k = K102;
  const g = new THREE.Group();
  const head = hexPrism(k.af, k.headH, false, true, 0);
  head.rotateY(Math.PI / 6);
  g.add(meshAt(head, darkSteel(), 0, k.headH / 2, 0));
  g.add(mesh(cylY(k.coreR, -k.threadL, 0.004, 0), steel()));
  const dome: V2[] = [[0, -k.threadL - k.dome]];
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    dome.push([k.coreR * 0.98 * Math.sin(a), -k.threadL - k.dome * Math.cos(a)]);
  }
  dome.push([0, -k.threadL]);
  g.add(mesh(lathe(dome, 32), steel()));
  const th = screwThread(k.coreR, k.outerR, k.pitch, k.threadL, { leftHand: k.leftHand });
  th.position.y = -k.threadL;
  g.add(th);
  g.add(meshAt(new THREE.BoxGeometry(0.03, 0.006, k.af * 0.42), paint(MARK), 0, k.headH + 0.002, k.af * 0.24));
  g.add(meshAt(new THREE.BoxGeometry(0.03, k.headH * 0.5, 0.006), paint(MARK), 0, k.headH * 0.45, k.af / 2 + 0.002));
  setMM(g, { kind: 'screw', axis: 'y', pitch: k.pitch, coreR: k.coreR, outerR: k.outerR, leftHand: k.leftHand, length: k.threadL });
  return g;
}

/**
 * 육각 너트(102번): 축 = 로컬 Y, 원점 = 중심. 납작한 면이 ±Z(뒷면이 돌림 막이 레일에 닿는다). 구멍 = 나사 바깥지름 + 틈.
 * userData.outline = 정면 윤곽(네모).
 */
export function hexNut102(): THREE.Group {
  const k = K102;
  const g = new THREE.Group();
  const nut = hexPrism(k.af, k.nutH, true, true, k.outerR + 0.004);
  nut.rotateY(Math.PI / 6);
  const m = mesh(nut, bronze({ roughness: 0.36 }));
  g.add(m);
  g.userData.outline = rect(-HEX_R102, -k.nutH / 2, HEX_R102, k.nutH / 2);
  setMM(g, { kind: 'nut', axis: 'y', af: k.af, h: k.nutH, bore: k.outerR + 0.004 });
  return g;
}

/**
 * 머리 받침 선반(102번, 판화에 없음): 원점 = 구멍 중심의 윗면(볼트 머리 밑면이 얹히는 곳). 판은 x ±halfW, z = −back(뒤판) ~ front.
 * 아래에 삼각 받침 둘. userData.outline = 정면 윤곽(판의 앞 모서리 띠).
 */
export function boltShelf102(back: number, front: number, halfW = 0.6): THREE.Group {
  const k = K102;
  const g = new THREE.Group();
  g.add(meshAt(extrudeY(rect(-halfW, -back, halfW, front), k.shelfT, { x: 0, z: 0, r: k.shelfHole }), castIron({ roughness: 0.6 }), 0, -k.shelfT / 2, 0));
  for (const sx of [-1, 1]) {
    const tri: V2[] = [
      [-back, -k.shelfT],
      [front * 0.6, -k.shelfT],
      [-back, -k.shelfT - 0.42]
    ];
    g.add(meshAt(extrudeX(tri, [], 0.05, 0.004), castIron(), sx * (halfW - 0.07), 0, 0));
  }
  g.userData.outline = rect(-halfW, -k.shelfT, halfW, 0);
  setMM(g, { kind: 'shelf', hole: k.shelfHole, t: k.shelfT });
  return g;
}

/**
 * 너트 돌림 막이 레일(102번, 판화에 없음): 뒤판에 붙은 세로 막대. 원점 = 뒷면(뒤판에 닿는 면)의 아래 가운데.
 * x ±halfW, y 0 ~ len, z 0 ~ depth. 앞면(z = depth)에 너트의 납작한 뒷면이 미끄러진다.
 */
export function nutRail102(len: number, depth: number, halfW = 0.13): THREE.Mesh {
  const geo = new THREE.BoxGeometry(halfW * 2, len, depth);
  geo.translate(0, len / 2, depth / 2);
  const m = mesh(geo, castIron({ roughness: 0.6 }));
  setMM(m, { kind: 'guide', axis: 'y', len, depth });
  return m;
}

// ═══════════════════════════ 103 나사로 미는 슬라이드 ═══════════════════════════

/**
 * 103번 치수. 틀 로컬 좌표: 원점 = 기둥의 오른쪽(안쪽) 면 × 바닥판 밑면, 로컬 z = 0 은 나사 축이 놓인 평면.
 * (판화 비: 기둥 폭 0.56·높이 2.03, 나사 축 높이 1.55, 나사 바깥지름 0.42·피치 0.30, 슬라이드 발 폭 1.0·몸통 폭 0.31)
 */
export const K103 = {
  postW: 0.56,
  postH: 2.03,
  /** 바닥판: 두께·오른쪽 끝 x */
  baseT: 0.25,
  baseX1: 2.94,
  /** 베드(바닥판 위의 덩이): x 범위·윗면 y */
  bedX0: 0.09,
  bedX1: 2.89,
  bedTop: 0.73,
  /** 안내 레일(베드 위): 윗면 y, 반두께(z) */
  railTop: 0.97,
  railHalf: 0.11,
  /** 틀의 z 범위(로컬): 뒤 −back ~ 앞 front 는 함수 인자. 나사 축 높이 */
  axisY: 1.55,
  coreR: 0.115,
  outerR: 0.21,
  pitch: 0.3,
  /** 나사부 x 범위(틀 로컬) */
  thread0: 0.1,
  thread1: 2.84,
  /** 기둥 안쪽 턱(칼라) 반지름, 바깥 턱 반지름·두께, 네모 끝 길이·한 변 */
  collarR: 0.24,
  outCollarR: 0.265,
  outCollarT: 0.11,
  stubL: 0.17,
  stubA: 0.2,
  /** 슬라이드(축 기준 로컬): 몸통 반폭·윗면, 발 반폭·윗면·아랫면, 반두께(z), 레일 홈 반폭 */
  stemHalf: 0.155,
  stemTop: 0.34,
  footHalf: 0.5,
  footTop: -0.43,
  footBot: -0.71,
  slideHalfT: 0.27,
  grooveHalf: 0.113,
  /** 판화 자세에서 슬라이드 가운데의 x(틀 로컬), 왕복 바퀴 수, 가장 왼쪽 자리 */
  poseX: 1.455,
  turns: 4,
  x0: 0.855
} as const;

/**
 * 103번 주기 시간표(주기 = 2·turns·2π rad = 16π). a = 나사가 돈 양(0 ~ turns·2π), beta = 나사의 rotation.x(오른나사라 −a),
 * x = 슬라이드 가운데의 x(틀 로컬) = x0 + pitch·a/2π, dir = 나사 회전 방향(rotation.x 가 느는 쪽 +1).
 * t = 1(theta = 1.6)에 판화 자세(왕복의 한가운데 1.455)를 오른쪽으로 지나간다.
 */
export function screw103(theta: number): { a: number; beta: number; x: number; dir: 1 | -1 } {
  const k = K103;
  const w = triWave(theta - 1.6 + ((k.poseX - k.x0) / k.pitch) * TAU, k.turns * TAU);
  const beta = -w.a;
  return { a: w.a, beta, x: k.x0 + screwAdvance(k.pitch, beta, false), dir: -w.dir as 1 | -1 };
}

/** T자 슬라이드의 정면 윤곽(슬라이드 로컬: 원점 = 나사 축 위, 몸통 가운데). 몸통과 발 사이는 둥근 살(r) */
export function slideOutline103(r = 0.1): V2[] {
  const k = K103;
  return [
    [-k.footHalf, k.footBot],
    [k.footHalf, k.footBot],
    [k.footHalf, k.footTop],
    ...arc(k.stemHalf + r, k.footTop + r, r, -Math.PI / 2, -Math.PI, 6),
    [k.stemHalf, k.stemTop],
    [-k.stemHalf, k.stemTop],
    ...arc(-k.stemHalf - r, k.footTop + r, r, 0, -Math.PI / 2, 6),
    [-k.footHalf, k.footTop]
  ];
}

/**
 * ㄴ자 틀(103번, 고정): 기둥(나사 구멍이 X 로 뚫림) + 바닥판 + 베드 + 안내 레일. 좌표는 K103 의 틀 로컬.
 * z 범위: 뒤 −back(뒤판에 닿음) ~ 앞 front. userData.outlines = { post, bed }(정면 윤곽 — 슬라이드가 침범하면 안 됨).
 */
export function screwFrame103(back: number, front: number): THREE.Group {
  const k = K103;
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.6 });
  const zc = (front - back) / 2;
  const depth = front + back;
  // 기둥: (z, y) 단면에 축 구멍, X 로 postW
  g.add(meshAt(extrudeX(rect(-back, k.baseT - 0.004, front, k.postH), [circlePts(k.coreR + 0.004, 32, 0, k.axisY)], k.postW, 0.01), iron, -k.postW / 2, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(k.baseX1 + k.postW, k.baseT, depth), iron, (k.baseX1 - k.postW) / 2, k.baseT / 2, zc));
  g.add(meshAt(new THREE.BoxGeometry(k.bedX1 - k.bedX0, k.bedTop - k.baseT, depth - 0.1), castIron({ roughness: 0.7 }), (k.bedX0 + k.bedX1) / 2, (k.bedTop + k.baseT) / 2, zc - 0.05));
  g.add(meshAt(new THREE.BoxGeometry(k.bedX1, k.railTop - k.bedTop, k.railHalf * 2), steel(), k.bedX1 / 2, (k.railTop + k.bedTop) / 2, 0));
  g.userData.outlines = { post: rect(-k.postW, k.baseT, 0, k.postH), bed: rect(k.bedX0, k.baseT, k.bedX1, k.bedTop) };
  setMM(g, { kind: 'frame', axisY: k.axisY, railTop: k.railTop });
  return g;
}

/**
 * 이송 나사(103번): 축 = 로컬 X, 원점 = 축이 기둥 안쪽 면과 만나는 점(틀 로컬 (0, axisY, 0)). rotation.x = beta 로 돌린다.
 * 왼쪽부터 네모 끝(돌리는 곳) · 바깥 턱 · 기둥 속 축목 · 안쪽 턱 · 오른나사부. 바깥 턱에 표시줄.
 */
export function leadScrew103(): THREE.Group {
  const k = K103;
  const g = new THREE.Group();
  const xL = -k.postW - k.outCollarT;
  g.add(meshAt(new THREE.BoxGeometry(k.stubL + 0.01, k.stubA, k.stubA), darkSteel(), xL - k.stubL / 2 + 0.005, 0, 0));
  g.add(mesh(cylX(k.outCollarR, xL, -k.postW, 0.012, 40), darkSteel()));
  g.add(mesh(cylX(k.coreR, -k.postW - 0.004, k.thread1, 0, 36), steel()));
  g.add(mesh(cylX(k.collarR, 0, k.thread0, 0.012, 40), darkSteel()));
  const th = screwThread(k.coreR, k.outerR, k.pitch, k.thread1 - k.thread0);
  th.geometry.rotateZ(-Math.PI / 2);
  th.position.x = k.thread0;
  setMM(th, { axis: 'x' });
  g.add(th);
  g.add(meshAt(new THREE.BoxGeometry(k.outCollarT * 0.6, 0.006, 0.05), paint(MARK), xL + k.outCollarT / 2, k.outCollarR + 0.001, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.006, k.outCollarR * 0.7, 0.03), paint(MARK), xL - 0.001, k.outCollarR * 0.6, 0));
  setMM(g, { kind: 'screw', axis: 'x', pitch: k.pitch, coreR: k.coreR, outerR: k.outerR, leftHand: false, length: k.thread1 - k.thread0 });
  return g;
}

/**
 * T자 슬라이드(103번, 너트를 겸한다): 원점 = 나사 축 위(몸통 가운데). 몸통에 나사 구멍(X 방향), 발 밑에 레일 홈(X 방향, 발이 레일을 걸터탄다).
 * userData.outline = 정면 T 윤곽.
 */
export function screwSlide103(): THREE.Group {
  const k = K103;
  const g = new THREE.Group();
  const mat = bronze({ roughness: 0.38 });
  const h = k.slideHalfT;
  g.add(mesh(extrudeX(rect(-h, k.footTop - 0.004, h, k.stemTop), [circlePts(k.outerR + 0.005, 36)], k.stemHalf * 2, 0.008), mat));
  const grooveTop = k.railTop - k.axisY + 0.002;
  const foot: V2[] = [
    [-h, k.footBot],
    [-k.grooveHalf, k.footBot],
    [-k.grooveHalf, grooveTop],
    [k.grooveHalf, grooveTop],
    [k.grooveHalf, k.footBot],
    [h, k.footBot],
    [h, k.footTop],
    [-h, k.footTop]
  ];
  g.add(mesh(extrudeX(foot, [], k.footHalf * 2, 0.008), mat));
  const r = 0.1;
  for (const sx of [-1, 1]) {
    const fil: V2[] = [[sx * k.stemHalf, k.footTop], [sx * (k.stemHalf + r), k.footTop], ...arc(sx * (k.stemHalf + r), k.footTop + r, r, -Math.PI / 2, sx > 0 ? -Math.PI : 0, 6).slice(1)];
    g.add(mesh(extrude(shapeFrom(sx > 0 ? fil.reverse() : fil), h * 2 - 0.016, 0, 8), mat));
  }
  g.add(meshAt(new THREE.BoxGeometry(0.014, 0.2, 0.006), paint(MARK), 0, k.footTop - 0.14, h + 0.002));
  g.userData.outline = slideOutline103();
  setMM(g, { kind: 'slider', axis: 'x', w: k.footHalf * 2, bore: k.outerR + 0.005 });
  return g;
}
