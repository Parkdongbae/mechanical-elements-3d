// 185번 전용 키트 — 기관차 링크 밸브 장치(스티븐슨 링크): 편심 둘 → 편심 막대 둘 → 굽은 홈 링크(역전 레버로 들고 내림)
//  → 홈 속 슬라이드(다이) → 흔들 레버 → 밸브 연결봉 → 밸브 막대
// 운동식 linkMotion185(theta) 는 순수 함수(고정 초기값에서 뉴턴 반복 → 결정적).
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, roundedRect, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

// ───────────── 치수(세계 좌표, 판화 1 px = 0.0044) ─────────────
export const K185 = {
  S: [1.58, 1.32] as V2, // 기관 축(편심 둘)
  e: 0.08, // 편심 거리
  sheaveR: 0.19,
  strapR: 0.25,
  delta: 0.0, // 앞섬각
  Rs: 1.5, // 링크 홈 호 반지름(편심 막대 길이와 같게)
  hp: 0.24, // 링크 핀 T·B 의 호 길이 자리(±)
  linkL: 0.31, // 링크 띠 끝(±)
  linkW: 0.07, // 링크 띠 반폭
  slotL: 0.175, // 홈 끝(±)
  slotW: 0.03, // 홈 반폭
  dieL: 0.035, // 다이 반길이(홈 방향)
  H: [-0.08, 0] as V2, // 들기 귀 핀(링크 로컬)
  M0: [0.06, 1.3] as V2, // 링크 가운데 기준 자리
  R: [0.08, 1.69] as V2, // 흔들 레버 받침
  ru: 0.36, // 흔들 레버 윗팔
  yV: 2.03, // 밸브 막대 높이
  Lv: 0.42, // 밸브 연결봉
  P: [-0.7, 2.32] as V2, // 역전 레버 받침
  armQ: 0.58, // 레버 짧은 팔(들기 막대 핀)
  armHandle: 1.28, // 손잡이 끝
  lamMid: -0.1, // 레버 각 가운데(중립)
  lamAmp: 0.18, // 레버 각 진폭
  quadR: 1.06, // 사분원(톱니 호) 반지름
  block: { x0: -1.62, x1: -0.64, y0: 1.1, y1: 2.11, z1: 0.42 },
  // 층(z 가운데)
  zB: 0.05, // 뒤 편심·뒤 막대
  zL: 0.13, // 링크·다이
  zF: 0.21, // 앞 편심·앞 막대·들기 막대
  zR: 0.28, // 흔들 레버·밸브 막대
  zV: 0.335, // 밸브 연결봉
  zLv: 0.27, // 역전 레버
  zQuad: 0.205, // 사분원
  zRail: 0.39, // 흔들 레버 받침 가로대
  zLift: 0.45 // 들기 막대(맨 앞 — 판화처럼 밸브 연결봉 앞을 지난다)
} as const;

const TAU = Math.PI * 2;
type Pose = [number, number, number]; // 링크 x, y, 각

/** 링크 로컬 호 위 점(호 길이 s) — 호 중심은 로컬 (+Rs, 0) */
export function arcPt185(s: number, off = 0): V2 {
  const R = K185.Rs;
  const f = s / R;
  return [R * (1 - Math.cos(f)) - off * Math.cos(f), R * Math.sin(f) + off * Math.sin(f)];
}
const toW = (u: Pose, p: V2): V2 => {
  const c = Math.cos(u[2]);
  const s = Math.sin(u[2]);
  return [u[0] + c * p[0] - s * p[1], u[1] + s * p[0] + c * p[1]];
};
const dist = (a: V2, b: V2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const U0: Pose = [K185.M0[0], K185.M0[1], 0];
const T_LOC = arcPt185(K185.hp);
const B_LOC = arcPt185(-K185.hp);

/** 레버 각 → 들기 막대 위 핀 Q */
export function leverQ185(lam: number): V2 {
  return [K185.P[0] + K185.armQ * Math.cos(lam), K185.P[1] + K185.armQ * Math.sin(lam)];
}
// 막대 길이(기준 자세에서 정한다)
export const LEN185 = {
  rodT: dist(toW(U0, T_LOC), K185.S),
  rodB: dist(toW(U0, B_LOC), K185.S),
  lift: dist(toW(U0, K185.H), leverQ185(K185.lamMid)),
  rr: dist(K185.M0, K185.R)
} as const;

export interface State185 {
  lam: number;
  Q: V2;
  phiF: number;
  phiB: number;
  Ef: V2;
  Eb: V2;
  link: Pose;
  T: V2;
  B: V2;
  H: V2;
  D: V2;
  sDie: number;
  dieAng: number;
  rock: number; // 흔들 레버 회전(로컬 −Y 가 다이 쪽)
  U: V2;
  V: V2;
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
/** 기어 자리 표(축 바퀴 수, 값): +1 전진 끝, 0 가운데(밸브 멈춤), −1 후진 끝. 16 바퀴에 한 번 닫힌다 */
const GEAR_TABLE: [number, number][] = [
  [0, 0.5], [2, 0.5], [3, 0], [5, 0], [6, -1], [9, -1], [11, 1], [14, 1], [15, 0.5], [16, 0.5]
];
export const GEAR_PERIOD185 = 16;
/** theta → 기어 자리 g(−1~1). 판화 자세(g = 0.5, 가운데와 위 끝 사이)가 t = 1 */
export function gear185(theta: number): number {
  const n = theta / TAU;
  const u = n - GEAR_PERIOD185 * Math.floor(n / GEAR_PERIOD185);
  let prev: [number, number] = [0, 0.5];
  for (const cur of GEAR_TABLE) {
    if (u <= cur[0] && cur[0] > prev[0]) return prev[1] + (cur[1] - prev[1]) * smooth((u - prev[0]) / (cur[0] - prev[0]));
    prev = cur;
  }
  return 0.5;
}
/** 레버 각 — 기어 자리 +1(전진)이면 짧은 팔이 내려가 링크가 내려가고 다이가 위 끝(전진 편심 쪽)에 온다 */
export function leverAngle185(theta: number): number {
  return K185.lamMid - K185.lamAmp * gear185(theta);
}

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];
const det3 = (m: Mat3): number =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
/** 열 k 를 b 로 바꾼 행렬 */
const withCol = (m: Mat3, k: number, b: Vec3): Mat3 =>
  [0, 1, 2].map((i) => [0, 1, 2].map((j) => (j === k ? b[i as 0] : m[i as 0][j as 0])) as Vec3) as Mat3;

function solveLink(Ef: V2, Eb: V2, Q: V2): Pose {
  const f = (u: Pose): Vec3 => [
    dist(toW(u, T_LOC), Ef) - LEN185.rodT,
    dist(toW(u, B_LOC), Eb) - LEN185.rodB,
    dist(toW(u, K185.H), Q) - LEN185.lift
  ];
  let u: Pose = [U0[0], U0[1], U0[2]];
  const h = 1e-6;
  for (let it = 0; it < 30; it++) {
    const r = f(u);
    if (Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) < 1e-11) break;
    const c0 = f([u[0] + h, u[1], u[2]]);
    const c1 = f([u[0], u[1] + h, u[2]]);
    const c2 = f([u[0], u[1], u[2] + h]);
    const J: Mat3 = [
      [(c0[0] - r[0]) / h, (c1[0] - r[0]) / h, (c2[0] - r[0]) / h],
      [(c0[1] - r[1]) / h, (c1[1] - r[1]) / h, (c2[1] - r[1]) / h],
      [(c0[2] - r[2]) / h, (c1[2] - r[2]) / h, (c2[2] - r[2]) / h]
    ];
    const d = det3(J);
    if (Math.abs(d) < 1e-14) break;
    const nb: Vec3 = [-r[0], -r[1], -r[2]];
    u = [u[0] + det3(withCol(J, 0, nb)) / d, u[1] + det3(withCol(J, 1, nb)) / d, u[2] + det3(withCol(J, 2, nb)) / d];
  }
  return u;
}

/** theta(축 각) → 모든 부품 자세 */
export function linkMotion185(theta: number): State185 {
  const { S, e, delta, Rs, R, ru, yV, Lv } = K185;
  const lam = leverAngle185(theta);
  const Q = leverQ185(lam);
  const phiF = theta + Math.PI / 2 + delta;
  const phiB = theta - Math.PI / 2 - delta;
  const Ef: V2 = [S[0] + e * Math.cos(phiF), S[1] + e * Math.sin(phiF)];
  const Eb: V2 = [S[0] + e * Math.cos(phiB), S[1] + e * Math.sin(phiB)];
  const u = solveLink(Ef, Eb, Q);
  const T = toW(u, T_LOC);
  const B = toW(u, B_LOC);
  const H = toW(u, K185.H);
  const M = toW(u, [0, 0]);
  const C = toW(u, [Rs, 0]);
  // 다이: 홈 호(C, Rs) ∩ 흔들 레버 원(R, rr) — 링크 가운데에 가까운 해
  const rr = LEN185.rr;
  const dx = R[0] - C[0];
  const dy = R[1] - C[1];
  const d = Math.hypot(dx, dy);
  const a = (Rs * Rs - rr * rr + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, Rs * Rs - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const c1: V2 = [C[0] + ux * a - uy * hh, C[1] + uy * a + ux * hh];
  const c2: V2 = [C[0] + ux * a + uy * hh, C[1] + uy * a - ux * hh];
  const D = dist(c1, M) < dist(c2, M) ? c1 : c2;
  // 다이의 홈 속 호 길이
  const cs = Math.cos(-u[2]);
  const sn = Math.sin(-u[2]);
  const lx = cs * (D[0] - u[0]) - sn * (D[1] - u[1]);
  const ly = sn * (D[0] - u[0]) + cs * (D[1] - u[1]);
  const sDie = Rs * Math.atan2(ly, Rs - lx);
  const dieAng = u[2] - sDie / Rs;
  const rock = Math.atan2(D[1] - R[1], D[0] - R[0]) + Math.PI / 2;
  const U: V2 = [R[0] - (ru / rr) * (D[0] - R[0]), R[1] - (ru / rr) * (D[1] - R[1])];
  const V: V2 = [U[0] - Math.sqrt(Math.max(0, Lv * Lv - (U[1] - yV) ** 2)), yV];
  return { lam, Q, phiF, phiB, Ef, Eb, link: u, T, B, H, D, sDie, dieAng, rock, U, V };
}

// ───────────── 형상 도우미 ─────────────
function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function cylX(r: number, x0: number, x1: number, c = 0.004, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
function named(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
/** 핀(z0~z1) + 앞 머리 */
function pinAt(x: number, y: number, z0: number, z1: number, r = 0.022): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(cylZ(r, z0, z1), darkSteel(), x, y, 0));
  g.add(meshAt(cylZ(r * 1.6, z1, z1 + 0.014, 0.004), darkSteel(), x, y, 0));
  return g;
}
/** 두 눈을 잇는 납작 막대(로컬 원점 = 첫 눈, +X 로 len). 두께 t, z 가운데 0 */
function flatBar(len: number, halfW: number, eyeR: number, t: number, mat: THREE.Material, holeR = 0.025): THREE.Group {
  const g = new THREE.Group();
  const sh = roundedRect(eyeR * 0.6, -halfW, len - eyeR * 0.6, halfW, 0.004);
  g.add(mesh(extrude(sh, t * 0.8, 0.004), mat));
  for (const x of [0, len]) {
    const eye = new THREE.Shape();
    eye.absarc(0, 0, eyeR, 0, TAU, false);
    eye.holes.push(pathFrom(circlePts(holeR, 24)));
    g.add(meshAt(extrude(eye, t, 0.005), mat, x, 0, 0));
  }
  return g;
}

// ───────────── 부품 ─────────────

/** 고정 틀: 증기실 덩이(밸브 막대 구멍), 패킹 상자, 역전 레버 받침대, 톱니 사분원과 받침, 흔들 레버 받침 가로대 */
export function frame185(): THREE.Group {
  const g = new THREE.Group();
  const b = K185.block;
  const zs = K185.zR;
  // 덩이: (−z, y) 단면을 X 로 뽑음 — 밸브 막대 구멍
  const sh = roundedRect(-b.z1, b.y0, 0.3, b.y1, 0.02);
  sh.holes.push(pathFrom(circlePts(0.03, 24, -zs, K185.yV)));
  const geo = extrude(sh, b.x1 - b.x0, 0.01);
  geo.rotateY(Math.PI / 2);
  g.add(meshAt(geo, castIron(), (b.x0 + b.x1) / 2, 0, 0));
  // 패킹 상자(오른쪽 면) + 누름 너트
  g.add(meshAt(lathe([[0.03, 0], [0.065, 0], [0.065, 0.06], [0.05, 0.075], [0.03, 0.075]], 32).rotateZ(-Math.PI / 2), brass(), b.x1 - 0.003, K185.yV, zs));
  g.add(meshAt(lathe([[0.03, 0], [0.075, 0], [0.075, 0.02], [0.03, 0.02]], 6).rotateZ(-Math.PI / 2), darkSteel(), b.x1 + 0.03, K185.yV, zs));
  // 역전 레버 받침대(덩이 윗면에서) + 받침 핀
  const P = K185.P;
  const br = new THREE.Shape();
  br.moveTo(P[0] - 0.09, b.y1 - 0.01);
  br.lineTo(P[0] + 0.09, b.y1 - 0.01);
  br.lineTo(P[0] + 0.06, P[1]);
  br.absarc(P[0], P[1], 0.06, 0, Math.PI, false);
  br.lineTo(P[0] - 0.09, b.y1 - 0.01);
  g.add(meshAt(extrude(br, 0.05, 0.005), castIron(), 0, 0, 0.215));
  g.add(pinAt(P[0], P[1], 0.19, 0.305, 0.024));
  // 톱니 사분원: 레버 받침을 중심으로 한 굽은 띠(바깥에 홈), 뒤판 받침 둘
  const a0 = (148 * Math.PI) / 180;
  const a1 = (196 * Math.PI) / 180;
  const rq = K185.quadR;
  const pts: V2[] = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N;
    const notch = i % 4 === 2 && i > 2 && i < N - 2 ? -0.02 : 0;
    pts.push([P[0] + (rq + 0.04 + notch) * Math.cos(a), P[1] + (rq + 0.04 + notch) * Math.sin(a)]);
  }
  for (let i = N; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / N;
    pts.push([P[0] + (rq - 0.04) * Math.cos(a), P[1] + (rq - 0.04) * Math.sin(a)]);
  }
  g.add(meshAt(extrude(shapeFrom(pts), 0.04, 0.004), steel(), 0, 0, K185.zQuad));
  for (const a of [a0 + 0.06, a1 - 0.06]) {
    const x = P[0] + rq * Math.cos(a);
    const y = P[1] + rq * Math.sin(a);
    g.add(meshAt(cylZ(0.03, -0.3, K185.zQuad - 0.019), darkSteel(), x, y, 0));
    g.add(meshAt(cylZ(0.06, -0.3, -0.24), castIron(), x, y, 0));
  }
  // 흔들 레버 받침 가로대(덩이 오른쪽 면에서 앞으로) + 받침 핀
  const R = K185.R;
  const rail = roundedRect(b.x1 - 0.01, R[1] - 0.035, R[0] + 0.07, R[1] + 0.035, 0.03);
  g.add(meshAt(extrude(rail, 0.05, 0.005), castIron(), 0, 0, K185.zRail));
  g.add(meshAt(cylZ(0.06, K185.zRail - 0.025, K185.zRail + 0.04), castIron(), R[0], R[1], 0));
  g.add(meshAt(cylZ(0.022, K185.zR - 0.03, K185.zRail), darkSteel(), R[0], R[1], 0));
  return g;
}

/** 편심 바퀴(축에 박힘). 원점 = 축 중심, 편심 중심 = 로컬 +X e. z 가운데 0, 두께 0.06 */
export function eccentric185(driver: boolean): THREE.Group {
  const markName = driver ? 'eccF' : 'eccB';
  const g = new THREE.Group();
  const { e, sheaveR } = K185;
  const sh = new THREE.Shape();
  sh.absarc(e, 0, sheaveR, 0, TAU, false);
  sh.holes.push(pathFrom(circlePts(0.052, 28)));
  for (const a of [0.6, -0.6, Math.PI]) {
    const cx = e + 0.12 * Math.cos(a);
    const cy = 0.12 * Math.sin(a);
    if (Math.hypot(cx, cy) > 0.12) sh.holes.push(pathFrom(circlePts(0.035, 18, cx, cy)));
  }
  g.add(mesh(extrude(sh, 0.06, 0.006, 48), driver ? bronze() : brass()));
  // 허브(축 둘레) + 표시점
  const hub = new THREE.Shape();
  hub.absarc(0, 0, 0.085, 0, TAU, false);
  hub.holes.push(pathFrom(circlePts(0.052, 28)));
  g.add(mesh(extrude(hub, 0.07, 0.005), darkSteel()));
  g.add(meshAt(cylZ(0.02, 0.03, 0.036), steel({ color: 0xf2b619 }), e + 0.15, 0, 0));
  g.add(named(markName, e, 0, 0));
  return setMM(g, { kind: 'wheel', r: sheaveR, width: 0.06, rim: 'flat', axis: 'z' });
}

/** 편심 막대: 원점 = 편심 중심(띠쇠), +X 로 len 에 링크 핀 눈. z 가운데 0 */
export function eccRod185(len: number): THREE.Group {
  const g = new THREE.Group();
  const { sheaveR, strapR } = K185;
  const ring = new THREE.Shape();
  ring.absarc(0, 0, strapR, 0, TAU, false);
  ring.holes.push(pathFrom(circlePts(sheaveR + 0.004, 64)));
  g.add(mesh(extrude(ring, 0.05, 0.005, 64), steel()));
  // 띠쇠 귀(볼트) 둘
  for (const y of [strapR - 0.01, -(strapR - 0.01)]) g.add(meshAt(new THREE.BoxGeometry(0.1, 0.05, 0.05), steel(), -0.05, y + Math.sign(y) * 0.02, 0));
  // 막대: 띠쇠 바깥에서 눈까지
  const bar = new THREE.Shape();
  const w0 = 0.045;
  const w1 = 0.03;
  bar.moveTo(strapR - 0.02, -w0);
  bar.lineTo(len, -w1);
  bar.lineTo(len, w1);
  bar.lineTo(strapR - 0.02, w0);
  bar.closePath();
  g.add(mesh(extrude(bar, 0.04, 0.004), steel()));
  const eye = new THREE.Shape();
  eye.absarc(len, 0, 0.05, 0, TAU, false);
  eye.holes.push(pathFrom(circlePts(0.024, 24, len, 0)));
  g.add(mesh(extrude(eye, 0.05, 0.005), steel()));
  g.add(named('rodEye', len, 0, 0));
  return g;
}

/** 굽은 홈 링크: 원점 = 호 가운데, 홈 호 중심은 로컬 (+Rs, 0). 핀 T·B 와 들기 귀 H 의 핀 포함. z 가운데 0 */
export function link185(): THREE.Group {
  const g = new THREE.Group();
  const { linkL, linkW, slotL, slotW, hp, H, zB, zL, zF, zLift } = K185;
  const band = (L: number, w: number, n = 40): V2[] => {
    const pts: V2[] = [];
    const f1 = L / K185.Rs;
    const c1 = arcPt185(L);
    const c0 = arcPt185(-L);
    for (let i = 0; i <= n; i++) pts.push(arcPt185(-L + (2 * L * i) / n, w));
    // 위 끝 반원(+N → 접선 → −N)
    for (let i = 1; i < 12; i++) {
      const a = Math.PI - f1 - (i / 12) * Math.PI;
      pts.push([c1[0] + w * Math.cos(a), c1[1] + w * Math.sin(a)]);
    }
    for (let i = 0; i <= n; i++) pts.push(arcPt185(L - (2 * L * i) / n, -w));
    // 아래 끝 반원
    for (let i = 1; i < 12; i++) {
      const a = f1 - (i / 12) * Math.PI;
      pts.push([c0[0] + w * Math.cos(a), c0[1] + w * Math.sin(a)]);
    }
    return pts;
  };
  const sh = shapeFrom(band(linkL, linkW));
  sh.holes.push(pathFrom(band(slotL, slotW).reverse()));
  g.add(mesh(extrude(sh, 0.08, 0.006), steel()));
  // 들기 귀
  const lug = new THREE.Shape();
  lug.absarc(H[0], H[1], 0.045, 0, TAU, false);
  lug.holes.push(pathFrom(circlePts(0.024, 24, H[0], H[1])));
  g.add(mesh(extrude(lug, 0.07, 0.005), steel()));
  // 핀: T(앞 막대, 앞으로), B(뒤 막대, 뒤로), H(들기 막대, 앞으로) — 링크 로컬 z(가운데 = zL)
  const T = arcPt185(hp);
  const B = arcPt185(-hp);
  const pT = pinAt(T[0], T[1], -0.04, zF - zL + 0.03);
  const pB = pinAt(B[0], B[1], zB - zL - 0.035, 0.045);
  const pH = pinAt(H[0], H[1], -0.035, zLift - zL + 0.03);
  g.add(pT, pB, pH);
  g.add(named('pinT', T[0], T[1], zF - zL), named('pinB', B[0], B[1], zB - zL), named('pinH', H[0], H[1], zLift - zL));
  return g;
}

/** 슬라이드(다이): 원점 = 다이 가운데, 로컬 Y = 홈 방향. 앞으로 흔들 레버까지 핀 */
export function die185(): THREE.Group {
  const g = new THREE.Group();
  const { dieL, slotW, zL, zR } = K185;
  g.add(mesh(extrude(roundedRect(-(slotW - 0.002), -dieL, slotW - 0.002, dieL, 0.01), 0.07, 0.005), bronze()));
  // 앞뒤 덧판(홈 밖으로 빠지지 않게)
  g.add(meshAt(extrude(roundedRect(-0.05, -dieL - 0.01, 0.05, dieL + 0.01, 0.015), 0.012, 0.003), bronze(), 0, 0, 0.047));
  g.add(pinAt(0, 0, 0.053, zR - zL + 0.03));
  g.add(named('pinD', 0, 0, zR - zL));
  return g;
}

/** 흔들 레버: 원점 = 받침, 로컬 −Y rr 에 다이 핀, +Y ru 에 밸브 연결봉 핀. z 가운데 0 */
export function rocker185(): THREE.Group {
  const g = new THREE.Group();
  const rr = LEN185.rr;
  const ru = K185.ru;
  g.add(mesh(extrude(roundedRect(-0.035, -rr + 0.03, 0.035, -0.03, 0.004), 0.04, 0.004), steel()));
  g.add(mesh(extrude(roundedRect(-0.032, 0.03, 0.032, ru - 0.03, 0.004), 0.04, 0.004), steel()));
  for (const y of [-rr, 0, ru]) {
    const eye = new THREE.Shape();
    eye.absarc(0, y, 0.05, 0, TAU, false);
    eye.holes.push(pathFrom(circlePts(0.024, 24, 0, y)));
    g.add(mesh(extrude(eye, 0.05, 0.005), steel()));
  }
  // 윗 핀(밸브 연결봉 쪽, 앞으로)
  g.add(pinAt(0, ru, -0.025, K185.zV - K185.zR + 0.03));
  g.add(named('pinU', 0, ru, K185.zV - K185.zR));
  return g;
}

/** 납작 연결봉(들기 막대·밸브 연결봉): 원점 = 첫 눈, +X 로 len */
export function bar185(len: number, mat: 'steel' | 'brass' = 'steel'): THREE.Group {
  return flatBar(len, 0.028, 0.048, 0.04, mat === 'brass' ? brass() : steel());
}

/** 밸브 막대: 원점 = 끝 눈(연결봉 핀), −X 로 덩이 속까지. z 가운데 0 */
export function valveStem185(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylX(0.022, -0.58, -0.03), steel()));
  g.add(mesh(cylZ(0.045, -0.025, 0.025), steel()));
  g.add(pinAt(0, 0, -0.025, K185.zV - K185.zR + 0.03));
  g.add(named('pinV', 0, 0, K185.zV - K185.zR));
  return g;
}

/** 역전 레버: 원점 = 받침, +X 로 짧은 팔(들기 막대 핀 Q), −X 로 손잡이. z 가운데 0 */
export function lever185(): THREE.Group {
  const g = new THREE.Group();
  const { armQ, armHandle, quadR } = K185;
  const sh = new THREE.Shape();
  sh.moveTo(-0.04, -0.038);
  sh.lineTo(-armHandle + 0.06, -0.022);
  sh.lineTo(-armHandle + 0.06, 0.022);
  sh.lineTo(-0.04, 0.038);
  sh.closePath();
  g.add(mesh(extrude(sh, 0.04, 0.004), steel()));
  const arm = new THREE.Shape();
  arm.moveTo(0.04, -0.035);
  arm.lineTo(armQ - 0.03, -0.025);
  arm.lineTo(armQ - 0.03, 0.025);
  arm.lineTo(0.04, 0.035);
  arm.closePath();
  g.add(mesh(extrude(arm, 0.04, 0.004), steel()));
  for (const x of [0, armQ]) {
    const eye = new THREE.Shape();
    eye.absarc(x, 0, x === 0 ? 0.065 : 0.048, 0, TAU, false);
    eye.holes.push(pathFrom(circlePts(0.026, 24, x, 0)));
    g.add(mesh(extrude(eye, 0.05, 0.005), steel()));
  }
  // 손잡이 공
  g.add(meshAt(new THREE.SphereGeometry(0.045, 20, 14), brass(), -armHandle, 0, 0));
  g.add(meshAt(cylX(0.022, -armHandle + 0.03, -armHandle + 0.08), brass(), 0, 0, 0));
  // 걸쇠(사분원 홈에 걸리는 이) — 사분원 앞을 지나는 작은 덩이
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.1, 0.04), darkSteel(), -quadR, 0, -0.005));
  // 들기 막대 핀(앞으로)
  g.add(pinAt(armQ, 0, -0.025, K185.zLift - K185.zLv + 0.03));
  g.add(named('pinQ', armQ, 0, K185.zLift - K185.zLv));
  return g;
}
