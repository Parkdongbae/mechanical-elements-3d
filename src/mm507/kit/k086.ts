// 086·087·088 전용 키트 (설계표 086, 087, 088)
//   086 캠·갈고리 걸쇠로 펌프 줄을 끌어올리는 헐거운 바퀴 — 걸쇠·캠 윤곽, 멈춤 블록, A자 받침, 한 주기 시간표 state86
//   087 스스로 뒤집히는 운동 — 포크(원호 홈 가로대)·추 달린 레버·꺾쇠·연결 막대·스터드, 4절 링크와 시간표 reverse87
//   088 달팽이 캠과 멈춤쇠 원판(간헐 회전) — 캠 윤곽·멈춤쇠 원판·치우친 보스, 접촉 풀이 state88
// 모델은 '../kit/k086' 에서 직접 import 한다(kit/index.ts 에는 넣지 않는다).
// 치수와 식은 shots/_verify/s086.mjs · s087.mjs · s088.mjs 에서 다각형 침범을 재서 정했다(검사: shots/_verify/t086kit.ts).
import * as THREE from 'three';
import { bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, circlePath, circlePts, extrude, kidneyPath, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function rot(p: V2, a: number): V2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}
const add2 = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const sub2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const pol = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 각을 (−π, π] 로 */
function wrapPi(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}
/** Z 방향 원통(로컬 z0 → z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.004): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, 0, z1 - z0, c, c), 28);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  return g;
}

// ═════════════════════════ 086 캠·갈고리 걸쇠·헐거운 바퀴 ═════════════════════════
// 좌표: 바퀴 중심 원점, y 위. 캠(축)은 시계 방향으로 theta 만큼, 바퀴는 시계 방향으로 alpha 만큼 돈다.
// 걸쇠는 바퀴 테의 받침 핀 P 둘레로 바퀴에 대해 반시계 psi 만큼 들린다(갈고리가 바깥으로).

const P86 = pol(0.44, 177);
const K86pt = pol(0.36, 117.5);
const N86 = pol(0.27, 115);
const U86: V2 = ((): V2 => {
  const d = sub2(K86pt, P86);
  const l = Math.hypot(d[0], d[1]);
  return [d[0] / l, d[1] / l];
})();
const PN86 = sub2(N86, P86);
const LPN86 = Math.hypot(PN86[0], PN86[1]);
/** 캠이 미는 방향(받침 핀 → 코) */
const NV86: V2 = [PN86[0] / LPN86, PN86[1] / LPN86];
/** 캠 면 방향 = 코가 받침 핀 둘레로 움직이는 방향 */
const MV86: V2 = [-NV86[1], NV86[0]];

/** 086 치수(바퀴 중심 기준). S = 멈춤 블록의 닿는 모서리, psiC = 코가 캠 끝을 벗어나는 걸쇠 각 */
export const K86 = {
  /** 바퀴: pulley(0.5, { width: 0.12, spokes: 4 }) — 줄 중심 반지름 */
  wheelR: 0.5,
  ropeR: 0.51,
  /** 걸쇠 받침 핀(바퀴 로컬, 쉼 자세) */
  pin: P86,
  /** 걸쇠 막대 반폭·꼬리 길이(받침 핀 → 꼬리 끝) */
  hw: 0.028,
  tail: 0.56,
  /** 코(둥근 발톱 끝) 중심·반지름 */
  nose: N86,
  noseR: 0.036,
  /** 캠 끝 반지름·허브 반지름 */
  camTip: 0.29,
  camHub: 0.11,
  /** 끌고 도는 각(rad) = 115° */
  delta: 115 * D2R,
  /** 되돌아가는 데 쓰는 구동각(rad) */
  ret: 1.3,
  /** 멈춤 블록 모서리 높이 */
  stopY: 0.76,
  /** 타고 넘을 때 더 들어 주는 여유(rad) */
  margin: 0.05,
  /** 줄을 매는 자리(바퀴 로컬 각, rad) = 150° */
  ropeAt: 150 * D2R
} as const;

const BETA86 = Math.atan2(-U86[1], -U86[0]); // 꼬리 방향(쉼 자세)
const F86 = sub2(N86, [NV86[0] * K86.noseR, NV86[1] * K86.noseR]); // 코가 캠 면에 닿는 점

function onFace86(rad: number): V2 {
  const b = F86[0] * MV86[0] + F86[1] * MV86[1];
  const c = F86[0] ** 2 + F86[1] ** 2 - rad * rad;
  const s = -b + Math.sqrt(b * b - c);
  return [F86[0] + s * MV86[0], F86[1] + s * MV86[1]];
}

/** 캠 윤곽(축 중심 원점, theta = 0 곧 걸쇠에 막 걸린 자세). 끝 → 미는 면 뿌리 → 허브 원 → 뒷변 뿌리. 그룹 rotation.z = −theta */
export function camOutline86(): V2[] {
  const tip = onFace86(K86.camTip);
  const root = onFace86(K86.camHub);
  const a0 = Math.atan2(root[1], root[0]);
  const a1 = Math.atan2(tip[1], tip[0]) + 42 * D2R - TAU;
  const pts: V2[] = [tip, root];
  for (let i = 1; i <= 40; i++) {
    const a = a0 + ((a1 - a0) * i) / 40;
    pts.push([K86.camHub * Math.cos(a), K86.camHub * Math.sin(a)]);
  }
  return pts;
}

function hit86(q: V2, d: V2, o: V2, e: V2): V2 {
  const den = d[0] * e[1] - d[1] * e[0];
  const t = ((o[0] - q[0]) * e[1] - (o[1] - q[1]) * e[0]) / den;
  return [q[0] + d[0] * t, q[1] + d[1] * t];
}

/** 걸쇠 윤곽 — 바퀴 로컬(쉼 자세, psi = 0). 꼬리 끝 → 안쪽 변 → 발톱(캠 면과 나란한 옆면 + 둥근 코) → 바깥 변 */
function catchWheelLocal86(): V2[] {
  const w = K86.hw;
  const nrm: V2 = [-U86[1], U86[0]];
  const inner = nrm[0] * P86[0] + nrm[1] * P86[1] > 0 ? -1 : 1;
  const In: V2 = [nrm[0] * w * inner, nrm[1] * w * inner];
  const Out: V2 = [-In[0], -In[1]];
  const T: V2 = add2(P86, [-U86[0] * K86.tail, -U86[1] * K86.tail]);
  const fl = sub2(N86, [NV86[0] * K86.noseR, NV86[1] * K86.noseR]);
  const fr = add2(N86, [NV86[0] * K86.noseR, NV86[1] * K86.noseR]);
  const i1 = hit86(fl, MV86, add2(P86, In), U86);
  const o1 = hit86(fr, MV86, add2(P86, Out), U86);
  const pts: V2[] = [add2(T, In), i1, fl];
  const a0 = Math.atan2(-NV86[1], -NV86[0]);
  const am = Math.atan2(-MV86[1], -MV86[0]);
  const sg = wrapPi(am - a0) > 0 ? 1 : -1;
  for (let i = 1; i < 12; i++) {
    const a = a0 + (sg * Math.PI * i) / 12;
    pts.push(add2(N86, [K86.noseR * Math.cos(a), K86.noseR * Math.sin(a)]));
  }
  pts.push(fr, o1, add2(T, Out));
  return pts;
}

/** 걸쇠 윤곽 — 받침 핀이 원점인 걸쇠 로컬(쉼 자세). 걸쇠 그룹은 바퀴 그룹의 자식, position = K86.pin, rotation.z = psi */
export function catchOutline86(): V2[] {
  return catchWheelLocal86().map((p) => sub2(p, P86));
}

/** 꼬리 앞변이 멈춤 블록 모서리 S 에 닿을 때의 걸쇠 각(닿지 않으면 0). alpha = 바퀴가 시계 방향으로 돈 각 */
function psiStop86(alpha: number, S: V2): number {
  const pw = rot(P86, -alpha);
  const v = sub2(S, pw);
  const D = Math.hypot(v[0], v[1]);
  const g = Math.atan2(v[1], v[0]);
  const beta = g + Math.asin(K86.hw / D);
  const psi = wrapPi(beta - (BETA86 - alpha));
  const proj = D * Math.cos(g - beta);
  return proj > 0 && proj <= K86.tail ? Math.max(0, psi) : 0;
}

/** 코가 캠 끝 반지름 밖으로 다 나오는 걸쇠 각: 코 원의 가장 안쪽 점(중심 반지름 − noseR)이 camTip 이 되는 각(이분법, 한 번만) */
const PSI_C86 = ((): number => {
  const clear = (psi: number): number => {
    const n = add2(P86, rot(sub2(N86, P86), psi));
    return Math.hypot(n[0], n[1]) - K86.noseR - K86.camTip;
  };
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (clear(m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
})();

/** 멈춤 블록의 닿는 모서리(왼쪽 아래 모서리) — alpha = delta, psi = psiC 일 때 꼬리 앞변 위에서 y = stopY 인 점 */
const S86: V2 = ((): V2 => {
  const pd = rot(P86, -K86.delta);
  const bd = BETA86 - K86.delta + PSI_C86;
  const ud: V2 = [Math.cos(bd), Math.sin(bd)];
  const e0: V2 = [pd[0] + ud[1] * K86.hw, pd[1] - ud[0] * K86.hw];
  const t = (K86.stopY - e0[1]) / ud[1];
  return [e0[0] + ud[0] * t, K86.stopY];
})();

/** 086 에서 계산으로 나온 값: 멈춤 블록 모서리 S(바퀴 중심 기준), 풀림 각 psiC, 꼬리 방향 beta0, 꼬리 끝(쉼 자세) */
export const D86 = {
  stop: S86,
  psiC: PSI_C86,
  beta0: BETA86,
  tailTip: add2(P86, [-U86[0] * K86.tail, -U86[1] * K86.tail]) as V2,
  elbow: K86pt
} as const;

export interface State86 {
  /** 구동각을 한 바퀴로 접은 값(0 = 캠이 걸쇠에 막 걸림) */
  tau: number;
  /** 바퀴가 쉼 자세에서 시계 방향으로 돈 각 — wheel.rotation.z = −alpha */
  alpha: number;
  /** 걸쇠가 바퀴에 대해 반시계로 들린 각 — catch.rotation.z = psi */
  psi: number;
  /** 줄(추)이 올라간 높이 = ropeR × alpha */
  lift: number;
  phase: 'drag' | 'return' | 'rest';
}

/**
 * 086 한 주기(구동각 2π) 시간표. theta = 캠 축의 구동각(cam.rotation.z = −theta).
 *  0 ~ delta: 캠이 갈고리를 끌고 바퀴와 같이 돈다(alpha = tau). 끝 무렵 꼬리가 멈춤 블록에 닿아 걸쇠가 들린다(psiStop).
 *  delta ~ delta + ret: 걸쇠가 풀려 바퀴가 추 무게로 되돌아간다(매끄러운 곡선). 코는 캠 끝을 타고 넘은 뒤 제자리로.
 *  나머지: 바퀴는 쉬고 캠만 돌아 다음 바퀴에서 다시 건다.
 */
export function state86(theta: number): State86 {
  const tau = ((theta % TAU) + TAU) % TAU;
  const hold = PSI_C86 + K86.margin;
  let alpha = 0;
  let psi = 0;
  let phase: State86['phase'] = 'rest';
  if (tau < K86.delta) {
    alpha = tau;
    psi = psiStop86(alpha, S86);
    phase = 'drag';
  } else if (tau < K86.delta + K86.ret) {
    const t = tau - K86.delta;
    alpha = K86.delta * (1 - smooth(t / K86.ret));
    const up = Math.min(hold, PSI_C86 + t * 2);
    const down = 1 - smooth((t - 0.55) / 0.5);
    psi = Math.max(psiStop86(alpha, S86), up * down);
    phase = 'return';
  }
  return { tau, alpha, psi, lift: K86.ropeR * alpha, phase };
}

/** 갈고리 걸쇠(판화 86 의 B): 원점 = 받침 핀, 평면 XY, z 가운데. 강철 판 + 핀 머리. userData.outline(침범 검사) */
export function hookCatch86(thick = 0.045): THREE.Group {
  const outline = catchOutline86();
  const g = new THREE.Group();
  const plate = mesh(extrude(shapeFrom(outline), thick, 0.006), steel({ roughness: 0.4 }));
  plate.userData.outline = outline;
  g.add(plate);
  g.add(mesh(cylZ(0.04, -thick / 2 - 0.012, thick / 2 + 0.012), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.012, 0.008), paint(MARK), -U86[0] * 0.3, -U86[1] * 0.3, thick / 2 + 0.002).rotateZ(BETA86));
  setMM(g, { kind: 'lever', fn: 'hookCatch86', pivot: [0, 0, 0] });
  return g;
}

/** 끄는 캠(판화 86 의 C): 원점 = 축 중심, theta = 0 자세. 청동 판 + 허브. rotation.z = −theta. userData.outline */
export function dragCam86(thick = 0.045): THREE.Group {
  const outline = camOutline86();
  const g = new THREE.Group();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.044));
  const plate = mesh(extrude(shape, thick, 0.006), bronze({ roughness: 0.34 }));
  plate.userData.outline = outline;
  g.add(plate);
  const hub = lathe(tubeProfile(0.044, 0.075, -thick / 2 - 0.02, thick / 2 + 0.02, 0.006), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  setMM(g, { kind: 'cam', fn: 'dragCam86', tip: K86.camTip });
  return g;
}

/**
 * 멈춤 블록(판화 86 의 위쪽 빗금 네모): 원점 = 걸쇠 꼬리가 닿는 왼쪽 아래 모서리, x 0~w, y 0~h, z0~z1(로컬).
 * 들보 앞면에서 걸쇠 평면까지 앞으로 나온 네모 막대. userData.outline
 */
export function stopBlock86(z0: number, z1: number, w = 0.16, h = 0.12): THREE.Mesh {
  const outline: V2[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const m = mesh(extrude(shapeFrom(outline), z1 - z0, 0.004), castIron());
  m.geometry.translate(0, 0, (z0 + z1) / 2);
  m.userData.outline = outline;
  setMM(m, { kind: 'stop', fn: 'stopBlock86' });
  return m;
}

/**
 * A자 받침(판화 86): 원점 = 축받이 중심. 꼭대기 네모 축받이 몸(반폭 0.13) + 아래로 벌어지는 두 다리 + 밑 가로대(y = −height).
 * 가운데 세모 구멍. 두께 thick, z 가운데 0. 주철.
 */
export function aFrame86(height: number, halfBase: number, thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const top = 0.13;
  const leg = 0.085;
  const yb = -height;
  const outer: V2[] = [
    [-top, 0.1], [top, 0.1], [top, -0.1], [halfBase, yb + 0.06], [halfBase + 0.06, yb + 0.06], [halfBase + 0.06, yb], [-halfBase - 0.06, yb], [-halfBase - 0.06, yb + 0.06], [-halfBase, yb + 0.06], [-top, -0.1]
  ];
  const shape = shapeFrom(outer);
  const k = (halfBase - top) / (height - 0.16); // 다리 기울기(dx/dy)
  const yTop = -0.3;
  const yBot = yb + 0.14;
  const xi = (y: number): number => top + k * (-0.1 - y) - leg / Math.cos(Math.atan(k));
  const hole = new THREE.Path();
  hole.moveTo(-Math.max(0.02, xi(yTop)), yTop);
  hole.lineTo(-xi(yBot), yBot);
  hole.lineTo(xi(yBot), yBot);
  hole.lineTo(Math.max(0.02, xi(yTop)), yTop);
  hole.closePath();
  shape.holes.push(hole);
  shape.holes.push(circlePath(0, 0, 0.05));
  g.add(mesh(extrude(shape, thick, 0.006), castIron()));
  const boss = lathe(tubeProfile(0.05, 0.085, -thick / 2 - 0.015, thick / 2 + 0.015, 0.006), 32);
  boss.rotateX(Math.PI / 2);
  g.add(mesh(boss, darkSteel()));
  return g;
}

// ═════════════════════════ 088 달팽이 캠 + 멈춤쇠 원판 ═════════════════════════
// 풀이는 "거울 평면"(y 를 뒤집어 캠이 반시계로 도는 좌표)에서 하고, 내보내는 값만 실제(캠 시계) 좌표로 바꾼다.

/** 088 치수. 원점 = 캠 축. 원판 B 의 중심은 축에서 +x 로 e 만큼 치우쳐 있다 */
export const K88 = {
  /** 원판 B 중심의 치우침(+x) */
  e: 0.08,
  /** 멈춤쇠 중심 반지름(B 중심 기준)·반변(정사각형 한 변 = 2h) */
  rho: 0.7,
  h: 0.07,
  /** 캠 턱 끝·뿌리 반지름 */
  rMax: 0.7,
  rMin: 0.52,
  /** 턱 끝에서 뒤로 이 각(rad)까지 반지름이 rMax → rMin 으로 줄어든다 = 200° */
  a1: 200 * D2R,
  /** 원판 B 반지름·가운데 구멍(치우친 보스) 반지름 */
  discR: 0.9,
  bossR: 0.21
} as const;

function camR88(a: number): number {
  if (a >= K88.a1) return K88.rMin;
  return K88.rMin + ((K88.rMax - K88.rMin) * (1 + Math.cos((a / K88.a1) * Math.PI))) / 2;
}

/** (거울 평면) 턱 면 방향이 phi 일 때, 그 앞에 놓인 멈춤쇠 중심이 있어야 할 가장 작은 각 b. 닿을 수 없으면 null */
function contactB88(phi: number): number | null {
  let best: number | null = null;
  const take = (b: number): void => {
    if (best === null || wrapPi(b - best) > 0) best = b;
  };
  for (const dr of [-K88.h, K88.h]) {
    // 멈춤쇠 뒷변의 두 모서리가 턱 면(축에서 나가는 반직선) 위에 놓이는 경우
    const ri = Math.hypot(K88.rho + dr, K88.h);
    const bi = -Math.atan2(K88.h, K88.rho + dr);
    const x = (K88.e * Math.sin(phi)) / ri;
    if (Math.abs(x) > 1) continue;
    const beta = phi + Math.asin(x);
    const px = K88.e + ri * Math.cos(beta);
    const py = ri * Math.sin(beta);
    const d = Math.hypot(px, py);
    if (d <= K88.rMax && d >= K88.rMin && px * Math.cos(phi) + py * Math.sin(phi) > 0) take(beta - bi);
  }
  // 턱 끝점이 멈춤쇠 뒷변 위에 놓이는 경우
  const vx = K88.rMax * Math.cos(phi) - K88.e;
  const vy = K88.rMax * Math.sin(phi);
  const vl = Math.hypot(vx, vy);
  const g = Math.atan2(vy, vx);
  const b2 = g + Math.asin(K88.h / vl);
  const rad = vl * Math.cos(g - b2);
  if (rad >= K88.rho - K88.h && rad <= K88.rho + K88.h) take(b2);
  return best;
}

/** 088 정상 상태의 걸림·풀림(거울 평면 각, rad): 풀리는 멈춤쇠 각 bE, 걸리는 멈춤쇠 각 bS = bE + π, 걸릴 때·풀릴 때 턱 면 각, 처음 자세의 턱 면 각 phi0 */
const D88i = ((): { bE: number; bS: number; phiS: number; span: number; phi0: number } => {
  // 풀림: 안쪽 뒷모서리가 축에서 rMax 가 되는 각(먼 쪽으로 가는 길)
  const ri = Math.hypot(K88.rho - K88.h, K88.h);
  const bi = -Math.atan2(K88.h, K88.rho - K88.h);
  const betaE = -Math.acos((K88.rMax ** 2 - K88.e ** 2 - ri ** 2) / (2 * K88.e * ri));
  const bE = betaE - bi;
  const phiE = Math.atan2(ri * Math.sin(betaE), K88.e + ri * Math.cos(betaE));
  const bS = bE + Math.PI;
  // 걸림: 멈춰 있는 멈춤쇠(bS)의 뒷변 두 모서리 가운데 턱 면이 먼저 만나는 쪽
  let phiS = Infinity;
  for (const dr of [-K88.h, K88.h]) {
    const r = Math.hypot(K88.rho + dr, K88.h);
    const b = bS - Math.atan2(K88.h, K88.rho + dr);
    const px = K88.e + r * Math.cos(b);
    const py = r * Math.sin(b);
    if (Math.hypot(px, py) > K88.rMax) continue;
    let a = Math.atan2(py, px);
    while (a < phiE) a += TAU; // phiE 뒤 한 바퀴 안
    a -= TAU;
    // a 는 (phiE − 2π, phiE] — 그 가운데 가장 작은(먼저 닿는) 각
    phiS = Math.min(phiS, a);
  }
  const span = phiE - phiS;
  // 처음 자세: 밀리고 있는 멈춤쇠 중심이 정확히 왼쪽(b = π)
  let lo = phiS;
  let hi = phiS + 1.2;
  const f = (p: number): number => {
    const b = contactB88(p);
    return b === null ? 1 : wrapPi(b - Math.PI);
  };
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m;
    else lo = m;
  }
  return { bE, bS, phiS, span, phi0: (lo + hi) / 2 };
})();

/** 088 에서 계산으로 나온 값(도): 캠이 미는 구동각 spanDeg, 걸리는·풀리는 멈춤쇠의 실제 각(B 중심에서 +x 기준 반시계) */
export const D88 = {
  spanDeg: D88i.span / D2R,
  catchDeg: wrapPi(-D88i.bS) / D2R,
  releaseDeg: wrapPi(-D88i.bE) / D2R,
  /** theta = 0 은 걸린 뒤 이만큼(구동각, 도) 지난 자세 */
  startDeg: (D88i.phi0 - D88i.phiS) / D2R
} as const;

export interface State88 {
  /** 캠 그룹 rotation.z (= −theta, 시계) */
  cam: number;
  /** 원판 B 그룹 rotation.z (시계 쪽으로 음수가 쌓인다. 한 주기에 정확히 −π) */
  disc: number;
  /** 캠이 멈춤쇠를 밀고 있으면 'drive', 원판이 쉬면 'rest' */
  phase: 'drive' | 'rest';
  /** 이번 주기에 원판이 돈 각(도, 0~180) */
  advDeg: number;
}

/** 088 상태. theta = 캠 구동각(시계 방향으로 쌓인다). theta = 0 은 판화 자세(멈춤쇠 C 가 정확히 왼쪽에서 밀리는 중) */
export function state88(theta: number): State88 {
  const u = theta + D88i.phi0 - D88i.phiS;
  const N = Math.floor(u / TAU);
  const tau = u - N * TAU;
  let adv = Math.PI;
  let phase: State88['phase'] = 'rest';
  if (tau < D88i.span) {
    const b = contactB88(D88i.phiS + tau);
    if (b !== null) {
      adv = wrapPi(b - D88i.bS);
      if (adv < -1e-6) adv += TAU;
      adv = Math.min(Math.PI, Math.max(0, adv));
      phase = 'drive';
    }
  }
  const b0 = D88i.bS + N * Math.PI + adv; // 멈춤쇠 C 의 거울 평면 각(theta = 0 에서 π)
  return { cam: -theta, disc: -(b0 - Math.PI), phase, advDeg: adv / D2R };
}

/** 달팽이 캠 윤곽(실제 좌표, 축 중심 원점, theta = 0 자세): 턱 끝에서 시작해 반지름이 줄어드는 둘레를 돌아 턱 뿌리까지 */
export function snailOutline88(n = 240): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.min((i / n) * TAU, TAU - 1e-9);
    const r = camR88(a);
    const m = D88i.phi0 - a; // 거울 평면 방향
    out.push([r * Math.cos(m), -r * Math.sin(m)]);
  }
  return out;
}

/** 달팽이 캠 A(판화 88): 원점 = 축 중심, z 가운데. 청동 판 + 허브 + 표시선. rotation.z = state88().cam. userData.outline */
export function snailCam88(thick = 0.1): THREE.Group {
  const outline = snailOutline88();
  const g = new THREE.Group();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.05));
  const plate = mesh(extrude(shape, thick, 0.008), bronze({ roughness: 0.34 }));
  plate.userData.outline = outline;
  g.add(plate);
  const hub = lathe(tubeProfile(0.05, 0.12, -thick / 2 - 0.01, thick / 2 + 0.03, 0.008), 36);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.016, 0.008), paint(MARK), 0.3, 0, thick / 2 + 0.003));
  setMM(g, { kind: 'cam', fn: 'snailCam88', rMax: K88.rMax, rMin: K88.rMin });
  return g;
}

/**
 * 멈춤쇠 원판 B(판화 88): 원점 = 원판 중심(축에서 +x 로 K88.e), 원판 z ∈ [−thick, 0], 가운데 구멍 반지름 K88.bossR.
 * 앞면(z = 0)에 정사각 멈춤쇠 둘 — C 는 로컬 180°, D 는 0°, 반지름 K88.rho, 높이 stopLen(+z). 각 멈춤쇠 메시에 userData.outline.
 * rotation.z = state88().disc
 */
export function stopDisc88(thick = 0.08, stopLen = 0.12): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(circlePts(K88.discR, 96));
  shape.holes.push(circlePath(0, 0, K88.bossR));
  const disc = meshAt(extrude(shape, thick, 0.008), castIron({ roughness: 0.6 }), 0, 0, -thick / 2);
  g.add(disc);
  for (const [name, a] of [['stopC', Math.PI], ['stopD', 0]] as const) {
    const c: V2 = [K88.rho * Math.cos(a), K88.rho * Math.sin(a)];
    const outline: V2[] = [
      [c[0] - K88.h, c[1] - K88.h], [c[0] + K88.h, c[1] - K88.h], [c[0] + K88.h, c[1] + K88.h], [c[0] - K88.h, c[1] + K88.h]
    ];
    const m = meshAt(extrude(shapeFrom(outline), stopLen, 0.006), steel({ roughness: 0.4 }), 0, 0, stopLen / 2);
    m.name = name;
    m.userData.outline = outline;
    g.add(m);
  }
  // 표시: 회전이 보이게 테 가까이 밝은 줄
  g.add(meshAt(new THREE.BoxGeometry(0.014, 0.12, 0.008), paint(MARK), 0, K88.discR - 0.09, 0.003));
  setMM(g, { kind: 'disc', fn: 'stopDisc88', r: K88.discR });
  return g;
}

/**
 * 치우친 보스(판화에 없음 — 원판 B 를 캠 축과 다른 중심에서 돌게 받치는 고정 통): 원점 = 원판 B 중심.
 * 반지름 K88.bossR − 0.004 의 통(로컬 z0 → z1)에 캠 축이 지나는 구멍(중심 (−K88.e, 0), 반지름 shaftR + 0.006).
 */
export function eccentricBoss88(z0: number, z1: number, shaftR = 0.05): THREE.Mesh {
  const shape = shapeFrom(circlePts(K88.bossR - 0.004, 64));
  shape.holes.push(circlePath(-K88.e, 0, shaftR + 0.006));
  const m = mesh(extrude(shape, z1 - z0, 0.006), darkSteel());
  m.geometry.translate(0, 0, (z0 + z1) / 2);
  return m;
}

// ═════════════════════════ 087 스스로 뒤집히는 운동 ═════════════════════════
// 세계 좌표(정면 XY). 구동 베벨(축 Z) 반시계 theta. 가로축(X)의 각 sigma 는 +X 둘레(rotation.x).

/** 087 치수 */
export const K87 = {
  /** 구동 베벨 잇수·헐거운 베벨 B, C 잇수·모듈 */
  zDrive: 27,
  zBC: 18,
  /** 가로축 끝 피니언·바퀴 E 잇수 */
  zPinion: 10,
  zE: 20,
  module: 0.04,
  /** 가로축 높이·깊이, 구동 베벨 중심 x */
  ys: 1.75,
  zc: 0.3,
  x0: -1.25,
  /** 클러치 턱 수 */
  jaws: 12,
  /** 흔들 축 P(포크·추 레버의 받침) */
  P: [-1.25, 0.75] as V2,
  /** 추 레버: 받침 → 추 중심 길이, 받침 → 연결 막대 핀, 좌우 기울기(rad) = 30°, 스터드가 넘겨 주는 각 = 4° */
  LF: 0.58,
  aF: 0.2,
  phi0: 30 * D2R,
  phiF: 4 * D2R,
  ballR: 0.09,
  /** 꺾쇠 받침 G, 바퀴 E 중심 */
  G: [0.41, 1.345] as V2,
  Ec: [1.05, 1.75] as V2,
  /** 스터드: E 중심에서의 반지름·스터드 반지름 */
  rhoS: 0.27,
  rS: 0.035,
  /** 꺾쇠 위 팔: 반폭·길이, 아래 팔 길이 */
  hw: 0.03,
  La: 0.68,
  c: 0.44,
  /** 포크: 받침 → 클러치 홈 길이, 클러치 이동 ±x0, 턱 끝이 만나는 |x| */
  Lfork: 1.0,
  xMax: 0.105,
  xn: 0.065,
  /** 가로대 원호 홈의 중심 반지름(받침 P 기준) */
  slotR: 0.4,
  /** 클러치가 건너가는 구동각 */
  Sc: 0.12
} as const;

const k87 = K87.zDrive / K87.zBC;
const gk87 = (K87.zPinion / K87.zE) * k87;
const PSIM87 = Math.atan2(K87.Ec[1] - K87.G[1], K87.Ec[0] - K87.G[0]);
const KAPPA87 = -Math.PI / 2 - PSIM87;
const LR87 = Math.hypot(K87.G[0] - K87.P[0], K87.G[1] - K87.c - (K87.P[1] + K87.aF));
const CHI0_87 = Math.asin(K87.xMax / K87.Lfork);
const LAM87 = K87.phi0 - CHI0_87;
const D87c = K87.rS + K87.hw;

function circ2(c1: V2, r1: number, c2: V2, r2: number, pick: (q: V2) => number): V2 {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const D = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / D;
  const my = c1[1] + (a * dy) / D;
  const A: V2 = [mx - (h * dy) / D, my + (h * dx) / D];
  const B: V2 = [mx + (h * dy) / D, my - (h * dx) / D];
  return pick(A) > pick(B) ? A : B;
}
/** 추 레버의 연결 막대 핀(세계 좌표). phi = 레버 기울기(곧게 선 것에서 오른쪽 +) */
export function pinF87(phi: number): V2 {
  return [K87.P[0] + K87.aF * Math.sin(phi), K87.P[1] + K87.aF * Math.cos(phi)];
}
/** 꺾쇠 아래 팔 끝 핀(세계 좌표). psi = 위 팔의 방향각 */
export function pinW87(psi: number): V2 {
  return [K87.G[0] + K87.c * Math.cos(psi + KAPPA87), K87.G[1] + K87.c * Math.sin(psi + KAPPA87)];
}
function psiOfPhi87(phi: number): number {
  const W = circ2(K87.G, K87.c, pinF87(phi), LR87, (q) => -q[1]);
  return Math.atan2(W[1] - K87.G[1], W[0] - K87.G[0]) - KAPPA87;
}
function phiOfPsi87(psi: number): number {
  const Q = circ2(K87.P, K87.aF, pinW87(psi), LR87, (q) => q[1]);
  return Math.atan2(Q[0] - K87.P[0], Q[1] - K87.P[1]);
}
/** 스터드가 팔을 밀 때 위 팔의 방향각. side +1: 스터드가 팔 위(내리누름), −1: 아래(밀어 올림) */
function psiPush87(eps: number, side: number): number {
  const vx = K87.Ec[0] + K87.rhoS * Math.cos(eps) - K87.G[0];
  const vy = K87.Ec[1] + K87.rhoS * Math.sin(eps) - K87.G[1];
  return Math.atan2(vy, vx) - side * Math.asin(D87c / Math.hypot(vx, vy));
}
function solve87(f: (x: number) => number, lo0: number, hi0: number): number {
  let lo = lo0;
  let hi = hi0;
  for (let i = 0; i < 70; i++) {
    const m = (lo + hi) / 2;
    if (f(lo) * f(m) <= 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

interface Table87 {
  Sb: number; W: number; T: number; H: number; nu: number; tDis: number; tEng: number; tF: number; tH: number;
  e0: number; e1: number; tau1: number; tau2: number; v1: number; v2: number; theta00: number; fr: number;
  psiU: number; psiL: number; epsMin: number; epsMax: number;
}
const T87: Table87 = ((): Table87 => {
  const dGE = Math.hypot(K87.Ec[0] - K87.G[0], K87.Ec[1] - K87.G[1]);
  const tangUp = PSIM87 + Math.PI / 2 + Math.asin(K87.rhoS / dGE);
  const tangDn = PSIM87 - Math.PI / 2 - Math.asin(K87.rhoS / dGE) + TAU;
  const mid = PSIM87 + Math.PI;
  const psiU = psiOfPhi87(K87.phi0);
  const psiL = psiOfPhi87(-K87.phi0);
  const psiF1 = psiOfPhi87(-K87.phiF);
  const psiF2 = psiOfPhi87(K87.phiF);
  const eps1 = solve87((e) => psiPush87(e, 1) - psiU, tangUp, mid + 0.6);
  const epsF1 = solve87((e) => psiPush87(e, 1) - psiF1, tangUp, mid + 0.6);
  const eps2 = solve87((e) => psiPush87(e, -1) - psiL, tangDn, mid - 0.6) - TAU;
  const epsF2 = solve87((e) => psiPush87(e, -1) - psiF2, tangDn, mid - 0.6) - TAU;
  const fr = (K87.xMax - K87.xn) / (2 * K87.xMax);
  const nu = K87.Sc * (K87.xn / K87.xMax);
  // 한 주기 T 는 턱 피치에 맞춘다: k·T = (턱 피치)의 정수배 → 떨어지는 구간 Sb 로 조절
  const p = TAU / K87.jaws;
  let Sb = 0.12;
  const base = (s: number): number => (epsF1 - epsF2 + 2 * gk87 * (s + fr * K87.Sc)) / gk87;
  const unit = p / k87;
  const T0 = 2 * (base(Sb) + nu);
  const Tn = Math.ceil(T0 / unit - 1e-9) * unit;
  Sb += (Tn - T0) / 4;
  const W = base(Sb);
  const T = 2 * (W + nu);
  const epsMax = epsF1 + gk87 * (Sb + fr * K87.Sc);
  const epsMin = epsMax - gk87 * W;
  const H = W + nu;
  const tDis = W - fr * K87.Sc;
  const tEng = H - fr * K87.Sc;
  const tF = tDis - Sb - fr * K87.Sc;
  const tH = tF + Sb;
  const e0 = epsMax - gk87 * tDis;
  const e1 = epsMin + gk87 * tDis;
  const tau1 = (eps1 - e0) / gk87;
  const tau2 = (e1 - eps2) / gk87;
  const dphi = (e: number, side: number): number => (phiOfPsi87(psiPush87(e + 1e-5, side)) - phiOfPsi87(psiPush87(e - 1e-5, side))) / 2e-5;
  const v1 = Math.abs(dphi(epsF1, 1)) * gk87;
  const v2 = Math.abs(dphi(epsF2, -1)) * gk87;
  return { Sb, W, T, H, nu, tDis, tEng, tF, tH, e0, e1, tau1, tau2, v1, v2, theta00: -(tau1 - 0.6), fr, psiU, psiL, epsMin, epsMax };
})();

/** 087 에서 계산으로 나온 값 */
export const D87 = {
  /** 속도비: 가로축/구동 = ±k, 바퀴 E/가로축 = g */
  k: k87,
  g: K87.zPinion / K87.zE,
  /** 한 주기(구동각 rad)와 반 주기 */
  period: T87.T,
  half: T87.H,
  /** 연결 막대 길이(핀–핀) */
  rodLen: LR87,
  /** 꺾쇠 두 팔 사이각(아래 팔 방향 = 위 팔 방향 + kappa) */
  kappa: KAPPA87,
  /** 위 팔 쉼 자세 둘(rad) */
  psiU: T87.psiU,
  psiL: T87.psiL,
  /** 포크 끝 기울기(rad)와 가로대 홈의 반각(rad) — 홈 안에서 추 레버 핀이 헛도는 각 = ±lam */
  chi0: CHI0_87,
  lam: LAM87,
  /** 바퀴 E 스터드가 오가는 범위(세계 각, rad) */
  epsMin: T87.epsMin,
  epsMax: T87.epsMax,
  /**
   * 턱 위상: 헐거운 베벨에 붙이는 clawRing(k053) 의 phase(rad).
   * 조건 — B 는 rotation.y = +π/2, C 는 rotation.y = −π/2 인 그룹 안에서 roll(rotation.z) = rollB, rollC 로 돌고,
   * 발톱 링은 그 기어의 자식(로컬 +Z 쪽), 이중 클러치 doubleClutch(k053) 는 rotation.x = sigma.
   */
  phaseC: ((): number => {
    const p = TAU / K87.jaws;
    const c1 = -k87 * T87.theta00;
    return (((p / 2 + Math.PI / 4 - Math.PI / K87.zBC - c1) % p) + p) % p;
  })(),
  phaseB: ((): number => {
    const p = TAU / K87.jaws;
    const c2 = k87 * (T87.tDis - T87.fr * K87.Sc) + k87 * (T87.theta00 + T87.H);
    return (((c2 + (3 * Math.PI) / 4 - p / 2) % p) + p) % p;
  })()
} as const;

export interface State87 {
  /** 구동 베벨 rotation.z = theta */
  drive: number;
  /** 헐거운 베벨 B, C 의 roll(각자 그룹 안 rotation.z): 둘 다 −k·theta (+C 는 반 이 π/zBC) */
  rollB: number;
  rollC: number;
  /** 가로축·클러치·피니언의 rotation.x */
  sigma: number;
  /** 피니언 roll(rotation.y = +π/2 그룹 안 rotation.z) = sigma */
  rollPinion: number;
  /** 바퀴 E: 세계에서 반시계로 돈 각(스터드의 방향각, rad) */
  eps: number;
  /** 바퀴 E 의 roll(rotation.y = π 그룹 안 rotation.z) = −g·sigma + π/zE — 스터드는 E 로컬 각 studLocal 에 */
  rollE: number;
  /** 스터드 중심(세계 XY) */
  stud: V2;
  /** 추 레버 기울기(오른쪽 +): lever.rotation.z = −phi */
  phi: number;
  /** 포크 기울기(오른쪽 +): fork.rotation.z = −chi */
  chi: number;
  /** 클러치 중심의 x 이동(+ = C 쪽) */
  x: number;
  /** 꺾쇠 위 팔 방향각: bellCrank.rotation.z = psi */
  psi: number;
  /** 연결 막대 양 끝 핀(세계 XY)과 막대 방향각 */
  pinF: V2;
  pinW: V2;
  rodAngle: number;
  engaged: 'B' | 'C' | 'none';
  phase: 'run' | 'push' | 'fall' | 'shift';
  /** 가로축 회전 방향(+1 = C 에 걸려 +X 둘레 양의 방향, −1 = B, 0 = 중립) */
  dir: number;
}

/** 바퀴 E 의 스터드가 놓이는 E 로컬 각(rad): 그룹 rotation.y = π 안에서 잰 각. 세계 각 eps = π − (studLocal + rollE) */
export const STUD_LOCAL87 = ((): number => {
  // sigma = 0 일 때 eps = e0 (반 주기 시작), rollE = π/zE → studLocal = π − π/zE − e0
  return Math.PI - Math.PI / K87.zE - T87.e0;
})();

/**
 * 087 시간표(주기 D87.period, 구동각). 반 주기마다 좌우가 바뀐다.
 *  run  : 클러치가 걸려 가로축이 돌고 바퀴 E 의 스터드가 한 바퀴 가까이 돌아온다.
 *  push : 스터드가 꺾쇠 위 팔을 밀어 연결 막대로 추 레버를 세운다(곧게 선 것을 4° 넘길 때까지).
 *  fall : 추가 저 혼자 넘어간다(가로대 홈 안에서 핀이 헛돈다 — 클러치는 아직 그대로).
 *  shift: 핀이 홈 끝에 닿아 포크·클러치를 반대쪽으로 넘긴다(가운데 nu 동안 중립 → 반대쪽 턱에 물려 축이 거꾸로).
 */
export function reverse87(theta: number): State87 {
  const t0 = T87;
  const tt = (((theta - t0.theta00) % t0.T) + t0.T) % t0.T;
  const second = tt >= t0.H;
  const t = second ? tt - t0.H : tt;
  const sgn = second ? -1 : 1;
  const run = Math.min(t, t0.tDis) - Math.max(0, t - t0.tEng);
  const eps = second ? t0.e1 - gk87 * run : t0.e0 + gk87 * run;
  const sigma = second ? k87 * (t0.tDis - t0.fr * K87.Sc) - k87 * run : k87 * run;
  const tA = second ? t0.tau2 : t0.tau1;
  const v0 = second ? t0.v2 : t0.v1;
  const drop = LAM87 - CHI0_87 - K87.phiF;
  const acc = (drop - v0 * t0.Sb) / (t0.Sb * t0.Sb);
  let phi: number;
  let psi: number | null = null;
  let x: number;
  let phase: State87['phase'];
  if (t < tA) {
    phi = sgn * K87.phi0;
    x = sgn * K87.xMax;
    phase = 'run';
  } else if (t < t0.tF) {
    psi = psiPush87(eps, sgn);
    phi = phiOfPsi87(psi);
    x = sgn * K87.xMax;
    phase = 'push';
  } else if (t < t0.tH) {
    const u = t - t0.tF;
    phi = sgn * (-K87.phiF - v0 * u - acc * u * u);
    x = sgn * K87.xMax;
    phase = 'fall';
  } else {
    x = sgn * (K87.xMax - (2 * K87.xMax * (t - t0.tH)) / K87.Sc);
    phi = Math.asin(x / K87.Lfork) - sgn * LAM87;
    phase = 'shift';
  }
  const psi1 = psi ?? psiOfPhi87(phi);
  const pf = pinF87(phi);
  const pw = pinW87(psi1);
  const engaged: State87['engaged'] = Math.abs(x) >= K87.xn - 1e-12 ? (x > 0 ? 'C' : 'B') : 'none';
  return {
    drive: theta,
    rollB: -k87 * theta,
    rollC: -k87 * theta + Math.PI / K87.zBC,
    sigma,
    rollPinion: sigma,
    eps,
    rollE: -(K87.zPinion / K87.zE) * sigma + Math.PI / K87.zE,
    stud: [K87.Ec[0] + K87.rhoS * Math.cos(eps), K87.Ec[1] + K87.rhoS * Math.sin(eps)],
    phi,
    chi: Math.asin(x / K87.Lfork),
    x,
    psi: psi1,
    pinF: pf,
    pinW: pw,
    rodAngle: Math.atan2(pw[1] - pf[1], pw[0] - pf[0]),
    engaged,
    phase,
    dir: engaged === 'C' ? 1 : engaged === 'B' ? -1 : 0
  };
}

/**
 * 포크 레버(판화 87: 받침에서 클러치 D 의 홈으로 올라간 가는 막대 + 원호 홈이 난 가로대): 원점 = 흔들 축 P, 평면 XY, z 가운데.
 * 곧게 선 자세(+Y). 위 끝(0, Lfork)에 클러치 홈 아래쪽을 두르는 반고리(YZ 평면, 홈 바닥 반지름 grooveR).
 * 가로대 = 반지름 slotR 의 원호 띠(각 90° ± (lam + 9°)), 그 안에 원호 홈(중심선 각 90° ± lam, 반폭 pinR).
 * 기울기: rotation.z = −chi. userData.slot = { r, half, pinR }.
 */
export function forkLever87(grooveR = 0.09, thick = 0.04, pinR = 0.02): THREE.Group {
  const g = new THREE.Group();
  const r0 = grooveR + 0.003;
  const r1 = r0 + 0.032;
  const body = steel({ roughness: 0.42 });
  // 막대: 받침 보스에서 반고리 밑까지
  // 막대는 받침 보스 바깥(0.06)에서 시작 — 흔들 축이 막대 판을 뚫지 않게
  const bar = shapeFrom([[-0.022, 0.06], [0.022, 0.06], [0.022, K87.Lfork - r0 - 0.006], [-0.022, K87.Lfork - r0 - 0.006]]);
  g.add(mesh(extrude(bar, thick, 0.004), body));
  // 반고리(아래 반원) — XY 에서 만들어 YZ 로 세운다
  const ring = extrude(annularSector(r0, r1, Math.PI, TAU), 0.04, 0.004, 24);
  ring.rotateY(Math.PI / 2);
  g.add(meshAt(ring, body, 0, K87.Lfork, 0));
  // 가로대(원호 띠 + 원호 홈)
  const half = LAM87;
  const band = annularSector(K87.slotR - 0.05, K87.slotR + 0.05, Math.PI / 2 - half - 9 * D2R, Math.PI / 2 + half + 9 * D2R);
  band.holes.push(kidneyPath(K87.slotR, pinR, Math.PI / 2 - half, Math.PI / 2 + half));
  g.add(mesh(extrude(band, thick, 0.004), body));
  // 받침 보스
  const boss = lathe(tubeProfile(0.04, 0.075, -thick / 2 - 0.012, thick / 2 + 0.012, 0.006), 32);
  boss.rotateX(Math.PI / 2);
  g.add(mesh(boss, darkSteel()));
  g.userData.slot = { r: K87.slotR, half, pinR };
  setMM(g, { kind: 'lever', fn: 'forkLever87', pivot: [0, 0, 0], tip: [0, K87.Lfork, 0] });
  return g;
}

/**
 * 추 달린 레버 F(판화 87): 원점 = 흔들 축 P, 곧게 선 자세(+Y), z 가운데. 막대(받침 → LF) + 끝의 공 추(반지름 ballR).
 * 연결 막대 핀: (0, aF) 에서 +z 로 pinFront 만큼. 홈 핀: (0, slotR) 에서 −z 로 pinBack 만큼(포크 가로대의 원호 홈에 든다).
 * 기울기: rotation.z = −phi. 자식 'pinF'(markPin) 가 연결 막대 핀 자리.
 */
export function weightedLever87(thick = 0.05, pinFront = 0.08, pinBack = 0.16, pinR = 0.02): THREE.Group {
  const g = new THREE.Group();
  // 막대는 받침 보스 안(0.072)에서 시작 — 흔들 축이 막대 판을 뚫지 않게
  g.add(mesh(extrude(stadiumShape(0, 0.072, 0, K87.LF, 0.03), thick, 0.006), steel()));
  const boss = lathe(tubeProfile(0.04, 0.07, -thick / 2 - 0.012, thick / 2 + 0.012, 0.006), 32);
  boss.rotateX(Math.PI / 2);
  g.add(mesh(boss, darkSteel()));
  g.add(meshAt(new THREE.SphereGeometry(K87.ballR, 40, 28), darkSteel(), 0, K87.LF, 0));
  g.add(meshAt(new THREE.BoxGeometry(K87.ballR * 0.7, 0.016, 0.01), paint(MARK), 0, K87.LF, K87.ballR - 0.002));
  const pf = meshAt(cylZ(pinR, thick / 2 - 0.004, thick / 2 + pinFront), darkSteel(), 0, K87.aF, 0);
  pf.name = 'pinF';
  markPin(pf, [0, 0, 0]);
  g.add(pf);
  g.add(meshAt(cylZ(pinR, -thick / 2 - pinBack, -thick / 2 + 0.004), darkSteel(), 0, K87.slotR, 0));
  setMM(g, { kind: 'lever', fn: 'weightedLever87', pivot: [0, 0, 0], tip: [0, K87.LF, 0] });
  return g;
}

/**
 * 꺾쇠 G(판화 87): 원점 = 받침 G. 위 팔 = 로컬 +X 로 La(반폭 hw, z = zUpper 가운데, 두께 thick) — userData.outline,
 * 아래 팔 = 로컬 각 kappa 로 c(z = zLower 가운데), 끝에 핀(+z 로 pinFront). 두 팔을 잇는 통(받침 축을 감싸는 슬리브).
 * rotation.z = psi(위 팔 방향각). 자식 'pinW'(markPin) 가 연결 막대 핀 자리.
 */
export function bellCrank87(zUpper: number, zLower: number, thick = 0.05, pinFront = 0.08, bore = 0.036): THREE.Group {
  const g = new THREE.Group();
  // 팔 판은 슬리브 안(bore + 0.03)에서 시작 — 받침 축이 팔 판을 뚫지 않게(outline 은 그대로 받침까지)
  const r0 = bore + 0.03;
  const up = meshAt(extrude(stadiumShape(r0, 0, K87.La, 0, K87.hw), thick, 0.006), steel(), 0, 0, zUpper);
  const outline: V2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    outline.push([K87.La + K87.hw * Math.cos(a), K87.hw * Math.sin(a)]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    outline.push([K87.hw * Math.cos(a), K87.hw * Math.sin(a)]);
  }
  up.userData.outline = outline;
  up.name = 'upperArm';
  g.add(up);
  const lx = K87.c * Math.cos(KAPPA87);
  const ly = K87.c * Math.sin(KAPPA87);
  g.add(meshAt(extrude(stadiumShape(r0 * Math.cos(KAPPA87), r0 * Math.sin(KAPPA87), lx, ly, K87.hw), thick, 0.006), steel(), 0, 0, zLower));
  const zA = Math.min(zUpper, zLower) - thick / 2 - 0.01;
  const zB = Math.max(zUpper, zLower) + thick / 2 + 0.01;
  const sleeve = lathe(tubeProfile(bore, bore + 0.034, zA, zB, 0.006), 32);
  sleeve.rotateX(Math.PI / 2);
  g.add(mesh(sleeve, darkSteel()));
  const pw = meshAt(cylZ(0.02, thick / 2 - 0.004, thick / 2 + pinFront), darkSteel(), lx, ly, zLower);
  pw.name = 'pinW';
  markPin(pw, [0, 0, 0]);
  g.add(pw);
  setMM(g, { kind: 'lever', fn: 'bellCrank87', pivot: [0, 0, 0] });
  return g;
}

/** 연결 막대: 원점 = 한쪽 핀 구멍, 로컬 +X 로 length 뒤에 다른 핀 구멍. 양 끝 눈(반지름 0.04), 두께 thick, z 가운데. 위치 = pinF, rotation.z = rodAngle */
export function linkBar87(length: number, thick = 0.04): THREE.Group {
  const g = new THREE.Group();
  // 몸통 띠는 양 끝 눈 안에서 멈춘다 — 핀이 띠를 뚫지 않게
  const s = stadiumShape(0.045, 0, length - 0.045, 0, 0.024);
  g.add(mesh(extrude(s, thick, 0.005), castIron({ roughness: 0.55 })));
  for (const x of [0, length]) {
    const eye = new THREE.Shape();
    eye.absarc(0, 0, 0.04, 0, TAU, false);
    eye.holes.push(circlePath(0, 0, 0.021));
    g.add(meshAt(extrude(eye, thick + 0.01, 0.005), darkSteel(), x, 0, 0));
  }
  setMM(g, { kind: 'link', fn: 'linkBar87', length });
  return g;
}

/** 바퀴 E 의 스터드: 원점 = 스터드 뿌리 중심, +Z 로 len. 반지름 K87.rS. userData.outline(원) — E(굴림 그룹)의 자식으로 로컬 각 STUD_LOCAL87 에 둔다 */
export function stud87(len = 0.09): THREE.Mesh {
  const m = mesh(cylZ(K87.rS, 0, len, 0.006), steel({ roughness: 0.35 }));
  m.userData.outline = circlePts(K87.rS, 24);
  m.name = 'stud';
  setMM(m, { kind: 'pin', point: [0, 0, len / 2] });
  return m;
}
