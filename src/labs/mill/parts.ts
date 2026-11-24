// 물레방아 고정 부품·움직이는 부품 조립 — 치수는 실제 m (types.ts 의 MILL). three 에 의존.
// 좌표: x = 굴통 축, y = 위, z = 물이 흘러가는 방향. 원점 = 물레바퀴 중심 바로 아래 방앗간 바닥.

import * as THREE from 'three';
import { wood, castIron, plastic } from '../../models/materials';
import { mesh, lathe, extrude, shapeFrom, pathFrom, circlePts, merge, rodProfile, type V2 } from '../../models/parts/geom';
import { MILL, type PartKey } from './types';

export const DEG = Math.PI / 180;

// ── 배치 상수(실제 m) ──
export const SLOPE = 3 * DEG;                 // 물홈 기울기
export const CHUTE_END_Y = MILL.axisY + MILL.wheelR + MILL.head; // 2.85
export const CHUTE_END_Z = MILL.rMean * Math.sin(MILL.phiIn * DEG); // 0.25
export const CHUTE_START_Z = -3.2;
export const CHUTE_W = 0.6;
export const GATE_Z = -2.6;
export const GATE_LIFT = 0.3;
export const GATE_H = 0.45;
export const BOWL_Z = 3.06;                   // 쉬는 자세 공이 끝 바로 아래
export const PIT = { x: 0.8, z0: -2.2, z1: 2.6, floorY: -MILL.pitDepth, waterTop: -MILL.pitDepth + 0.15 };
export const POST_X = [-0.65, 0.88, 3.1] as const;
export const POST_BASE = [-MILL.pitDepth, 0, 0] as const;
export const BLADE_TILT = MILL.bladeTilt * DEG;
const R_IN = MILL.wheelR - MILL.bladeLen;     // 1.25

/** 물홈 윗면 높이(실제 z 에서) */
export function chuteTopY(z: number): number {
  return CHUTE_END_Y + (CHUTE_END_Z - z) * Math.tan(SLOPE);
}

/** 날개: 안쪽 반지름 1.25 에서 반지름 방향보다 25° 뒤로 눕혀 바깥 1.65 에 닿는 날개 길이 */
export const BLADE_L = (() => {
  const b = 2 * R_IN * Math.cos(BLADE_TILT);
  const c = R_IN * R_IN - MILL.wheelR * MILL.wheelR;
  return (-b + Math.sqrt(b * b - 4 * c)) / 2;
})();
/** 날개 바깥 끝이 안쪽 끝보다 뒤처진 각(rad) */
export const BLADE_LAG = Math.atan2(BLADE_L * Math.sin(BLADE_TILT), R_IN + BLADE_L * Math.cos(BLADE_TILT));

export type Reg = Map<PartKey, THREE.Mesh[]>;

export function reg(r: Reg, key: PartKey, m: THREE.Mesh): THREE.Mesh {
  const a = r.get(key);
  if (a) a.push(m);
  else r.set(key, [m]);
  return m;
}

/** (z, y) 평면 도형을 x 방향으로 width 만큼 압출(x 중심 = xc) */
function prismZY(pts: V2[], width: number, xc: number, bevel = 0): THREE.BufferGeometry {
  const g = extrude(shapeFrom(pts), width, bevel);
  g.rotateY(-Math.PI / 2);
  g.translate(xc, 0, 0);
  return g;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function cylX(r: number, len: number, segs: number, x: number, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

// ───────────────────────── 바닥·구덩이 ─────────────────────────

export function buildGround(parent: THREE.Object3D): void {
  const dirt = plastic(0x8d6e4c, { roughness: 0.95 });
  const soilDeep = plastic(0x6a5038, { roughness: 0.98 });
  const stoneA = plastic(0x8d9298, { roughness: 0.9 });
  const stoneB = plastic(0x777d84, { roughness: 0.92 });

  // 땅(윗면 y = 0, 아래로 pitDepth): 구덩이·물길·확돌 자리가 뚫린 판
  const X0 = -1.9;
  const X1 = 3.9;
  const Z0 = -3.5;
  const Z1 = 3.9;
  const HX = 0.95;
  const HZ0 = -2.35;
  const HZ1 = 2.75;
  const CH = 0.45;
  const outline: V2[] = [
    [X0, Z0], [X1, Z0], [X1, Z1], [CH, Z1], [CH, HZ1], [HX, HZ1], [HX, HZ0], [-HX, HZ0], [-HX, HZ1], [-CH, HZ1], [-CH, Z1], [X0, Z1]
  ];
  const shape = shapeFrom(outline);
  for (const x of MILL.armX) shape.holes.push(pathFrom(circlePts(0.38, 48, x, BOWL_Z)));
  const slab = new THREE.ExtrudeGeometry(shape, { depth: MILL.pitDepth, bevelEnabled: false, curveSegments: 24 });
  slab.rotateX(Math.PI / 2); // 모양 Y → z, 압출 → 아래(−y)
  mesh(slab, dirt, parent);

  // 아래 흙 단면 한 장(구덩이 바닥·물길 바닥 겸용)
  const base = boxAt(X1 - X0, 0.06, Z1 - Z0, (X0 + X1) / 2, -MILL.pitDepth - 0.03, (Z0 + Z1) / 2);
  mesh(base, soilDeep, parent);

  // 구덩이 돌벽: 3줄 × 번갈아 놓은 돌덩이
  const rows = 3;
  const rh = MILL.pitDepth / rows;
  const gA: THREE.BufferGeometry[] = [];
  const gB: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, k: number): void => void (k % 2 === 0 ? gA : gB).push(g);
  // 긴 벽(x = ±) : z −2.35 ~ 2.75
  for (const sx of [-1, 1]) {
    for (let r = 0; r < rows; r++) {
      const n = 8;
      const len = (HZ1 - HZ0) / n;
      const off = r % 2 === 0 ? 0 : len / 2;
      for (let i = 0; i < n; i++) {
        let z0 = HZ0 + i * len - off;
        let z1 = z0 + len;
        z0 = Math.max(z0, HZ0);
        z1 = Math.min(z1, HZ1);
        if (z1 - z0 < 0.02) continue;
        const g = boxAt(HX - PIT.x - 0.006, rh - 0.012, z1 - z0 - 0.012, sx * (PIT.x + HX) / 2, -MILL.pitDepth + (r + 0.5) * rh, (z0 + z1) / 2);
        put(g, i + r);
      }
    }
  }
  // 뒤 벽(z −2.35 ~ −2.2)
  for (let r = 0; r < rows; r++) {
    const n = 4;
    const len = (2 * PIT.x) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -PIT.x + i * len + (r % 2 === 0 ? 0 : len / 2) - 0.0;
      const xa = Math.max(x0, -PIT.x);
      const xb = Math.min(x0 + len, PIT.x);
      if (xb - xa < 0.02) continue;
      put(boxAt(xb - xa - 0.012, rh - 0.012, 0.15 - 0.006, (xa + xb) / 2, -MILL.pitDepth + (r + 0.5) * rh, (HZ0 + PIT.z0) / 2), i + r);
    }
  }
  // 앞 벽(z 2.6 ~ 2.75): 물길 입구(|x| < 0.45)는 비운다
  for (let r = 0; r < rows; r++) {
    for (const s of [-1, 1]) {
      const a = s * CH;
      const b = s * PIT.x;
      put(boxAt(Math.abs(b - a) - 0.012, rh - 0.012, 0.15 - 0.006, (a + b) / 2, -MILL.pitDepth + (r + 0.5) * rh, (PIT.z1 + HZ1) / 2), r + (s > 0 ? 1 : 0));
    }
  }
  if (gA.length) mesh(merge(gA), stoneA, parent);
  if (gB.length) mesh(merge(gB), stoneB, parent);
}

// ───────────────────────── 물레바퀴 ─────────────────────────

/** 물레바퀴 한 벌(원점 = 굴통 중심, 축 = x). 호출한 쪽에서 위치·회전을 정한다 */
export function buildWheel(r: Reg): THREE.Group {
  const g = new THREE.Group();
  const woodMain = wood(0xb98552);
  const woodWet = wood(0x8f6a45);
  const woodRing = wood(0xa57445);
  const iron = castIron();

  // 양쪽 테
  const ringShape = shapeFrom(circlePts(MILL.wheelR, 48));
  ringShape.holes.push(pathFrom(circlePts(R_IN, 48)));
  for (const s of [-1, 1]) {
    const rg = extrude(ringShape, 0.05, 0.005, 24);
    rg.rotateY(Math.PI / 2);
    rg.translate(s * 0.475, 0, 0);
    reg(r, 'wheel', mesh(rg, woodRing, g));
  }
  // 칸 바닥판(통)
  const drum = lathe([[R_IN - 0.035, -0.46], [R_IN, -0.46], [R_IN, 0.46], [R_IN - 0.035, 0.46], [R_IN - 0.035, -0.46]], 48);
  drum.rotateZ(Math.PI / 2);
  reg(r, 'wheel', mesh(drum, woodWet, g));
  // 허브
  const hub = lathe(rodProfile(0.3, -0.42, 0.42, 0.015, 0.015), 36);
  hub.rotateZ(Math.PI / 2);
  reg(r, 'wheel', mesh(hub, woodMain, g));
  for (const s of [-1, 1]) reg(r, 'wheel', mesh(cylX(0.31, 0.05, 36, s * 0.39), iron, g));

  // 살: 8개 × 양쪽
  const spokes: THREE.BufferGeometry[] = [];
  const len = R_IN + 0.02 - 0.28;
  const rc = (R_IN + 0.02 + 0.28) / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
    for (const s of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.08, 0.1, len);
      b.rotateX(a - Math.PI / 2);
      b.translate(s * 0.4, rc * Math.cos(a), rc * Math.sin(a));
      spokes.push(b);
    }
  }
  reg(r, 'wheel', mesh(merge(spokes), woodMain, g));

  // 날개 32장
  const blades: THREE.BufferGeometry[] = [];
  const bl = BLADE_L + 0.02;
  for (let i = 0; i < MILL.blades; i++) {
    const a = (i / MILL.blades) * Math.PI * 2;
    const gam = a - BLADE_TILT;
    const bx = (R_IN - 0.01) * Math.sin(a) + (bl / 2) * Math.sin(gam);
    const by = (R_IN - 0.01) * Math.cos(a) + (bl / 2) * Math.cos(gam);
    const b = new THREE.BoxGeometry(0.94, 0.03, bl);
    b.rotateX(gam - Math.PI / 2);
    b.translate(0, by, bx);
    blades.push(b);
  }
  reg(r, 'blade', mesh(merge(blades), woodWet, g));
  return g;
}

// ───────────────────────── 굴통 ─────────────────────────

export function buildShaft(r: Reg): THREE.Group {
  const g = new THREE.Group();
  const w = wood(0x7a5230);
  const iron = castIron();
  const len = MILL.shaftX1 - MILL.shaftX0;
  reg(r, 'shaft', mesh(cylX(MILL.shaftR, len, 32, (MILL.shaftX0 + MILL.shaftX1) / 2), w, g));
  // 쇠 테: 누름대 양옆, 오른쪽 끝
  const xs: number[] = [3.24];
  for (const ax of MILL.armX) xs.push(ax - 0.11, ax + 0.11);
  const rings = xs.map((x) => cylX(MILL.shaftR + 0.014, 0.05, 32, x));
  reg(r, 'shaft', mesh(merge(rings), iron, g));
  return g;
}

/** 받침 기둥 3개(위에 반달 홈) */
export function buildPosts(r: Reg, parent: THREE.Object3D): void {
  const w = wood(0x6b4a2e);
  for (let i = 0; i < POST_X.length; i++) {
    const b = POST_BASE[i]!;
    const gr = 0.21;
    const top = 1.1;
    const pts: V2[] = [[-0.28, b], [0.28, b], [0.28, top], [gr, top], [gr, MILL.axisY]];
    for (let k = 1; k < 16; k++) {
      const a = -(k / 16) * Math.PI;
      pts.push([gr * Math.cos(a), MILL.axisY + gr * Math.sin(a)]);
    }
    pts.push([-gr, MILL.axisY], [-gr, top], [-0.28, top]);
    reg(r, 'post', mesh(prismZY(pts, 0.16, POST_X[i]!, 0.008), w, parent));
  }
}

// ───────────────────────── 누름대·방아채·볼씨·공이 ─────────────────────────

/** 누름대: 굴통을 관통하는 막대. 로컬 y 가 반지름 방향. 양 끝은 뾰족하게 다듬어 끝 점이 접촉 기준이 되게 */
export function buildArm(r: Reg, idx: 0 | 1): THREE.Group {
  const g = new THREE.Group();
  const R = MILL.armR;
  const t0 = 0.42;
  const pts: V2[] = [
    [0.05, -t0], [0.05, t0], [0.012, R], [-0.012, R], [-0.05, t0], [-0.05, -t0], [-0.012, -R], [0.012, -R]
  ];
  // 이 도형의 x = 접선 방향, y = 반지름 방향. 압출 방향(굴통 축)이 x 가 되게 돌린다.
  const geo = extrude(shapeFrom(pts), 0.14, 0.006);
  geo.rotateY(-Math.PI / 2); // 도형 x → z(접선), 압출 → x
  reg(r, idx === 0 ? 'arm1' : 'arm2', mesh(geo, wood(0x5d3f26), g));
  return g;
}

/** 방아채 한 벌(원점 = 볼씨 받침 축). 로컬 z: 꼬리 −1.0 → 공이 쪽 +2.0, 꼬리 윗면 y = 0 */
export function buildBeam(r: Reg, idx: 0 | 1): THREE.Group {
  const g = new THREE.Group();
  const T = MILL.tailLen;
  const E = MILL.beamLen - MILL.tailLen; // 2.0
  const pts: V2[] = [[-T, -0.17], [-T + 0.03, -0.2], [E - 0.03, -0.2], [E, -0.17], [E, -0.03], [E - 0.03, 0], [0.05, 0]];
  for (let k = 1; k < 12; k++) {
    const a = -(k / 12) * Math.PI;
    pts.push([0.05 * Math.cos(a), 0.05 * Math.sin(a)]);
  }
  pts.push([-0.05, 0], [-T + 0.03, 0], [-T, -0.03]);
  const body = prismZY(pts, 0.22, 0, 0.012);
  reg(r, idx === 0 ? 'beam1' : 'beam2', mesh(body, wood(0x7a5230), g));

  // 방아공이: 받침 축에서 1.8 지점에 수직으로 꿰었다. 아래로 0.75, 위로 0.12 더 나옴
  const pg = lathe(rodProfile(0.08, -MILL.pestleLen, 0.12, 0.03, 0.02), 32);
  pg.translate(0, 0, 0);
  const pestle = mesh(pg, wood(0xc99a63), g);
  pestle.position.set(0, 0, MILL.pestleArm);
  reg(r, idx === 0 ? 'pestle1' : 'pestle2', pestle);
  return g;
}

/** 볼씨: 방아채 양옆 짧은 기둥 2개 + 받침 축 나무못 (고정 부품) */
export function buildPivot(r: Reg, idx: 0 | 1, parent: THREE.Object3D): void {
  const w = wood(0x6b4a2e);
  const key: PartKey = idx === 0 ? 'pivot1' : 'pivot2';
  const x = MILL.armX[idx];
  const ps: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) ps.push(boxAt(0.08, MILL.pivotY + 0.14, 0.22, x + s * 0.17, (MILL.pivotY + 0.14) / 2, MILL.pivotZ));
  reg(r, key, mesh(merge(ps), w, parent));
  const pin = cylX(0.045, 0.46, 24, x, MILL.pivotY, MILL.pivotZ);
  reg(r, key, mesh(pin, wood(0xa57445), parent));
}

/** 확돌(오목한 돌 그릇) + 곡식. 땅 구멍에 맞춰 끼운다 */
export function buildBowl(r: Reg, idx: 0 | 1, parent: THREE.Object3D): void {
  const x = MILL.armX[idx];
  const key: PartKey = idx === 0 ? 'bowl1' : 'bowl2';
  const stone = plastic(0x9a9fa6, { roughness: 0.88 });
  const prof: V2[] = [
    [0, -0.5], [0.38, -0.5], [0.38, 0.09], [0.37, 0.1], [0.27, 0.1], [0.24, 0.085], [0.24, -0.1], [0.2, -0.16], [0.1, -0.18], [0, -0.18]
  ];
  const b = mesh(lathe(prof, 48), stone, parent);
  b.position.set(x, 0, BOWL_Z);
  reg(r, key, b);
  const grainProf: V2[] = [[0, -0.19], [0.238, -0.19], [0.238, -0.165], [0.19, -0.15], [0.1, -0.14], [0, -0.135]];
  const grain = mesh(lathe(grainProf, 32), plastic(0xe6c36a, { roughness: 0.9 }), parent);
  grain.position.set(x, 0, BOWL_Z);
  reg(r, key, grain);
}

// ───────────────────────── 물홈·수문 ─────────────────────────

/** 물홈 그룹: 원점 = 물홈 끝 바닥 윗면(z = 0.25, y = 2.85), 기울기만큼 돌려 둔다. 로컬 z −len ~ 0 */
export function buildChute(r: Reg, parent: THREE.Object3D): THREE.Group {
  const w = wood(0xb98552);
  const wDark = wood(0x8f6a45);
  const g = new THREE.Group();
  g.position.set(0, CHUTE_END_Y, CHUTE_END_Z);
  g.rotation.x = SLOPE;
  parent.add(g);
  const len = (CHUTE_END_Z - CHUTE_START_Z) / Math.cos(SLOPE);
  reg(r, 'chute', mesh(boxAt(CHUTE_W, 0.05, len, 0, -0.025, -len / 2), w, g));
  const sides = [-1, 1].map((s) => boxAt(0.04, 0.27, len, s * 0.31, 0.085, -len / 2));
  reg(r, 'chute', mesh(merge(sides), wDark, g));

  // 받침 가로대 + 기둥 (z 위치마다)
  const sup = wood(0x6b4a2e);
  const zs = [-3.1, GATE_Z, -1.5, -0.5];
  const beams: THREE.BufferGeometry[] = [];
  const posts: THREE.BufferGeometry[] = [];
  for (const z of zs) {
    const under = chuteTopY(z) - 0.05;
    beams.push(boxAt(1.5, 0.08, 0.12, 0, under - 0.04, z));
    const base = z > PIT.z0 - 0.05 && z < PIT.z1 ? PIT.floorY : 0;
    for (const s of [-1, 1]) {
      const h = under - 0.08 - base;
      posts.push(boxAt(0.12, h, 0.12, s * 0.62, base + h / 2, z));
    }
  }
  // 이 도형들은 root 좌표(기울지 않음)라서 부모(root)에 단다
  reg(r, 'chute', mesh(merge(beams), sup, parent));
  reg(r, 'chute', mesh(merge(posts), sup, parent));
  return g;
}

/** 수문: 틀(고정) + 판·손잡이(위아래로 움직임). 판 그룹의 원점 = 닫혔을 때 판 아래 가장자리 */
export function buildGate(r: Reg, parent: THREE.Object3D): THREE.Group {
  const yTop = chuteTopY(GATE_Z);
  const frame = wood(0x5d3f26);
  const ups: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) ups.push(boxAt(0.05, 1.0, 0.12, s * 0.375, yTop - 0.05 + 0.5 - 0.0, GATE_Z));
  ups.push(boxAt(0.8, 0.06, 0.12, 0, yTop + 0.95, GATE_Z));
  reg(r, 'gate', mesh(merge(ups), frame, parent));

  const slide = new THREE.Group();
  slide.position.set(0, yTop, GATE_Z);
  parent.add(slide);
  reg(r, 'gate', mesh(boxAt(0.58, GATE_H, 0.04, 0, GATE_H / 2, 0), wood(0x7a5230), slide));
  reg(r, 'gate', mesh(boxAt(0.74, 0.05, 0.07, 0, GATE_H - 0.03, 0), wood(0x5d3f26), slide));
  return slide;
}

// ───────────────────────── 시점 보조 ─────────────────────────
export function polar(rad: number, ang: number): { z: number; y: number } {
  return { z: rad * Math.sin(ang), y: MILL.axisY + rad * Math.cos(ang) };
}
