// 152·153·154번 전용 키트 — 십자 홈 타원 그리개 / 스터드 원판이 미는 왕복 막대 / 스터드 원판과 벨 크랭크로 추 올리기
//  152 타원 그리개: 십자 홈 받침, 가로막대(스터드 2 + 연필), 종이판(타원 자취)
//  153 스터드로 미는 왕복: 스터드 원판, 돌출부·앞 스터드가 달린 미끄럼 막대, 벨 크랭크(두 팔이 다른 층), 받침 굴림대
//  154 추를 올리는 벨 크랭크: 스터드 원판(3개), 벨 크랭크(한 층, 줄 눈), 받침 기둥, 공 모양 추
// 치수 상수(K152·K153·K154)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s152.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markAnchor, markPin, setMM } from './mm';

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

/** 스타디움 다각형 — 두 중심 c0, c1, 반지름 r (반시계) */
export function stadiumPts152(c0: V2, c1: V2, r: number, n = 12): V2[] {
  const a = Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
  return [...arc(c1[0], c1[1], r, a - Math.PI / 2, a + Math.PI / 2, n), ...arc(c0[0], c0[1], r, a + Math.PI / 2, a + Math.PI * 1.5, n)];
}

const rot = (p: V2, a: number): V2 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const modPos = (a: number, m: number): number => ((a % m) + m) % m;
const wrapPi = (a: number): number => a - TAU * Math.round(a / TAU);

// ═══════════════════════════ 152 타원 그리개 ═══════════════════════════

/** 152번 치수(판화 비: 반축 a : b = 835 : 583, 스터드 사이 = a − b, 연필은 막대 위 바깥쪽) */
export const K152 = {
  /** 타원 긴 반축(연필 ~ 세로 홈 스터드) */
  a: 1.3,
  /** 타원 짧은 반축(연필 ~ 가로 홈 스터드) */
  b: 0.9,
  /** 홈 반폭 */
  grooveHalf: 0.065,
  /** 스터드 반지름(홈 반폭 − 틈 0.003) */
  studR: 0.062,
  /** 가로 팔 반길이 / 바깥 반폭 */
  armLenH: 1.05,
  armHalfH: 0.2,
  /** 세로 팔 반길이 / 바깥 반폭 */
  armLenV: 0.76,
  armHalfV: 0.24,
  /** 받침 바닥판 두께 / 레일(홈 벽) 높이 */
  floorT: 0.04,
  railH: 0.08,
  /** 막대 반폭 / 두께 */
  barHalf: 0.105,
  barT: 0.06,
  /** 막대가 연필 밖으로 / 세로 홈 스터드 밖으로 더 뻗은 길이 */
  extPen: 0.31,
  extStud: 0.41,
  /** 연필 반지름 */
  penR: 0.045,
  /** 판화 자세(t = 1)에서 막대의 각 — 세로 홈 스터드에서 연필 쪽이 왼쪽 위 137° */
  pose: 137 * DEG
} as const;

/**
 * 152번 운동식. theta = 구동 누적각(막대 반시계). 십자 중심을 원점으로 한 평면 좌표.
 * phi = 막대의 각(세로 홈 스터드 → 연필), studV = 세로 홈 스터드, studH = 가로 홈 스터드, pen = 연필(타원 위).
 */
export function trammel152(theta: number): { phi: number; studV: V2; studH: V2; pen: V2 } {
  const phi = theta - 1.6 + K152.pose;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const d = K152.a - K152.b;
  return { phi, studV: [0, -d * s], studH: [d * c, 0], pen: [K152.a * c, K152.b * s] };
}

/** 십자 홈(가로 홈 + 세로 홈을 합친 十자) 윤곽 — 받침 로컬 */
export function crossGroovePts152(): V2[] {
  const g = K152.grooveHalf;
  const H = K152.armLenH;
  const V = K152.armLenV;
  return [
    [g, -V], [g, -g], [H, -g], [H, g], [g, g], [g, V],
    [-g, V], [-g, g], [-H, g], [-H, -g], [-g, -g], [-g, -V]
  ];
}

/** 십자 받침 바깥 윤곽(十자) */
export function crossBodyPts152(): V2[] {
  const wH = K152.armHalfH;
  const wV = K152.armHalfV;
  const H = K152.armLenH;
  const V = K152.armLenV;
  return [
    [wV, -V], [wV, -wH], [H, -wH], [H, wH], [wV, wH], [wV, V],
    [-wV, V], [-wV, wH], [-H, wH], [-H, -wH], [-wV, -wH], [-wV, -V]
  ];
}

/**
 * 십자 홈 받침(152번, 고정): 원점 = 십자 중심, 로컬 z = 0 이 밑면(종이에 닿는 면).
 * 바닥판(十자, 두께 floorT) 위에 ㄱ자 레일 4개(높이 railH) — 레일 사이가 가로·세로 홈.
 * 윗면 z = floorT + railH. userData.outlines.grooveHole = 十자 홈 윤곽(스터드가 이 안에 있어야 한다).
 */
export function crossPiece152(): THREE.Group {
  const { grooveHalf: gh, armLenH: H, armLenV: V, armHalfH: wH, armHalfV: wV, floorT, railH } = K152;
  const g = new THREE.Group();
  g.add(meshAt(extrude(shapeFrom(crossBodyPts152()), floorT, 0.004), darkSteel(), 0, 0, floorT / 2));
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const pts: V2[] = [
        [sx * gh, sy * gh],
        [sx * H, sy * gh],
        [sx * H, sy * wH],
        [sx * wV, sy * wH],
        [sx * wV, sy * V],
        [sx * gh, sy * V]
      ];
      if (sx * sy < 0) pts.reverse();
      g.add(meshAt(extrude(shapeFrom(pts), railH, 0.006), brass(), 0, 0, floorT + railH / 2));
    }
  }
  g.userData.outlines = { grooveHole: crossGroovePts152() };
  setMM(g, { kind: 'guide', axis: 'xy', top: floorT + railH, floor: floorT });
  return g;
}

export interface TraverseBarOpts {
  /** 스터드가 막대 밑면 아래로 내려간 깊이(홈 속). 기본 0.08 */
  studDown?: number;
  /** 연필심 끝이 막대 밑면 아래로 내려간 깊이(종이까지). 기본 0.125 */
  penDown?: number;
  /** 연필 꼭대기의 로컬 z. 기본 0.42 */
  penTop?: number;
}

/**
 * 가로막대(152번, 구동): 원점 = 세로 홈 스터드 축, 로컬 +X 로 (a − b) 에 가로 홈 스터드, a 에 연필.
 * 로컬 z = 0 이 막대 밑면, 막대 두께 barT. 스터드는 밑면 아래 studDown 까지, 연필심 끝은 penDown 까지.
 * child 표식: 'studV', 'studH', 'penTip'. userData.outlines = { studV, studH } (스터드 원 — 홈 안에 있어야 한다).
 */
export function traverseBar152(o: TraverseBarOpts = {}): THREE.Group {
  const { a, b, barHalf, barT, extPen, extStud, studR, penR } = K152;
  const studDown = o.studDown ?? 0.08;
  const penDown = o.penDown ?? 0.125;
  const penTop = o.penTop ?? 0.42;
  const d = a - b;
  const g = new THREE.Group();
  // 막대(납작한 자) — 구멍 3개(스터드 2, 연필 1)
  const pts: V2[] = [
    [-extStud, -barHalf],
    [a + extPen, -barHalf],
    [a + extPen, barHalf],
    [-extStud, barHalf]
  ];
  const shape = shapeFrom(pts);
  for (const x of [0, d, a]) shape.holes.push(circlePath(x, 0, x === a ? penR : studR * 0.6));
  g.add(meshAt(extrude(shape, barT, 0.006), bronze({ roughness: 0.36 }), 0, 0, barT / 2));
  // 스터드 2개: 홈 속 몸통 + 막대 위 머리(판화의 작은 원)
  const outlines: Record<string, V2[]> = {};
  const studs: [string, number][] = [
    ['studV', 0],
    ['studH', d]
  ];
  for (const [name, x] of studs) {
    g.add(meshAt(cylZ(studR, -studDown, 0.004, 0.006, 32), steel(), x, 0, 0));
    g.add(meshAt(cylZ(studR * 0.6, 0, barT + 0.004, 0.004, 24), steel(), x, 0, 0));
    g.add(meshAt(cylZ(studR * 0.95, barT, barT + 0.025, 0.006, 32), darkSteel(), x, 0, 0));
    outlines[name] = circlePts(studR, 32, x, 0);
    const mk = new THREE.Object3D();
    mk.name = name;
    mk.position.set(x, 0, -studDown / 2);
    g.add(markPin(mk));
  }
  // 연필: 물림 고리 + 육각 자루 + 깎은 끝 + 심
  g.add(meshAt(tubeZ(penR, penR * 1.9, barT - 0.002, barT + 0.05, 0.006, 32), darkSteel(), a, 0, 0));
  const coneH = 0.1;
  const body = new THREE.CylinderGeometry(penR, penR, penTop + penDown - coneH, 6);
  body.rotateX(Math.PI / 2);
  g.add(meshAt(body, paint(0xd9a520), a, 0, (penTop - penDown + coneH) / 2));
  const cone = new THREE.ConeGeometry(penR, coneH, 24);
  cone.rotateX(-Math.PI / 2); // 꼭짓점이 −Z
  g.add(meshAt(cone, wood(0xd8b98a), a, 0, -penDown + coneH / 2));
  const lead = new THREE.ConeGeometry(penR * 0.3, coneH * 0.3, 16);
  lead.rotateX(-Math.PI / 2);
  g.add(meshAt(lead, darkSteel(), a, 0, -penDown + coneH * 0.15));
  g.add(meshAt(cylZ(penR * 0.9, penTop, penTop + 0.03, 0.006, 24), paint(0xc0392b), a, 0, 0));
  const tip = new THREE.Object3D();
  tip.name = 'penTip';
  tip.position.set(a, 0, -penDown);
  g.add(markPin(tip));
  g.userData.outlines = outlines;
  setMM(g, { kind: 'link', length: a, a: [0, 0, 0], b: [a, 0, 0], mid: [d, 0, 0] });
  return g;
}

/**
 * 종이판 + 타원 자취(152번): 원점 = 타원 중심, 로컬 z = 0 이 뒷면(뒤판에 붙는 면), 종이 두께 t.
 * 타원 선(반축 a, b, 선 굵기 line)은 종이 앞면에 얹힌 얇은 띠. userData.outlines 는 남기지 않는다(선은 부품이 아니다).
 */
export function drawingSheet152(w: number, h: number, t = 0.015, line = 0.014): THREE.Group {
  const { a, b } = K152;
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(w, h, t), paint(0xf1ead6, { roughness: 0.9 }), 0, 0, t / 2));
  const ell = (k: number, n = 160): V2[] => {
    const out: V2[] = [];
    for (let i = 0; i < n; i++) {
      const u = (i / n) * TAU;
      out.push([(a + k) * Math.cos(u), (b + k) * Math.sin(u)]);
    }
    return out;
  };
  const ring = shapeFrom(ell(line / 2));
  const hole = new THREE.Path();
  ell(-line / 2)
    .reverse()
    .forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  hole.closePath();
  ring.holes.push(hole);
  g.add(meshAt(extrude(ring, 0.003, 0, 4), paint(0x2a2a30, { roughness: 0.8 }), 0, 0, t + 0.0015));
  setMM(g, { kind: 'sheet', w, h, a, b });
  return g;
}

// ═══════════════════════════ 스터드 원판 · 벨 크랭크 (153·154 공용) ═══════════════════════════

/**
 * 스터드(반지름은 d 에 포함)에 얹힌 팔의 각을 구한다.
 * 팔 = 받침점 Q 에서 길이 Lt(끝 반원 중심까지)의 스타디움, d = 팔 반폭 + 스터드 반지름 + 틈, C = 스터드 중심.
 * side = +1 이면 팔이 스터드의 반시계 쪽(스터드가 팔을 반시계로 민다), −1 이면 반대.
 * 스터드가 닿을 수 없는 자리(너무 멀거나 받침점에 너무 가까움)면 null. 팔 옆면에 닿는 동안은 직선 접촉, 끝에서는 끝 반원 접촉.
 */
export function armOnStud(Q: V2, Lt: number, d: number, C: V2, side: 1 | -1 = 1): number | null {
  const dx = C[0] - Q[0];
  const dy = C[1] - Q[1];
  const D = Math.hypot(dx, dy);
  if (D <= d || D >= Lt + d) return null;
  const ang = Math.atan2(dy, dx);
  const along = Math.sqrt(D * D - d * d);
  if (along <= Lt) return ang + side * Math.asin(d / D);
  return ang + side * Math.acos((Lt * Lt + D * D - d * d) / (2 * Lt * D));
}

export interface StudDiscOpts {
  /** 판 두께. 기본 0.08 */
  thick?: number;
  /** 스터드 끝의 로컬 z(판 가운데가 0). 기본 0.2 */
  studTop?: number;
  /** 축 구멍 반지름. 기본 0.06 */
  boreR?: number;
  /** 허브 반지름. 기본 0.13 */
  hubR?: number;
  /** 허브 앞 끝 로컬 z. 기본 thick/2 + 0.02 */
  hubTop?: number;
}

/**
 * 스터드 원판(153·154번): 회전축 = 로컬 Z, 판 가운데 z = 0. 앞면의 반지름 studCircle 원 위에 스터드 n 개가 +Z 로 솟는다.
 * 스터드 0 은 로컬 +Y(위), k 번은 거기서 **시계 방향**으로 k·360°/n. 스터드 표식 child 이름 'stud0'…, userData.outlines.stud0… = 스터드 원.
 */
export function studDisc(R: number, studCircle: number, n: number, studR: number, o: StudDiscOpts = {}): THREE.Group {
  const thick = o.thick ?? 0.08;
  const studTop = o.studTop ?? 0.2;
  const bore = o.boreR ?? 0.06;
  const hubR = o.hubR ?? 0.13;
  const hubTop = o.hubTop ?? thick / 2 + 0.02;
  const g = new THREE.Group();
  const shape = shapeFrom(circlePts(R, 96));
  shape.holes.push(circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, thick, 0.008, 24), bronze({ roughness: 0.36 })));
  g.add(mesh(tubeZ(bore, hubR, -thick / 2 - 0.01, hubTop, 0.008), darkSteel()));
  // 반지름 표시줄(회전이 보이게) — 스터드 0 쪽
  const markLen = studCircle - hubR - studR - 0.05;
  g.add(meshAt(new THREE.BoxGeometry(0.014, markLen, 0.006), paint(MARK), 0, hubR + 0.025 + markLen / 2, thick / 2 + 0.002));
  const outlines: Record<string, V2[]> = {};
  for (let k = 0; k < n; k++) {
    const a = (k * TAU) / n;
    const x = studCircle * Math.sin(a);
    const y = studCircle * Math.cos(a);
    g.add(meshAt(cylZ(studR, thick / 2 - 0.004, studTop, 0.008, 32), steel(), x, y, 0));
    outlines[`stud${k}`] = circlePts(studR, 32, x, y);
    const mk = new THREE.Object3D();
    mk.name = `stud${k}`;
    mk.position.set(x, y, studTop);
    g.add(markPin(mk));
  }
  g.userData.outlines = outlines;
  setMM(g, { kind: 'studDisc', r: R, studCircle, studs: n, studR, axis: 'z' });
  return g;
}

/** 벨 크랭크의 팔 하나 */
export interface CrankArm {
  /** 받침점에서 끝 반원 중심까지 */
  len: number;
  /** 반폭(= 끝 반원 반지름) */
  half: number;
  /** 팔 가운데 평면의 로컬 z. 기본 0 */
  z?: number;
  /** 두께. 기본 0.08 */
  thick?: number;
}

export interface BellCrankOpts {
  /** 허브 바깥 반지름. 기본 0.13 */
  hubR?: number;
  /** 축 구멍 반지름. 기본 0.05 */
  boreR?: number;
  /** 허브 z 범위. 기본 두 팔을 다 덮는 범위 ± 0.015 */
  hubZ0?: number;
  hubZ1?: number;
  /** true 면 팔 B 끝에 줄을 매는 눈(고리)을 단다 — child 'cordEye'(줄 끝이 붙는 자리) */
  eye?: boolean;
}

/**
 * 벨 크랭크(꺾인 지레, 153·154번): 원점 = 받침점(회전축 = 로컬 Z). 팔 A 는 로컬 +X, 팔 B 는 거기서 spread(rad, 반시계 +) 만큼 돌린 방향.
 * 두 팔은 z 가 달라도 된다(긴 허브가 잇는다). userData.outlines = { armA, armB } (스타디움 윤곽, 그룹 로컬).
 * child 표식: 'tipA', 'tipB'(끝 반원 중심), eye 면 'cordEye'.
 */
export function bellCrank(A: CrankArm, B: CrankArm, spread: number, o: BellCrankOpts = {}): THREE.Group {
  const hubR = o.hubR ?? 0.13;
  const bore = o.boreR ?? 0.05;
  const zA = A.z ?? 0;
  const zB = B.z ?? 0;
  const tA = A.thick ?? 0.08;
  const tB = B.thick ?? 0.08;
  const z0 = o.hubZ0 ?? Math.min(zA - tA / 2, zB - tB / 2) - 0.015;
  const z1 = o.hubZ1 ?? Math.max(zA + tA / 2, zB + tB / 2) + 0.015;
  const g = new THREE.Group();
  g.add(mesh(tubeZ(bore, hubR, z0, z1, 0.008, 40), darkSteel()));
  const armA = meshAt(extrude(stadiumShape(hubR * 0.6, 0, A.len, 0, A.half), tA, 0.006, 16), brass(), 0, 0, zA);
  g.add(armA);
  const armB = meshAt(extrude(stadiumShape(hubR * 0.6, 0, B.len, 0, B.half), tB, 0.006, 16), brass(), 0, 0, zB);
  armB.rotation.z = spread;
  g.add(armB);
  const tipB = rot([B.len, 0], spread);
  g.userData.outlines = {
    armA: stadiumPts152([0, 0], [A.len, 0], A.half, 12),
    armB: stadiumPts152([0, 0], tipB, B.half, 12)
  };
  const mkA = new THREE.Object3D();
  mkA.name = 'tipA';
  mkA.position.set(A.len, 0, zA);
  g.add(markPin(mkA));
  const mkB = new THREE.Object3D();
  mkB.name = 'tipB';
  mkB.position.set(tipB[0], tipB[1], zB);
  g.add(markPin(mkB));
  if (o.eye === true) {
    // 줄 눈: 팔 B 끝을 꿰는 핀 + 앞 고리. 줄 끝은 팔 끝 반원 중심(팔 가운데 평면)에 붙는다
    g.add(meshAt(cylZ(B.half * 0.45, -tB / 2 - 0.012, tB / 2 + 0.012, 0.004, 20), steel(), tipB[0], tipB[1], zB));
    const eye = new THREE.Object3D();
    eye.name = 'cordEye';
    eye.position.set(tipB[0], tipB[1], zB);
    g.add(markAnchor(eye, [0, 0, 0], { of: 'cordEye' }));
  }
  setMM(g, { kind: 'bellCrank', lenA: A.len, lenB: B.len, spread, axis: 'z' });
  return g;
}

// ═══════════════════════════ 153 스터드로 미는 왕복 ═══════════════════════════

/**
 * 153번 치수. 원판 중심 O 를 원점으로 한 평면 좌표(판화 1px(4배 확대) = 0.0016).
 * 판화 치수 그대로면 되돌림 행정(0.85)이 미는 행정의 한계(0.72)보다 커서 스터드가 돌출부 밑에 낀다 →
 * 돌출부를 0.06 길게(lugBottom 0.48 → 0.42), 막대 앞 스터드를 0.12 왼쪽으로(studBack 1.10 → 1.22) 옮겼다. 나머지는 판화 비 그대로.
 */
export const K153 = {
  /** 원판 반지름 / 스터드 원 반지름 / 스터드 반지름 / 스터드 수 */
  R: 0.66,
  studCircle: 0.55,
  studR: 0.055,
  studs: 2,
  /** 막대 밑면 높이 / 막대 높이 / 돌출부 밑면 높이 / 돌출부 폭 */
  barBottom: 0.78,
  barH: 0.21,
  lugBottom: 0.42,
  lugW: 0.19,
  /** 막대 길이: 돌출부 왼쪽 면에서 왼쪽 끝·오른쪽 끝까지 */
  barLeft: 1.88,
  barRight: 1.5,
  /** 막대 앞 스터드: 돌출부 왼쪽 면에서 왼쪽으로 studBack, 막대 밑면에서 위로 studUp, 반지름 barStudR */
  studBack: 1.22,
  studUp: 0.06,
  barStudR: 0.065,
  /** 벨 크랭크 받침점 */
  pivot: [-1.04, 0.02] as V2,
  /** 위 팔(막대 스터드를 치는 팔): 끝 반원 중심까지 길이 / 반폭 */
  upperLen: 0.86,
  upperHalf: 0.06,
  /** 아래 팔(원판 스터드가 드는 팔) */
  lowerLen: 0.58,
  lowerHalf: 0.065,
  /** 위 팔이 아래 팔보다 앞선 각(반시계) */
  spread: 90 * DEG,
  /** 쉬는 자세(멈춤 핀에 얹힘)에서 위 팔의 각 — 판화 61° */
  rest: 61 * DEG,
  /** 접촉 틈(윤곽끼리 파고들지 않게) */
  clear: 0.002,
  /** 스터드가 아래 팔 끝을 벗어난 뒤 크랭크가 제 무게로 떨어지는 동안의 원판 회전각 */
  fall: 16 * DEG,
  /** 판화 자세(t = 1)에서 스터드 0 의 각(위에서 시계 방향 +) — 돌출부 왼쪽에 막 닿은 −7.3° */
  pose: -7.3 * DEG,
  /** 받침 굴림대 2개의 중심 / 반지름 */
  rollers: [
    [-1.352, 0.636],
    [1.024, 0.636]
  ] as V2[],
  rollerR: 0.144
} as const;

/** 스터드 중심(원판 중심 기준) — a = 위에서 시계 방향으로 잰 각 */
const studAt = (R: number, a: number): V2 => [R * Math.sin(a), R * Math.cos(a)];

/** 스터드가 돌출부 왼쪽 면(또는 아래 왼쪽 모서리)을 밀 때 그 면의 x. 닿지 않는 각이면 null */
export function lugFace153(a: number): number | null {
  const rr = K153.studR + K153.clear;
  const e = Math.max(0, K153.lugBottom - K153.studCircle * Math.cos(a));
  if (e >= rr || Math.cos(a) <= 0) return null;
  return K153.studCircle * Math.sin(a) + Math.sqrt(rr * rr - e * e);
}

/** 위 팔(각 g)이 막대 앞 스터드를 왼쪽으로 밀 때 스터드 중심의 x(받침점 기준). 닿지 않으면 null */
export function barStudX153(g: number): number | null {
  const db = K153.upperHalf + K153.barStudR + K153.clear;
  const H = K153.barBottom + K153.studUp - K153.pivot[1];
  const sn = Math.sin(g);
  if (sn <= 0.2) return null;
  const x = (H * Math.cos(g) - db) / sn;
  if (x * Math.cos(g) + H * sn <= K153.upperLen) return x;
  const tx = K153.upperLen * Math.cos(g);
  const ty = K153.upperLen * sn;
  const e = H - ty;
  if (Math.abs(e) >= db) return null;
  return tx - Math.sqrt(db * db - e * e);
}

/** 아래쪽 스터드(각 lam, 180°~360°)가 드는 아래 팔의 각. 닿지 않으면 null */
function lowerContact153(lam: number): number | null {
  return armOnStud(K153.pivot, K153.lowerLen, K153.lowerHalf + K153.studR + K153.clear, studAt(K153.studCircle, lam), 1);
}

export interface Table153 {
  /** 미는 행정이 끝나는 스터드 각 / 그때 돌출부 면 x(오른쪽 끝) */
  aPeak: number;
  xR: number;
  /** 스터드가 아래 팔에 처음 닿는 각 / 팔이 가장 높이 들린 각 / 끝을 벗어나는 각 */
  lamFirst: number;
  lamMax: number;
  lamRel: number;
  /** 아래 팔의 쉬는 각 / 가장 높은 각 / 벗어나는 순간의 각 */
  beta0: number;
  betaMax: number;
  betaRel: number;
  /** 위 팔이 막대 스터드를 가장 왼쪽까지 민 순간의 아래 스터드 각(그 뒤로 막대는 선다) */
  lamPush: number;
  /** 돌출부 면의 왼쪽 끝 x / 다음 스터드가 그 면에 닿는 각(음수) */
  xL: number;
  aOn: number;
  /** 행정 */
  stroke: number;
  /** 스터드가 돌출부 밑으로 들어가 끼지 않을 한계(xL 은 이보다 커야 한다) */
  jamLimit: number;
}

let table153: Table153 | null = null;

/** 153번 한 주기의 꺾이는 점들(초기화 때 한 번 수치로 구한다) */
export function cycleTable153(): Table153 {
  if (table153 !== null) return table153;
  const K = K153;
  // 미는 행정의 끝: lugFace 의 최대
  let aPeak = 0;
  let xR = -Infinity;
  for (let i = 0; i <= 90000; i++) {
    const a = (i / 1000) * DEG;
    const v = lugFace153(a);
    if (v === null) break;
    if (v > xR) {
      xR = v;
      aPeak = a;
    }
  }
  const beta0 = K.rest - K.spread;
  let lamFirst = NaN;
  let lamMax = 0;
  let betaMax = -Infinity;
  let lamRel = 0;
  let betaRel = beta0;
  for (let i = 180000; i <= 360000; i++) {
    const lam = (i / 1000) * DEG;
    const b = lowerContact153(lam);
    if (b === null) continue;
    if (Number.isNaN(lamFirst) && b > beta0) lamFirst = lam;
    if (b > betaMax) {
      betaMax = b;
      lamMax = lam;
    }
    lamRel = lam;
    betaRel = b;
  }
  // 되돌림의 끝: 위 팔이 막대 스터드를 가장 왼쪽까지 민 자리(팔 끝이 스터드 밑으로 돌아 들어가기 전의 최소)
  let lamPush = lamMax;
  let gMin = Infinity;
  for (let i = Math.round((lamFirst / DEG) * 1000); i <= Math.round((lamMax / DEG) * 1000); i++) {
    const lam = (i / 1000) * DEG;
    const b = lowerContact153(lam);
    if (b === null || b < beta0) continue;
    const gx = barStudX153(b + K.spread);
    if (gx !== null && gx < gMin) {
      gMin = gx;
      lamPush = lam;
    }
  }
  const xL = gMin + K.studBack + K.pivot[0];
  // 다음 스터드가 왼쪽 끝에 선 돌출부 면에 닿는 각: lugFace(aOn) = xL (이분법)
  const rr = K.studR + K.clear;
  let lo = -Math.acos((K.lugBottom - rr) / K.studCircle) + 1e-9;
  let hi = aPeak;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    const v = lugFace153(m);
    if (v === null || v < xL) lo = m;
    else hi = m;
  }
  const jamLimit = -K.studCircle * Math.sin(Math.acos((K.lugBottom - K.studR) / K.studCircle));
  table153 = { aPeak, xR, lamFirst, lamMax, lamRel, beta0, betaMax, betaRel, lamPush, xL, aOn: hi, stroke: xR - xL, jamLimit };
  return table153;
}

/**
 * 153번 운동식(모두 theta 의 닫힌 식, 주기 = 원판 반 바퀴 π).
 * alpha = 스터드 0 의 각(위에서 시계 +), disc = 원판 rotation.z(= −alpha), face = 돌출부 왼쪽 면의 x(원판 중심 기준),
 * upper·lower = 위·아래 팔의 각(반시계 +), phase = 0 미는 중 / 1 오른쪽 끝에서 쉼 / 2 되돌리는 중 / 3 왼쪽 끝에서 쉼.
 */
export function cycle153(theta: number): { alpha: number; disc: number; face: number; upper: number; lower: number; phase: 0 | 1 | 2 | 3 } {
  const K = K153;
  const T = cycleTable153();
  const alpha = theta - 1.6 + K.pose;
  // 아래 팔: 180°~360° 구간에 있는 스터드의 각
  const lam = Math.PI + modPos(alpha, Math.PI);
  let lower = T.beta0;
  if (lam < T.lamRel) {
    const b = lowerContact153(lam);
    if (b !== null && b > lower) lower = b;
  } else {
    const u = (lam - T.lamRel) / K.fall;
    if (u < 1) lower = T.betaRel - (T.betaRel - T.beta0) * u * u;
  }
  // 막대: 스터드 각을 [aOn, aOn + π) 창으로
  const a = T.aOn + modPos(alpha - T.aOn, Math.PI);
  let face: number;
  let phase: 0 | 1 | 2 | 3;
  if (a <= T.aPeak) {
    face = Math.max(T.xL, lugFace153(a) ?? T.xL);
    phase = 0;
  } else {
    const l2 = a + Math.PI;
    if (l2 >= T.lamPush) {
      face = T.xL;
      phase = 3;
    } else {
      const b = l2 > T.lamFirst ? (lowerContact153(l2) ?? T.beta0) : T.beta0;
      const gx = barStudX153(Math.max(b, T.beta0) + K.spread);
      const x = gx === null ? T.xR : gx + K.studBack + K.pivot[0];
      face = Math.min(T.xR, x);
      phase = face < T.xR ? 2 : 1;
    }
  }
  return { alpha, disc: -alpha, face, upper: lower + K.spread, lower, phase };
}

export interface SlideBar153Opts {
  /** 막대·돌출부 두께(z). 기본 0.1 */
  thick?: number;
  /** 앞 스터드 끝의 로컬 z(막대 가운데가 0). 기본 0.22 */
  studTop?: number;
}

/**
 * 미끄럼 막대(153번): 원점 = 돌출부 왼쪽 면과 막대 밑면이 만나는 점, 두께 가운데 z = 0.
 * 막대는 x −barLeft ~ +barRight, y 0 ~ barH. 돌출부는 x 0 ~ lugW, y −(barBottom − lugBottom) ~ 0. 앞 스터드는 (−studBack, studUp) 에서 +Z 로.
 * userData.outlines = { lug(돌출부 네모), barStud(앞 스터드 원) }. child 표식 'barStud'.
 */
export function slideBar153(o: SlideBar153Opts = {}): THREE.Group {
  const K = K153;
  const thick = o.thick ?? 0.1;
  const studTop = o.studTop ?? 0.22;
  const lugLen = K.barBottom - K.lugBottom;
  const g = new THREE.Group();
  const pts: V2[] = [
    [-K.barLeft, 0],
    [0, 0],
    [0, -lugLen],
    [K.lugW, -lugLen],
    [K.lugW, 0],
    [K.barRight, 0],
    [K.barRight, K.barH],
    [-K.barLeft, K.barH]
  ];
  g.add(mesh(extrude(shapeFrom(pts), thick, 0.006), castIron({ roughness: 0.55 })));
  // 굴림대에 닿는 밑면 띠(밝은 강철) — 양쪽 굴림대 위 구간
  const sx = -K.studBack;
  g.add(meshAt(cylZ(K.barStudR, thick / 2 - 0.004, studTop, 0.008, 32), steel(), sx, K.studUp, 0));
  g.add(meshAt(new THREE.CylinderGeometry(K.barStudR * 0.5, K.barStudR * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), sx, K.studUp, studTop + 0.002));
  // 눈금 표시(움직임이 보이게): 막대 앞면 가운데 세로줄
  g.add(meshAt(new THREE.BoxGeometry(0.014, K.barH * 0.6, 0.006), paint(MARK), K.lugW / 2, K.barH / 2, thick / 2 + 0.002));
  g.userData.outlines = {
    lug: [
      [0, -lugLen],
      [K.lugW, -lugLen],
      [K.lugW, 0.02],
      [0, 0.02]
    ] as V2[],
    barStud: circlePts(K.barStudR, 32, sx, K.studUp)
  };
  const mk = new THREE.Object3D();
  mk.name = 'barStud';
  mk.position.set(sx, K.studUp, studTop);
  g.add(markPin(mk));
  setMM(g, { kind: 'slider', axis: 'x', w: K.barLeft + K.barRight, h: K.barH });
  return g;
}

/** 받침 굴림대(153번): 회전축 = 로컬 Z, 폭 가운데 z = 0. 납작한 굴림 면 + 허브 + 표시점. wheel 로 세지 않는다(kind 'roller') */
export function supportRoller(r: number, width = 0.12, boreR = 0.04): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(tubeZ(boreR, r, -width / 2, width / 2, 0.01, 48), brass()));
  g.add(mesh(tubeZ(boreR, r * 0.48, -width / 2 - 0.012, width / 2 + 0.012, 0.006, 32), darkSteel()));
  g.add(meshAt(new THREE.CylinderGeometry(r * 0.09, r * 0.09, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), r * 0.74, 0, width / 2 + 0.002));
  setMM(g, { kind: 'roller', r, width, axis: 'z' });
  return g;
}

// ═══════════════════════════ 154 추를 올리는 벨 크랭크 ═══════════════════════════

/** 154번 치수. 원판 중심 O 를 원점으로 한 평면 좌표(판화 1px(4배 확대) = 0.0019) */
export const K154 = {
  /** 원판 반지름 / 스터드 원 반지름 / 스터드 반지름 / 스터드 수 */
  R: 0.8,
  studCircle: 0.69,
  studR: 0.075,
  studs: 3,
  /** 벨 크랭크 받침점 */
  pivot: [1.273, -0.209] as V2,
  /** 아래 팔(스터드가 누르는 팔, 원판 쪽): 끝 반원 중심까지 / 반폭 */
  lowerLen: 0.805,
  lowerHalf: 0.075,
  /** 위 팔(줄을 매는 팔): 줄 눈까지 / 반폭 */
  upperLen: 0.79,
  upperHalf: 0.05,
  /** 쉬는 자세(멈춤 핀)에서 아래 팔이 수평(왼쪽)에서 아래로 처진 각 */
  rest: 2 * DEG,
  /** 접촉 틈 */
  clear: 0.002,
  /** 스터드가 팔 끝을 벗어난 뒤 추가 떨어져 지레가 돌아오는 동안의 원판 회전각 */
  fall: 14 * DEG,
  /** 판화 자세(t = 1)에서 스터드 0 의 각(위에서 시계 +) — 오른쪽 아래 117.3° */
  pose: 117.3 * DEG,
  /** 도르래 중심 / 도르래 반지름 / 줄 중심선 반지름 / 줄 반지름 */
  pulley: [1.853, 1.606] as V2,
  pulleyR: 0.21,
  ropeRC: 0.21,
  ropeR: 0.016,
  /** 공 모양 추 반지름 / 쉬는 자세에서 추 고리 꼭대기가 도르래 중심보다 낮은 거리 */
  ballR: 0.22,
  restDrop: 1.73,
  /** 원판 받침 기둥·지레 받침 기둥의 축 높이(바닥에서) */
  axleH: 1.026,
  pivotH: 0.817
} as const;

/** 스터드(각 lam, 위에서 시계 +)가 누르는 아래 팔의 처진 각 psi(수평 왼쪽에서 아래로 +). 닿지 않으면 null */
function leverContact154(lam: number): number | null {
  const b = armOnStud(K154.pivot, K154.lowerLen, K154.lowerHalf + K154.studR + K154.clear, studAt(K154.studCircle, lam), 1);
  return b === null ? null : wrapPi(b - Math.PI);
}

export interface Table154 {
  /** 스터드가 팔에 처음 닿는 각 / 팔이 가장 깊이 눌린 각 / 끝을 벗어나는 각 */
  lamFirst: number;
  lamMax: number;
  lamRel: number;
  /** 처진 각: 쉼 / 최대 / 벗어나는 순간 */
  psi0: number;
  psiMax: number;
  psiRel: number;
  /** 줄 전체 길이(눈 ~ 도르래 ~ 추 고리 꼭대기) / 추가 오르는 높이 */
  ropeLen: number;
  lift: number;
}

/** 지레 처진 각 psi 에서 줄 눈의 자리·도르래 접점 각·눈에서 도르래를 돌아 오른쪽 접점까지의 줄 길이 */
export function cord154(psi: number): { eye: V2; tangent: number; used: number } {
  const K = K154;
  const eye: V2 = [K.pivot[0] - K.upperLen * Math.sin(psi), K.pivot[1] + K.upperLen * Math.cos(psi)];
  const dx = eye[0] - K.pulley[0];
  const dy = eye[1] - K.pulley[1];
  const D = Math.hypot(dx, dy);
  // 눈은 도르래의 왼쪽 아래. 줄은 왼쪽 위 접점에서 위를 넘어 시계 방향으로 오른쪽(각 0)까지 감긴다
  const tangent = modPos(Math.atan2(dy, dx) - Math.acos(K.ropeRC / D), TAU);
  return { eye, tangent, used: Math.sqrt(D * D - K.ropeRC * K.ropeRC) + K.ropeRC * tangent };
}

let table154: Table154 | null = null;

/** 154번 한 주기의 꺾이는 점들 */
export function cycleTable154(): Table154 {
  if (table154 !== null) return table154;
  const K = K154;
  let lamFirst = NaN;
  let lamMax = 0;
  let psiMax = -Infinity;
  let lamRel = 0;
  let psiRel = K.rest;
  for (let i = 30000; i <= 200000; i++) {
    const lam = (i / 1000) * DEG;
    const p = leverContact154(lam);
    if (p === null) continue;
    if (Number.isNaN(lamFirst) && p > K.rest) lamFirst = lam;
    if (p > psiMax) {
      psiMax = p;
      lamMax = lam;
    }
    lamRel = lam;
    psiRel = p;
  }
  const ropeLen = cord154(K.rest).used + K.restDrop;
  const lift = cord154(psiMax).used - cord154(K.rest).used;
  table154 = { lamFirst, lamMax, lamRel, psi0: K.rest, psiMax, psiRel, ropeLen, lift };
  return table154;
}

/**
 * 154번 운동식(모두 theta 의 닫힌 식, 주기 = 원판 1/3 바퀴).
 * alpha = 스터드 0 의 각(위에서 시계 +), disc = 원판 rotation.z, psi = 아래 팔이 처진 각, lever = 지레 그룹 rotation.z(팔 A = 아래 팔이 로컬 +X),
 * eye = 줄 눈, tangent = 줄이 도르래에 닿는 각, drop = 도르래 중심에서 추 고리 꼭대기까지, rise = 쉬는 자리에서 추가 오른 높이,
 * phase = 0 쉼 / 1 스터드가 누르는 중(추 오름) / 2 끝을 돌아 놓이는 중·떨어지는 중.
 */
export function cycle154(theta: number): { alpha: number; disc: number; psi: number; lever: number; eye: V2; tangent: number; drop: number; rise: number; phase: 0 | 1 | 2 } {
  const K = K154;
  const T = cycleTable154();
  const alpha = theta - 1.6 + K.pose;
  const per = TAU / K.studs;
  const w0 = T.lamRel + K.fall + 2 * DEG - per; // 창의 시작: 떨어짐이 끝난 바로 뒤
  const lam = w0 + modPos(alpha - w0, per);
  let psi: number = T.psi0;
  let phase: 0 | 1 | 2 = 0;
  if (lam < T.lamRel) {
    const p = leverContact154(lam);
    if (p !== null && p > psi) {
      psi = p;
      phase = lam <= T.lamMax ? 1 : 2;
    }
  } else {
    const u = (lam - T.lamRel) / K.fall;
    if (u < 1) {
      psi = T.psiRel - (T.psiRel - T.psi0) * u * u;
      phase = 2;
    }
  }
  const c = cord154(psi);
  const drop = T.ropeLen - c.used;
  return { alpha, disc: -alpha, psi, lever: Math.PI + psi, eye: c.eye, tangent: c.tangent, drop, rise: K.restDrop - drop, phase };
}

export interface Standard154Opts {
  /** 꼭대기 반원 반지름(= 기둥 반폭). 기본 0.2 */
  topR?: number;
  /** 발이 왼쪽·오른쪽으로 벌어진 반폭(바닥판 윗면에서). 기본 topR × 1.8 */
  footL?: number;
  footR?: number;
  /** 바닥판: 왼쪽·오른쪽 끝(축 기준), 높이. 기본 footL + 0.1, footR + 0.1, 0.12 */
  plateL?: number;
  plateR?: number;
  plateH?: number;
  /** 두께(z). 기본 0.12 */
  thick?: number;
  /** 축 구멍 반지름. 기본 0.05 */
  boreR?: number;
}

/**
 * 받침 기둥(154번, 판화의 종 모양 스탠드): 원점 = 축 구멍 중심, 두께 가운데 z = 0. 꼭대기는 반원, 아래로 가며 발이 벌어지고 바닥판에 선다.
 * 바닥판 밑면 y = −h (받침대 윗면에 놓는다). 구멍 축 = Z(축이 꿰인다).
 */
export function standard154(h: number, o: Standard154Opts = {}): THREE.Group {
  const topR = o.topR ?? 0.2;
  const footL = o.footL ?? topR * 1.8;
  const footR = o.footR ?? topR * 1.8;
  const plateH = o.plateH ?? 0.12;
  const plateL = o.plateL ?? footL + 0.1;
  const plateR = o.plateR ?? footR + 0.1;
  const thick = o.thick ?? 0.12;
  const bore = o.boreR ?? 0.05;
  const yb = -(h - plateH); // 바닥판 윗면
  const ys = yb * 0.45; // 여기까지는 곧은 옆면
  const bez = (p0: V2, p1: V2, p2: V2, n: number): V2[] => {
    const out: V2[] = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  };
  const pts: V2[] = [
    ...arc(0, 0, topR, 0, Math.PI, 24),
    [-topR, ys],
    ...bez([-topR, ys], [-topR, yb], [-footL, yb], 10),
    [-plateL, yb],
    [-plateL, -h],
    [plateR, -h],
    [plateR, yb],
    [footR, yb],
    ...bez([footR, yb], [topR, yb], [topR, ys], 10)
  ];
  const shape = shapeFrom(pts);
  shape.holes.push(circlePath(0, 0, bore));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, thick, 0.008, 16), castIron({ roughness: 0.6 })));
  g.add(mesh(tubeZ(bore, bore + 0.05, -thick / 2 - 0.012, thick / 2 + 0.012, 0.006, 32), darkSteel()));
  setMM(g, { kind: 'standard', h, axis: 'z', boreR: bore });
  return g;
}

/**
 * 공 모양 추(154번): 원점 = 공 중심. 위에 목 + 고리. 줄 끝은 고리 꼭대기(로컬 (0, r + neck + 2·ringR, 0))에 붙는다.
 * 키트 weight 와 같은 검사 표식(kind 'weight', 고리 = anchor of 'weight').
 */
export function ballWeight(r: number, ringR = 0.045): THREE.Mesh {
  const tube = ringR * 0.3;
  const m = mesh(new THREE.SphereGeometry(r, 40, 28), darkSteel());
  const ringY = r + ringR - tube * 0.5;
  const ring = meshAt(new THREE.TorusGeometry(ringR, tube, 12, 32), darkSteel(), 0, ringY, 0);
  m.add(ring);
  const band = meshAt(new THREE.TorusGeometry(r * 1.002, 0.008, 8, 64), paint(MARK), 0, 0, 0);
  band.rotation.x = Math.PI / 2;
  m.add(band);
  setMM(m, { kind: 'weight', w: 2 * r, h: 2 * r, d: 2 * r, top: [0, r, 0], ring: [0, ringY, 0] });
  setMM(ring, { kind: 'anchor', of: 'weight', point: [0, ringR, 0], center: [0, 0, 0], ring: ringR, tube });
  return m;
}

/** 공 모양 추의 고리 꼭대기 높이(공 중심 기준) — 줄 끝이 붙는 자리 */
export function ballRingTop(r: number, ringR = 0.045): number {
  return r + 2 * ringR - ringR * 0.15;
}
