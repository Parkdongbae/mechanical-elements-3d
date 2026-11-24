// 기어 5종 키트(41~45번 전용) — 헬리컬 기어, 임의 각 원뿔 베벨 기어, 계단 기어, 마찰 홈 바퀴
// (기존 키트 파일·index.ts 는 건드리지 않는다. 모델은 '../kit/gear5' 에서 직접 import)
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, lathe, loft, mesh, tubeProfile, TAU, type LoftLayer, type V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { setMM } from './mm';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const MARK = 0xf2b619;

/** 회전축 = 로컬 Z 로 눕힌 관(구멍 있는 원통) — z0 → z1 */
function ringZ(rIn: number, rOut: number, z0: number, z1: number, c: number, mat: THREE.Material): THREE.Mesh {
  const geo = lathe(tubeProfile(rIn, rOut, z0, z1, c), 36);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

// ───────────────────────── 헬리컬(비스듬한 이) 기어 (041·042) ─────────────────────────

export interface HelicalGearOpts {
  /** 이 폭(축 방향, 기본 0.25) */
  width?: number;
  /** 피치원에서의 헬릭스각(rad, 이 줄과 축이 이루는 각, 기본 30°). 0 이면 평기어 */
  helix?: number;
  /** 비틀림 방향. 로컬 Z 가 커질수록 단면이 hand=+1 이면 반시계(+), -1 이면 시계로 돈다. 맞물리는 평행축 기어는 서로 반대 */
  hand?: 1 | -1;
  driver?: boolean;
  /** 축 구멍 반지름(기본 0.05 — 반지름 0.045 축이 지나간다) */
  bore?: number;
  /** 양쪽 면의 허브 칼라(판화 41·42 의 고리) 기본 true */
  collars?: boolean;
}

/** 폭 방향 위치 z 에서 단면이 돌아간 각(rad): hand·tan(helix)·z/rp — 피치원에서 이 줄이 축과 helix 를 이룬다 */
export function helixTwist(rp: number, helix: number, hand: 1 | -1, z: number): number {
  return (hand * Math.tan(helix) * z) / rp;
}

/**
 * 헬리컬 기어: 피치 반지름 = teeth·module/2(module = 축에 수직한 단면의 모듈), 인벌류트 단면.
 * 회전축 = 로컬 Z, 원점 중심, 가운데 평면(z=0)의 단면이 spurGear 와 같은 위상(이 중심 = (i+½)·피치각)이라
 * 평행축 쌍은 meshAngle 을 그대로 쓴다(두 기어 hand 반대). 이 줄 위에 노란 표시선이 따라 감긴다.
 * userData.gear = { teeth, module, helix, hand, width, rp, ra, rf } (검사용).
 */
export function helicalGear(teeth: number, module: number, opts: HelicalGearOpts = {}): THREE.Group {
  const w = opts.width ?? 0.25;
  const helix = opts.helix ?? (30 * Math.PI) / 180;
  const hand = opts.hand ?? 1;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = opts.bore ?? 0.05;
  const h = w / 2;
  const c = Math.min(module * 0.35, w * 0.05);
  const outline = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const total = Math.abs(helixTwist(rp, helix, 1, w));
  const N = Math.max(10, Math.ceil(total / 0.045));
  const zs: number[] = [-h, -h + c];
  for (let i = 0; i <= N; i++) zs.push(-(h - c) + (2 * (h - c) * i) / N);
  zs.push(h - c, h);
  const layers: LoftLayer[] = zs.map((zz, i) => {
    const edge = i === 0 || i === zs.length - 1;
    return { z: zz, s: edge ? (ra - c) / ra : 1, hs: edge ? (bore + c) / bore : 1, rot: helixTwist(rp, helix, hand, zz) };
  });
  const g = new THREE.Group();
  g.add(mesh(loft(outline, [circlePts(bore, 32)], layers), opts.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  if (opts.collars !== false) {
    for (const s of [-1, 1]) {
      // 얇은 큰 고리(플랜지) + 그 바깥의 작은 보스 — 판화의 두 겹 고리
      g.add(ringZ(bore, bore * 2.5, s > 0 ? h : -h - 0.022, s > 0 ? h + 0.022 : -h, 0.005, darkSteel()));
      g.add(ringZ(bore, bore * 1.7, s > 0 ? h + 0.022 : -h - 0.07, s > 0 ? h + 0.07 : -h - 0.022, 0.006, steel()));
    }
  }
  // 표시선: 이 0 의 이끝 위를 나선으로 따라가는 작은 노란 조각들
  const mark = paint(MARK);
  const nSeg = Math.max(6, Math.round(w / 0.03));
  const segLen = ((w * 0.98) / nSeg) * 1.05;
  for (let i = 0; i < nSeg; i++) {
    const zz = -(w * 0.98) / 2 + ((i + 0.5) * (w * 0.98)) / nSeg;
    const ang = Math.PI / teeth + helixTwist(rp, helix, hand, zz);
    const m = meshAt(new THREE.BoxGeometry(0.012, 0.012, segLen), mark, 0, 0, 0);
    m.position.set(Math.cos(ang) * (ra + 0.002), Math.sin(ang) * (ra + 0.002), zz);
    m.rotation.z = ang;
    // 이 줄 방향(축에서 helix 만큼 기울임)
    m.rotateX(hand * helix * -1);
    g.add(m);
  }
  g.userData.gear = { teeth, module, helix, hand, width: w, rp, ra, rf };
  setMM(g, { kind: 'gear', fn: 'helicalGear', teeth, module, internal: false, rp, ra, rf, width: w, axis: 'z', helix, hand }); // 검사 표식
  return g;
}

// ───────────────────────── 임의 각 원뿔 베벨 기어 (043) ─────────────────────────

export interface ConeBevelOpts {
  /** 이 폭(원뿔 모선 방향 길이, 기본 0.18) */
  face?: number;
  driver?: boolean;
  /** 축 구멍 반지름(기본 0.05) */
  bore?: number;
}

/** 베벨 이 모양: tip·root = 이끝·이뿌리 반폭(피치각 p 의 비율), add·ded = 이끝·이뿌리 높이(module 배) */
export interface BevelToothShape {
  tip: number;
  root: number;
  add: number;
  ded: number;
}
export const BEVEL_SHAPE: BevelToothShape = { tip: 0.13, root: 0.27, add: 0.9, ded: 0.9 };

/** 베벨 이 단면(큰 쪽 끝) 윤곽 — 피치 반지름 R, 이 0 의 중심 = +X, 사다리꼴. delta = 피치 원뿔 반각 */
export function bevelToothOutline(teeth: number, module: number, delta: number, shape: BevelToothShape = BEVEL_SHAPE): V2[] {
  const R = (teeth * module) / 2;
  const rt = R + (module * shape.add) / Math.cos(delta); // 이 높이는 피치 원뿔의 수직 방향이 module 배가 되도록 반지름 방향으로는 1/cosδ
  const rf = R - (module * shape.ded) / Math.cos(delta);
  const p = TAU / teeth;
  const wt = shape.tip * p;
  const wr = shape.root * p;
  const out: V2[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * p;
    out.push(
      [Math.cos(a - wr) * rf, Math.sin(a - wr) * rf],
      [Math.cos(a - wt) * rt, Math.sin(a - wt) * rt],
      [Math.cos(a + wt) * rt, Math.sin(a + wt) * rt],
      [Math.cos(a + wr) * rf, Math.sin(a + wr) * rf]
    );
  }
  return out;
}

/** 두 축이 이루는 각 sigma, 잇수 z1·z2 일 때 기어 1 의 피치 원뿔 반각(rad). 기어 2 는 sigma − 이 값 */
export function bevelPitchAngle(sigma: number, z1: number, z2: number): number {
  return Math.atan2(Math.sin(sigma), z2 / z1 + Math.cos(sigma));
}

/**
 * 피치 원뿔 반각 delta 인 직선 이 베벨 기어(축 교각 임의). 회전축 = 로컬 Z, 원점 = 큰 쪽 피치원 중심,
 * 이는 z∈[0, face·cosδ] 에서 꼭짓점 (0,0,A=R/tanδ) 쪽으로 가늘어진다(단면 배율 1 − z/A). 뒤(z<0)에 둥근 뒷판+허브.
 * 이 0 의 중심 = 로컬 +X(bevelToothOutline). 표시선은 이 0 의 윗면 모선.
 * userData.bevel = { teeth, module, delta, R, A, zT } (검사용).
 */
export function coneBevelGear(teeth: number, module: number, delta: number, opts: ConeBevelOpts = {}): THREE.Group {
  const face = opts.face ?? 0.18;
  const R = (teeth * module) / 2;
  const A = R / Math.tan(delta);
  const zT = face * Math.cos(delta);
  const k = 1 - zT / A;
  const rf = R - (module * BEVEL_SHAPE.ded) / Math.cos(delta);
  const bore = opts.bore ?? 0.05;
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  const outline = bevelToothOutline(teeth, module, delta);
  g.add(
    mesh(
      loft(outline, [circlePts(bore, 32)], [
        { z: 0, s: 1, hs: 1 },
        { z: zT, s: k, hs: 1 }
      ]),
      body
    )
  );
  // 뒷판(둥근 원판) + 허브
  const blankT = Math.min(0.1, face * 0.6);
  g.add(ringZ(bore, rf * 0.97, -blankT, 0.002, 0.008, body));
  g.add(ringZ(bore, bore * 1.9, -blankT - 0.05, -blankT, 0.007, darkSteel()));
  g.add(ringZ(bore, bore * 1.6, zT, zT + 0.05, 0.007, steel()));
  // 표시선: 이 0 윗면 모선
  const rt = R + (module * BEVEL_SHAPE.add) / Math.cos(delta);
  const p0 = new THREE.Vector3(rt + 0.003, 0, 0);
  const p1 = new THREE.Vector3(rt * k + 0.003, 0, zT);
  const len = p0.distanceTo(p1);
  const m = meshAt(new THREE.BoxGeometry(0.012, 0.012, len * 0.9), paint(MARK), 0, 0, 0);
  m.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p1.clone().sub(p0).normalize());
  g.add(m);
  g.userData.bevel = { teeth, module, delta, R, A, zT };
  setMM(g, { kind: 'gear', fn: 'coneBevelGear', teeth, module, internal: false, rp: R, ra: rt, rf, width: zT, axis: 'z', delta, apex: [0, 0, A] }); // 검사 표식
  return g;
}

// ───────────────────────── 계단식 이 기어 (044) ─────────────────────────

export interface SteppedGearOpts {
  /** 계단(층) 수, 기본 4 */
  sections?: number;
  /** 층 하나의 폭(기본 0.2) */
  sectionWidth?: number;
  /** 층 사이 틈(기본 0.012 — 판화의 가는 이음선) */
  gap?: number;
  /** 층마다 어긋나는 각(rad). 기본 피치각/sections. 맞물리는 상대 기어는 −(z1/z2)·step */
  step?: number;
  driver?: boolean;
  bore?: number;
}

/** 층 k 의 가운데 z(로컬) */
export function steppedSectionZ(k: number, sections: number, sectionWidth: number, gap: number): number {
  return (k - (sections - 1) / 2) * (sectionWidth + gap);
}

/**
 * 계단식 이 기어: 같은 평기어(spurGear 와 같은 인벌류트·위상)를 폭 방향으로 sections 개 겹치고
 * 층 k 를 k·step 만큼 돌려 어긋나게 쌓은 것. 회전축 = 로컬 Z, 원점이 전체 가운데.
 * 층 k 의 실제 위상 = 기어 회전 + k·step. userData.stepped = { teeth, module, sections, sectionWidth, gap, step, rp, ra, rf }.
 */
export function steppedGear(teeth: number, module: number, opts: SteppedGearOpts = {}): THREE.Group {
  const n = opts.sections ?? 4;
  const sw = opts.sectionWidth ?? 0.2;
  const gap = opts.gap ?? 0.012;
  const step = opts.step ?? TAU / teeth / n;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = opts.bore ?? 0.05;
  const c = Math.min(module * 0.3, sw * 0.08);
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const outline = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const g = new THREE.Group();
  const markMat = paint(MARK);
  for (let k = 0; k < n; k++) {
    const zc = steppedSectionZ(k, n, sw, gap);
    const layers: LoftLayer[] = [
      { z: -sw / 2, s: (ra - c) / ra, hs: (bore + c) / bore },
      { z: -sw / 2 + c, s: 1, hs: 1 },
      { z: sw / 2 - c, s: 1, hs: 1 },
      { z: sw / 2, s: (ra - c) / ra, hs: (bore + c) / bore }
    ];
    const sec = new THREE.Group();
    sec.add(mesh(loft(outline, [circlePts(bore, 32)], layers), body));
    // 표시선: 이 0 의 이끝을 따라(층 폭 전체)
    const mk = meshAt(new THREE.BoxGeometry(0.012, 0.012, sw * 0.96), markMat, 0, 0, 0);
    mk.position.set(Math.cos(Math.PI / teeth) * (ra + 0.002), Math.sin(Math.PI / teeth) * (ra + 0.002), 0);
    mk.rotation.z = Math.PI / teeth;
    sec.add(mk);
    sec.position.z = zc;
    sec.rotation.z = k * step;
    sec.userData.section = k;
    g.add(sec);
  }
  const half = (n * sw + (n - 1) * gap) / 2;
  for (const s of [-1, 1]) {
    g.add(ringZ(bore, bore * 2.2, s > 0 ? half : -half - 0.025, s > 0 ? half + 0.025 : -half, 0.006, darkSteel()));
  }
  g.userData.stepped = { teeth, module, sections: n, sectionWidth: sw, gap, step, rp, ra, rf };
  setMM(g, { kind: 'gear', fn: 'steppedGear', teeth, module, internal: false, rp, ra, rf, width: 2 * half, axis: 'z', sections: n, step }); // 검사 표식
  return g;
}

// ───────────────────────── 마찰 홈 바퀴 (045) ─────────────────────────

export interface GrooveWheelOpts {
  /** 둘레 V 홈 능선 개수(기본 5). ridgeAtCenter=false 면 홈이 가운데이고 능선은 grooves−1 + 양끝 */
  ridges?: number;
  /** 능선 간격(축 방향, 기본 0.09) */
  pitch?: number;
  /** V 홈 깊이(능선 끝~홈 바닥 이론 깊이, 기본 0.07) */
  depth?: number;
  /** 능선 끝을 평평하게 깎는 여유(기본 0.008) — 상대 바퀴의 홈 바닥과 끝이 닿지 않는다 */
  clearance?: number;
  /** true 면 x=0 에 능선(위 바퀴), false 면 x=0 에 홈(아래 바퀴: 반 피치 어긋남). 기본 true */
  ridgeAtCenter?: boolean;
  driver?: boolean;
  bore?: number;
  /** 능선 끝의 노란 표시 조각(기본 true) */
  mark?: boolean;
}

/** x(축 방향) 에서의 바퀴 반지름. 능선 +d/2, 홈 −d/2 를 이론선으로 하고 능선 끝만 clearance 만큼 깎는다(홈 바닥은 뾰족). 위 바퀴와 아래 바퀴는 위상이 반대 → V 면에서 반지름 합이 일정, 끝·바닥 사이에는 clearance 만큼 틈 */
export function grooveRadius(rp: number, x: number, o: { pitch: number; depth: number; clearance: number; ridgeAtCenter: boolean }): number {
  const u = o.ridgeAtCenter ? x / o.pitch : x / o.pitch + 0.5;
  const f = Math.abs(u - Math.round(u)); // 0(능선)~0.5(홈)
  const tri = 1 - 4 * f; // +1 능선, −1 홈
  const r = rp + (o.depth / 2) * tri;
  return Math.min(rp + o.depth / 2 - o.clearance, r); // 능선 끝만 깎는다(홈 바닥은 뾰족한 V)
}

/**
 * 마찰 홈 바퀴: 원통 둘레에 곧은 V 홈(능선)이 줄지어 난 바퀴. 피치 반지름(홈 깊이 한가운데) = rp.
 * 회전축 = 로컬 Z, 원점 중심. 폭 = ridges·pitch. 위 바퀴(ridgeAtCenter 참)와 아래 바퀴(거짓)의 반지름 합이 어디서나
 * 2·(피치 반지름 합)이라 중심 거리 rp1+rp2 에서 V 면끼리 정확히 맞닿고 박히지 않는다.
 * userData.groove = { rp, width, pitch, depth, clearance, ridgeAtCenter }.
 */
export function grooveWheel(rp: number, opts: GrooveWheelOpts = {}): THREE.Group {
  const nR = opts.ridges ?? 5;
  const pitch = opts.pitch ?? 0.09;
  const depth = opts.depth ?? 0.07;
  const clearance = opts.clearance ?? 0.008;
  const ridgeAtCenter = opts.ridgeAtCenter ?? true;
  const bore = opts.bore ?? 0.05;
  const W = nR * pitch;
  const o = { pitch, depth, clearance, ridgeAtCenter };
  // 외곽 프로파일 (r, y=축방향). 꼭짓점: 끝, 능선 끝 양 모서리, 홈 바닥 양 모서리
  const xs: number[] = [-W / 2];
  const half = Math.ceil(nR / 2) + 2;
  const bx: number[] = []; // 꺾임 위치
  for (let j = -half; j <= half; j++) {
    const c0 = ridgeAtCenter ? j * pitch : (j - 0.5) * pitch; // 능선 중심
    // 능선 끝이 평평하게 깎인 폭, 홈 바닥 폭: 이론 기울기 d/(p/2)
    const slope = depth / (pitch / 2); // r 변화 / x
    const flatHalf = clearance / slope;
    bx.push(c0 - flatHalf, c0 + flatHalf); // 능선 끝 평면
    const g0 = c0 + pitch / 2; // 홈 중심
    bx.push(g0);
  }
  bx.sort((a, b) => a - b);
  for (const x of bx) if (x > -W / 2 + 1e-6 && x < W / 2 - 1e-6) xs.push(x);
  xs.push(W / 2);
  const prof: V2[] = [[bore, -W / 2]];
  for (const x of xs) prof.push([grooveRadius(rp, x, o), x]);
  prof.push([bore, W / 2], [bore, -W / 2]);
  const geo = lathe(prof, 96, 0, TAU, 20);
  geo.rotateX(Math.PI / 2);
  const g = new THREE.Group();
  g.add(mesh(geo, opts.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  for (const s of [-1, 1]) {
    g.add(ringZ(bore, bore * 2.3, s > 0 ? W / 2 : -W / 2 - 0.03, s > 0 ? W / 2 + 0.03 : -W / 2, 0.006, darkSteel()));
  }
  // 표시: 능선 끝마다 노란 조각(높이 0.003 < clearance)
  if (opts.mark !== false) {
    const mk = paint(MARK);
    const nb = Math.round(W / pitch) + 1;
    for (let j = -nb; j <= nb; j++) {
      const c0 = ridgeAtCenter ? j * pitch : (j - 0.5) * pitch;
      if (Math.abs(c0) > W / 2 - pitch * 0.2) continue;
      const rr = grooveRadius(rp, c0, o);
      const m = meshAt(new THREE.BoxGeometry(0.02, 0.003, pitch * 0.12), mk, 0, 0, 0);
      m.position.set(rr + 0.0012, 0, c0);
      g.add(m);
    }
  }
  g.userData.groove = { rp, width: W, pitch, depth, clearance, ridgeAtCenter };
  setMM(g, { kind: 'part', fn: 'grooveWheel', rp, width: W, pitch, depth, ridgeAtCenter, axis: 'z' }); // 검사 표식(마찰 바퀴 — 기어·풀리 수에 세지 않는다)
  return g;
}
