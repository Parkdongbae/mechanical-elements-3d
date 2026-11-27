// 277 콜트 실린더 회전 장치 전용 키트 — 닫힌 운동식(해머·도그·실린더), 도그·해머·텀블러 윤곽, 판 스프링
// 설계표 docs/mm507-sheets/277.md 의 치수·식을 그대로 옮겼다.
import * as THREE from 'three';

const D2R = Math.PI / 180;

/** 277번 상수 */
export const K277 = {
  AXIS_Y: 1.85,
  ZC: 0.28,
  CYL: [-1.7, -0.7] as [number, number],
  CYL_R: 0.5,
  RAT_ROOT: 0.2,
  RAT_TIP: 0.3,
  FACE0: -24 * D2R,
  Z_IN: 0.21,
  Z_OUT: 0.26,
  H: [0.4, 1.22] as [number, number],
  A_REL: [-0.482, -0.208] as [number, number],
  DOG_LEN: 0.88,
  X_FRONT: -0.698,
  X_BACK: -0.618,
  BETA_START: 8.163 * D2R,
  BETA_MAX: 37.549 * D2R,
  BETA_RET: 29.193 * D2R,
  Y_HOLD: 2.0006,
  S_LOC: [0.55, -0.0599] as [number, number],
  PERIOD: 3
};

const ss = (x: number): number => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

export type Phase277 = 'cock' | 'hold' | 'back' | 'fall' | 'insert' | 'rest';

export interface State277 {
  tc: number;
  n: number;
  phase: Phase277;
  /** 해머 젖힘 각(시계 +, rad) */
  beta: number;
  /** 도그 끝 T 의 x */
  xT: number;
  /** 핀 a 의 세계 좌표 */
  A: [number, number];
  /** 도그 끝 */
  T: [number, number];
  /** 도그 방향각(A → T) */
  thetaD: number;
  /** 실린더 각(rad) */
  psi: number;
  /** 판 스프링이 닿는 도그 등의 세계 좌표 */
  S: [number, number];
}

/** 핀 a 의 세계 좌표 A(β) = H + Rot(−β)·A_REL */
function pinA(beta: number): [number, number] {
  const c = Math.cos(beta);
  const s = Math.sin(beta);
  const [ax, ay] = K277.A_REL;
  return [K277.H[0] + ax * c + ay * s, K277.H[1] - ax * s + ay * c];
}

/** 도그 끝 높이(닫힌 식): y_T = A_y + √(L² − (x_T − A_x)²) */
function tipY(A: [number, number], xT: number): number {
  const dx = xT - A[0];
  return A[1] + Math.sqrt(K277.DOG_LEN * K277.DOG_LEN - dx * dx);
}

/** y_T(β, x_T) = Y_HOLD 가 되는 β 를 이분법으로(y_T 는 β 에 대해 늘어남) */
function solveBeta(xT: number): number {
  let lo = 0;
  let hi = K277.BETA_MAX;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (tipY(pinA(mid), xT) < K277.Y_HOLD) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 277번 상태(t = 초, 주기 3 초) */
export function state277(t: number): State277 {
  const P = K277.PERIOD;
  const n = Math.floor(t / P);
  const tc = t - n * P;
  let beta = 0;
  let xT = K277.X_FRONT;
  let phase: Phase277 = 'rest';
  let solved = false;
  if (tc < 1.4) {
    phase = 'cock';
    beta = K277.BETA_MAX * ss(tc / 1.4);
  } else if (tc < 1.9) {
    phase = 'hold';
    beta = K277.BETA_MAX;
  } else if (tc < 2.0) {
    phase = 'back';
    xT = K277.X_FRONT + (K277.X_BACK - K277.X_FRONT) * ss((tc - 1.9) / 0.1);
    beta = solveBeta(xT);
    solved = true;
  } else if (tc < 2.2) {
    phase = 'fall';
    xT = K277.X_BACK;
    beta = K277.BETA_RET * (1 - ss((tc - 2.0) / 0.2));
  } else if (tc < 2.5) {
    phase = 'insert';
    xT = K277.X_BACK - (K277.X_BACK - K277.X_FRONT) * ss((tc - 2.2) / 0.3);
  }
  void solved;
  const A = pinA(beta);
  const T: [number, number] = [xT, tipY(A, xT)];
  const thetaD = Math.atan2(T[1] - A[1], T[0] - A[0]);
  let psi: number;
  if (tc < 1.4) {
    if (beta < K277.BETA_START) psi = n * 60 * D2R;
    else {
      const yp = T[1] - K277.AXIS_Y;
      const alpha = Math.atan(yp / (yp >= 0 ? K277.Z_IN : K277.Z_OUT));
      psi = n * 60 * D2R + (alpha - K277.FACE0);
    }
  } else psi = (n + 1) * 60 * D2R;
  const c = Math.cos(thetaD);
  const s = Math.sin(thetaD);
  const [sx, sy] = K277.S_LOC;
  const S: [number, number] = [A[0] + c * sx - s * sy, A[1] + s * sx + c * sy];
  return { tc, n, phase, beta, xT, A, T, thetaD, psi, S };
}

type P2 = [number, number];

/** 직선(p0→p1) 과 원점 중심 반지름 r 원의 교점 가운데 p1 쪽에서 먼 것이 아니라 선분 위(0..1)에 든 것 */
function lineCircle(p0: P2, p1: P2, r: number): P2 {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const a = dx * dx + dy * dy;
  const b = 2 * (p0[0] * dx + p0[1] * dy);
  const c = p0[0] * p0[0] + p0[1] * p0[1] - r * r;
  const disc = Math.sqrt(Math.max(0, b * b - 4 * a * c));
  const u1 = (-b - disc) / (2 * a);
  const u2 = (-b + disc) / (2 * a);
  const u = u1 >= 0 && u1 <= 1 ? u1 : u2;
  return [p0[0] + u * dx, p0[1] + u * dy];
}

/** 도그 윤곽(도그 좌표: 원점 = 핀 a, x 축 = A → T) — 끝 손가락 + 뼈대 + 핀 둘레 보스(반지름 0.06) 하나로 이은 닫힌 점열(반시계), 구멍 0.022 는 모델이 낸다 */
export function dogOutline277(): P2[] {
  const T: P2 = [0.88, 0];
  const front: P2 = [0.80346, 0.04735];
  const ledge: P2 = [0.7382, -0.02842];
  const top: P2 = [0, 0.035];
  const bot: P2 = [0, -0.035];
  const back: P2 = [0.81026, -0.07167];
  const R = 0.06;
  const i1 = lineCircle(ledge, top, R);
  const i2 = lineCircle(bot, back, R);
  const a1 = Math.atan2(i1[1], i1[0]);
  let a2 = Math.atan2(i2[1], i2[0]);
  if (a2 < a1) a2 += Math.PI * 2;
  const pts: P2[] = [T, front, ledge, i1];
  const N = 14;
  for (let k = 1; k < N; k++) {
    const a = a1 + ((a2 - a1) * k) / N;
    pts.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  pts.push(i2, back);
  return pts;
}

export function dogShape277(): THREE.Shape {
  const s = new THREE.Shape();
  dogOutline277().forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.022, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** 해머 윤곽 — 세계(β = 0) 점에서 H 를 뺀 해머 좌표 */
export function hammerOutline277(): P2[] {
  const W: P2[] = [
    [-0.665, 2.29],
    [-0.665, 2.19],
    [-0.45, 2.05],
    [-0.22, 1.78],
    [-0.13, 1.5],
    [-0.05, 1.05],
    [0.15, 0.9],
    [0.55, 0.92],
    [0.72, 1.15],
    [0.7, 1.55],
    [0.8, 1.95],
    [0.98, 2.35],
    [1.1, 2.55],
    [1.02, 2.64],
    [0.8, 2.52],
    [0.5, 2.4],
    [0.1, 2.42],
    [-0.3, 2.4]
  ];
  return W.map(([x, y]) => [x - K277.H[0], y - K277.H[1]] as P2);
}

export function hammerShape277(): THREE.Shape {
  const s = new THREE.Shape();
  hammerOutline277().forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.037, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** 텀블러 윤곽(해머 좌표) — 원점 보스 0.09 + 막대(반폭 0.05) + 끝 보스 0.07 를 하나로 이은 점열(반시계) */
export function tumblerOutline277(): P2[] {
  const [ex, ey] = K277.A_REL;
  const len = Math.hypot(ex, ey);
  const phi = Math.atan2(ey, ex);
  const w = 0.05;
  const r1 = 0.09;
  const r2 = 0.07;
  const a1 = Math.asin(w / r1);
  const a2 = Math.asin(w / r2);
  const pts: P2[] = [];
  const N1 = 28;
  for (let k = 0; k <= N1; k++) {
    const a = phi + a1 + ((Math.PI * 2 - 2 * a1) * k) / N1;
    pts.push([r1 * Math.cos(a), r1 * Math.sin(a)]);
  }
  const N2 = 20;
  for (let k = 0; k <= N2; k++) {
    const a = phi - a2 + ((2 * a2) * k) / N2;
    pts.push([ex + r2 * Math.cos(a), ey + r2 * Math.sin(a)]);
  }
  void len;
  return pts;
}

export function tumblerShape277(): THREE.Shape {
  const s = new THREE.Shape();
  tumblerOutline277().forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.037, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** 판 스프링 c — 덩이 밑면 R → 조절점 → S 의 2차 베지에 관(반지름 0.008), 깊이 0.515. 세계 좌표 지오메트리 */
export function springC277(S: THREE.Vector3): THREE.BufferGeometry {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.14, 2.06, 0.515), new THREE.Vector3(-0.22, 1.72, 0.515), new THREE.Vector3(S.x, S.y, 0.515));
  return new THREE.TubeGeometry(curve, 28, 0.008, 6, false);
}
