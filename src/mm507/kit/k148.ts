// 148번 전용 키트 — 교대 회전 기어 장치(plate 45 · fig 148)
//  큰 기어(이 48 · 살 8) 면의 닫힌 타원 홈(리브 2)을 롤러 핀이 따라가며,
//  프레임 눈 E 에 받쳐진 부러진 레버를 기어 1회전에 한 번 흔든다. 핀니언(이 12)이 구동(4:1).
//  판화 비(1 px = 0.009): 축 사이 165 : 광절거리 224 : 환 타원 182×102.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePts, extrude, hexPrism, lathe, loft, merge, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { meshAngle } from './gear';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

/** 148번 치수(세계 좌표·길이) */
export const K148 = {
  /** 큰 기어 축 */
  G: [0, 1.33] as V2,
  /** 핀니언 축(중심 거리 = (48+12)/2·m) */
  P: [-1.35, 1.33] as V2,
  m: 0.045,
  zGear: 48,
  zPin: 12,
  /** 홈 가운데선 타원(큰 기어 축 중심) — 판화 182×102 px */
  a: 0.823,
  b: 0.457,
  /** 리브 안쪽 면 오프셋(롤러 반지름 0.055 + 옆틈 0.008) */
  wall: 0.063,
  /** 리브 두께(바깥 면 = wall + rib) */
  rib: 0.03,
  rollerR: 0.055,
  /** 기어 판 두께(층) */
  slabT: 0.08,
  /** 리브 꼭대기(앞면) */
  ribTop: 0.085,
  rimIn: 0.95,
  hubOut: 0.12,
  bore: 0.055,
  spokes: 8,
  spokeW: 0.05,
  /** 레버 받침 눈(프레임) */
  E: [1.638, 1.395] as V2,
  /** 레버 긴 팔(E→J) · 짧은 팔(J→롤러) · 굽은 각 */
  L1: 1.774,
  L2: 0.391,
  psi: 56.5 * DEG,
  /** 레버 두께(z) */
  leverZ: [-0.04, 0.04] as [number, number],
  /** t=1 이 판화 자세(살이 곧게 섬)가 되는 핀니언 각 오프셋 */
  theta0: 13.380973,
} as const;

/** 롤러 궤도 반지름(E 에서 핀까지, 일정) = |L1·û + L2·û'|
 *  도달 창 [D−b, D+b] = [1.182, 2.096] 안(여유 윗쪽 0.080) */
export const K148_C = Math.hypot(K148.L1 + K148.L2 * Math.cos(K148.psi), K148.L2 * Math.sin(K148.psi));
/** 롤러의 레버 로컬 방향(긴 팔 기준) */
export const K148_DELTA = Math.atan2(K148.L2 * Math.sin(K148.psi), K148.L1 + K148.L2 * Math.cos(K148.psi));
/** 레버 로컬에서 롤러 핀 자리 */
export const K148_TIP: V2 = [K148.L1 + K148.L2 * Math.cos(K148.psi), K148.L2 * Math.sin(K148.psi)];

// ────────────── 기하 도우미 ──────────────

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
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 타원 가운데선을 법선 방향으로 off 만큼 옮긴 다각형(반시계 n 점) */
function ellipseOffset(a: number, b: number, off: number, n = 200): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const u = (TAU * i) / n;
    const tx = -a * Math.sin(u);
    const ty = b * Math.cos(u);
    const len = Math.hypot(tx, ty);
    const nx = ty / len;
    const ny = -tx / len;
    out.push([a * Math.cos(u) + nx * off, b * Math.sin(u) + ny * off]);
  }
  return out;
}

/** 리브 링 하나를 한 폐곡선으로: 바깥 곡선 정방향 + 안쪽 곡선 역방향 */
function ribRing(a: number, b: number, inOff: number, outOff: number, n = 200): V2[] {
  const out = ellipseOffset(a, b, outOff, n);
  const inn = ellipseOffset(a, b, inOff, n);
  for (let i = n - 1; i >= 0; i--) out.push(inn[i] as V2);
  return out;
}

/** 점의 타원 가운데선까지의 거리(부호: 안쪽 −). inside 는 타원 식으로 판정 */
function signedDist(x: number, y: number, poly: V2[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j]![0];
    const ay = poly[j]![1];
    const bx = poly[i]![0];
    const by = poly[i]![1];
    const dx = bx - ax;
    const dy = by - ay;
    const L = dx * dx + dy * dy || 1e-18;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return (x * x) / (K148.a * K148.a) + (y * y) / (K148.b * K148.b) <= 1 ? -best : best;
}

// ────────────── 운동식: 주기표 ──────────────

const TAB_N = 720;
/** 홈 위 매개변수 u 에서 절제 조건 |P−E|² − c² (phiG: 기어 각) */
function reachErr(u: number, phiG: number): number {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const cg = Math.cos(phiG);
  const sg = Math.sin(phiG);
  const x = K148.a * cu * cg - K148.b * su * sg;
  const y = K148.a * cu * sg + K148.b * su * cg;
  return (K148.G[0] + x - K148.E[0]) ** 2 + (K148.G[1] + y - K148.E[1]) ** 2 - K148_C * K148_C;
}

/** phiG 에서 이전 해 u0 근처의 해(뉴턴, 한계 단계 0.2 rad — 갈라짐 없음: c 가 창 한가운데라 접선 없음) */
function solveContact(u0: number, phiG: number): number {
  let u = u0;
  for (let i = 0; i < 60; i++) {
    const f = reachErr(u, phiG);
    const h = 1e-7;
    const d = (reachErr(u + h, phiG) - reachErr(u - h, phiG)) / (2 * h);
    if (Math.abs(d) < 1e-14) break;
    const step = f / d;
    u -= Math.max(-0.2, Math.min(0.2, step));
    if (Math.abs(f) < 1e-13) break;
  }
  return u;
}

/** 기어 각 → 레버 각 주기표(0~2π 를 720 칸, 끝값 = 첫값: 매 주기 정확히 닫힌다).
 *  phiG = 0 의 두 근 가운데 위쪽 왼쪽(판화의 롤러 자리)을 t=1 로 택한다. */
const alphaTab: Float64Array = (() => {
  const tab = new Float64Array(TAB_N + 1);
  let lo = 95 * DEG;
  let hi = 175 * DEG;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (reachErr(lo, 0) * reachErr(mid, 0) <= 0) hi = mid;
    else lo = mid;
  }
  let u = (lo + hi) / 2;
  for (let k = 0; k <= TAB_N; k++) {
    const phiG = (TAU * k) / TAB_N;
    u = solveContact(u, phiG);
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cg = Math.cos(phiG);
    const sg = Math.sin(phiG);
    const px = K148.G[0] + K148.a * cu * cg - K148.b * su * sg;
    const py = K148.G[1] + K148.a * cu * sg + K148.b * su * cg;
    tab[k] = Math.atan2(py - K148.E[1], px - K148.E[0]) - K148_DELTA;
  }
  tab[TAB_N] = tab[0] as number;
  return tab;
})();

export interface Pose148 {
  /** 핀니언 각(계속 감소 = 정면에서 시계) */
  phiP: number;
  /** 큰 기어 각(meshAngle 결과) */
  phiG: number;
  /** 레버 각(E 중심, 범위 149.75°~164.82°) */
  alpha: number;
  /** 롤러 핀 월드 자리 */
  pin: V2;
  /** 레버 굽은점 J 월드 자리 */
  joint: V2;
}

/** 148번 운동식 — theta 의 닫힌 함수(주기 8π, 주기표는 매 주기 정확히 닫힘).
 *  pinion.rotation.z = A.phiP, gear.rotation.z = A.phiG, crankLever148.rotation.z = A.alpha */
export function lever148(theta: number): Pose148 {
  const phiP = K148.theta0 - theta;
  const phiG = meshAngle(K148.P, K148.zPin, phiP, K148.G, K148.zGear);
  let g = phiG % TAU;
  if (g < 0) g += TAU;
  const x = (g / TAU) * TAB_N;
  const i0 = Math.min(TAB_N - 1, Math.floor(x));
  const f = x - i0;
  const a0 = alphaTab[i0] as number;
  const a1 = alphaTab[i0 + 1] as number;
  const alpha = a0 + (a1 - a0) * f;
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const jx = K148.E[0] + K148.L1 * ca;
  const jy = K148.E[1] + K148.L1 * sa;
  const px = jx + K148.L2 * Math.cos(alpha + K148.psi);
  const py = jy + K148.L2 * Math.sin(alpha + K148.psi);
  return { phiP, phiG, alpha, pin: [px, py], joint: [jx, jy] };
}

// ────────────── 부품 ──────────────

/**
 * 큰 기어: 이 48(인벌류트, spurGear 위상 = (i+0.5)·피치각 — meshAngle 그대로) + 살 8 + 허브 + 타원 리브 2(홈).
 * 살은 홈에서 끊긴다(끝을 리브 속 0.088 까지 박아 붙임). 원점 = 축, 회전축 = 로컬 Z.
 * 리브 2 개에 userData.outline = 링 윤곽(롤러 침범 검사용), mm.kind = 'gear'.
 */
export function gearWeb148(): THREE.Group {
  const K = K148;
  const rp = (K.zGear * K.m) / 2;
  const ra = rp + K.m;
  const rf = rp - 1.25 * K.m;
  const body = brass();
  const g = new THREE.Group();
  // 이 난 림(안벽 = rimIn)
  const outline = involuteOutline(K.zGear, ra, rf);
  const c = Math.min(K.m * 0.3, K.slabT * 0.12);
  const layers = [
    { z: -K.slabT / 2, s: (ra - c) / ra, hs: 1 },
    { z: -K.slabT / 2 + c, s: 1, hs: 1 },
    { z: K.slabT / 2 - c, s: 1, hs: 1 },
    { z: K.slabT / 2, s: (ra - c) / ra, hs: 1 }
  ];
  g.add(mesh(loft(outline, [circlePts(K.rimIn, 96)], layers), body));
  // 허브(축 구멍 0.055)
  g.add(mesh(tubeZ(K.bore, K.hubOut, -K.slabT / 2 - 0.02, K.slabT / 2 + 0.02, 0.005, 40), darkSteel()));
  // 살 8 — 홈(가운데선 ±0.088 안)에서 끊긴다
  const center = ellipseOffset(K.a, K.b, 0, 256);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < K.spokes; i++) {
    const gamma = (TAU * i) / K.spokes;
    const dx = Math.cos(gamma);
    const dy = Math.sin(gamma);
    // 가운데선 ±0.088 지점(리브 한가운데) — 2 분법. 선분 거리는 살 방향으로 단조라 답이 하나
    const solve = (target: number, t0: number, t1: number): number => {
      let a2 = t0;
      let b2 = t1;
      for (let k = 0; k < 40; k++) {
        const mid = (a2 + b2) / 2;
        if ((signedDist(dx * a2, dy * a2, center) - target) * (signedDist(dx * mid, dy * mid, center) - target) <= 0) b2 = mid;
        else a2 = mid;
      }
      return (a2 + b2) / 2;
    };
    const tIn = solve(-0.088, 0.12, 0.95);
    const tOut = solve(0.088, tIn, 0.95);
    const segs: [number, number][] = [
      [0.1, tIn],
      [tOut, 0.97]
    ];
    for (const [s0, s1] of segs) {
      const len = s1 - s0;
      const box = new THREE.BoxGeometry(len, K.spokeW, K.slabT);
      box.translate(0.1 + len / 2, 0, 0);
      box.rotateZ(gamma);
      geos.push(box);
    }
  }
  g.add(mesh(merge(geos), body));
  // 리브 2(홈 벽) — 판 면에서 앞으로 K.ribTop 까지. userData.outline = 링 윤곽
  const rings: [number, number][] = [
    [-K.wall - K.rib, -K.wall],
    [K.wall, K.wall + K.rib]
  ];
  for (const [inOff, outOff] of rings) {
    const pts = ribRing(K.a, K.b, inOff, outOff, 200);
    const geo = extrude(shapeFrom(pts), K.ribTop + K.slabT / 2, 0.004, 12);
    geo.translate(0, 0, (K.ribTop - K.slabT / 2) / 2); // extrude 는 z 0 중심 — 리브를 판 뒷면 −0.04 ~ 앞면 0.085 에 앉힌다
    const rib = mesh(geo, body);
    rib.userData.outline = pts;
    g.add(rib);
  }
  // 표시줄: 첫 살 위 — 회전이 보이게
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.016, 0.01), paint(MARK), (K.hubOut + K.rimIn) / 2, 0, K.slabT / 2 + 0.004));
  setMM(g, { kind: 'gear', fn: 'gearWeb148', teeth: K.zGear, module: K.m, internal: false, rp, ra, rf, width: K.slabT, axis: 'z' });
  return g;
}

/**
 * 프레임: 바닥판 + 좌우 면판(위가 계단으로 좁아짐) + 교량 + 오른쪽 팔(E 구멍) + 베어링 링 3 + E 축·너트.
 * 원점 = 세계 원점. 면판·교량의 구멍은 축 방향(Z)으로 뚫려 있다. mm.kind = 'frame'.
 */
export function frame148(): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  // 바닥판(전시대 나무 윗면 0.18 에 얹힘)
  const base = meshAt(new THREE.BoxGeometry(4.1, 0.14, 0.18), body, 0, 0.25, -0.16);
  g.add(base);
  /** (x,y) 평면 판(두께 0.18, z −0.25~−0.07) — 점·구멍 모두 절대 좌표, holes = [x, y, r].
   *  extrude() 는 z 0 중심으로 나오므로 z −0.16 로 옮겨야 판이 −0.25~−0.07 에 앉는다 */
  const plate = (pts: V2[], holes: [number, number, number][]): THREE.Mesh => {
    const sh = shapeFrom(pts);
    for (const [hx, hy, hr] of holes) sh.holes.push(pathFrom(circlePts(hr, 28, hx, hy)));
    const geo = extrude(sh, 0.18, 0.006, 12);
    geo.translate(0, 0, -0.16);
    return mesh(geo, body);
  };
  // 왼쪽 면판(핀니언 축 구멍) — 위 평평, 기어 쪽으로 계단
  g.add(plate(
    [
      [-1.85, 0.32],
      [-1.85, 1.78],
      [-1.58, 1.78],
      [-1.0, 1.58],
      [-1.0, 0.32]
    ],
    [[K148.P[0], K148.P[1], 0.09]]
  ));
  // 오른쪽 면판
  g.add(plate(
    [
      [1.37, 0.32],
      [1.37, 1.62],
      [1.72, 1.78],
      [2.05, 1.78],
      [2.05, 0.32]
    ],
    []
  ));
  // 오른쪽 팔(E 구멍) — 면판 위 같은 층
  g.add(plate(
    [
      [1.3, 1.29],
      [1.3, 1.5],
      [1.72, 1.5],
      [1.72, 1.29]
    ],
    [[K148.E[0], K148.E[1], 0.055]]
  ));
  // 교량(큰 기어 축 구멍) — 좌우 면판을 잇고 기어 뒤를 지나간다.
  //  구멍 0.126: shaftZ 뒤 보스(반지름 0.12, z −0.30~−0.20)가 통과해야 해서 넓혔다
  g.add(plate(
    [
      [-1.0, 1.18],
      [-1.0, 1.48],
      [1.37, 1.48],
      [1.37, 1.18]
    ],
    [[K148.G[0], K148.G[1], 0.126]]
  ));
  // 베어링 링 3(구멍 = 축 방향): 핀니언 · 큰 기어(교량) · E.
  //  큰 기어 링 바깥 0.135 — 교량 구멍(0.126) 가장자리 위에 얹혀 앉게
  g.add(meshAt(tubeZ(0.042, 0.1, -0.07, -0.04, 0.004, 36), darkSteel(), K148.P[0], K148.P[1], 0));
  g.add(meshAt(tubeZ(0.055, 0.135, -0.07, -0.04, 0.004, 36), darkSteel(), K148.G[0], K148.G[1], 0));
  g.add(meshAt(tubeZ(0.055, 0.1, -0.07, -0.04, 0.004, 36), darkSteel(), K148.E[0], K148.E[1], 0));
  // E 축(레버 눈이 앉는다) + 끝 너트
  g.add(meshAt(cylZ(0.05, -0.06, 0.185, 0.004, 28), steel(), K148.E[0], K148.E[1], 0));
  const cap = hexPrism(0.055, 0.04, true, true, 0);
  cap.rotateX(Math.PI / 2);
  g.add(meshAt(cap, darkSteel(), K148.E[0], K148.E[1], 0.185));
  // 검사 표식: E 축 자리
  const pivotE = new THREE.Object3D();
  pivotE.name = 'pivotE';
  pivotE.position.set(K148.E[0], K148.E[1], 0.06);
  markPin(pivotE);
  g.add(pivotE);
  setMM(g, { kind: 'frame', fn: 'frame148' });
  return g;
}

/**
 * 부러진 레버(크랭크): 눈(E, 구멍 0.056) + 긴 팔 L1 + 짧은 팔 L2(굽음 ψ) + J 리벳 + 롤러·핀.
 * 원점 = E, 로컬 +X = 긴 팔, 두께 z ±0.04(모델이 z 0.14 에 두고 rotation.z = alpha).
 * child 'rollerPin'(userData.outline = 롤러 원, mm.point = 롤러 중심).
 */
export function crankLever148(): THREE.Group {
  const K = K148;
  const g = new THREE.Group();
  const bar = steel();
  // 눈(E)
  g.add(mesh(tubeZ(0.056, 0.075, -0.04, 0.04, 0.005, 32), darkSteel()));
  // 긴 팔(E → J) — 눈 바깥(x 0.07)에서 시작: 팔이 눈 구멍을 막으면 E 축(반지름 0.05)에 박힌다
  const armX0 = 0.07;
  const long = new THREE.BoxGeometry(K.L1 + 0.01 - armX0, 0.05, 0.08);
  long.translate(armX0 + (K.L1 + 0.01 - armX0) / 2, 0, 0);
  g.add(mesh(long, bar));
  // 짧은 팔(J → 롤러)
  const dirX = Math.cos(K.psi);
  const dirY = Math.sin(K.psi);
  const shortLen = K.L2 + 0.03;
  const short = new THREE.BoxGeometry(shortLen, 0.05, 0.08);
  const shortMesh = mesh(short, bar);
  shortMesh.position.set(K.L1 + (dirX * shortLen) / 2 - dirX * 0.015, (dirY * shortLen) / 2 - dirY * 0.015, 0);
  shortMesh.rotation.z = K.psi;
  g.add(shortMesh);
  // J 리벳(판화의 고리 — 굽은점 리벳)
  g.add(meshAt(cylZ(0.045, 0.04, 0.05, 0.004, 24), darkSteel(), K.L1, 0, 0));
  // 롤러 + 핀(핀은 레버 뒷면에서 홈 속까지)
  const tip = K148_TIP;
  g.add(meshAt(cylZ(0.03, -0.16, -0.04, 0.004, 20), steel(), tip[0], tip[1], 0));
  g.add(meshAt(cylZ(K.rollerR, -0.135, -0.055, 0.005, 28), bronze({ roughness: 0.4 }), tip[0], tip[1], 0));
  // 검사 표식: 롤러 핀 자리 + 원 윤곽(리브와의 침범 검사용)
  const rollerPin = new THREE.Object3D();
  rollerPin.name = 'rollerPin';
  rollerPin.position.set(tip[0], tip[1], -0.095);
  markPin(rollerPin);
  rollerPin.userData.outline = circlePts(K.rollerR, 24);
  g.add(rollerPin);
  // 표시줄: 긴 팔 위
  g.add(meshAt(new THREE.BoxGeometry(0.14, 0.014, 0.01), paint(MARK), K.L1 * 0.6, 0, 0.045));
  setMM(g, { kind: 'lever', fn: 'crankLever148', pivot: [0, 0, 0], tip: [tip[0], tip[1], 0], L1: K.L1, L2: K.L2 });
  return g;
}
