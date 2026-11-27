// 274 포물선 팔 조속기 전용 키트 — 상수·닫힌 식 운동(state274)·팔 B 판·막대 F 와 공 한 몸·받침·스핀들·가로대·슬리브·롤러·핀
// 설계표 docs/mm507-sheets/274.md 의 치수·식을 그대로 옮겼다. 회전 묶음 로컬: x = r(오른쪽), y = 세계 높이, z = 깊이 층.
import * as THREE from 'three';
import { bronze, castIron, darkSteel, brass, paint, steel } from '../../models/materials';
import { TAU, circlePath, extrude, lathe, merge, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

export const K274 = {
  ZC: 0.275,
  A: 0.22,
  YV: 1.9489,
  RL: 0.045,
  R0: 0.15,
  R1: 0.33,
  AS: 0.12,
  LF: 0.7,
  ALONG: 0.3,
  PERP: 0.15,
  RB: 0.11,
  YOKE: [0.34, 2.8] as V2,
  YOKE2: [0.4007, 2.7045] as V2,
  BEZ: [
    [0.46134, 2.2788],
    [0.56736, 2.47157],
    [0.34, 2.8]
  ] as [V2, V2, V2],
  SPACER: [0.4928, 2.4547] as V2,
  PERIOD: 16
};

export interface State274 {
  /** 들림 0~1 */
  s: number;
  /** 스핀들 각(rad) */
  psi: number;
  /** 스핀들 각속도(rad/s) */
  omega: number;
  /** 롤러 중심의 스핀들에서 거리 */
  r: number;
  /** 롤러 중심 L (r, y) */
  L: V2;
  /** 슬리브 핀 S (r = 0.12, ys) */
  S: V2;
  /** 공 중심 K (r, y) */
  K: V2;
  /** 슬리브 높이 */
  ys: number;
  /** 롤러 바퀴 굴림 각(로컬 z 회전, rad) */
  roll: number;
  /** 슬리브 움직임 방향: +1 오름, −1 내림, 0 멈춤 */
  dir: -1 | 0 | 1;
}

/** 포물선 호장 S(r) — 설계표 식 */
function arc274(r: number): number {
  const u = r / K274.A;
  return (K274.A / 2) * (u * Math.sqrt(1 + u * u) + Math.asinh(u));
}

/** 274번 운동식(t = 초, 한 주기 16 초, 닫힌 식). t 가 음수여도 된다 */
export function state274(t: number): State274 {
  const P = K274.PERIOD;
  const tc = ((t % P) + P) % P;
  const n = Math.floor(t / P);
  let s: number;
  let I: number;
  let dir: State274['dir'] = 0;
  if (tc <= 2) {
    s = 0;
    I = 0;
  } else if (tc <= 6) {
    const u = (tc - 2) / 4;
    s = (1 - Math.cos(Math.PI * u)) / 2;
    I = 4 * (u / 2 - Math.sin(Math.PI * u) / (2 * Math.PI));
    dir = tc < 6 ? 1 : 0;
  } else if (tc <= 10) {
    s = 1;
    I = 2 + (tc - 6);
  } else if (tc <= 14) {
    const u = (tc - 10) / 4;
    s = (1 + Math.cos(Math.PI * u)) / 2;
    I = 6 + 4 * (u / 2 + Math.sin(Math.PI * u) / (2 * Math.PI));
    dir = tc < 14 ? -1 : 0;
  } else {
    s = 0;
    I = 8;
  }
  const psi = 24 * n + 1.2 * tc + 0.6 * I;
  const r = K274.R0 + (K274.R1 - K274.R0) * s;
  const Ly = K274.YV + (r * r) / (2 * K274.A);
  const ys = Ly - Math.sqrt(K274.LF * K274.LF - (r - K274.AS) * (r - K274.AS));
  const dx = (K274.AS - r) / K274.LF;
  const dy = (ys - Ly) / K274.LF;
  // o = (−dy, dx): 바깥(+r) 쪽
  const ox = -dy;
  const oy = dx;
  const K: V2 = [r + K274.ALONG * dx + K274.PERP * ox, Ly + K274.ALONG * dy + K274.PERP * oy];
  const roll = -(arc274(r) - arc274(K274.R0)) / K274.RL;
  return { s, psi, omega: 1.2 + 0.6 * s, r, L: [r, Ly], S: [K274.AS, ys], K, ys, roll, dir };
}

// ───────────────────────── 팔 B 윤곽 ─────────────────────────

const normalAt = (r: number): V2 => {
  const u = r / K274.A;
  const d = Math.sqrt(1 + u * u);
  return [u / d, -1 / d];
};
const baseAt = (r: number): V2 => [r, K274.YV + (r * r) / (2 * K274.A)];

function bez(p: readonly V2[], t: number): V2 {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [a * p[0]![0] + b * p[1]![0] + c * p[2]![0], a * p[0]![1] + b * p[1]![1] + c * p[2]![1]];
}
function bezTan(p: readonly V2[], t: number): V2 {
  const x = 2 * (1 - t) * (p[1]![0] - p[0]![0]) + 2 * t * (p[2]![0] - p[1]![0]);
  const y = 2 * (1 - t) * (p[1]![1] - p[0]![1]) + 2 * t * (p[2]![1] - p[1]![1]);
  const l = Math.hypot(x, y);
  return [x / l, y / l];
}

/** 팔 B 한 판의 윤곽(로컬 x = r, y) — 아래 띠(식으로 만든 안·바깥 가장자리) ∪ 위 띠(2차 베지에, 끝 원 0.04) */
export function armOutline274(): V2[] {
  const out: V2[] = [];
  const step = 0.005;
  const nPts = 62; // r 0.095 ~ 0.40
  const rr = (k: number): number => 0.095 + k * step;
  // 바깥 가장자리 r 올림차순
  for (let k = 0; k < nPts; k++) {
    const r = rr(k);
    const b = baseAt(r);
    const n = normalAt(r);
    out.push([b[0] + 0.095 * n[0], b[1] + 0.095 * n[1]]);
  }
  // 위 띠 오른쪽(바깥쪽) 가장자리 — 끝 원 0.04 와 만나는 t* 까지
  const Y = K274.YOKE;
  const hw = 0.025;
  const side = (t: number, sgn: number): V2 => {
    const c = bez(K274.BEZ, t);
    const T = bezTan(K274.BEZ, t);
    return [c[0] + sgn * hw * T[1], c[1] - sgn * hw * T[0]];
  };
  let lo = 0.5;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const p = side(mid, 1);
    if (Math.hypot(p[0] - Y[0], p[1] - Y[1]) > 0.04) lo = mid;
    else hi = mid;
  }
  const ts = lo;
  const K = 48;
  for (let k = 1; k <= K; k++) out.push(side((ts * k) / K, 1));
  // 끝 원(반지름 0.04, 가운데 Y) — 오른쪽 점에서 왼쪽 점까지 앞쪽으로 돌아서
  const pR = side(ts, 1);
  const pL = side(ts, -1);
  const aR = Math.atan2(pR[1] - Y[1], pR[0] - Y[0]);
  let aL = Math.atan2(pL[1] - Y[1], pL[0] - Y[0]);
  while (aL <= aR) aL += TAU;
  const NA = 28;
  for (let k = 1; k < NA; k++) {
    const a = aR + ((aL - aR) * k) / NA;
    out.push([Y[0] + 0.04 * Math.cos(a), Y[1] + 0.04 * Math.sin(a)]);
  }
  // 위 띠 왼쪽(안쪽) 가장자리 내려오기
  for (let k = K; k >= 1; k--) out.push(side((ts * k) / K, -1));
  // 아래 띠 안쪽 가장자리 r 내림차순
  for (let k = nPts - 1; k >= 0; k--) {
    const r = rr(k);
    const b = baseAt(r);
    const n = normalAt(r);
    out.push([b[0] + 0.045 * n[0], b[1] + 0.045 * n[1]]);
  }
  return out;
}

function polyShape(pts: V2[]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

/** 팔 B 판 하나(castIron, 두께 0.02, 가운데 z = 0 — 모델이 z 를 준다). 볼트 구멍 둘. userData.outline */
export function parabolicArm274(): THREE.Mesh {
  const outline = armOutline274();
  const shape = polyShape(outline);
  shape.holes.push(circlePath(K274.YOKE[0], K274.YOKE[1], 0.013), circlePath(K274.YOKE2[0], K274.YOKE2[1], 0.013));
  const m = mesh(extrude(shape, 0.02, 0.0015, 12), steel({ roughness: 0.3 }));
  m.userData.outline = outline;
  setMM(m, { kind: 'part', fn: 'parabolicArm274' });
  return m;
}

// ───────────────────────── 막대 F 와 공 한 몸 ─────────────────────────

/** 막대 F(납작, 폭 0.03·깊이 0.03·구멍 중심 사이 0.70, 양 끝 눈 0.025·구멍 0.013) — 원점 = 위 눈, 아래 쪽 −y */
function rodShape274(): THREE.Shape {
  const L = K274.LF;
  const ang = Math.asin(0.015 / 0.025);
  const dy = 0.025 * Math.cos(ang);
  const s = new THREE.Shape();
  s.moveTo(0.015, -dy);
  s.absarc(0, 0, 0.025, -ang, Math.PI + ang, false);
  s.lineTo(-0.015, -(L - dy));
  s.absarc(0, -L, 0.025, Math.PI - ang, TAU + ang, false);
  s.closePath();
  s.holes.push(circlePath(0, 0, 0.013), circlePath(0, -L, 0.013));
  return s;
}

/** 막대 F + V 막대 둘 + 공 K 한 몸. 원점 = 롤러 축 L, 로컬 −y 가 S 쪽, 바깥(o)은 로컬 +x. 이름 rodF·vRodA·vRodB·ballK(모델이 짝 이름으로 바꾼다) */
export function ballArm274(): THREE.Group {
  const g = new THREE.Group();
  const bar = mesh(extrude(rodShape274(), 0.03, 0.001, 16), steel());
  bar.name = 'rodF';
  g.add(bar);
  const Kp: V2 = [K274.PERP, -K274.ALONG];
  const vRod = (y0: number, name: string): THREE.Mesh => {
    const dx = Kp[0] - 0;
    const dy = Kp[1] - y0;
    const len = Math.hypot(dx, dy);
    const geo = lathe(rodProfile(0.012, 0, len, 0, 0), 20);
    const m = mesh(geo, steel());
    // 로컬 +y 가 (dx, dy) 방향이 되게
    m.position.set(0, y0, 0);
    m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    m.name = name;
    return m;
  };
  g.add(vRod(-0.1, 'vRodA'), vRod(-0.42, 'vRodB'));
  const ball = mesh(new THREE.SphereGeometry(K274.RB, 44, 30), brass());
  ball.name = 'ballK';
  ball.position.set(Kp[0], Kp[1], 0);
  g.add(ball);
  setMM(g, { kind: 'part', fn: 'ballArm274' });
  return g;
}

// ───────────────────────── 롤러·핀·볼트·간격대 ─────────────────────────

const zCyl = (r: number, z0: number, z1: number): THREE.BufferGeometry => {
  const g = lathe(rodProfile(r, z0, z1, 0, 0), 28);
  g.rotateX(Math.PI / 2);
  return g;
};

/** 롤러 바퀴 하나(bronze, 반지름 0.045, 구멍 0.013, 폭 0.016 — 팔 판 두께 0.02 안에 든다). outerSign +1 = z 가 큰 쪽 판, −1 = 작은 쪽 판. 바깥 면에 노란 점 */
export function rollerWheel274(outerSign: 1 | -1): THREE.Mesh {
  const z0 = 0.037;
  const z1 = 0.053;
  const geo = lathe(tubeProfile(0.013, K274.RL, 0, z1 - z0, 0.002), 72);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, outerSign > 0 ? z0 + 0.0 : -z1);
  const w = mesh(geo, bronze());
  const dotGeo = zCyl(0.007, -0.002, 0.002);
  const dot = mesh(dotGeo, paint(0xf2b619));
  dot.name = 'rollerMark';
  dot.position.set(0.03, 0, outerSign > 0 ? z1 : -z1);
  w.add(dot);
  setMM(w, { kind: 'part', fn: 'rollerWheel274' });
  return w;
}

/** 롤러 축 핀(steel, 반지름 0.012, z ±0.065 + 머리 0.02·두께 0.008). 원점 = 축 가운데 */
export function rollerPin274(): THREE.Mesh {
  const geo = merge([zCyl(0.012, -0.067, 0.067), zCyl(0.02, 0.065, 0.073), zCyl(0.02, -0.073, -0.065)]);
  const m = mesh(geo, steel());
  markPin(m, [0, 0, 0]);
  return m;
}

/** 슬리브 핀(steel, 반지름 0.012, z ±0.04 + 머리 0.02) */
export function sleevePin274(): THREE.Mesh {
  const geo = merge([zCyl(0.012, -0.0385, 0.0385), zCyl(0.02, 0.031, 0.038), zCyl(0.02, -0.038, -0.031)]);
  const m = mesh(geo, steel());
  markPin(m, [0, 0, 0]);
  return m;
}

/** 가로대·팔 볼트(steel, 반지름 0.012, z ±0.06 + 머리 0.02: 팔 판 바깥면 ±0.055 에 0.001 박힘) */
export function bolt274(): THREE.Mesh {
  const geo = merge([zCyl(0.012, -0.0605, 0.0605), zCyl(0.02, 0.054, 0.062), zCyl(0.02, -0.062, -0.054)]);
  return mesh(geo, steel());
}

/** 간격대(steel 원기둥 반지름 0.016, 두 판 사이 ±0.035 — 판 안쪽 면에 0.0015 박힘) */
export function spacer274(): THREE.Mesh {
  return mesh(zCyl(0.016, -0.0365, 0.0365), steel());
}

// ───────────────────────── 받침·스핀들·가로대·슬리브 ─────────────────────────

/** 아래 받침(castIron): 상자 + 위 베어링 고리. 원점 = 스핀들 축(x 0, z 0), 높이는 세계 y */
export function pedestal274(): THREE.Mesh {
  const lower = new THREE.BoxGeometry(0.2, 0.21, 0.2);
  lower.translate(0, 0.28, 0); // 0.175 ~ 0.385
  const sh = new THREE.Shape();
  sh.moveTo(-0.1, -0.1);
  sh.lineTo(0.1, -0.1);
  sh.lineTo(0.1, 0.1);
  sh.lineTo(-0.1, 0.1);
  sh.closePath();
  sh.holes.push(circlePath(0, 0, 0.032));
  const upper = extrude(sh, 0.14, 0.003, 24); // y 0.38 ~ 0.52 (구멍 0.032)
  upper.rotateX(Math.PI / 2);
  upper.translate(0, 0.45, 0);
  const ring = lathe(tubeProfile(0.032, 0.07, 0.515, 0.6, 0.004), 56);
  const m = mesh(merge([lower, upper, ring]), castIron());
  setMM(m, { kind: 'part', fn: 'pedestal274' });
  return m;
}

/** 위 베어링(castIron): 고리 + 뒤판 앞면에서 오는 팔. 원점 = 스핀들 축. 팔은 −z 로 뻗어 뒤판에 0.005 박힘 */
export function topBearing274(): THREE.Mesh {
  const ring = lathe(tubeProfile(0.032, 0.065, 2.94, 3.0, 0.004), 56);
  const z0 = -0.3 - 0.005 - K274.ZC; // 뒤판 앞면(−0.30) 안쪽 0.005
  const z1 = -0.04;
  const arm = new THREE.BoxGeometry(0.08, 0.054, z1 - z0);
  arm.translate(0, 2.97, (z0 + z1) / 2);
  const m = mesh(merge([ring, arm]), castIron());
  setMM(m, { kind: 'part', fn: 'topBearing274' });
  return m;
}

/** 스핀들(steel): 원기둥 반지름 0.03 y 0.40~3.06 + 위 끝 C 손잡이 공(0.035) + 칼라 둘. 원점 = 축 */
export function spindle274(): THREE.Mesh {
  const prof: V2[] = [
    [0, 0.4],
    [0.03, 0.4],
    [0.03, 0.602],
    [0.06, 0.602],
    [0.06, 0.632],
    [0.03, 0.632],
    [0.03, 2.905],
    [0.06, 2.905],
    [0.06, 2.935],
    [0.03, 2.935],
    [0.03, 3.062]
  ];
  const cy = 3.08;
  const rb = 0.035;
  const a0 = Math.asin((3.062 - cy) / rb); // 구가 반지름 0.03 이 되는 아래쪽 점 부근
  const a1 = Math.PI / 2;
  const NA = 18;
  for (let k = 0; k <= NA; k++) {
    const a = a0 + ((a1 - a0) * k) / NA;
    prof.push([Math.max(0, rb * Math.cos(a)), cy + rb * Math.sin(a)]);
  }
  const m = mesh(lathe(prof, 56), steel());
  setMM(m, { kind: 'shaft', axis: 'y', r: 0.03, y0: 0.4, y1: 3.06 });
  return m;
}

/** 위 가로대(darkSteel): 보스 + 오른쪽·왼쪽 아치 띠(스핀들을 비켜 보스에 이어진다). 원점 = 축 */
export function yoke274(): THREE.Mesh {
  const boss = lathe(tubeProfile(0.031, 0.06, 2.78, 2.9, 0.003), 56);
  const parts: THREE.BufferGeometry[] = [boss];
  const Y = K274.YOKE;
  const Y2 = K274.YOKE2;
  const hw = 0.025;
  // 가운데선: 아치 2차 곡선 (−0.34, 2.80) → (0, 2.86) → (0.34, 2.80) 중 x ≥ 0.032, 그다음 Y2 까지 곧게
  const arch: V2[] = [
    [-0.34, 2.8],
    [0, 2.92],
    [0.34, 2.8]
  ];
  const t0 = (1 + 0.032 / 0.34) / 2;
  const cl: V2[] = [];
  const N = 28;
  for (let k = 0; k <= N; k++) cl.push(bez(arch, t0 + ((1 - t0) * k) / N));
  cl.push([Y2[0], Y2[1]]);
  // 띠 윤곽(우: 아래쪽·바깥쪽 = 오른쪽 법선)
  const nrm = (i: number): V2 => {
    const prev = cl[Math.max(0, i - 1)]!;
    const next = cl[Math.min(cl.length - 1, i + 1)]!;
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const l = Math.hypot(tx, ty);
    return [ty / l, -tx / l];
  };
  // 꺾임(Y) 은 이웃 점 평균 법선 + 마이터 보정
  const rightPts: V2[] = [];
  const leftPts: V2[] = [];
  for (let i = 0; i < cl.length; i++) {
    let n = nrm(i);
    if (i === N) {
      const a = cl[i - 1]!;
      const b = cl[i]!;
      const c = cl[i + 1]!;
      const t1x = b[0] - a[0];
      const t1y = b[1] - a[1];
      const l1 = Math.hypot(t1x, t1y);
      const t2x = c[0] - b[0];
      const t2y = c[1] - b[1];
      const l2 = Math.hypot(t2x, t2y);
      const n1: V2 = [t1y / l1, -t1x / l1];
      const n2: V2 = [t2y / l2, -t2x / l2];
      const mx = n1[0] + n2[0];
      const my = n1[1] + n2[1];
      const ml = Math.hypot(mx, my);
      const cosHalf = ml / 2;
      n = [mx / ml / cosHalf, my / ml / cosHalf];
    }
    rightPts.push([cl[i]![0] + hw * n[0], cl[i]![1] + hw * n[1]]);
    leftPts.push([cl[i]![0] - hw * n[0], cl[i]![1] - hw * n[1]]);
  }
  // 끝 둥근 마감(Y2 둘레) — 오른쪽 점에서 왼쪽 점으로 앞쪽
  const endC = cl[cl.length - 1]!;
  const pR = rightPts[rightPts.length - 1]!;
  const pL = leftPts[leftPts.length - 1]!;
  const aR = Math.atan2(pR[1] - endC[1], pR[0] - endC[0]);
  let aL = Math.atan2(pL[1] - endC[1], pL[0] - endC[0]);
  while (aL <= aR) aL += TAU;
  const cap: V2[] = [];
  for (let k = 1; k < 14; k++) {
    const a = aR + ((aL - aR) * k) / 14;
    cap.push([endC[0] + hw * Math.cos(a), endC[1] + hw * Math.sin(a)]);
  }
  const poly: V2[] = [...rightPts, ...cap, ...leftPts.slice().reverse()];
  for (const sx of [1, -1]) {
    const pts: V2[] = poly.map(([x, y]) => [sx * x, y] as V2);
    const sh = polyShape(pts);
    sh.holes.push(circlePath(sx * Y[0], Y[1], 0.013), circlePath(sx * Y2[0], Y2[1], 0.013));
    parts.push(extrude(sh, 0.066, 0.002, 16));
  }
  const m = mesh(merge(parts), darkSteel());
  setMM(m, { kind: 'part', fn: 'yoke274' });
  return m;
}

/** 슬리브(darkSteel): 관 + 귀 둘(갈래 두 장) + 깃 둘. 원점 = 슬리브 핀 높이(ys), 축 x 0 */
export function sleeve274(): THREE.Mesh {
  const prof: V2[] = [
    [0.032, -0.1],
    [0.1, -0.1],
    [0.1, -0.085],
    [0.06, -0.085],
    [0.06, -0.065],
    [0.1, -0.065],
    [0.1, -0.05],
    [0.06, -0.05],
    [0.06, 0.08],
    [0.032, 0.08],
    [0.032, -0.1]
  ];
  const parts: THREE.BufferGeometry[] = [lathe(prof, 56)];
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const sh = new THREE.Shape();
      sh.moveTo(sx * 0.05, -0.03);
      sh.lineTo(sx * K274.AS, -0.03);
      // 둥근 끝: 가운데 (±0.12, 0), 반지름 0.03
      sh.absarc(sx * K274.AS, 0, 0.03, -Math.PI / 2, Math.PI / 2, sx < 0);
      sh.lineTo(sx * 0.05, 0.03);
      sh.closePath();
      sh.holes.push(circlePath(sx * K274.AS, 0, 0.013));
      const g = extrude(sh, 0.015, 0.001, 16);
      g.translate(0, 0, sz * 0.0245);
      parts.push(g);
    }
  }
  const m = mesh(merge(parts), darkSteel());
  setMM(m, { kind: 'part', fn: 'sleeve274' });
  return m;
}
