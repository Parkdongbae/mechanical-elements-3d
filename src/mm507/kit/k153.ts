// 153번 전용 키트 — 스터드로 미는 왕복 장치
//  원판의 스터드가 막대 아래 돌출부를 밀어 한쪽으로 보내고, 반대쪽 스터드가 벨 크랭크의
//  아래팔을 밀면 윗팔이 막대 앞 스터드를 쳐서 되보낸다. 모든 자세는 bell153(theta) 의 닫힌 식.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePts, circlePath, extrude, lathe, mesh, rodProfile, roundedRect, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

/** 153번 치수(세계 좌표). 판화 비(450px = 4.14): 원판 지름 192, 막대 두께 36, 축 사이 169, 팔 140·125 (px) */
export const K153 = {
  /** 원판 축 */
  O: [0, 1.64] as V2,
  /** 원판 반지름·두께·두께 층의 아래 z */
  Rd: 0.88, discT: 0.08, discZ0: 0.12,
  /** 스터드: 감는 반지름·반지름·돌출 z */
  Rs: 0.75, rs: 0.075, studZ0: 0.2, studZ1: 0.34,
  /** 가로 막대: 반길이·높이·아랫면 y·두께 층 */
  barHalf: 1.86, barH: 0.28, barBot: 2.74, barZ1: 0.1,
  /** 돌출부: 폭·밑변 y·두께 층 */
  rectW: 0.37, rectBot: 2.41, rectZ0: 0.215, rectZ1: 0.275,
  /** 막대 앞 스터드: 반지름·막대 기준 x·높이 y */
  rs2: 0.09, sx0: -1.18, sy: 2.86,
  /** 벨 크랭크: 받침점·윗팔 길이와 기본각·끝 원, 아래팔 길이와 기본각·끝 패드, 쉬는 각
   *  (쉬는 패드 = P + L2∠(thL0+gRest) = 스터드 감김 원 안쪽, 판화처럼 스터드가 아래에서 받쳐 든다) */
  P: [-1.53, 1.71] as V2, L1: 1.28, thH0: 57 * DEG, rt: 0.075,
  L2: 0.88, thL0: 6 * DEG, rtLo: 0.12, gRest: -16 * DEG,
  /** 안내 봉: 눈 x·봉 y·z·반지름, 러그 x·반너비·구멍 반지름 */
  guideX: 2.06, guideY: 2.5, guideZ: 0.05, rodR: 0.05,
  lugX: 1.62, lugHalf: 0.09, holeR: 0.058,
  /** theta=0 의 스터드 A 각(t=1 이 판화 자세)·스터드가 빠져나간 뒤 레버가 내려오는 구간 */
  phi0: 195.17 * DEG, ret: 22 * DEG
} as const;

// ── 유도 상수(한 번 계산) ──
//  아래팔 끝 패드는 쉬는 자리에서 스터드 감김 원 안쪽(중심에서 ≈0.89·Rs, −173°)에 놓인다(판화).
//  원판은 시계 — 아래쪽 스터드가 원판 왼쪽 옆을 따라 올라오며 패드의 아랫면(레버의 시계 쪽)에 닿아
//  두 원 접점(ρLo = rs + rtLo)으로 패드를 반시계로 들어 올린다(교점의 반시계 가지 gb).
//  가장 높이 든 뒤 스터드가 패드 끝을 빠져나갈 때까지 그 각에 머물고, 빠져나간 뒤 정해진 곡선으로 내려온다.
const phiA = Math.asin((K153.rectBot - K153.rs - K153.O[1]) / K153.Rs);
const phiZ = Math.PI - phiA;
const stroke = K153.Rs * (Math.cos(phiA) - Math.cos(phiZ));
const Lv = -stroke / 2;
const rhoHi = K153.rs2 + K153.rt;
const rhoLo = K153.rs + K153.rtLo;

/** 스터드 각 φ 에서 패드가 스터드 위(시계 쪽 접촉)에 얹힐 때의 레버 각. 두 원이 못 닿으면 null */
function gbOf(phiS: number): number | null {
  const dx = K153.O[0] + K153.Rs * Math.cos(phiS) - K153.P[0];
  const dy = K153.O[1] + K153.Rs * Math.sin(phiS) - K153.P[1];
  const d = Math.hypot(dx, dy);
  if (d > K153.L2 + rhoLo || d < K153.L2 - rhoLo) return null;
  const c = (K153.L2 * K153.L2 + d * d - rhoLo * rhoLo) / (2 * K153.L2 * d);
  return Math.atan2(dy, dx) + Math.acos(Math.max(-1, Math.min(1, c))) - K153.thL0;
}
// 처음 닿는 각 phiHi: 스터드가 아래(−100°)에서 올라오며 gb 가 쉬는 각에 이르는 자리 (≈ −158.6°)
let phiHi = -100 * DEG;
{
  let prev = phiHi;
  for (let p = -100 * DEG; p > -260 * DEG; p -= 0.25 * DEG) {
    const g = gbOf(p);
    if (g !== null && g >= K153.gRest) {
      let lo = prev; // gb < gRest(또는 안 닿음)
      let hi = p;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        const gm = gbOf(m);
        if (gm !== null && gm >= K153.gRest) hi = m;
        else lo = m;
      }
      phiHi = hi;
      break;
    }
    prev = p;
  }
}
// 가장 높이 드는 각 phiPk(≈ −214°)와 그때 레버 각 gStay — gb 최대
let phiPk = phiHi;
let gStay = K153.gRest;
{
  for (let p = phiHi; p > phiHi - 150 * DEG; p -= 0.05 * DEG) {
    const g = gbOf(p);
    if (g === null) break;
    if (g > gStay) { gStay = g; phiPk = p; }
  }
  let lo = phiPk - 0.05 * DEG;
  let hi = phiPk + 0.05 * DEG;
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if ((gbOf(m1) ?? -9) < (gbOf(m2) ?? -9)) lo = m1;
    else hi = m2;
  }
  phiPk = (lo + hi) / 2;
  gStay = gbOf(phiPk) ?? gStay;
}
// 스터드가 패드 끝을 빠져나가는 각 phiRel(≈ −223°, |P−S| = L2 + ρLo) — 그때까지 레버는 gStay 에 머문다
let phiRel = phiPk;
{
  let p = phiPk;
  while (gbOf(p - 0.05 * DEG) !== null && p > phiPk - 90 * DEG) p -= 0.05 * DEG;
  let lo = p - 0.05 * DEG; // 안 닿음
  let hi = p;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (gbOf(m) !== null) hi = m;
    else lo = m;
  }
  phiRel = lo;
}
// 접촉 자리의 막대 x (윗팔 끝 원이 막대 스터드 원에 닿는 자리)
const barXOf = (g: number): number => {
  const tx = K153.P[0] + K153.L1 * Math.cos(K153.thH0 + g);
  const ty = K153.P[1] + K153.L1 * Math.sin(K153.thH0 + g);
  const dy = ty - K153.sy;
  return tx - Math.sqrt(Math.max(rhoHi * rhoHi - dy * dy, 0)) - K153.sx0;
};
const barL = barXOf(gStay);
const rL0 = K153.rs - (barL - Lv);
const Rpv = K153.Rs * Math.cos(phiA) + K153.rs - rL0;

/** 유도 상수(검사 스크립트가 같은 식을 쓰도록 내놓는 값) */
export const K153V = {
  phiA, phiZ, stroke, Lv, Rpv, barL, rL0, rhoHi, rhoLo, phiHi, phiPk, phiRel, gStay,
  /** 들어 올림 구간 길이(처음 닿음 → 가장 높이)·머묾 끝(스터드가 빠져나감) */
  wLift: phiHi - phiPk,
  wHold: phiHi - phiRel
} as const;

const sstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

export interface Bell153 {
  /** 스터드 A 의 세계 각(0..2π)과 원판 rotation.z */
  phiA: number;
  disk: number;
  /** 막대 x 와 벨 크랭크 각 */
  bar: number;
  gamma: number;
  /** 지금 구간 */
  mode: 'push' | 'strike' | 'dwell';
  /** 스터드 둘·팔 끝 둘의 세계 위치(이름표 따라가기용) */
  studA: V2;
  studB: V2;
  tipHi: V2;
  tipLo: V2;
}

/** 153번 운동식 — theta 의 함수(한 주기 = 원판 한 바퀴, 막대 두 왕복). 스터드 각은 시간에 따라 줄어든다(시계) */
export function bell153(theta: number): Bell153 {
  const x = wrap(K153.phi0 - theta);
  const V = K153V;
  let gamma = K153.gRest;
  let bar: number | null = null;
  let mode: 'push' | 'strike' | 'dwell' = 'dwell';
  let since = Infinity; // 가장 최근 사건에서 지난 각
  let lastPush = false;
  for (const ph of [x, x - Math.PI]) {
    const p = wrap(ph);
    // 밀기: 스터드가 돌출부 왼옆을 민다
    if (p > V.phiA && p < V.phiZ) {
      bar = K153.Rs * Math.cos(p) + K153.rs - V.rL0;
      mode = 'push';
    }
    // 레버: 처음 닿은 뒤 지난 각 u
    const u = wrap(V.phiHi - p);
    if (u <= V.wLift) {
      gamma = Math.max(gamma, gbOf(V.phiHi - u) ?? K153.gRest);
      if (mode !== 'push') mode = 'strike';
    } else if (u <= V.wHold) {
      gamma = Math.max(gamma, V.gStay); // 가장 높이 든 채 스터드가 패드 끝을 빠져나간다(gb ≤ gStay, 떨어져 있음)
    } else if (u < V.wHold + K153.ret) {
      gamma = Math.max(gamma, V.gStay + (K153.gRest - V.gStay) * sstep((u - V.wHold) / K153.ret));
    }
    // 가장 최근 사건: 밀기 끝(막대 오른쪽 끝) 또는 가장 높이 듦(막대 왼쪽 끝)
    const sp = wrap(V.phiA - p);
    const ss = wrap(V.phiPk - p);
    if (sp < since) { since = sp; lastPush = true; }
    if (ss < since) { since = ss; lastPush = false; }
  }
  if (bar === null) bar = mode === 'strike' ? Math.min(V.Rpv, barXOf(gamma)) : lastPush ? V.Rpv : V.barL;
  return {
    phiA: x,
    disk: K153.phi0 - theta,
    bar,
    gamma,
    mode,
    studA: [K153.O[0] + K153.Rs * Math.cos(x), K153.O[1] + K153.Rs * Math.sin(x)],
    studB: [K153.O[0] - K153.Rs * Math.cos(x), K153.O[1] - K153.Rs * Math.sin(x)],
    tipHi: [K153.P[0] + K153.L1 * Math.cos(K153.thH0 + gamma), K153.P[1] + K153.L1 * Math.sin(K153.thH0 + gamma)],
    tipLo: [K153.P[0] + K153.L2 * Math.cos(K153.thL0 + gamma), K153.P[1] + K153.L2 * Math.sin(K153.thL0 + gamma)]
  };
}

// ── 부품 ──

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function boxAt(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  return meshAt(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
function pinMark(name: string, x: number, y: number, z: number, r: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  o.userData.outline = circlePts(r, 24);
  setMM(o, { kind: 'pin', point: [0, 0, 0] });
  return o;
}

/**
 * 스터드 원판(153번, 구동): 원점 = 축, 두께 가운데 z = 0. 스터드 둘(로컬 ±X, 반지름 Rs)이 앞으로 돌출.
 * child 'studA'·'studB' 에 스터드 원 outline. mm.kind = 'disc'.
 */
export function studDisc153(): THREE.Group {
  const g = new THREE.Group();
  const b = K153.discZ0;
  g.add(mesh(tubeZ(0.052, K153.Rd, b, b + K153.discT, 0.008, 72), bronze({ roughness: 0.42 })));
  g.add(mesh(tubeZ(0.052, 0.1, b + K153.discT, b + K153.discT + 0.012, 0.005, 32), darkSteel()));
  g.add(meshAt(cylZ(K153.rs, K153.studZ0, K153.studZ1, 0.006, 24), steel(), K153.Rs, 0, 0));
  g.add(meshAt(cylZ(K153.rs, K153.studZ0, K153.studZ1, 0.006, 24), steel(), -K153.Rs, 0, 0));
  g.add(boxAt(0.016, 0.3, 0.008, paint(MARK), 0, 0.45, b + K153.discT + 0.003));
  g.add(pinMark('studA', K153.Rs, 0, (K153.studZ0 + K153.studZ1) / 2, K153.rs));
  g.add(pinMark('studB', -K153.Rs, 0, (K153.studZ0 + K153.studZ1) / 2, K153.rs));
  setMM(g, { kind: 'disc', fn: 'studDisc153', r: K153.Rd, width: K153.discT, axis: 'z', studs: 2 });
  return g;
}

/**
 * 벨 크랭크(153번): 원점 = 받침점, 회전축 = 로컬 z, 두께 0.05(가운데 z = 0).
 * child 'armHiTip'(윗팔 끝 원 outline)·'armLoTip'(아래팔 패드 outline). mm.kind = 'lever'.
 */
export function bellCrank153(): THREE.Group {
  const g = new THREE.Group();
  const t = 0.05;
  const brassMat = brass({ roughness: 0.36 });
  const hub = roundedRect(-0.17, -0.17, 0.17, 0.17, 0.17);
  hub.holes.push(circlePath(0, 0, 0.056));
  g.add(mesh(extrude(hub, t, 0.005, 32), brassMat));
  // 팔: 허브에서 끝 원까지 테이퍼 사변형 + 끝 원판
  const arm = (ang: number, len: number, tipR: number, w0: number, w1: number): void => {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const nx = -uy;
    const ny = ux;
    const bx = ux * 0.1;
    const by = uy * 0.1;
    const ex = ux * (len - tipR * 0.4);
    const ey = uy * (len - tipR * 0.4);
    const pts: V2[] = [
      [bx + nx * w0, by + ny * w0],
      [ex + nx * w1, ey + ny * w1],
      [ex - nx * w1, ey - ny * w1],
      [bx - nx * w0, by - ny * w0]
    ];
    g.add(mesh(extrude(shapeFrom(pts), t, 0.004, 8), brassMat));
    const tip = mesh(extrude(shapeFrom(circlePts(tipR, 32)), t, 0.004, 24), brassMat);
    tip.position.set(ux * len, uy * len, 0);
    g.add(tip);
  };
  arm(K153.thH0, K153.L1, K153.rt, 0.05, 0.035);
  arm(K153.thL0, K153.L2, K153.rtLo, 0.06, 0.06); // 아래팔은 곧은 막대 + 둥근 끝(판화) — 스터드가 팔 밑을 지나도 안 닿는 폭
  g.add(boxAt(0.09, 0.014, 0.006, paint(MARK), 0.42, 0.52, t / 2 + 0.002));
  g.add(pinMark('armHiTip', K153.L1 * Math.cos(K153.thH0), K153.L1 * Math.sin(K153.thH0), 0, K153.rt));
  g.add(pinMark('armLoTip', K153.L2 * Math.cos(K153.thL0), K153.L2 * Math.sin(K153.thL0), 0, K153.rtLo));
  setMM(g, { kind: 'lever', fn: 'bellCrank153', pivot: [0, 0, 0], length: K153.L1 });
  return g;
}

/**
 * 가로 막대(153번): 원점 = 막대 아랫면의 한가운데, 로컬 X 가 길이.
 * 몸 + 러그 둘(안내 봉 구멍) + 목 + 돌출부(userData.outline) + 앞 스터드(child 'barStud').
 */
export function slideBar153(): THREE.Group {
  const g = new THREE.Group();
  const V = K153V;
  // 몸·러그는 두께 층 z 0~barZ1(설계 층표) — 압출이 z 0 중심이므로 반 두께 올린다
  const body = mesh(extrude(roundedRect(-K153.barHalf, 0, K153.barHalf, K153.barH, 0.02), K153.barZ1, 0.008, 12), bronze({ roughness: 0.46 }));
  body.position.z = K153.barZ1 / 2;
  g.add(body);
  for (const s of [1, -1] as const) {
    // 러그: 봉을 뚫는 눈(X축 링) + 막대 밑면에 붙는 목 — 평판 구멍은 평면 안을 지나는 봉을 못 받는다
    const eye = lathe(tubeProfile(K153.holeR, 0.1, -0.05, 0.05, 0.005), 32);
    eye.rotateZ(-Math.PI / 2);
    g.add(meshAt(eye, darkSteel(), s * K153.lugX, K153.guideY - K153.barBot, K153.guideZ));
    g.add(boxAt(K153.lugHalf, 0.14, K153.barZ1, darkSteel(), s * K153.lugX, -0.07, K153.barZ1 / 2));
  }
  g.add(boxAt(0.09, 0.2, 0.26, darkSteel(), 0.278, -0.06, 0.15));
  const rect = meshAt(
    extrude(roundedRect(V.rL0, K153.rectBot - K153.barBot, V.rL0 + K153.rectW, 0, 0.015), K153.rectZ1 - K153.rectZ0, 0.004, 8),
    darkSteel(), 0, 0, (K153.rectZ0 + K153.rectZ1) / 2 // 돌출부 층 rectZ0~rectZ1 의 가운데
  );
  rect.userData.outline = [
    [V.rL0, K153.rectBot - K153.barBot],
    [V.rL0 + K153.rectW, K153.rectBot - K153.barBot],
    [V.rL0 + K153.rectW, 0],
    [V.rL0, 0]
  ] as V2[];
  g.add(rect);
  g.add(meshAt(cylZ(K153.rs2, K153.barZ1, 0.37, 0.006, 24), steel(), K153.sx0, K153.sy - K153.barBot, 0));
  g.add(boxAt(0.3, 0.014, 0.006, paint(MARK), 0.6, 0.14, K153.barZ1 + 0.002));
  g.add(pinMark('barStud', K153.sx0, K153.sy - K153.barBot, 0.235, K153.rs2));
  setMM(g, { kind: 'slider', fn: 'slideBar153', axis: 'x', half: K153.barHalf });
  return g;
}

/**
 * 안내 봇(고정): 양 끝 눈에 받친 X 방향 봉 — 막대의 러그 구멍이 봉 위를 미끄러진다.
 * 눈 뒤의 받침 팔은 뒤판에 붙는다(판화에 없음).
 */
export function guideRod153(): THREE.Group {
  const g = new THREE.Group();
  const rod = cylX(K153.rodR, -K153.guideX, K153.guideX, 0.006, 24);
  g.add(meshAt(rod, steel(), 0, K153.guideY, K153.guideZ));
  for (const s of [1, -1] as const) {
    const eye = lathe(tubeProfile(K153.holeR, 0.1, -0.025, 0.025, 0.005), 32);
    eye.rotateZ(-Math.PI / 2);
    g.add(meshAt(eye, darkSteel(), s * K153.guideX, K153.guideY, K153.guideZ));
    g.add(boxAt(0.12, 0.14, K153.guideZ - STAGE.backZ - 0.05, castIron(), s * K153.guideX, K153.guideY + 0.01, (STAGE.backZ + K153.guideZ - 0.05) / 2));
  }
  setMM(g, { kind: 'guide', fn: 'guideRod153', axis: 'x' });
  return g;
}
