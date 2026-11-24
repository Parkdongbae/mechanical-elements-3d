// 131·132·133번 전용 키트
//  131 홈 팔과 이 부채꼴(크랭크 원판 → 홈 팔 → 부채꼴 → 랙): 크랭크 원판, 홈 팔과 한 몸인 이 부채꼴, 랙, 랙 안내, 운동식(rock131)
//  132 비스듬한 막대 프레스: 틀, 도는 윗 원판(지레 달림), 누름판(아래 원판 달림), 공 끝 막대, 운동식(twist132)
//  133 피니언·부채꼴 프레스: 틀, 누름판, 크랭크 핀 달린 이 부채꼴, 눈 달린 연결봉, 손 크랭크, 운동식(press133)
// 치수 상수(K131·K132·K133)와 운동식·윤곽은 순수 함수라 node 검사 스크립트(shots/_verify/s131.mjs · s132.mjs · s133.mjs)가 번들해 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePts, extrude, lathe, loft, mesh, pathFrom, rodProfile, roundedRect, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { LoftLayer, V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { STAGE } from './stand';
import { meshAngle } from './gear';
import { rotArrow } from './misc';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;
const TAN20 = Math.tan(20 * DEG);

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
/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** 이름만 있는 표식(핀 자리) */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
/** 누운 판(XZ 평면 둥근 네모, y0~y1) — 세로 구멍(기둥·축 자리) holes = [x, z, r] */
function slabY(halfW: number, depth: number, y0: number, y1: number, holes: [number, number, number][] = [], round = 0.02): THREE.BufferGeometry {
  const sh = roundedRect(-halfW, -depth / 2, halfW, depth / 2, round);
  for (const [x, z, r] of holes) sh.holes.push(pathFrom(circlePts(r, 28, x, z)));
  const geo = extrude(sh, y1 - y0, 0.006, 12);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, (y0 + y1) / 2, 0);
  return geo;
}

// ═══════════════════════════ 공용: 이 부채꼴 ═══════════════════════════

export interface SectorSpan {
  rp: number;
  ra: number;
  rf: number;
  /** 이 난 호의 시작·끝 각(로컬, rad, aE > aS) — 양 끝 이뿌리 점 */
  aS: number;
  aE: number;
  /** 곧은 변이 허브 원에 닿는 각 */
  tS: number;
  tE: number;
}

/**
 * 이 부채꼴의 이 난 가장자리(반시계). 로컬 좌표는 spurGear(zs, m) 와 같다(이 i 의 중심각 = (i + 0.5)·2π/zs) — meshAngle 을 그대로 쓸 수 있다.
 * 이 i0 … i0 + N − 1 과 끝 이뿌리 점.
 */
export function sectorTeeth131(zs: number, m: number, i0: number, N: number): V2[] {
  const rp = (zs * m) / 2;
  const full = involuteOutline(zs, rp + m, rp - 1.25 * m);
  const per = Math.round(full.length / zs);
  const out: V2[] = [];
  for (let k = 0; k <= per * N; k++) out.push(full[(((i0 * per + k) % full.length) + full.length) % full.length]!);
  return out;
}

/** 이 난 호의 각 범위와 곧은 변의 접점 각 */
export function sectorSpan131(zs: number, m: number, i0: number, N: number, hubR: number): SectorSpan {
  const rp = (zs * m) / 2;
  const rf = rp - 1.25 * m;
  const t = sectorTeeth131(zs, m, i0, N);
  const s = t[0]!;
  const e = t[t.length - 1]!;
  const aS = Math.atan2(s[1], s[0]);
  let aE = Math.atan2(e[1], e[0]);
  while (aE <= aS) aE += TAU;
  const k = Math.acos(hubR / rf);
  return { rp, ra: rp + m, rf, aS, aE, tS: aS - k, tE: aE + k };
}

/** 이 부채꼴 윤곽(반시계): 이 난 호 → 허브 원에 접하는 곧은 변 → 허브 뒤쪽 원호 → 곧은 변 */
export function sectorOutline131(zs: number, m: number, i0: number, N: number, hubR: number): V2[] {
  const out = sectorTeeth131(zs, m, i0, N);
  const S = sectorSpan131(zs, m, i0, N, hubR);
  const a1 = S.tS + TAU;
  for (let i = 0; i <= 16; i++) {
    const t = S.tE + ((a1 - S.tE) * i) / 16;
    out.push([hubR * Math.cos(t), hubR * Math.sin(t)]);
  }
  return out;
}

/**
 * 부채꼴의 창(살 사이 뚫린 곳) 윤곽들. 가장자리 살 폭 sw(곧은 변에서 안쪽으로), 가운데 살들 mids(로컬 각)·반폭 hw, 반지름 r0 ~ r1.
 */
export function sectorWindows131(S: SectorSpan, hubR: number, sw: number, mids: number[], hw: number, r0: number, r1: number): V2[][] {
  const hIn = hubR - sw;
  const los: ((r: number) => number)[] = [(r) => S.tS + Math.acos(hIn / r)];
  const his: ((r: number) => number)[] = [];
  for (const a of mids) {
    his.push((r) => a - Math.asin(hw / r));
    los.push((r) => a + Math.asin(hw / r));
  }
  his.push((r) => S.tE - Math.acos(hIn / r));
  const wins: V2[][] = [];
  for (let w = 0; w < los.length; w++) {
    const lo = los[w]!;
    const hi = his[w]!;
    if (hi(r0) - lo(r0) < 0.05) continue;
    const pts: V2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = lo(r1) + ((hi(r1) - lo(r1)) * i) / 14;
      pts.push([r1 * Math.cos(t), r1 * Math.sin(t)]);
    }
    for (let i = 1; i < 6; i++) {
      const r = r1 + ((r0 - r1) * i) / 6;
      pts.push([r * Math.cos(hi(r)), r * Math.sin(hi(r))]);
    }
    for (let i = 0; i <= 8; i++) {
      const t = hi(r0) + ((lo(r0) - hi(r0)) * i) / 8;
      pts.push([r0 * Math.cos(t), r0 * Math.sin(t)]);
    }
    for (let i = 1; i < 6; i++) {
      const r = r0 + ((r1 - r0) * i) / 6;
      pts.push([r * Math.cos(lo(r)), r * Math.sin(lo(r))]);
    }
    wins.push(pts);
  }
  return wins;
}

function gearLayers(width: number, ra: number, m: number): LoftLayer[] {
  const c = Math.min(m * 0.3, width * 0.12);
  return [
    { z: -width / 2, s: (ra - c) / ra, hs: 1 },
    { z: -width / 2 + c, s: 1, hs: 1 },
    { z: width / 2 - c, s: 1, hs: 1 },
    { z: width / 2, s: (ra - c) / ra, hs: 1 }
  ];
}

/** 왔다 갔다 도는 부품의 방향 화살표 한 쌍(반시계·시계). set(dir) 로 지금 도는 쪽만 보인다(dir > 0 반시계, < 0 시계, 0 이면 그대로) */
export function swingArrows131(r: number): { group: THREE.Group; set(dir: number): void } {
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

// ═══════════════════════════ 131 홈 팔과 이 부채꼴 ═══════════════════════════

/** 131번 치수(세계 좌표·길이). 판화 비: 축 사이 510 : 크랭크 310 : 원판 370 : 부채꼴 피치 445 (px) */
export const K131 = {
  /** 크랭크 원판 축 */
  O: [0, 1.99] as V2,
  /** 홈 팔·부채꼴의 축 */
  P: [0, 1.3] as V2,
  discR: 0.5,
  /** 크랭크 반지름 */
  crank: 0.42,
  pinR: 0.04,
  /** 부채꼴: 온 바퀴 잇수·모듈·첫 이 번호·난 이 수 (이 22 의 중심이 로컬 −Y) */
  zs: 30,
  m: 0.04,
  i0: 17,
  N: 11,
  hubR: 0.14,
  bore: 0.052,
  /** 팔(로컬 +Y): 반폭, 끝 반원 중심, 홈 반폭, 홈 양 끝 반원 중심 */
  armHalf: 0.08,
  armTop: 1.17,
  slotHalf: 0.043,
  slot0: 0.24,
  slot1: 1.14,
  /** 랙: 이 수, 반길이, 이뿌리 아래 몸통 높이 */
  rackTeeth: 10,
  rackHalf: 1.66,
  rackBody: 0.11,
  /** 안내의 x(±), 폭 */
  guideX: 1.16,
  guideW: 0.1,
  /** 층: 원판 가운데 z·두께, 팔·부채꼴·랙 가운데 z·두께 */
  zDisc: 0.02,
  discT: 0.08,
  zArm: 0.15,
  width: 0.08,
  /** 판화 자세(t = 1)의 크랭크 핀 각(도) */
  poseDeg: -4.6
} as const;
/** 부채꼴 피치 반지름 */
export const K131_R: number = (K131.zs * K131.m) / 2;
/** 랙 피치선의 높이 */
export const K131_RACK_Y: number = K131.P[1] - K131_R;

/** 131번 운동: crank = 핀 각, pin = 핀 자리(세계), gamma = 팔·부채꼴 회전각(팔이 곧게 선 때 0, 반시계 +), rackX = 랙 변위, pinDist = 축에서 핀까지 */
export function rock131(theta: number): { crank: number; pin: V2; gamma: number; rackX: number; pinDist: number } {
  const crank = theta - 1.6 + K131.poseDeg * DEG;
  const pin: V2 = [K131.O[0] + K131.crank * Math.cos(crank), K131.O[1] + K131.crank * Math.sin(crank)];
  const dx = pin[0] - K131.P[0];
  const dy = pin[1] - K131.P[1];
  const gamma = Math.atan2(dy, dx) - Math.PI / 2;
  return { crank, pin, gamma, rackX: K131_R * gamma, pinDist: Math.hypot(dx, dy) };
}

/** 홈 윤곽(팔 로컬, 반시계) */
export function slotPts131(): V2[] {
  const { slotHalf: h, slot0, slot1 } = K131;
  const pts: V2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = (Math.PI * i) / 14;
    pts.push([h * Math.cos(t), slot1 + h * Math.sin(t)]);
  }
  for (let i = 0; i <= 14; i++) {
    const t = Math.PI + (Math.PI * i) / 14;
    pts.push([h * Math.cos(t), slot0 + h * Math.sin(t)]);
  }
  return pts;
}

/** 팔까지 합친 바깥 윤곽(메시용, 반시계) */
function armSectorOutline131(): V2[] {
  const K = K131;
  const out = sectorTeeth131(K.zs, K.m, K.i0, K.N);
  const S = sectorSpan131(K.zs, K.m, K.i0, K.N, K.hubR);
  const aArm = Math.acos(K.armHalf / K.hubR);
  // 허브 오른쪽 호(tE → 팔 오른쪽 변)
  const norm = (t: number): number => ((t % TAU) + TAU) % TAU;
  const tE = norm(S.tE);
  const tS = norm(S.tS);
  for (let i = 0; i <= 3; i++) {
    const t = tE + ((aArm - tE) * i) / 3;
    out.push([K.hubR * Math.cos(t), K.hubR * Math.sin(t)]);
  }
  for (let i = 0; i <= 16; i++) {
    const t = (Math.PI * i) / 16;
    out.push([K.armHalf * Math.cos(t), K.armTop + K.armHalf * Math.sin(t)]);
  }
  for (let i = 0; i <= 3; i++) {
    const t = Math.PI - aArm + ((tS - (Math.PI - aArm)) * i) / 3;
    out.push([K.hubR * Math.cos(t), K.hubR * Math.sin(t)]);
  }
  return out;
}

/**
 * 홈 팔과 한 몸인 이 부채꼴(131번): 원점 = 축, 회전축 = 로컬 Z, 팔은 로컬 +Y(긴 홈), 이 난 호의 한가운데(이 하나의 중심)는 로컬 −Y. 두께 가운데 z = 0.
 * userData.outline = 부채꼴 윤곽(팔 빼고 — 랙과의 침범 검사용), userData.outlines.slot = 홈(핀이 이 안에 있어야 한다). mm.kind = 'gear'.
 */
export function slottedSector131(): THREE.Group {
  const K = K131;
  const S = sectorSpan131(K.zs, K.m, K.i0, K.N, K.hubR);
  const wins = sectorWindows131(S, K.hubR, 0.07, [(S.aS + S.aE) / 2], 0.035, K.hubR + 0.05, S.rf - 0.06);
  const g = new THREE.Group();
  g.add(mesh(loft(armSectorOutline131(), [circlePts(K.bore, 32), slotPts131(), ...wins], gearLayers(K.width, S.ra, K.m)), brass()));
  g.add(mesh(tubeZ(K.bore, K.bore + 0.035, -K.width / 2 - 0.012, K.width / 2 + 0.014, 0.006, 40), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.012, 0.08, 0.008), paint(MARK), 0, -(S.rf - 0.03), K.width / 2 + 0.003));
  g.userData.outline = sectorOutline131(K.zs, K.m, K.i0, K.N, K.hubR);
  g.userData.outlines = { slot: slotPts131() };
  setMM(g, { kind: 'gear', fn: 'slottedSector131', teeth: K.zs, module: K.m, internal: false, rp: S.rp, ra: S.ra, rf: S.rf, width: K.width, axis: 'z', count: K.N });
  return g;
}

/** 랙 윤곽(반시계, 로컬: 피치선 y = 0, 이는 +Y, 이 k 의 중심 x = (k + 0.5)·πm, 한가운데 x = 0 은 이골) */
export function rackOutline131(m: number = K131.m, teeth: number = K131.rackTeeth, half: number = K131.rackHalf, body: number = K131.rackBody): V2[] {
  const p = Math.PI * m;
  const t2 = 0.24 * p;
  const th = t2 - m * TAN20;
  const rh = t2 + 1.25 * m * TAN20;
  const ch = 0.18 * m;
  const yt = m;
  const yb = -1.25 * m;
  const pts: V2[] = [
    [half, yb - body],
    [half, yb]
  ];
  for (let k = teeth / 2 - 1; k >= -teeth / 2; k--) {
    const x = (k + 0.5) * p;
    pts.push([x + rh, yb], [x + th + ch * TAN20, yt - ch], [x + th - ch, yt], [x - th + ch, yt], [x - th - ch * TAN20, yt - ch], [x - rh, yb]);
  }
  pts.push([-half, yb], [-half, yb - body]);
  return pts;
}

/** 랙(131번): 원점 = 피치선 위 한가운데, 길이 = 로컬 X, 이는 위(+Y), 두께 가운데 z = 0. userData.outline = 윤곽 */
export function rack131(): THREE.Group {
  const K = K131;
  const outline = rackOutline131();
  const g = new THREE.Group();
  g.add(mesh(extrude(shapeFrom(outline), K.width, 0.004, 8), steel({ roughness: 0.4 })));
  g.add(meshAt(new THREE.BoxGeometry(0.012, 0.05, 0.006), paint(MARK), 0, -1.25 * K.m - 0.04, K.width / 2 + 0.002));
  g.userData.outline = outline;
  setMM(g, { kind: 'rack', fn: 'rack131', module: K.m, teeth: K.rackTeeth, half: K.rackHalf, width: K.width, axis: 'x' });
  return g;
}

/**
 * 랙 안내(131번, 고정 — 판화의 볼트 둘 달린 세로 받침): 그룹 원점 = (x, 랙 몸통 가운데 높이, 0). 랙 몸통(높이 K131.rackBody, 두께 K131.width, 가운데 z = zc)이
 * 지나가는 네모 구멍(틈 0.004)이 X 방향으로 뚫린 틀 + 뒤판까지 받침 기둥(판화에 없음).
 */
export function rackGuide131(x: number, zc: number = K131.zArm): THREE.Group {
  const K = K131;
  const g = new THREE.Group();
  const yc = K131_RACK_Y - 1.25 * K.m - K.rackBody / 2;
  g.position.set(x, yc, 0);
  const iron = castIron();
  const hh = K.rackBody / 2 + 0.004;
  const hd = K.width / 2 + 0.004;
  const wall = 0.03;
  const lug = 0.09;
  const w = K.guideW;
  // 앞판(위아래로 길다 — 볼트 자리)·뒷판·위·아래
  g.add(boxAt(w, 2 * (hh + lug), wall, iron, 0, 0, zc + hd + wall / 2));
  g.add(boxAt(w, 2 * (hh + lug), wall, iron, 0, 0, zc - hd - wall / 2));
  g.add(boxAt(w, lug, 2 * hd, iron, 0, hh + lug / 2, zc));
  g.add(boxAt(w, lug, 2 * hd, iron, 0, -hh - lug / 2, zc));
  for (const sy of [1, -1]) g.add(meshAt(cylZ(0.022, 0, 0.016, 0.004, 6), darkSteel(), 0, sy * (hh + lug / 2), zc + hd + wall));
  // 뒤판까지 받침
  const z0 = STAGE.backZ;
  const z1 = zc - hd - wall;
  g.add(boxAt(w * 0.7, 0.1, z1 - z0, iron, 0, 0, (z0 + z1) / 2));
  g.userData.outlines = { guideSlot: [[-w / 2, -hh], [w / 2, -hh], [w / 2, hh], [-w / 2, hh]] as V2[] };
  setMM(g, { kind: 'guide', fn: 'rackGuide131', axis: 'x', halfH: hh, halfD: hd });
  return g;
}

/**
 * 크랭크 원판(131번): 원점 = 축, 두께 가운데 z = 0, 민판. 크랭크 핀은 로컬 +X 로 crankR, 앞면에서 pinZ1(로컬 z)까지 + 끝 덮개.
 * child 'crankPin'(로컬 z = markZ — 홈 팔의 평면)에 userData.outline = 핀 원(홈 침범 검사용).
 */
export function crankDisc131(pinZ1: number, markZ: number): THREE.Group {
  const K = K131;
  const t = K.discT;
  const g = new THREE.Group();
  g.add(mesh(tubeZ(0.046, K.discR, -t / 2, t / 2, 0.008, 72), bronze({ roughness: 0.36 })));
  g.add(mesh(tubeZ(0.046, 0.11, -t / 2 - 0.012, t / 2 + 0.008, 0.005, 40), darkSteel()));
  g.add(meshAt(cylZ(K.pinR, t / 2 - 0.01, pinZ1, 0.005, 28), steel(), K.crank, 0, 0));
  g.add(meshAt(cylZ(K.pinR + 0.022, pinZ1 - 0.018, pinZ1, 0.004, 28), darkSteel(), K.crank, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.014, 0.008), paint(MARK), K.crank - 0.14, 0, t / 2 + 0.003));
  const pin = pinMark('crankPin', K.crank, 0, markZ);
  pin.userData.outline = circlePts(K.pinR, 24);
  g.add(pin);
  setMM(g, { kind: 'crankDisc', fn: 'crankDisc131', r: K.discR, crank: K.crank, width: t, axis: 'z' });
  return g;
}

// ═══════════════════════════ 132 비스듬한 막대 프레스 ═══════════════════════════

/** 132번 치수. 높이는 세계 y, 가로·깊이는 프레스 축(세로) 기준 */
export const K132 = {
  /** 프레스 축의 깊이 자리(세계 z) */
  ZC: 0.28,
  floor: 0.18,
  /** 기둥: x(±), 반지름, 아래·위 끝 */
  colX: 1.05,
  colR: 0.07,
  colY0: 0.3,
  colY1: 2.62,
  /** 윗보: 아래·위, 반폭, 깊이 */
  beamY0: 2.62,
  beamY1: 2.9,
  beamHalf: 1.3,
  depth: 0.5,
  /** 윗 원판 아랫면의 높이(고정) */
  yT: 1.98,
  discR: 0.45,
  discT: 0.14,
  /** 허브(지레 자리): 아래·위(yT 기준), 반지름 */
  hubY0: 0.36,
  hubY1: 0.6,
  hubR: 0.19,
  spindleR: 0.07,
  /** 지레: 축에서 끝까지, 반지름, 높이(yT 기준) */
  lever: 0.72,
  leverR: 0.03,
  leverY: 0.48,
  /** 막대: 구멍 원 반지름, 공 중심 사이 길이, 공·막대 반지름 */
  rb: 0.3,
  L: 0.72,
  ballR: 0.045,
  barR: 0.022,
  /** 비틀림 각 = mid + amp·cos(theta − 1.6) (도). 쉬는 자세(판화) 110°, 눌렀을 때 30° */
  mid: 70,
  amp: 40,
  /** 아래 구멍의 방위(도, 막대 A — B 는 +180°). 쉬는 자세에서 두 막대가 정면에서 X 로 겹쳐 보이는 값 = 90 − 110/2 */
  alpha: 35,
  /** 아래 원판 두께, 누름판 두께·반폭 */
  lowT: 0.12,
  slabT: 0.3,
  slabHalf: 1.2
} as const;

export interface Twist132 {
  /** 윗 원판(지레)의 회전각(rotation.y, rad) */
  psi: number;
  /** 두 원판의 비틀림 각(rad) */
  phi: number;
  /** 공 중심 평면 사이 높이 */
  H: number;
  /** 쉬는 자세에서 내려간 거리 */
  drop: number;
  /** 구멍(공 중심) 자리 — 프레스 축 기준 [x, y(윗 원판 아랫면 = 0), z] */
  top: [[number, number, number], [number, number, number]];
  bot: [[number, number, number], [number, number, number]];
}

/** 방위각 b(rotation.y 와 같은 방향) 의 반지름 r 자리 [x, z] */
function azim(r: number, b: number): [number, number] {
  return [r * Math.cos(b), -r * Math.sin(b)];
}

/** 132번 운동(theta 의 닫힌 식): 지레가 ±40° 흔들리면 막대가 서면서 아래 원판이 내려간다. H = √(L² − (2·rb·sin(phi/2))²) */
export function twist132(theta: number): Twist132 {
  const K = K132;
  const psi = K.amp * DEG * Math.cos(theta - 1.6);
  const phi = K.mid * DEG + psi;
  const h = (f: number): number => Math.sqrt(K.L * K.L - (2 * K.rb * Math.sin(f / 2)) ** 2);
  const H = h(phi);
  const drop = H - h((K.mid + K.amp) * DEG);
  const a = K.alpha * DEG;
  const one = (b: number, y: number): [number, number, number] => {
    const [x, z] = azim(K.rb, b);
    return [x, y, z];
  };
  return { psi, phi, H, drop, top: [one(a + phi, 0), one(a + Math.PI + phi, 0)], bot: [one(a, -H), one(a + Math.PI, -H)] };
}

/** 세로 기둥(둥근 기둥 + 밑받침 + 머리 받침) — y0 ~ y1 */
function column(x: number, r: number, y0: number, y1: number, mat: THREE.Material): THREE.Mesh {
  const prof: V2[] = [
    [0, y0],
    [r * 1.5, y0],
    [r * 1.5, y0 + 0.05],
    [r, y0 + 0.09],
    [r, y1 - 0.1],
    [r * 1.45, y1 - 0.03],
    [r * 1.45, y1],
    [0, y1]
  ];
  return meshAt(lathe(prof, 32), mat, x, 0, 0);
}

/**
 * 프레스 틀(132번, 고정): 원점 = 프레스 축의 바닥(세계 y = 0), z = 0 이 축 평면. 기둥 둘(밑받침) + 윗보(축 구멍) + 처마 + 바닥 가운데 받침대(판화의 아래 네모).
 */
export function pressFrame132(): THREE.Group {
  const K = K132;
  const g = new THREE.Group();
  const iron = castIron();
  for (const s of [-1, 1]) {
    g.add(boxAt(0.34, 0.07, 0.34, iron, s * K.colX, K.floor + 0.035, 0));
    g.add(boxAt(0.26, 0.05, 0.26, iron, s * K.colX, K.floor + 0.095, 0));
    g.add(column(s * K.colX, K.colR, K.colY0, K.colY1, steel({ roughness: 0.42 })));
  }
  const yb = K.beamY1 - 0.1;
  g.add(mesh(slabY(K.beamHalf - 0.06, K.depth - 0.06, K.beamY0, yb, [[0, 0, K.spindleR + 0.004]]), iron));
  g.add(mesh(slabY(K.beamHalf, K.depth, yb, K.beamY1, [[0, 0, K.spindleR + 0.004]]), iron));
  g.add(boxAt(0.8, 0.12, K.depth - 0.06, iron, 0, K.floor + 0.06, 0));
  setMM(g, { kind: 'frame', fn: 'pressFrame132' });
  return g;
}

/**
 * 도는 윗 원판(132번): 원점 = 원판 아랫면의 축 자리, 회전축 = 로컬 Y. 아래부터 원판 → 원뿔 → 허브(지레가 로컬 +X 로 꽂힘) → 윗보를 꿰는 축 → 보 위 턱(판화의 검은 토막).
 * 아랫면에 낮은 원뿔 혹. child 'topSocketA'·'topSocketB' = 막대 위 구멍(공 중심) 자리.
 */
export function twistHead132(): THREE.Group {
  const K = K132;
  const g = new THREE.Group();
  const iron = castIron();
  const body: V2[] = [
    [0, 0],
    [K.discR - 0.01, 0],
    [K.discR, 0.01],
    [K.discR, K.discT - 0.01],
    [K.discR - 0.01, K.discT],
    [K.hubR + 0.03, K.hubY0],
    [K.hubR, K.hubY0 + 0.02],
    [K.hubR, K.hubY1 - 0.01],
    [K.hubR - 0.01, K.hubY1],
    [0, K.hubY1]
  ];
  g.add(mesh(lathe(body, 56), iron));
  g.add(mesh(lathe([[0, -0.12], [0.08, -0.12], [0.16, 0], [0, 0]], 36), iron));
  const beamTop = K.beamY1 - K.yT;
  g.add(mesh(lathe(rodProfile(K.spindleR, K.hubY1 - 0.01, beamTop + 0.09, 0, 0.008), 32), steel()));
  g.add(mesh(lathe(tubeProfile(K.spindleR - 0.004, 0.12, K.hubY1, K.beamY0 - K.yT, 0.004), 36), darkSteel()));
  g.add(mesh(lathe(tubeProfile(K.spindleR - 0.004, 0.11, beamTop, beamTop + 0.08, 0.008), 36), darkSteel()));
  g.add(meshAt(cylX(K.leverR, K.hubR - 0.03, K.lever - K.leverR, 0.006, 24), steel(), 0, K.leverY, 0));
  g.add(meshAt(new THREE.SphereGeometry(K.leverR, 20, 14), steel(), K.lever - K.leverR, K.leverY, 0));
  g.add(boxAt(0.012, 0.09, 0.03, paint(MARK), K.discR + 0.004, K.discT / 2, 0));
  const a = (K.alpha + K.mid) * DEG;
  for (const [name, b] of [['topSocketA', a], ['topSocketB', a + Math.PI]] as const) {
    const [x, z] = azim(K.rb, b);
    g.add(pinMark(name, x, 0, z));
  }
  setMM(g, { kind: 'pressHead', fn: 'twistHead132', r: K.discR, axis: 'y', lever: K.lever });
  return g;
}

/**
 * 누름판(132번, 위아래로만 움직인다): 원점 = 아래 원판 윗면의 축 자리. 아래 원판(낮은 원뿔 혹) + 두꺼운 판(기둥 구멍 둘, 틈 0.005).
 * child 'botSocketA'·'botSocketB' = 막대 아래 구멍(공 중심) 자리.
 */
export function pressPlaten132(): THREE.Group {
  const K = K132;
  const g = new THREE.Group();
  const iron = castIron();
  g.add(mesh(lathe(rodProfile(K.discR, -K.lowT, 0, 0.01, 0.01), 56), iron));
  g.add(mesh(lathe([[0, 0], [0.16, 0], [0.08, 0.12], [0, 0.12]], 36), iron));
  const holes: [number, number, number][] = [
    [-K.colX, 0, K.colR + 0.005],
    [K.colX, 0, K.colR + 0.005]
  ];
  g.add(mesh(slabY(K.slabHalf, K.depth, -K.lowT - K.slabT, -K.lowT, holes, 0.03), bronze({ roughness: 0.5 })));
  const a = K.alpha * DEG;
  for (const [name, b] of [['botSocketA', a], ['botSocketB', a + Math.PI]] as const) {
    const [x, z] = azim(K.rb, b);
    g.add(pinMark(name, x, 0, z));
  }
  setMM(g, { kind: 'platen', fn: 'pressPlaten132', axis: 'y' });
  return g;
}

/** 공 끝 막대(132번): 원점 = 아래 공 중심, 로컬 +Y 로 length 에 위 공 중심 */
export function ballBar132(length: number = K132.L): THREE.Group {
  const K = K132;
  const g = new THREE.Group();
  g.add(mesh(lathe(rodProfile(K.barR, 0, length, 0, 0), 20), steel()));
  for (const y of [0, length]) g.add(meshAt(new THREE.SphereGeometry(K.ballR, 24, 16), darkSteel(), 0, y, 0));
  setMM(g, { kind: 'bar', fn: 'ballBar132', length, r: K.barR });
  return g;
}

/** 막대를 아래 공 자리 a 에 놓고 위 공 자리 b 를 향하게 돌린다(부모 좌표) */
export function aimBar132(bar: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  bar.position.copy(a);
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}

// ═══════════════════════════ 133 피니언·부채꼴 프레스 ═══════════════════════════

/** 133번 치수. 판화 비: 부채꼴 피치 700 : 피니언 110 : 크랭크 핀 270 : 연결봉 911 (px), 1 px = 0.001646 */
export const K133 = {
  /** 부채꼴 축(세계) */
  P: [-0.2, 0.42] as V2,
  zs: 64,
  zp: 10,
  m: 0.036,
  /** 부채꼴에 난 이 수(로컬 0° 부터) */
  N: 17,
  hubR: 0.2,
  bore: 0.062,
  /** 피니언이 놓인 방향(부채꼴 축에서, 도) */
  pinionDeg: 53,
  /** 크랭크 핀: 반지름 자리, 로컬 각(도), 핀 반지름 */
  rc: 0.444,
  pinDeg: 3,
  pinR: 0.03,
  /** 연결봉 길이 */
  rod: 1.5,
  /** 판화 자세의 부채꼴 회전각(도)과 흔들림(도): 회전각 = S0 + swing/2·(1 − cos(theta − 1.6)) */
  S0: -5,
  swing: 48,
  /** 손 크랭크 팔 길이 */
  handle: 0.54,
  /** 틀: 기둥 x(축 기준 ±), 반지름, 머리 아래·위(축 기준 높이), 머리 반폭 */
  colX: 0.5,
  colR: 0.085,
  headY0: 2.19,
  headY1: 2.52,
  headHalf: 0.75,
  floor: 0.18,
  /** 누름판: 핀에서 판 아랫면·윗면까지, 반폭, 깊이, 얹은 물건 두께(판화에 없음) */
  platY0: 0.13,
  platY1: 0.23,
  platHalf: 0.62,
  platDepth: 0.3,
  work: 0.16,
  /** 층(세계 z): 기둥·누름판, 부채꼴·피니언, 연결봉, 손 크랭크 뒷면 */
  zCol: 0.05,
  zGear: 0.3,
  width: 0.08,
  zRod: 0.4,
  rodT: 0.04,
  zCrank: 0.46
} as const;
/** 부채꼴 피치 반지름, 피니언 피치 반지름, 축 사이 거리 */
export const K133_R: number = (K133.zs * K133.m) / 2;
export const K133_RP: number = (K133.zp * K133.m) / 2;
export const K133_C: number = K133_R + K133_RP;
/** 피니언 축(세계) */
export const K133_Q: V2 = [K133.P[0] + K133_C * Math.cos(K133.pinionDeg * DEG), K133.P[1] + K133_C * Math.sin(K133.pinionDeg * DEG)];

export interface Press133 {
  /** 판화 자세에서 더 돈 각(rad, 0 ~ swing) */
  sigma: number;
  /** 부채꼴·피니언의 rotation.z, 손 크랭크의 rotation.z(판화 자세에서 +X) */
  sector: number;
  pinion: number;
  crank: number;
  /** 크랭크 핀(세계) */
  pin: V2;
  /** 누름판 핀의 높이(세계 y) — x 는 K133.P[0] */
  eyeY: number;
  /** 연결봉의 rotation.z(핀 → 누름판 핀) */
  rodAngle: number;
  /** 판화 자세에서 올라간 높이 */
  rise: number;
}

function eye133(S: number): { pin: V2; eye: number } {
  const K = K133;
  const a = S + K.pinDeg * DEG;
  const px = K.rc * Math.cos(a);
  const py = K.rc * Math.sin(a);
  return { pin: [K.P[0] + px, K.P[1] + py], eye: K.P[1] + py + Math.sqrt(K.rod * K.rod - px * px) };
}

/** 133번 운동(theta 의 닫힌 식): 손 크랭크가 왔다 갔다 → 피니언 → 부채꼴이 48° 흔들림 → 연결봉이 누름판을 밀어 올린다 */
export function press133(theta: number): Press133 {
  const K = K133;
  const sigma = ((K.swing * DEG) / 2) * (1 - Math.cos(theta - 1.6));
  const sector = K.S0 * DEG + sigma;
  const pinion = meshAngle(K.P, K.zs, sector, K133_Q, K.zp);
  const pinion0 = meshAngle(K.P, K.zs, K.S0 * DEG, K133_Q, K.zp);
  const e = eye133(sector);
  const e0 = eye133(K.S0 * DEG);
  return {
    sigma,
    sector,
    pinion,
    crank: pinion - pinion0,
    pin: e.pin,
    eyeY: e.eye,
    rodAngle: Math.atan2(e.eye - e.pin[1], K.P[0] - e.pin[0]),
    rise: e.eye - e0.eye
  };
}

export interface ToothSectorOpts {
  width?: number;
  bore?: number;
  hubR?: number;
  /** 가장자리 살 폭. 기본 0.12 */
  spokeW?: number;
  /** 가운데 살의 로컬 각(rad)들과 반폭 */
  mids?: number[];
  midHalf?: number;
  driver?: boolean;
}

/**
 * 이 부채꼴(공용): 로컬 좌표 = spurGear(zs, m) 와 같다(meshAngle 사용 가능). 이 i0 … i0 + N − 1, 곧은 변 둘이 허브에 접한다. 살 사이 창.
 * userData.outline = 윤곽(침범 검사용), mm.kind = 'gear'(teeth = 온 바퀴 잇수, count = 난 이 수).
 */
export function toothSector131(zs: number, m: number, i0: number, N: number, o: ToothSectorOpts = {}): THREE.Group {
  const width = o.width ?? 0.08;
  const bore = o.bore ?? 0.05;
  const hubR = o.hubR ?? 0.15;
  const S = sectorSpan131(zs, m, i0, N, hubR);
  const outline = sectorOutline131(zs, m, i0, N, hubR);
  const wins = sectorWindows131(S, hubR, o.spokeW ?? 0.12, o.mids ?? [(S.aS + S.aE) / 2], o.midHalf ?? 0.045, hubR + 0.07, S.rf - 0.07);
  const g = new THREE.Group();
  g.add(mesh(loft(outline, [circlePts(bore, 32), ...wins], gearLayers(width, S.ra, m)), o.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  g.add(mesh(tubeZ(bore, bore + 0.04, -width / 2 - 0.012, width / 2 + 0.014, 0.006, 40), darkSteel()));
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'toothSector131', teeth: zs, module: m, internal: false, rp: S.rp, ra: S.ra, rf: S.rf, width, axis: 'z', count: N });
  return g;
}

/**
 * 크랭크 핀 달린 이 부채꼴(133번): toothSector131(64, 0.036, 0, 17) + 아래 살 위의 핀 보스와 핀(로컬 극좌표 (K133.rc, K133.pinDeg), 앞으로 로컬 z = pinZ1 까지).
 * child 'crankPin'(로컬 z = rodZ — 연결봉 평면).
 */
export function sectorCrank133(pinZ1: number, rodZ: number): THREE.Group {
  const K = K133;
  const g = toothSector131(K.zs, K.m, 0, K.N, { width: K.width, bore: K.bore, hubR: K.hubR });
  const a = K.pinDeg * DEG;
  const x = K.rc * Math.cos(a);
  const y = K.rc * Math.sin(a);
  g.add(meshAt(cylZ(0.065, -K.width / 2 - 0.006, K.width / 2 + 0.012, 0.006, 32), darkSteel(), x, y, 0));
  g.add(meshAt(cylZ(K.pinR, K.width / 2, pinZ1 - 0.012, 0.004, 24), steel(), x, y, 0));
  g.add(meshAt(cylZ(K.pinR + 0.016, pinZ1 - 0.014, pinZ1, 0.003, 24), darkSteel(), x, y, 0));
  g.add(pinMark('crankPin', x, y, rodZ));
  return g;
}

export interface EyeRodOpts {
  r?: number;
  eyeR?: number;
  holeR?: number;
  thick?: number;
}

/** 눈 달린 연결봉(공용): 원점 = 한쪽 눈 중심, 로컬 +X 로 length 에 다른 눈. 두께 가운데 z = 0 */
export function eyeRod131(length: number, o: EyeRodOpts = {}): THREE.Group {
  const r = o.r ?? 0.02;
  const eyeR = o.eyeR ?? 0.058;
  const holeR = o.holeR ?? 0.031;
  const t = o.thick ?? 0.04;
  const g = new THREE.Group();
  for (const x of [0, length]) g.add(meshAt(tubeZ(holeR, eyeR, -t / 2, t / 2, 0.005, 32), darkSteel(), x, 0, 0));
  g.add(mesh(cylX(r, eyeR - 0.006, length - eyeR + 0.006, 0, 20), steel()));
  setMM(g, { kind: 'link', fn: 'eyeRod131', length, a: [0, 0, 0], b: [length, 0, 0] });
  return g;
}

/** 손 크랭크(공용): 원점 = 축, z = 0 이 뒷면. 보스 + 로컬 +X 팔(len) + 끝에 앞으로 선 나무 손잡이(z ≤ 0.2) */
export function handCrank131(len: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.06, 0, 0.06, 0.006, 32), darkSteel()));
  g.add(meshAt(extrude(stadiumShape(0, 0, len, 0, 0.03), 0.034, 0.005, 12), steel(), 0, 0, 0.03));
  g.add(meshAt(cylZ(0.014, 0.03, 0.2, 0.003, 16), steel(), len, 0, 0));
  g.add(meshAt(cylZ(0.032, 0.055, 0.19, 0.012, 24), wood(), len, 0, 0));
  setMM(g, { kind: 'handle', fn: 'handCrank131', length: len, axis: 'z' });
  return g;
}

/**
 * 프레스 틀(133번, 고정): 원점 = 프레스 가운데선(부채꼴 축의 x)의 바닥(세계 y = 0), z = 0 이 기둥 평면. 기둥 둘(밑받침) + 머리(받침판 + 몸 + 처마).
 * axisY = 부채꼴 축의 세계 높이(머리 높이의 기준).
 */
export function pressFrame133(axisY: number = K133.P[1]): THREE.Group {
  const K = K133;
  const g = new THREE.Group();
  const iron = castIron();
  const y0 = axisY + K.headY0;
  const y1 = axisY + K.headY1;
  for (const s of [-1, 1]) {
    g.add(boxAt(0.3, 0.06, 0.3, iron, s * K.colX, K.floor + 0.03, 0));
    g.add(column(s * K.colX, K.colR, K.floor + 0.06, y0, steel({ roughness: 0.42 })));
  }
  g.add(mesh(slabY(K.headHalf - 0.08, K.platDepth, y0, y0 + 0.06), iron));
  g.add(mesh(slabY(K.headHalf - 0.04, K.platDepth + 0.02, y0 + 0.06, y1 - 0.07), iron));
  g.add(mesh(slabY(K.headHalf, K.platDepth + 0.06, y1 - 0.07, y1), iron));
  setMM(g, { kind: 'frame', fn: 'pressFrame133' });
  return g;
}

/**
 * 누름판(133번, 기둥을 타고 위아래로): 원점 = 연결봉 핀 중심(xy), z = 0 이 기둥 평면. 판(기둥 구멍 둘) + 아래 가운데의 귀(두 볼 사이에 연결봉 눈) + 핀.
 * rodZ = 연결봉 평면의 로컬 z. work = true 면 판 위에 누를 물건(판화에 없음). child 'platenPin'(로컬 z = rodZ).
 */
export function platen133(rodZ: number, work = true): THREE.Group {
  const K = K133;
  const g = new THREE.Group();
  const iron = castIron();
  const holes: [number, number, number][] = [
    [-K.colX, 0, K.colR + 0.005],
    [K.colX, 0, K.colR + 0.005]
  ];
  g.add(mesh(slabY(K.platHalf, K.platDepth, K.platY0, K.platY1, holes), bronze({ roughness: 0.5 })));
  // 귀: 판 아랫면에서 앞으로 나온 받침 + 두 볼
  const zf = K.platDepth / 2;
  const c0 = rodZ - K.rodT / 2 - 0.036;
  const c1 = rodZ + K.rodT / 2 + 0.036;
  g.add(boxAt(0.22, 0.05, c1 - zf + 0.04, iron, 0, K.platY0 - 0.025, (zf - 0.04 + c1) / 2));
  const cheek = new THREE.Shape();
  cheek.moveTo(-0.11, K.platY0 - 0.05);
  cheek.lineTo(-0.055, 0);
  cheek.absarc(0, 0, 0.055, Math.PI, TAU, false);
  cheek.lineTo(0.11, K.platY0 - 0.05);
  cheek.closePath();
  for (const z of [rodZ - K.rodT / 2 - 0.02, rodZ + K.rodT / 2 + 0.02]) g.add(meshAt(extrude(cheek, 0.03, 0.004, 12), iron, 0, 0, z));
  g.add(mesh(cylZ(K.pinR, c0 - 0.008, c1 + 0.008, 0.004, 24), steel()));
  if (work) g.add(mesh(slabY(0.34, K.platDepth - 0.08, K.platY1, K.platY1 + K.work, [], 0.03), wood()));
  g.add(pinMark('platenPin', 0, 0, rodZ));
  setMM(g, { kind: 'platen', fn: 'platen133', axis: 'y' });
  return g;
}
