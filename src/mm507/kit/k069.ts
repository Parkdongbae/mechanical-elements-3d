// 69·70번 전용 키트 — 한 톱니 정지 바퀴(69), 스터드 원판 + 테·탭핏 구동 바퀴(70)
// 접촉(피동 전진량)은 shots/_verify/s069.mjs · s070b.mjs 의 충돌 시뮬레이션 결과를 표로 넣었다.
import * as THREE from 'three';
import { bronze, brass, darkSteel, ghost, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, TAU } from '../../models/parts/geom';

type V2 = [number, number];

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function zRod(r: number, z0: number, z1: number, mat: THREE.Material, x = 0, y = 0): THREE.Mesh {
  const geo = lathe(rodProfile(r, 0, z1 - z0, Math.min(0.01, r * 0.3), Math.min(0.012, r * 0.3)), 28);
  geo.rotateX(Math.PI / 2);
  return meshAt(geo, mat, x, y, z0);
}

// ───────────────────────── 69: 한 톱니 정지 바퀴 ─────────────────────────

/** 69번 치수(설계표 069) — 모델·검사가 같은 값을 쓴다 */
export const K69 = {
  teeth: 28,
  rTip: 1.2,
  rRoot: 1.06,
  /** A 중심 → B 중심 거리 */
  dist: 1.34,
  /** A 중심에서 본 B 방향(도, 위로 +) */
  dirDeg: 29.5,
  rB: 0.17,
  rFinger: 0.2,
  fingerW: 0.04,
  cutHalfDeg: 50,
  /** 휴지 때 A 의 시계방향 전진각 오프셋(도): 림이 두 이 사이에 앉는 틈 가운데 */
  aRestDeg: 2.6357,
  /** 한 바퀴에 A 가 전진하는 각(도) = 360/28 */
  stepDeg: 360 / 28
} as const;

/** 손가락 각 rel(도, A 를 향할 때 0, 반시계 +) → 이번 바퀴에서 A 가 시계 방향으로 간 각(도, 0 ~ stepDeg). rel −52 ~ 40 에서만 움직인다 */
const PUSH69 = [
  0.0, 0.0, 0.0, 0.0, 0.05, 0.32, 0.59, 0.82, 1.09, 1.32, 1.5, 1.73, 1.91, 2.14, 2.32, 2.5, 2.68, 2.86, 3.09, 3.32, 3.5, 3.73, 3.95,
  4.18, 4.41, 4.63, 4.86, 5.04, 5.27, 5.5, 5.72, 5.91, 6.13, 6.36, 6.54, 6.77, 6.95, 7.18, 7.36, 7.54, 7.77, 7.95, 8.13, 8.31, 8.5,
  8.68, 8.86, 9.04, 9.22, 9.36, 9.54, 9.68, 9.86, 9.99, 10.18, 10.31, 10.45, 10.59, 10.72, 10.86, 10.99, 11.09, 11.22, 11.31, 11.45,
  11.54, 11.63, 11.77, 11.86, 11.95, 12.04, 12.08, 12.18, 12.27, 12.31, 12.4, 12.45, 12.49, 12.54, 12.58, 12.63, 12.68, 12.72, 12.77,
  12.77, 12.81, 12.81, 12.86, 12.86, 12.86, 12.86, 12.86, 12.86
];
const PUSH69_REL0 = -52;

function lerpTable(tab: readonly number[], x0: number, x: number, lo: number, hi: number): number {
  const u = x - x0;
  if (u <= 0) return lo;
  if (u >= tab.length - 1) return hi;
  const i = Math.floor(u);
  const f = u - i;
  const a = tab[i] ?? lo;
  const b = tab[i + 1] ?? hi;
  return a + (b - a) * f;
}

/** 69번: B 손가락 각 rel(도) → A 가 이번 바퀴에서 시계 방향으로 간 각(도) */
export function onePushDeg(relDeg: number): number {
  return lerpTable(PUSH69, PUSH69_REL0, relDeg, 0, K69.stepDeg);
}

/** 69번: B 가 반시계로 누적 각 phi(도, rel0 보정 포함) 돌았을 때 A 의 누적 시계방향 회전(도). rel 는 (−180, 180] 로 접는다 */
export function oneToothAngle(totalRelDeg: number): number {
  const q = Math.floor((totalRelDeg + 180) / 360);
  const rel = totalRelDeg - 360 * q;
  return K69.aRestDeg + q * K69.stepDeg + onePushDeg(rel);
}

/** 뾰족 이 바퀴(톱니 모양 정지·잠금 바퀴): 이 i 가 각 i·피치 에 끝(rTip), 이뿌리 정점은 반 피치 어긋난 rRoot. 회전축 = 로컬 Z */
export function pointedWheel(teeth: number, rTip: number, rRoot: number, opts: { width?: number; holes?: number } = {}): THREE.Group {
  const w = opts.width ?? 0.1;
  const holes = opts.holes ?? 6;
  const P = TAU / teeth;
  const outline: V2[] = [];
  for (let i = 0; i < teeth; i++) {
    const c = i * P;
    outline.push([rRoot * Math.cos(c - P / 2), rRoot * Math.sin(c - P / 2)]);
    outline.push([rTip * Math.cos(c), rTip * Math.sin(c)]);
  }
  const shape = shapeFrom(outline);
  for (let k = 0; k < holes; k++) {
    const a = (k + 0.5) * (TAU / holes);
    shape.holes.push(circlePath(rRoot * 0.58 * Math.cos(a), rRoot * 0.58 * Math.sin(a), rRoot * 0.2));
  }
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, w, 0.012), brass()));
  g.add(zRod(0.09, -w / 2 - 0.01, w / 2 + 0.03, darkSteel()));
  // 표시점: 회전이 보이게
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.03, 0.01), paint(0xf2b619), rRoot * 0.3, 0, w / 2 + 0.003));
  g.userData.outline = outline;
  g.userData.teeth = teeth;
  return g;
}

/** 한 톱니 바퀴(B): 반지름 rB 의 판에서 손가락 둘레 ±cutHalfDeg 를 도려 내고 반지름 rFinger 의 손가락 하나. 손가락 방향 = 로컬 +X */
export function oneToothDriver(rB: number, rFinger: number, fingerW: number, cutHalfDeg: number, opts: { width?: number } = {}): THREE.Group {
  const w = opts.width ?? 0.1;
  const wc = (cutHalfDeg * Math.PI) / 180;
  const outline: V2[] = [];
  outline.push([rFinger, -fingerW / 2], [rFinger, fingerW / 2], [rB * Math.cos(wc) * 0.6, fingerW / 2], [rB * Math.cos(wc), rB * Math.sin(wc)]);
  const seg = 48;
  for (let k = 1; k < seg; k++) {
    const a = wc + ((TAU - 2 * wc) * k) / seg;
    outline.push([rB * Math.cos(a), rB * Math.sin(a)]);
  }
  outline.push([rB * Math.cos(TAU - wc), rB * Math.sin(TAU - wc)], [rB * Math.cos(wc) * 0.6, -fingerW / 2]);
  const g = new THREE.Group();
  g.add(mesh(extrude(shapeFrom(outline), w, 0.008), bronze({ roughness: 0.34 })));
  g.add(zRod(0.045, -w / 2 - 0.01, w / 2 + 0.03, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.02, 0.01), paint(0xf2b619), rFinger * 0.6, 0, w / 2 + 0.003));
  g.userData.outline = outline;
  return g;
}

// ───────────────────────── 70: 스터드 원판 + 테·탭핏 ─────────────────────────
// 판화 다시 읽기(지시서 20 S1b): 휴지 때 스터드 하나는 테 **안**(중심선 위)에 있고, 그 양옆(±36°) 두 스터드가
// 테 바깥면(= C 의 둘레)에 닿아 A 를 양쪽으로 잠근다. 틈이 오면 탭핏이 안쪽 스터드를 밀어 내보내고(하나가 나감)
// 위쪽 스터드가 틈으로 들어온다(하나가 들어옴). 탭핏 끝은 테 바깥 반지름까지 — 그래야 나가는 스터드가 정확히 테 바깥면에 접한 자리에서 놓인다.

const K70_DIST = 1.78;
const K70_RING = 0.885;
const K70_STUD = 0.07;

/** 70번 치수(설계표 070) */
export const K70 = {
  studs: 10,
  /** A 중심 → C 중심 거리 */
  dist: K70_DIST,
  ringR: K70_RING,
  studR: K70_STUD,
  /** 휴지 때 스터드 각(중심선 기준, 도): 0° 스터드가 테 안, ±36° 스터드가 테 바깥면에 닿는다 */
  psi0Deg: 0,
  /** 테 바깥 반지름 = C 둘레 = (±36° 스터드 중심–C 중심 거리) − 스터드 반지름 = 1.1144 */
  rimR: Math.sqrt(K70_DIST * K70_DIST + K70_RING * K70_RING - 2 * K70_DIST * K70_RING * Math.cos(Math.PI / 5)) - K70_STUD,
  rimThick: 0.085,
  gapHalfDeg: 34,
  /** 탭핏: 끝 반폭·뿌리 반폭·뿌리 반지름(길이는 rimR) */
  tipHalf: 0.045,
  baseHalf: 0.12,
  baseR: 0.12,
  plateA: 1.08,
  aRestDeg: 0
} as const;

/** C 탭핏 각 chi(도, 탭핏이 A 를 향할 때 180) → A 의 이번 바퀴 시계방향 전진각(도, 0~36). 0.5° 간격, chi 171 ~ 204 (shots/_verify/s070b.mjs) */
const PUSH70 = [
  0.0, 0.01, 0.51, 1.02, 1.52, 2.02, 2.52, 3.02, 3.51, 4.01, 4.51, 5.01, 5.5, 6.0, 6.5, 7.0, 7.5, 8.01, 8.51, 9.02, 9.52, 10.04, 10.55,
  11.07, 11.59, 12.11, 12.64, 13.17, 13.71, 14.25, 14.79, 15.34, 15.9, 16.46, 17.03, 17.61, 18.19, 18.78, 19.38, 19.99, 20.61, 21.24,
  21.88, 22.53, 23.2, 23.88, 24.57, 25.27, 26.0, 26.74, 27.5, 28.28, 29.08, 29.91, 30.77, 31.65, 32.45, 33.15, 33.76, 34.29, 34.76,
  35.15, 35.47, 35.72, 35.9, 35.99, 36.0
];
const PUSH70_CHI0 = 171;
const PUSH70_STEP = 0.5;

/** 70번: C 의 누적 탭핏 각(도) → A 의 누적 시계방향 회전(도). chi 는 0~360 으로 접는다. 미는 구간 chi 171.5° ~ 203.75° */
export function studWheelAngle(chiTotalDeg: number): number {
  const step = 360 / K70.studs;
  const q = Math.floor(chiTotalDeg / 360);
  const chi = chiTotalDeg - 360 * q;
  return K70.aRestDeg + q * step + lerpTable(PUSH70, 0, (chi - PUSH70_CHI0) / PUSH70_STEP, 0, step);
}

/** 탭핏 윤곽(방향 = 로컬 +X): 뿌리(반지름 baseR, 반폭 baseHalf) → 끝(반지름 len 의 호, 반폭 tipHalf) */
export function tappetOutline(len: number, tipHalf: number, baseHalf: number, baseR: number): V2[] {
  const beta = Math.asin(tipHalf / len);
  const pts: V2[] = [[baseR, -baseHalf]];
  for (let k = 0; k <= 6; k++) {
    const b = -beta + (2 * beta * k) / 6;
    pts.push([len * Math.cos(b), len * Math.sin(b)]);
  }
  pts.push([baseR, baseHalf]);
  return pts;
}

/** 스터드 원판(A): 반지름 plateR 의 얇은 판, 중심에서 ringR 에 n 개 스터드(반지름 studR, 판 앞으로 height). 스터드 k 의 로컬 각 = psi0 + k·360/n. 판 두께 중심 z = 0 */
export function studDisc(plateR: number, n: number, ringR: number, studR: number, psi0Deg: number, height: number): THREE.Group {
  const t = 0.06;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.absarc(0, 0, plateR, 0, TAU, false);
  const holes = 8;
  for (let k = 0; k < holes; k++) {
    const a = (k + 0.5) * (TAU / holes);
    shape.holes.push(circlePath(plateR * 0.45 * Math.cos(a), plateR * 0.45 * Math.sin(a), plateR * 0.13));
  }
  g.add(mesh(extrude(shape, t, 0.01, 64), brass()));
  g.add(zRod(0.1, -t / 2 - 0.01, t / 2 + 0.03, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.03, 0.01), paint(0xf2b619), plateR * 0.22, 0, t / 2 + 0.003));
  const pos: V2[] = [];
  const outlines: Record<string, V2[]> = {};
  for (let k = 0; k < n; k++) {
    const a = (psi0Deg * Math.PI) / 180 + (k * TAU) / n;
    const x = ringR * Math.cos(a);
    const y = ringR * Math.sin(a);
    g.add(zRod(studR, t / 2 - 0.005, t / 2 + height, steel(), x, y));
    pos.push([x, y]);
    const c: V2[] = [];
    for (let i = 0; i < 16; i++) c.push([x + studR * Math.cos((i * TAU) / 16), y + studR * Math.sin((i * TAU) / 16)]);
    outlines[`stud${k}`] = c;
  }
  g.userData.studs = pos;
  g.userData.studR = studR;
  g.userData.outlines = outlines;
  return g;
}

/**
 * 구동 바퀴(C): 앞판(반투명, 반지름 = rimR, 로컬 z = ±0.025) + 판 둘레에서 뒤로 뻗은 테(바깥 반지름 rimR = 판 둘레, 두께 rimThick, 틈 ±gapHalfDeg)
 * + 틈 가운데의 탭핏(허브에서 테 바깥 반지름까지, 끝으로 갈수록 좁아짐). 틈·탭핏 방향 = 로컬 +X, 테·탭핏은 앞판에서 뒤(−z)로 depth 만큼.
 */
export function rimDriver(rimR: number, rimThick: number, gapHalfDeg: number, tipHalf: number, baseHalf: number, baseR: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const gh = (gapHalfDeg * Math.PI) / 180;
  g.add(mesh(extrude(circleShape(rimR), 0.05, 0.008, 64), ghost(0xb8c8d8, 0.3)));
  // 테: 틈을 뺀 환형 조각, 뒤로 depth
  const rimGeo = extrude(annularSector(rimR - rimThick, rimR, gh, TAU - gh), depth + 0.05, 0.008, 64);
  g.add(meshAt(rimGeo, bronze({ roughness: 0.34 }), 0, 0, -depth / 2));
  // 틈 양 끝 마구리 표시
  for (const s of [1, -1]) {
    const m = meshAt(new THREE.BoxGeometry(rimThick, 0.012, depth), paint(0xf2b619), (rimR - rimThick / 2) * Math.cos(s * gh), (rimR - rimThick / 2) * Math.sin(s * gh), -0.025 - depth / 2);
    m.rotation.z = s * gh;
    g.add(m);
  }
  // 탭핏
  const tap = tappetOutline(rimR, tipHalf, baseHalf, baseR);
  g.add(meshAt(extrude(shapeFrom(tap), depth, 0.006), darkSteel({ roughness: 0.3 }), 0, 0, -0.025 - depth / 2));
  g.add(zRod(baseR + 0.03, -0.025 - depth, 0.04, darkSteel()));
  g.userData.rimR = rimR;
  g.userData.outlines = { tappet: tap };
  return g;
}

function circleShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  return s;
}
