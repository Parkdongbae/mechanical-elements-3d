// 137·138·139번 전용 키트
//   137 팽창 편심(프랑스식) — 머묾이 있는 지름 일정 캠, 롤러 둘을 단 갈라진(C 꼴) 흔들 팔, 받침 기둥, 밸브 막대
//   138 바닥 캠으로 움직이는 막대 — 원판 위의 울퉁불퉁한 캠(세 꼭지·세 골), 끝이 뾰족한 네모 막대
//   139 내부 랙 틀과 피니언 — 긴 고리 꼴 안쪽 랙이 난 판(틀 안에서 위아래로 미끄러짐), 고정 피니언, 틀, 평행 링크(벨 크랭크 둘 + 이음대)
// 순수 계산 함수(…Pitch, …Outline, …Lift, state…)는 three 물체를 만들지 않는다 → shots/_verify/s137.mjs 가 번들로 불러 침범을 잰다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, lathe, loft, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  return meshAt(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
/** Z축 원기둥(z0~z1) */
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
/** Y축 원기둥(y0~y1) */
function cylY(r: number, y0: number, y1: number, c = 0.005, segs = 24): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}
/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.005, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}
const pmod = (a: number, m: number): number => ((a % m) + m) % m;
/** 핀 표식(보이지 않는 빈 물체) — 검사 선언 links·joints 용 */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/** 점이 다각형 안인가 */
export function inPoly137(p: V2, poly: readonly V2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as V2;
    const [xj, yj] = poly[j] as V2;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ════════════════════════════ 137 팽창 편심(프랑스식) ════════════════════════════

/**
 * 137 치수. 좌표 원점 = 캠 축(정면 xy), 팔의 받침점(피벗) = (L, 0). 로컬 z = 0 이 캠·롤러 평면,
 * 팔 판은 그 뒤(zArm), 밸브 막대의 갈래 끝은 그 앞(zRod).
 */
export const K137 = {
  /** 롤러 중심의 평균 반지름(위·아래 롤러 중심 사이 거리의 절반) */
  a: 0.55,
  /** 피치 곡선의 들림 절반: 반지름 a − h ~ a + h */
  h: 0.07,
  /** 롤러 반지름 */
  rr: 0.15,
  /** 캠 축에서 팔 받침점까지 */
  L: 1.9,
  /** 큰 반지름·작은 반지름에서 머무는 각(절반) */
  dwell: 45 * DEG,
  shaftR: 0.11,
  /** 캠·롤러 폭 */
  camW: 0.1,
  /** 팔 판: 가운데 z, 두께, 띠 반폭, C 꼴 끝 반원의 중심선 반지름, 줄기(가로 팔) 반높이, 받침점 너머로 나온 길이 */
  zArm: -0.11,
  armT: 0.07,
  armHalf: 0.085,
  bend: 0.38,
  stemHalf: 0.09,
  stub: 0.24,
  /** 밸브 막대 갈래 끝의 가운데 z, 두께 */
  zRod: 0.1,
  rodT: 0.06,
  /** 롤러 핀·받침 핀 반지름 */
  pinR: 0.04,
  pivotR: 0.055
} as const;

/**
 * 피치 곡선(롤러 중심이 캠 기준으로 그리는 곡선) ρ(α). α 는 캠 로컬 +x 에서 반시계.
 * |α| ≤ dwell 에서 a + h(큰 반지름에 머묾), 180° ± dwell 에서 a − h(작은 반지름에 머묾), 그 사이는 코사인 곡선.
 * ρ(α) + ρ(α + π) = 2a 라 마주 보는 두 롤러가 늘 함께 닿는다.
 */
export function camPitch137(alpha: number): number {
  const K = K137;
  const w = pmod(alpha, TAU);
  const v = w <= Math.PI ? w : TAU - w; // 0..π (큰 쪽 가운데에서 잰 각)
  let g: number;
  if (v <= K.dwell) g = 1;
  else if (v >= Math.PI - K.dwell) g = -1;
  else g = Math.cos((Math.PI * (v - K.dwell)) / (Math.PI - 2 * K.dwell));
  return K.a + K.h * g;
}

/** 캠 윤곽(반시계) = 피치 곡선을 안쪽으로 롤러 반지름 + shrink 만큼 물린 곡선 */
export function camOutline137(n = 720, shrink = 0): V2[] {
  const out: V2[] = [];
  const P = (a: number): V2 => {
    const r = camPitch137(a);
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const off = K137.rr + shrink;
  const e = 1e-4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p = P(a);
    const p1 = P(a + e);
    const p0 = P(a - e);
    const tx = p1[0] - p0[0];
    const ty = p1[1] - p0[1];
    const tl = Math.hypot(tx, ty);
    out.push([p[0] - (off * ty) / tl, p[1] + (off * tx) / tl]);
  }
  return out;
}

/** 팔이 psi 만큼 돌았을 때(반시계 +) 위·아래 롤러 중심(캠 축 기준) */
export function rollerPos137(psi: number): { top: V2; bottom: V2 } {
  const { a, L } = K137;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  // 받침점 (L, 0) 둘레로 (−L, ±a) 를 돌린다
  return { top: [L - L * c - a * s, -L * s + a * c], bottom: [L - L * c + a * s, -L * s - a * c] };
}

/** 롤러 중심이 피치 곡선에서 바깥으로 떨어진 거리(+ = 틈, − = 파고듦). c = 캠 각 */
function pitchGap137(p: V2, c: number): number {
  return Math.hypot(p[0], p[1]) - camPitch137(Math.atan2(p[1], p[0]) - c);
}

/**
 * 캠 각 c(rotation.z) → 팔의 각 psi(받침점 둘레, 반시계 +). 두 롤러의 틈이 같아지는 각을 이분법으로 푼다
 * (팔이 원호로 흔들려 생기는 2차 오차 — 0.001 안쪽 — 를 두 롤러에 똑같이 나눈다). gap = 그 남은 틈.
 */
export function armAngle137(c: number): { psi: number; gap: number } {
  const f = (psi: number): number => {
    const r = rollerPos137(psi);
    return pitchGap137(r.top, c) - pitchGap137(r.bottom, c);
  };
  let lo = -0.12; // f(lo) > 0 (위 롤러가 뜸)
  let hi = 0.12;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const psi = (lo + hi) / 2;
  return { psi, gap: pitchGap137(rollerPos137(psi).top, c) };
}

/** 롤러의 회전각(구름 어림: 캠 평균 둘레 속도를 따라감). 캠이 반시계면 롤러는 시계 방향 */
export function rollerTurn137(c: number): number {
  return (-c * (K137.a - K137.rr)) / K137.rr;
}

/** 137 의 한 순간: 캠 각 c 에서 팔 각, 두 롤러 중심(캠 축 기준), 롤러 회전각 */
export function state137(c: number): { psi: number; top: V2; bottom: V2; roll: number } {
  const { psi } = armAngle137(c);
  const r = rollerPos137(psi);
  return { psi, top: r.top, bottom: r.bottom, roll: rollerTurn137(c) };
}

/** 캠: 원점 = 축, 로컬 Z 축, rotation.z = c. userData.outline = 윤곽. 큰 반지름 쪽(로컬 +x)에 노란 줄 */
export function valveCam137(): THREE.Group {
  const K = K137;
  const g = new THREE.Group();
  const outline = camOutline137(720, 0.0012);
  const s = shapeFrom(outline);
  s.holes.push(circlePath(0, 0, K.shaftR - 0.002));
  g.add(mesh(extrude(s, K.camW, 0.006, 8), bronze({ roughness: 0.34 })));
  g.add(mesh(tubeZ(K.shaftR - 0.002, K.shaftR + 0.05, -K.camW / 2 - 0.015, K.camW / 2 + 0.02), darkSteel()));
  g.add(box(0.13, 0.016, 0.008, paint(MARK), K.shaftR + 0.05 + 0.085, 0, K.camW / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', rMin: K.a - K.h - K.rr, rMax: K.a + K.h - K.rr, constantDiameter: 2 * (K.a - K.rr) });
  return g;
}

function roller137(name: string): THREE.Group {
  const K = K137;
  const g = new THREE.Group();
  g.name = name;
  g.add(mesh(tubeZ(K.pinR, K.rr, -K.camW / 2, K.camW / 2, 0.008, 48), steel()));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    g.add(meshAt(cylZ(0.016, K.camW / 2 - 0.002, K.camW / 2 + 0.004, 0.001, 12), paint(MARK), 0.1 * Math.cos(a), 0.1 * Math.sin(a), 0));
  }
  g.userData.outline = circlePts(K.rr, 64);
  setMM(g, { kind: 'roller', r: K.rr, width: K.camW });
  return g;
}

/** 팔 판의 윤곽(팔 로컬: 원점 = 받침점). C 꼴 띠 — 위 롤러 핀에서 위로 돌아 오른쪽 등줄기를 타고 내려와 아래 롤러 핀까지 */
export function forkOutline137(): V2[] {
  const K = K137;
  const x0 = -K.L; // 롤러 핀의 x
  const cx = x0 + K.bend;
  const ro = K.bend + K.armHalf;
  const ri = K.bend - K.armHalf;
  return [
    ...arc(cx, K.a, ro, Math.PI, 0, 24),
    ...arc(cx, -K.a, ro, 0, -Math.PI, 24),
    ...arc(x0, -K.a, K.armHalf, Math.PI, 0, 10).slice(1, -1),
    ...arc(cx, -K.a, ri, -Math.PI, 0, 20),
    ...arc(cx, K.a, ri, 0, Math.PI, 20),
    ...arc(x0, K.a, K.armHalf, 0, -Math.PI, 10).slice(1, -1)
  ];
}

export interface ForkArm137 {
  /** 팔 전체. 원점 = 받침점(로컬 z = 0 이 캠 평면). rotation.z = psi */
  group: THREE.Group;
  /** 위·아래 롤러(group 의 자식, rotation.z = 롤러 회전각) */
  rollerTop: THREE.Group;
  rollerBottom: THREE.Group;
}

/**
 * 갈라진 흔들 팔: C 꼴 띠 + 가로 줄기 + 받침점 보스 + 롤러 핀 2개 + 롤러 2개(name 'rollerTop'·'rollerBottom').
 * 핀 표식 child: 'pinTop'·'pinBottom'(롤러 핀, 캠 평면), 'armPivot'(받침점).
 * 아래 핀은 밸브 막대의 갈래 끝을 꿸 만큼 앞으로 길다.
 */
export function forkArm137(): ForkArm137 {
  const K = K137;
  const g = new THREE.Group();
  const iron = castIron();
  const zA = K.zArm;
  g.add(meshAt(extrude(shapeFrom(forkOutline137()), K.armT, 0.008, 8), iron, 0, 0, zA));
  // 줄기: 등줄기 가운데에서 받침점 너머까지
  const xs = -K.L + 2 * K.bend;
  g.add(box(K.stub - xs, 2 * K.stemHalf, K.armT, iron, (xs + K.stub) / 2, 0, zA));
  // 줄기와 등줄기가 만나는 자리의 살(위·아래 삼각)
  for (const sy of [-1, 1]) {
    const tri: V2[] = [
      [xs + K.armHalf - 0.01, sy * K.stemHalf],
      [xs + K.armHalf + 0.16, sy * K.stemHalf],
      [xs + K.armHalf - 0.01, sy * (K.stemHalf + 0.16)]
    ];
    g.add(meshAt(extrude(shapeFrom(sy > 0 ? tri : [...tri].reverse()), K.armT, 0.006, 4), iron, 0, 0, zA));
  }
  // 받침점 보스(팔 뒤쪽으로 두툼하게)
  g.add(mesh(tubeZ(K.pivotR, 0.13, zA - K.armT / 2 - 0.015, zA + K.armT / 2, 0.006), darkSteel()));
  // 롤러 핀: 팔 판에서 앞으로. 위 = 롤러 앞 머리까지, 아래 = 밸브 막대 갈래 끝 너머까지
  const zBack = zA - K.armT / 2 - 0.012;
  g.add(meshAt(cylZ(K.pinR - 0.001, zBack, K.camW / 2 + 0.012, 0.004, 20), darkSteel(), -K.L, K.a, 0));
  g.add(meshAt(cylZ(K.pinR + 0.022, K.camW / 2 + 0.002, K.camW / 2 + 0.022, 0.004, 20), darkSteel(), -K.L, K.a, 0));
  g.add(meshAt(cylZ(K.pinR - 0.001, zBack, K.zRod + K.rodT / 2 + 0.02, 0.004, 20), darkSteel(), -K.L, -K.a, 0));
  const rollerTop = roller137('rollerTop');
  rollerTop.position.set(-K.L, K.a, 0);
  const rollerBottom = roller137('rollerBottom');
  rollerBottom.position.set(-K.L, -K.a, 0);
  g.add(rollerTop, rollerBottom);
  g.add(pinMark('pinTop', -K.L, K.a, 0), pinMark('pinBottom', -K.L, -K.a, 0), pinMark('armPivot', 0, 0, 0));
  setMM(g, { kind: 'lever', fn: 'forkArm137', pivot: [0, 0, 0], rollers: [[-K.L, K.a, 0], [-K.L, -K.a, 0]] });
  return { group: g, rollerTop, rollerBottom };
}

/**
 * 팔 받침 기둥(고정). 원점 = 받침점(로컬 z = 0 이 캠 평면). 팔 판 앞의 고리(눈) + 받침 핀 + 아래로 내려간 기둥 + 발판.
 * height = 받침점에서 발판 바닥(받침대 윗면)까지. 핀 표식 child 'fulcrumPin'.
 */
export function fulcrum137(height: number): THREE.Group {
  const K = K137;
  const g = new THREE.Group();
  const iron = castIron();
  const zF = K.zArm + K.armT / 2 + 0.004; // 팔 판 앞면 바로 앞
  const eyeT = 0.065;
  g.add(mesh(tubeZ(K.pivotR - 0.001, 0.14, zF, zF + eyeT, 0.006), iron));
  // 핀: 팔 뒤 머리 ~ 고리 앞
  g.add(mesh(cylZ(K.pivotR - 0.001, K.zArm - K.armT / 2 - 0.035, zF + eyeT + 0.02, 0.004, 24), darkSteel()));
  g.add(mesh(cylZ(0.085, K.zArm - K.armT / 2 - 0.04, K.zArm - K.armT / 2 - 0.017, 0.004, 24), darkSteel()));
  // 기둥(위가 넓은 사다리꼴 판)과 발판
  const col: V2[] = [
    [-0.075, -height + 0.04],
    [0.075, -height + 0.04],
    [0.105, -0.1],
    [-0.105, -0.1]
  ];
  g.add(meshAt(extrude(shapeFrom(col), eyeT, 0.006, 4), iron, 0, 0, zF + eyeT / 2));
  g.add(box(0.36, 0.04, 0.3, iron, 0, -height + 0.02, zF + eyeT / 2));
  g.add(pinMark('fulcrumPin', 0, 0, 0));
  setMM(g, { kind: 'support', fn: 'fulcrum137', height });
  return g;
}

/**
 * 밸브 막대: 원점 = 아래 롤러 핀 중심(로컬 z = 0 이 캠 평면). 갈래 끝(핀을 꿴 띠쇠, 롤러 앞) + 턱 + 아래로 len 만큼의 둥근 막대.
 * 늘 세로로 서 있고 원점이 핀을 따라간다. 핀 표식 child 'rodEye'.
 */
export function valveRod137(len: number): THREE.Group {
  const K = K137;
  const g = new THREE.Group();
  const z = K.zRod;
  const strap = stadiumShape(0, 0, 0, -0.27, 0.062);
  strap.holes.push(circlePath(0, 0, K.pinR));
  g.add(meshAt(extrude(strap, K.rodT, 0.006, 12), steel(), 0, 0, z));
  g.add(meshAt(cylY(0.07, -0.37, -0.3, 0.008), darkSteel(), 0, 0, z));
  g.add(meshAt(cylY(0.042, -len, -0.36, 0.004), steel(), 0, 0, z));
  g.add(pinMark('rodEye', 0, 0, 0));
  setMM(g, { kind: 'rod', fn: 'valveRod137', length: len });
  return g;
}

// ════════════════════════════ 138 바닥 캠으로 움직이는 막대 ════════════════════════════

/** 138 치수. 원점 = 캠 축. 로컬 z = 0 이 캠 판·막대의 가운데 평면, 원판은 그 뒤 */
export const K138 = {
  /** 원판 반지름 */
  R: 0.75,
  discT: 0.05,
  /** 캠 판 폭(z) */
  camW: 0.1,
  /** 막대(네모) 반폭, 깊이, 길이(끝 둥근 코의 중심에서 꼭대기까지) */
  rodHalf: 0.045,
  rodD: 0.09,
  rodLen: 1.4,
  /** 막대 끝: 둥근 코 반지름, 뾰족하게 깎은 길이 */
  tipR: 0.025,
  taper: 0.13,
  hubR: 0.2,
  shaftR: 0.11
} as const;

/**
 * 캠 윤곽의 마디(각도°, 반지름/R): 꼭지 A(28°)·C(180°)·D(289°), 골 N1(90°)·K(242°)·N2(328°). 판화에서 잰 값.
 * 구간마다 낮은 쪽 마디에서 잰 각 비율 v 로 r = rLow + (rHigh − rLow)·v^p.
 */
const CAM138: { a0: number; a1: number; r0: number; r1: number; p: number }[] = [
  { a0: 28, a1: 90, r0: 0.97, r1: 0.37, p: 1.3 },
  { a0: 90, a1: 180, r0: 0.37, r1: 0.97, p: 1.3 },
  { a0: 180, a1: 242, r0: 0.97, r1: 0.45, p: 1.7 },
  { a0: 242, a1: 289, r0: 0.45, r1: 0.74, p: 1.4 },
  { a0: 289, a1: 328, r0: 0.74, r1: 0.56, p: 1.3 },
  { a0: 328, a1: 388, r0: 0.56, r1: 0.97, p: 1.0 }
];

/** 캠 반지름 r(φ) — φ 는 캠 로컬 +x 에서 반시계(rad) */
export function camRadius138(phi: number): number {
  let d = pmod(phi / DEG, 360);
  if (d < 28) d += 360;
  for (const s of CAM138) {
    if (d < s.a0 || d > s.a1) continue;
    const u = (d - s.a0) / (s.a1 - s.a0);
    const rising = s.r1 > s.r0;
    const v = rising ? u : 1 - u;
    const lo = rising ? s.r0 : s.r1;
    const hi = rising ? s.r1 : s.r0;
    return K138.R * (lo + (hi - lo) * Math.pow(v, s.p));
  }
  return K138.R * 0.97;
}

/** 캠 윤곽(반시계). n 은 360 의 배수(마디 각이 꼭짓점이 되게) */
export function camOutline138(n = 1440): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = camRadius138(a);
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

/** 막대 끝의 밑면 높이 b(x) (둥근 코의 중심 기준, |x| ≤ rodHalf): 코의 원호 → 접선으로 깎인 빗면 */
function tipProfile138(): { xt: number; yt: number; slope: number } {
  const K = K138;
  // 바깥 점 E = (rodHalf, taper) 에서 원(반지름 tipR)에 그은 접선의 접점(아래쪽)
  const d = Math.hypot(K.rodHalf, K.taper);
  const base = Math.atan2(K.taper, K.rodHalf);
  const ang = base - Math.acos(K.tipR / d); // 접점의 방향각
  const xt = K.tipR * Math.cos(ang);
  const yt = K.tipR * Math.sin(ang);
  return { xt, yt, slope: (K.taper - yt) / (K.rodHalf - xt) };
}
const TIP138 = tipProfile138();
function tipBottom138(x: number): number {
  const ax = Math.abs(x);
  if (ax <= TIP138.xt) return -Math.sqrt(K138.tipR * K138.tipR - ax * ax);
  return TIP138.yt + TIP138.slope * (ax - TIP138.xt);
}

/** 막대 윤곽(반시계). 원점 = 끝 둥근 코의 중심 */
export function followerOutline138(): V2[] {
  const K = K138;
  const a0 = Math.atan2(TIP138.yt, TIP138.xt);
  const nose = arc(0, 0, K.tipR, Math.PI - a0, a0 + TAU, 12).map(([x, y]): V2 => [x, y]);
  return [...nose, [K.rodHalf, K.taper], [K.rodHalf, K.rodLen], [-K.rodHalf, K.rodLen], [-K.rodHalf, K.taper]];
}

/**
 * 캠 각 c(rotation.z, 반시계)일 때 막대 끝(둥근 코의 중심)의 높이(축 기준).
 * 막대는 축 바로 위의 세로선을 따라 움직이고 제 무게로 캠에 얹힌다 → 캠 윤곽에 닿는 가장 낮은 자리.
 */
export function followerLift138(c: number): number {
  const K = K138;
  const win = Math.asin(Math.min(1, (K.rodHalf + 0.002) / (0.37 * K.R))) + 0.02;
  const N = 400;
  let best = -1e9;
  for (let i = 0; i <= N; i++) {
    const w = Math.PI / 2 - win + (2 * win * i) / N; // 세계 방향각
    const r = camRadius138(w - c);
    const x = r * Math.cos(w);
    if (Math.abs(x) > K.rodHalf) continue;
    const y = r * Math.sin(w) - tipBottom138(x);
    if (y > best) best = y;
  }
  // 꼭지(뾰족한 마디)는 표본 사이에 빠질 수 있으므로 따로 본다
  for (const s of CAM138) {
    const w = s.a0 * DEG + c;
    const r = K.R * s.r0;
    const x = r * Math.cos(w);
    const yy = r * Math.sin(w);
    if (yy > 0 && Math.abs(x) <= K.rodHalf) best = Math.max(best, yy - tipBottom138(x));
  }
  return best;
}

/** 캠의 최소·최대 반지름 */
export const K138_R = { min: 0.37 * K138.R, max: 0.97 * K138.R } as const;

/**
 * 원판 + 그 앞면의 캠 판 + 허브. 원점 = 축, 로컬 z = 0 이 캠 판의 가운데 평면(원판은 z −camW/2 − discT ~ −camW/2).
 * rotation.z = c. userData.outline = 캠 윤곽.
 */
export function camDisc138(): THREE.Group {
  const K = K138;
  const g = new THREE.Group();
  const zb = -K.camW / 2;
  g.add(mesh(tubeZ(K.shaftR - 0.002, K.R, zb - K.discT, zb, 0.008, 96), castIron()));
  const outline = camOutline138();
  const s = shapeFrom(outline);
  s.holes.push(circlePath(0, 0, K.shaftR - 0.002));
  g.add(mesh(extrude(s, K.camW, 0.006, 8), bronze({ roughness: 0.36 })));
  g.add(mesh(tubeZ(K.shaftR - 0.002, K.hubR, K.camW / 2 - 0.002, K.camW / 2 + 0.03, 0.006), darkSteel()));
  // 표시: 가장 낮은 골(로컬 +y)에 노란 줄
  g.add(box(0.016, 0.06, 0.008, paint(MARK), 0, K.hubR + 0.04, K.camW / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', fn: 'camDisc138', rMin: K138_R.min, rMax: K138_R.max, discR: K.R });
  return g;
}

/** 끝이 뾰족한 네모 막대. 원점 = 끝 둥근 코의 중심, 위(+y)로 rodLen. userData.outline = 윤곽 */
export function follower138(): THREE.Group {
  const K = K138;
  const g = new THREE.Group();
  const outline = followerOutline138();
  g.add(mesh(extrude(shapeFrom(outline), K.rodD, 0.004, 6), steel()));
  g.add(box(2 * K.rodHalf + 0.004, 0.03, K.rodD + 0.004, paint(MARK), 0, K.rodLen - 0.06, 0));
  g.userData.outline = outline;
  setMM(g, { kind: 'follower', fn: 'follower138', length: K.rodLen, axis: 'y' });
  return g;
}

// ════════════════════════════ 139 내부 랙 틀과 피니언 ════════════════════════════

/**
 * 139 치수. 좌표 원점 = 피니언 축(고정). 틀 로컬 원점 = 틀 구멍의 한가운데, 랙 판 로컬 원점 = 이 고리의 한가운데.
 * 이 고리의 피치선 = 스타디움(직선 길이 S, 끝 반원 반지름 rho). 로컬 z = 0 이 피니언·랙 판·틀의 가운데 평면.
 */
export const K139 = (() => {
  const Z = 12;
  const MOD = 0.044;
  const RP = (Z * MOD) / 2;
  const END = 9; // 끝 반원 하나의 이 수
  const RUN = 8; // 직선 한 줄의 이 수
  const RHO = END * MOD;
  const S = RUN * Math.PI * MOD;
  const E = RHO - RP;
  const plateHalfW = 1.09;
  const plateHalfH = 0.56;
  const clear = 0.004;
  const openHalfW = plateHalfW + clear;
  const openHalfH = plateHalfH + E + clear;
  const topBar = 0.12;
  const pivotY = openHalfH + topBar / 2;
  const qy = plateHalfH - 0.08;
  const crankA = 0.3;
  const qdx = 0.28;
  return {
    Z,
    MOD,
    RP,
    END,
    RUN,
    RHO,
    S,
    /** 피니언 중심이 랙 판 기준으로 도는 스타디움의 끝 반지름 = 랙 판이 위아래로 미끄러지는 거리의 절반 */
    E,
    /** 이 고리의 이 수, 한 주기의 피니언 각 */
    ringTeeth: 2 * (RUN + END),
    period: (2 * (S + Math.PI * E)) / RP,
    width: 0.09,
    plateHalfW,
    plateHalfH,
    clear,
    openHalfW,
    openHalfH,
    sideBar: 0.12,
    topBar,
    /** 아래 가로대(양옆으로 길게 뻗어 굴림대 위를 구르는 레일): 높이, 반길이 */
    railH: 0.16,
    railHalf: 1.48,
    frameT: 0.11,
    /** 틀 양옆의 짧은 막대(출력): 반지름, 길이 */
    stubR: 0.05,
    stubLen: 0.19,
    /** 굴림대: 반지름, 폭, x(±) */
    rollerR: 0.11,
    rollerW: 0.13,
    rollerX: 0.72,
    /** 벨 크랭크: 받침점(틀 로컬) 두 곳, 판 쪽 팔 a·이음대 쪽 팔 c·두 팔 사이 각 */
    pivotL: [-(openHalfW + 0.06), pivotY] as V2,
    pivotR: [0.45, pivotY] as V2,
    crankA,
    crankC: 0.34,
    crankD: 75 * DEG,
    /** 걸이 링크가 달리는 랙 판의 핀(판 로컬): 받침점에서 오른쪽으로 qdx, 판 가운데에서 위로 qy */
    qdx,
    qy,
    /** 걸이 링크 길이(판이 가운데 높이일 때 판 쪽 팔이 수평) */
    hang: Math.hypot(crankA - qdx, pivotY - qy),
    /** 링크 층의 z: 크랭크, 링크(걸이·이음대) */
    zCrank: 0.085,
    zLink: 0.125,
    linkT: 0.03,
    pinR: 0.022
  } as const;
})();

export interface State139 {
  /** 한 주기 안의 피니언 각(0 ~ period) */
  u: number;
  /** 지금 물린 곳 */
  seg: 'bottom' | 'left' | 'top' | 'right';
  /** 틀의 x(피니언 축 기준), 랙 판의 y(틀 기준, ±E) */
  x: number;
  y: number;
  /** 벨 크랭크 각(판 쪽 팔의 방향, 두 크랭크 공통), 걸이 링크의 방향각 */
  beta: number;
  hangAngle: number;
  /** 굴림대 회전각 */
  roll: number;
}

/** 랙 판의 높이 y(틀 기준) → 벨 크랭크 각 beta, 걸이 링크 방향각(크랭크 핀 A → 판의 핀 Q) */
export function linkage139(y: number): { beta: number; hangAngle: number } {
  const K = K139;
  const qx = K.qdx;
  const qyy = K.qy + y - K.pivotL[1];
  const d = Math.hypot(qx, qyy);
  const a1 = (K.crankA * K.crankA - K.hang * K.hang + d * d) / (2 * d);
  const beta = Math.atan2(qyy, qx) + Math.acos(Math.max(-1, Math.min(1, a1 / K.crankA)));
  const ax = K.crankA * Math.cos(beta);
  const ay = K.crankA * Math.sin(beta);
  return { beta, hangAngle: Math.atan2(qyy - ay, qx - ax) };
}

/**
 * 피니언 각 up(반시계, 0 에서 아래 줄 한가운데에 물림) → 틀·랙 판의 자리. 한 주기 = K139.period.
 * 랙 판 기준으로 피니언 중심은 끝 반지름 E 의 스타디움을 시계 방향으로 돈다:
 * 아래 줄(왼쪽으로) → 왼쪽 끝 반원(위로) → 윗줄(오른쪽으로) → 오른쪽 끝 반원(아래로).
 * 틀은 가로로만, 랙 판은 틀 안에서 세로로만 움직이므로 x = −(중심의 x), y = −(중심의 y).
 */
export function state139(up: number): State139 {
  const K = K139;
  const u = pmod(up, K.period);
  const uRun = K.S / K.RP;
  const uEnd = (Math.PI * K.E) / K.RP;
  let rx: number;
  let ry: number;
  let seg: State139['seg'];
  if (u < uRun / 2) {
    seg = 'bottom';
    rx = -K.RP * u;
    ry = -K.E;
  } else if (u < uRun / 2 + uEnd) {
    seg = 'left';
    const al = -Math.PI / 2 - ((u - uRun / 2) * K.RP) / K.E;
    rx = -K.S / 2 + K.E * Math.cos(al);
    ry = K.E * Math.sin(al);
  } else if (u < 1.5 * uRun + uEnd) {
    seg = 'top';
    rx = -K.S / 2 + K.RP * (u - uRun / 2 - uEnd);
    ry = K.E;
  } else if (u < 1.5 * uRun + 2 * uEnd) {
    seg = 'right';
    const al = Math.PI / 2 - ((u - 1.5 * uRun - uEnd) * K.RP) / K.E;
    rx = K.S / 2 + K.E * Math.cos(al);
    ry = K.E * Math.sin(al);
  } else {
    seg = 'bottom';
    rx = K.S / 2 - K.RP * (u - 1.5 * uRun - 2 * uEnd);
    ry = -K.E;
  }
  const x = -rx;
  const y = -ry;
  const l = linkage139(y);
  return { u, seg, x, y, beta: l.beta, hangAngle: l.hangAngle, roll: -x / K.rollerR };
}

/** 139 이 모양(랙): 이끝 높이·이뿌리 깊이(모듈 배수), 이끝 반폭·이뿌리 시작(피치 비율) */
const TOOTH139 = { ha: 0.9, hf: 1.25, tip: 0.105, root: 0.385 } as const;

/**
 * 랙 판의 이 고리 윤곽(구멍, 판 로컬, 반시계). 피치선 스타디움을 따라 호 길이로 고르게 이를 놓는다
 * (아래 줄 한가운데에 이 하나의 중심). 이는 안쪽(피니언 쪽)으로 난다.
 */
export function rackHole139(): V2[] {
  const K = K139;
  const T = TOOTH139;
  const m = K.MOD;
  const p = Math.PI * m;
  const total = 2 * K.S + 2 * Math.PI * K.RHO;
  // 호 길이 s(아래 줄 한가운데에서 +x 쪽으로, 반시계) → 피치선 위의 점과 바깥 법선
  const at = (sIn: number): { x: number; y: number; nx: number; ny: number } => {
    let s = pmod(sIn, total);
    if (s < K.S / 2) return { x: s, y: -K.RHO, nx: 0, ny: -1 };
    s -= K.S / 2;
    if (s < Math.PI * K.RHO) {
      const a = -Math.PI / 2 + s / K.RHO;
      return { x: K.S / 2 + K.RHO * Math.cos(a), y: K.RHO * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
    }
    s -= Math.PI * K.RHO;
    if (s < K.S) return { x: K.S / 2 - s, y: K.RHO, nx: 0, ny: 1 };
    s -= K.S;
    if (s < Math.PI * K.RHO) {
      const a = Math.PI / 2 + s / K.RHO;
      return { x: -K.S / 2 + K.RHO * Math.cos(a), y: K.RHO * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
    }
    s -= Math.PI * K.RHO;
    return { x: -K.S / 2 + s, y: -K.RHO, nx: 0, ny: -1 };
  };
  // 이 하나 안의 비율 f(−0.5 ~ 0.5, 0 = 이 중심) → 피치선에서 바깥으로 떨어진 거리(− = 안쪽 = 이끝)
  const prof = (f: number): number => {
    const a = Math.abs(f);
    if (a <= T.tip) return -T.ha * m;
    if (a >= T.root) return T.hf * m;
    return -T.ha * m + ((T.ha + T.hf) * m * (a - T.tip)) / (T.root - T.tip);
  };
  const F = [-0.5, -0.44, -T.root, -(T.root + T.tip) / 2, -T.tip, -0.05, 0, 0.05, T.tip, (T.root + T.tip) / 2, T.root, 0.44];
  const out: V2[] = [];
  for (let k = 0; k < K.ringTeeth; k++) {
    for (const f of F) {
      const q = at((k + f) * p);
      const d = prof(f);
      out.push([q.x + q.nx * d, q.y + q.ny * d]);
    }
  }
  return out;
}

/** 피니언 이 윤곽(인벌류트, 반시계). 각 0 에 이골 → −90°(아래)에도 이골 */
export function pinionOutline139(): V2[] {
  const K = K139;
  return involuteOutline(K.Z, K.RP + K.MOD, K.RP - 1.25 * K.MOD, Math.PI / K.Z);
}

/** 피니언(구동). 원점 = 축, rotation.z = 피니언 각. userData.outline. 노란 표시 */
export function pinion139(bore = 0.06): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  const outline = pinionOutline139();
  const w = K.width;
  const ra = K.RP + K.MOD;
  const c = 0.008;
  const layers = [
    { z: -w / 2, s: (ra - c) / ra, hs: 1 },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: (ra - c) / ra, hs: 1 }
  ];
  g.add(mesh(loft(outline, [circlePts(bore - 0.002, 32)], layers), brass()));
  g.add(mesh(tubeZ(bore - 0.002, bore + 0.04, w / 2 - 0.002, w / 2 + 0.02, 0.004), darkSteel()));
  g.add(box(0.07, 0.016, 0.008, paint(MARK), bore + 0.04 + 0.045, 0, w / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'pinion139', teeth: K.Z, module: K.MOD, internal: false, rp: K.RP, width: w, axis: 'z' });
  return g;
}

/**
 * 랙 판: 네모 판 + 긴 고리 꼴 안쪽 이(구멍) + 걸이 핀 2개. 원점 = 이 고리의 한가운데.
 * userData.outlines.hole = 이 고리 윤곽. 핀 표식 child 'pinQL'·'pinQR'(링크 층 z).
 */
export function rackPlate139(): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  const hole = rackHole139();
  const w = K.width;
  const rect: V2[] = [
    [-K.plateHalfW, -K.plateHalfH],
    [K.plateHalfW, -K.plateHalfH],
    [K.plateHalfW, K.plateHalfH],
    [-K.plateHalfW, K.plateHalfH]
  ];
  g.add(
    mesh(
      loft(rect, [hole], [
        { z: -w / 2, s: 1, hs: 1 },
        { z: w / 2, s: 1, hs: 1 }
      ]),
      bronze({ roughness: 0.4 })
    )
  );
  for (const [nm, px] of [
    ['pinQL', K.pivotL[0] + K.qdx],
    ['pinQR', K.pivotR[0] + K.qdx]
  ] as const) {
    g.add(meshAt(cylZ(K.pinR, w / 2 - 0.005, K.zLink + K.linkT / 2 + 0.012, 0.003, 16), darkSteel(), px, K.qy, 0));
    g.add(meshAt(cylZ(K.pinR + 0.016, w / 2 - 0.002, K.zLink - K.linkT / 2 - 0.002, 0.003, 16), darkSteel(), px, K.qy, 0));
    g.add(pinMark(nm, px, K.qy, K.zLink));
  }
  g.userData.outlines = { hole };
  setMM(g, { kind: 'gear', fn: 'rackPlate139', teeth: K.ringTeeth, module: K.MOD, internal: true, noncircular: true, width: w, axis: 'z' });
  return g;
}

/**
 * 직사각형 틀: 옆 기둥 2 + 위 가로대 + 아래 가로대(양옆으로 길게 뻗은 레일) + 양옆 짧은 막대(출력) + 벨 크랭크 받침 핀 2개.
 * 원점 = 틀 구멍의 한가운데. 가로로만 움직인다(position.x). 핀 표식 child 'pivotL'·'pivotR'(크랭크 층 z).
 */
export function frame139(): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  const iron = castIron();
  const t = K.frameT;
  const ow = K.openHalfW;
  const oh = K.openHalfH;
  for (const sx of [-1, 1]) {
    g.add(box(K.sideBar, 2 * oh + K.topBar, t, iron, sx * (ow + K.sideBar / 2), K.topBar / 2, 0));
    const x0 = sx * (ow + K.sideBar - 0.005);
    g.add(meshAt(cylX(K.stubR, Math.min(x0, x0 + sx * K.stubLen), Math.max(x0, x0 + sx * K.stubLen), 0.006), steel(), 0, 0, 0));
  }
  g.add(box(2 * ow, K.topBar, t, iron, 0, oh + K.topBar / 2, 0));
  g.add(box(2 * K.railHalf, K.railH, t, iron, 0, -oh - K.railH / 2, 0));
  for (const [nm, pv] of [
    ['pivotL', K.pivotL],
    ['pivotR', K.pivotR]
  ] as const) {
    g.add(meshAt(cylZ(K.pinR + 0.004, t / 2 - 0.005, K.zCrank + 0.03, 0.003, 16), darkSteel(), pv[0], pv[1], 0));
    g.add(meshAt(cylZ(K.pinR + 0.02, t / 2 - 0.002, K.zCrank - 0.016, 0.003, 16), darkSteel(), pv[0], pv[1], 0));
    g.add(pinMark(nm, pv[0], pv[1], K.zCrank));
  }
  setMM(g, { kind: 'frame', fn: 'frame139', stroke: K.S + 2 * K.E });
  return g;
}

/**
 * 벨 크랭크. 원점 = 받침점, 판 쪽 팔은 로컬 +X 로 crankA, 이음대 쪽 팔은 crankD 방향으로 crankC. rotation.z = beta.
 * 두께 0.03, 로컬 z = 0 이 크랭크 층의 가운데. 핀 표식 child 'pinA' + suffix·'pinU' + suffix(링크 층까지 앞으로 나온 핀의 끝).
 * suffix 로 왼쪽('L')·오른쪽('R') 크랭크의 표식 이름을 가른다.
 */
export function bellCrank139(suffix = ''): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  const ux = K.crankC * Math.cos(K.crankD);
  const uy = K.crankC * Math.sin(K.crankD);
  const dz = K.zLink - K.zCrank;
  g.add(mesh(extrude(stadiumShape(0, 0, K.crankA, 0, 0.036), 0.03, 0.004, 10), steel()));
  g.add(mesh(extrude(stadiumShape(0, 0, ux, uy, 0.036), 0.03, 0.004, 10), steel()));
  g.add(mesh(cylZ(0.05, -0.015, 0.015, 0.004, 24), steel()));
  for (const [nm, px, py] of [
    ['pinA', K.crankA, 0],
    ['pinU', ux, uy]
  ] as const) {
    g.add(meshAt(cylZ(K.pinR, 0.01, dz + K.linkT / 2 + 0.012, 0.003, 16), darkSteel(), px, py, 0));
    g.add(pinMark(nm + suffix, px, py, dz));
  }
  setMM(g, { kind: 'lever', fn: 'bellCrank139', pivot: [0, 0, 0] });
  return g;
}

/** 곧은 링크(걸이·이음대). 원점 = 한쪽 핀, 로컬 +X 로 length. 두께 linkT. 핀 표식 child 'endA'·'endB' */
export function link139(length: number): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  const s = stadiumShape(0, 0, length, 0, 0.032);
  s.holes.push(circlePath(0, 0, K.pinR), circlePath(length, 0, K.pinR));
  g.add(mesh(extrude(s, K.linkT, 0.004, 10), darkSteel()));
  g.add(pinMark('endA', 0, 0, 0), pinMark('endB', length, 0, 0));
  setMM(g, { kind: 'link', length });
  return g;
}

/** 레일을 받치는 굴림대(고정 축 위에서 돈다). 원점 = 축, rotation.z = 굴림 각. 노란 점 */
export function roller139(bore = 0.04): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  g.add(mesh(tubeZ(bore, K.rollerR, -K.rollerW / 2, K.rollerW / 2, 0.008, 48), steel()));
  g.add(mesh(tubeZ(bore, bore + 0.03, -K.rollerW / 2 - 0.012, K.rollerW / 2 + 0.012, 0.004, 32), darkSteel()));
  g.add(meshAt(cylZ(0.014, K.rollerW / 2 - 0.002, K.rollerW / 2 + 0.004, 0.001, 12), paint(MARK), K.rollerR * 0.72, 0, 0));
  setMM(g, { kind: 'roller', r: K.rollerR, width: K.rollerW });
  return g;
}
