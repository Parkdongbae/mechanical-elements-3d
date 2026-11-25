// 162번 전용 키트 — 물레방아 조속기 1 (베벨 기어 클러치)
//  세로 스핀들(위 수평축의 베벨 피니언 → 스핀들에 고정된 구동 베벨 기어) + 공 조속기(161 과 같은 팔·링크·슬리브 치수),
//  스핀들 아래쪽에 헐겁게 끼운 베벨 기어 둘(위: 이가 아래로, 아래: 이가 위로, 둘 다 아래 수평축의 피니언과 물림)과
//  그 사이를 오르내리는 클러치 고리(스핀들과 함께 돈다, 핀 하나). 고리는 조속기 슬리브와 속 빈 스핀들 속 막대로 이어져
//  슬리브와 같은 양만큼 오르내린다(판화에도 그 막대는 보이지 않는다).
//  운동식 gov162(theta): u = theta/2, v = u + C0, 스핀들 각 Φ(v) = 2v + 0.75·sin v (속도 인자 w = 4 + 1.5·cos v),
//  팔 각 α = 24° + 31°·(w − 2.5)/3, 슬리브 높이 sy(α), 클러치 높이 h = sy − sN.
//  h > TH 이면 핀이 위 기어 돌기를 밀어 위 기어가 스핀들과 함께 돈다(아래 수평축 +), h < −TH 이면 아래 기어(−).
//  sN(알맞은 속도의 중립 높이)은 "한 주기의 위·아래 물림 회전량이 같다"(H = L)를 풀어 정해 아래 수평축 각 ψ 가 한 주기마다 정확히 닫힌다.
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { rod } from './shaft';
import { bevelGear } from './gear';
import { markPin, setMM } from './mm';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export const K162 = {
  sx: 0.5, // 스핀들 x
  zc: 0.275, // 스핀들 z (공 스윗 0.275 ± 0.516)
  hy: 2.62, // 팔 힌지 높이
  pinx: 0.052, // 힌지 핀 오프셋
  armL: 0.45, // 힌지 → 공 중심
  rb: 0.095, // 공 반지름
  lug: 0.2745, // 힌지 → 러그
  lk: 0.32, // 링크
  sp: 0.055, // 슬리브 핀 반경
  aIn: 24 * DEG,
  aOut: 55 * DEG,
  c0: 1.2, // 속도 위상
  // 베벨 기어 다섯(모두 12이, 모듈 0.025, 45° 마이터) — 피치 반지름 R
  z: 12,
  m: 0.025,
  R: 0.15,
  gw: 0.05, // 이 폭
  yDrive: 1.5, // 위 수평축(구동) 높이 — 구동 기어 피치면 = yDrive + R
  yLow: 0.95, // 아래 수평축 높이 — 헐거운 기어 피치면 = yLow ± R
  // 클러치
  TH: 0.045, // 핀이 돌기에 걸리는 높이(중립 ±TH)
  studR: 0.078, // 돌기 반경
  studRad: 0.014, // 돌기 반지름
  studLen: 0.091, // 돌기 길이(기어 뒷판 앞면에서)
  pinRad: 0.012, // 클러치 핀 반지름
  pinOut: 0.1, // 클러치 핀 바깥 끝 반경
  off: 0.3535, // 핀이 돌기를 밀 때 돌기가 앞선 각 = asin(0.027/0.078)
  // 수문
  gateX: -1.2, // 수문 피니언 x(아래 수평축 위)
  rpGate: 0.08 // 수문 피니언 피치 반지름(16이 × 0.01)
} as const;

/** 속도 인자의 코사인 c(= cos v) → 슬리브 높이 */
function syOfCos(c: number): number {
  const w = 4 + 1.5 * c;
  const a = K162.aIn + ((K162.aOut - K162.aIn) * (w - 2.5)) / 3;
  const lugR = K162.pinx + K162.lug * Math.sin(a);
  const lugY = K162.hy - K162.lug * Math.cos(a);
  return lugY - Math.sqrt(K162.lk * K162.lk - (lugR - K162.sp) * (lugR - K162.sp));
}
/** 슬리브 높이 y 가 되는 cos v (단조 — 이분법) */
function cosFor(y: number): number {
  if (y <= syOfCos(-1)) return -1;
  if (y >= syOfCos(1)) return 1;
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mdl = (lo + hi) / 2;
    if (syOfCos(mdl) < y) lo = mdl;
    else hi = mdl;
  }
  return (lo + hi) / 2;
}
const Phi0 = (v: number): number => 2 * v + 0.75 * Math.sin(v);
/** 스핀들 각 — t = 1 (v = 2.0) 에 0 이 되게 옮겨 두 팔이 판화처럼 좌우(XY 평면)에 오게 한다 */
const Phi = (v: number): number => Phi0(v) - Phi0(2.0);

/** 중립 높이 sN 과 물림 구간(위: |v| < aH, 아래: aL < v < 2π − aL), 한 번 물림의 회전량 H(= L) */
function solveNeutral(): { sN: number; aH: number; aL: number; H: number } {
  const f = (sN: number): { aH: number; aL: number; H: number; L: number } => {
    const aH = Math.acos(cosFor(sN + K162.TH));
    const aL = Math.acos(cosFor(sN - K162.TH));
    return { aH, aL, H: 4 * aH + 1.5 * Math.sin(aH), L: 4 * (Math.PI - aL) - 1.5 * Math.sin(aL) };
  };
  let lo = syOfCos(-1) + K162.TH;
  let hi = syOfCos(1) - K162.TH;
  for (let i = 0; i < 70; i++) {
    const mdl = (lo + hi) / 2;
    const r = f(mdl);
    if (r.H > r.L) lo = mdl;
    else hi = mdl;
  }
  const sN = (lo + hi) / 2;
  const r = f(sN);
  return { sN, aH: r.aH, aL: r.aL, H: (r.H + r.L) / 2 };
}
export const CL162 = solveNeutral();

/** 돌기의 기어 그룹 안 방위(물림이 시작되는 순간 돌기가 핀보다 off 만큼 앞에 오게) */
export const STUD162 = {
  up: Phi(-CL162.aH) + K162.off,
  low: Phi(CL162.aL) + K162.off + CL162.H
} as const;

export interface Pose162 {
  /** 스핀들 각(spin rotation.y) */
  phiS: number;
  /** 속도 인자 w ∈ [2.5, 5.5] */
  w: number;
  alpha: number;
  sy: number;
  linkAng: number;
  lugR: number;
  lugY: number;
  ballR: number;
  ballY: number;
  /** 클러치 높이(아래 수평축 높이 기준) */
  h: number;
  /** 아래 수평축 누적 각(0 ~ H, 수문 높이에 비례) */
  psi: number;
  /** 'up' = 위 기어 물림(수문 올림), 'low' = 아래 기어(수문 내림), 'idle' = 중립 */
  state: 'up' | 'low' | 'idle';
}

/** 모든 자세의 닫힌 식. 한 주기 = theta 4π */
export function gov162(theta: number): Pose162 {
  const v = theta / 2 + K162.c0;
  const c = Math.cos(v);
  const w = 4 + 1.5 * c;
  const alpha = K162.aIn + ((K162.aOut - K162.aIn) * (w - 2.5)) / 3;
  const lugR = K162.pinx + K162.lug * Math.sin(alpha);
  const lugY = K162.hy - K162.lug * Math.cos(alpha);
  const sy = lugY - Math.sqrt(K162.lk * K162.lk - (lugR - K162.sp) * (lugR - K162.sp));
  const { aH, aL, H } = CL162;
  const x = v - TAU * Math.floor((v + aH) / TAU); // [−aH, 2π − aH)
  let psi: number;
  let state: Pose162['state'];
  if (x <= aH) {
    psi = Phi(x) - Phi(-aH);
    state = 'up';
  } else if (x <= aL) {
    psi = H;
    state = 'idle';
  } else if (x <= TAU - aL) {
    psi = H - (Phi(x) - Phi(aL));
    state = 'low';
  } else {
    psi = 0;
    state = 'idle';
  }
  return {
    phiS: Phi(v),
    w,
    alpha,
    sy,
    linkAng: Math.atan2(lugR - K162.sp, lugY - sy),
    lugR,
    lugY,
    ballR: K162.pinx + K162.armL * Math.sin(alpha),
    ballY: K162.hy - K162.armL * Math.cos(alpha),
    h: sy - CL162.sN,
    psi,
    state
  };
}

// ───────── 모양 도우미 ─────────
function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylY(r: number, y0: number, y1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}
function tubeY(rIn: number, rOut: number, y0: number, y1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  return lathe(tubeProfile(rIn, rOut, y0, y1, c), segs);
}
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 36): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function taperPlate(p0: V2, p1: V2, w0: number, w1: number, depth: number): THREE.BufferGeometry {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: V2[] = [
    [p0[0] + nx * w0, p0[1] + ny * w0],
    [p1[0] + nx * w1, p1[1] + ny * w1],
    [p1[0] - nx * w1, p1[1] - ny * w1],
    [p0[0] - nx * w0, p0[1] - ny * w0]
  ];
  return extrude(shapeFrom(pts), depth, 0.005, 8);
}
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/**
 * 도는 한 몸(spin). 원점 = 스핀들 축 y 0 — 모델은 (K162.sx, 0, K162.zc) 에 놓는다.
 * 스핀들 r 0.03 (y 0.47 ~ 2.70) + 위 꼭지 구 + 아래 구, 팔·공·링크·슬리브(161 치수, 지레 없음),
 * 구동 베벨 기어 `driveGear`(피치면 yDrive + R, 이가 아래로), 헐거운 기어를 붙잡는 고정 고리 둘,
 * 클러치 고리 `clutch`(+X 쪽 핀 하나, 핀 표식 `clutchPin`).
 */
export function spin162(): THREE.Group {
  const K = K162;
  const g = new THREE.Group();
  g.name = 'spin';
  const steelM = steel();
  const dark = darkSteel();
  g.add(rod(new THREE.Vector3(0, 0.47, 0), new THREE.Vector3(0, 2.7, 0), 0.03));
  g.add(meshAt(new THREE.SphereGeometry(0.04, 20, 14), dark, 0, 0.45, 0));
  g.add(meshAt(new THREE.SphereGeometry(0.038, 20, 14), brass(), 0, 2.72, 0)); // 위 꼭지(판화)
  // 구동 베벨 기어(스핀들에 고정, 이가 아래로) — 로컬 Z → −Y
  const drive = bevelGear(K.z, K.m, { width: K.gw, bore: 0.031, driver: false });
  drive.name = 'driveGear';
  drive.rotation.x = Math.PI / 2;
  drive.position.y = K.yDrive + K.R;
  g.add(drive);
  // 헐거운 기어를 축 방향으로 붙잡는 고정 고리(스핀들과 함께 돈다)
  for (const y of [K.yLow - K.R - 0.075, K.yLow + K.R + 0.065]) g.add(meshAt(tubeY(0.03, 0.05, 0, 0.02), dark, 0, y, 0));
  addGovernor162(g, K.hy);
  // 클러치 고리 + 핀(로컬 +X, 반경 0.04 ~ pinOut)
  const clutch = new THREE.Group();
  clutch.name = 'clutch';
  clutch.position.y = K.yLow;
  clutch.add(mesh(tubeY(0.031, 0.045, -0.022, 0.022), dark));
  const pin = cylY(K.pinRad, 0.04, K.pinOut, 0.004, 16);
  pin.rotateZ(-Math.PI / 2);
  clutch.add(mesh(pin, steelM));
  clutch.add(pinMark('clutchPin', K.studR, 0, 0));
  g.add(clutch);
  return g;
}

/**
 * 공 조속기(머리·팔·공·링크·슬리브)를 g 에 더한다 — 원점 = 스핀들 축, 힌지 높이 hy. 슬리브 그룹(name 'sleeve')을 돌려준다.
 * 자식 이름: head armR armL linkR linkL sleeve, 핀 표식 headPin* lugPin* linkTop* linkBot* sleevePin*. 163 도 쓴다.
 */
export function addGovernor162(g: THREE.Group, hy: number): THREE.Group {
  const steelM = steel();
  const dark = darkSteel();
  // 머리(클리비스) + 힌지 핀
  const head = new THREE.Group();
  head.name = 'head';
  head.add(meshAt(new THREE.BoxGeometry(0.072, 0.15, 0.07), castIron(), 0, hy - 0.025, 0));
  for (const s of [1, -1] as const) {
    head.add(meshAt(new THREE.BoxGeometry(0.059, 0.15, 0.024), castIron(), s * 0.0655, hy - 0.025, s * 0.047));
    head.add(meshAt(cylZ(0.02, -0.075, 0.075), dark, s * K162.pinx, hy, 0));
    head.add(pinMark(s > 0 ? 'headPinR' : 'headPinL', s * K162.pinx, hy, 0));
  }
  g.add(head);
  for (const side of ['R', 'L'] as const) {
    const s = side === 'R' ? 1 : -1;
    const arm = new THREE.Group();
    arm.name = `arm${side}`;
    arm.position.set(s * K162.pinx, hy, 0);
    arm.rotation.z = s * K162.aIn;
    arm.add(mesh(taperPlate([0, 0], [0, -K162.armL], 0.02, 0.015, 0.032), steelM));
    arm.add(meshAt(cylZ(0.02, -0.042, 0.042), dark, 0, -K162.lug, 0));
    arm.add(meshAt(new THREE.SphereGeometry(K162.rb, 24, 18), brass(), 0, -K162.armL, 0));
    arm.add(pinMark(`lugPin${side}`, 0, -K162.lug, 0));
    g.add(arm);
  }
  for (const side of ['R', 'L'] as const) {
    const link = new THREE.Group();
    link.name = `link${side}`;
    link.add(meshAt(tubeZ(0.021, 0.04, -0.018, 0.018, 0.005, 32), steelM, 0, 0, 0));
    link.add(mesh(taperPlate([0, -0.012], [0, -K162.lk + 0.012], 0.016, 0.013, 0.026), steelM));
    link.add(meshAt(tubeZ(0.021, 0.04, -0.018, 0.018, 0.005, 32), steelM, 0, -K162.lk, 0));
    link.add(pinMark(`linkTop${side}`, 0, 0, 0));
    link.add(pinMark(`linkBot${side}`, 0, -K162.lk, 0));
    g.add(link);
  }
  // 슬리브(지레 없음)
  const sleeve = new THREE.Group();
  sleeve.name = 'sleeve';
  sleeve.position.y = 2.15;
  sleeve.add(mesh(tubeY(0.032, 0.075, -0.15, 0.02), dark));
  sleeve.add(mesh(cylY(0.058, 0.018, 0.05, 0.012, 16), dark));
  for (const s of [1, -1] as const) {
    sleeve.add(meshAt(cylZ(0.02, -0.052, 0.052), dark, s * K162.sp, 0, 0));
    sleeve.add(pinMark(s > 0 ? 'sleevePinR' : 'sleevePinL', s * K162.sp, 0, 0));
  }
  g.add(sleeve);
  return sleeve;
}

/** 매 프레임 자세 대입 */
export function setPose162(spin: THREE.Object3D, p: Pose162): void {
  spin.rotation.y = p.phiS;
  const armR = spin.getObjectByName('armR');
  if (armR) armR.rotation.z = p.alpha;
  const armL = spin.getObjectByName('armL');
  if (armL) armL.rotation.z = -p.alpha;
  const sleeve = spin.getObjectByName('sleeve');
  if (sleeve) sleeve.position.y = p.sy;
  const linkR = spin.getObjectByName('linkR');
  if (linkR) {
    linkR.position.set(p.lugR, p.lugY, 0);
    linkR.rotation.z = -p.linkAng;
  }
  const linkL = spin.getObjectByName('linkL');
  if (linkL) {
    linkL.position.set(-p.lugR, p.lugY, 0);
    linkL.rotation.z = p.linkAng;
  }
  const clutch = spin.getObjectByName('clutch');
  if (clutch) clutch.position.y = K162.yLow + p.h;
}

/**
 * 헐거운 베벨 기어 + 돌기. 원점 = 피치원 중심, 회전 = 그룹 rotation.y.
 * up = true: 이가 아래로(위 기어), 돌기가 뒷판 앞면에서 아래로. false: 이가 위로(아래 기어), 돌기가 위로.
 * sigma = 돌기 방위(그룹 안, 위에서 반시계 — (r cos σ, ·, −r sin σ)).
 */
export function looseGear162(up: boolean, sigma: number): THREE.Group {
  const K = K162;
  const g = new THREE.Group();
  const gear = bevelGear(K.z, K.m, { width: K.gw, bore: 0.036 });
  gear.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
  g.add(gear);
  const s = up ? -1 : 1;
  const stud = cylY(K.studRad, 0, K.studLen, 0.004, 16);
  const m = meshAt(stud, darkSteel(), K.studR * Math.cos(sigma), s * 0.002, -K.studR * Math.sin(sigma));
  if (up) m.rotation.x = Math.PI;
  g.add(m);
  g.add(pinMark(up ? 'studUp' : 'studLow', K.studR * Math.cos(sigma), s * (0.002 + K.studLen / 2), -K.studR * Math.sin(sigma)));
  return g;
}

/**
 * 수평축 + 베벨 피니언(축 방향 X). 원점 = 피니언 피치원 중심, 이가 +X(스핀들 쪽). 회전 = 그룹 rotation.x.
 * 축은 로컬 x −0.05 ~ xEnd. 이름 붙일 피벗을 돌려준다.
 */
export function bevelShaft162(xEnd: number): THREE.Group {
  const K = K162;
  const g = new THREE.Group();
  const p = bevelGear(K.z, K.m, { width: K.gw, bore: 0.026, driver: true });
  p.rotation.y = Math.PI / 2;
  g.add(p);
  g.add(rod(new THREE.Vector3(-0.05, 0, 0), new THREE.Vector3(xEnd, 0, 0), 0.025));
  return g;
}

/** 스핀들 받침 — 뒤판에서 나온 팔과 링(구멍 Y 방향) 둘: 아래 y 0.55, 가운데 y 1.27 */
export function frame162(): THREE.Group {
  const K = K162;
  const g = new THREE.Group();
  for (const y of [0.55, 1.27]) {
    g.add(meshAt(new THREE.BoxGeometry(0.09, 0.06, 0.516), castIron(), K.sx, y, -0.045));
    g.add(meshAt(tubeY(0.034, 0.062, -0.045, 0.045), darkSteel(), K.sx, y, K.zc));
  }
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 수문(셔틀): 세로 랙(이가 +Z 쪽, 피니언 뒤에서 물림) + 왼쪽으로 붙은 문판. 원점 = 랙의 피치선이 피니언 축 높이에 올 때의 피니언 축 자리.
 * 모델은 (gateX, yLow + rp·ψ, zc) 에 놓는다 — 피니언 뒤(−Z)에서 물려 ψ 가 늘면 올라간다.
 */
export function gate162(): THREE.Group {
  const K = K162;
  const g = new THREE.Group();
  g.name = 'gate';
  const zr = -K.rpGate; // 피치선 z
  const body = castIron({ roughness: 0.55 });
  // 랙 몸(x 폭 0.05, z zr−0.045 ~ zr−0.01), 이(높이 0.02, 피치 π·0.01)
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.62, 0.035), body, 0, -0.03, zr - 0.0275));
  const pitch = Math.PI * 0.01;
  for (let i = -19; i <= 17; i++) g.add(meshAt(new THREE.BoxGeometry(0.05, pitch * 0.45, 0.02), body, 0, (i + 0.5) * pitch, zr));
  // 문판(왼쪽) — 랙 아래쪽에 붙는다
  g.add(meshAt(new THREE.BoxGeometry(0.72, 0.28, 0.04), brass(), -0.385, -0.2, zr - 0.0275));
  g.add(pinMark('gateMark', -0.385, -0.06, zr));
  setMM(g, { kind: 'slider' });
  return g;
}
