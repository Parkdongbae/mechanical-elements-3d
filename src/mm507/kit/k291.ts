// 291번 아널드 크로노미터(자유) 탈진기 전용 키트 — 탈진 바퀴 B·충격 롤러·멈치 스프링 A·가벼운 스프링과 접촉 계산. 설계표 docs/mm507-sheets/291.md
// 밸런스 각 ψ 만 시간표, 멈치 들림 δ·스프링 눌림 σ·바퀴 각 φ 는 모두 접촉(원·선분 교점, 이분법)에서 구한다.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

export const K291 = {
  W: [-0.7, 1.4] as V2,
  A: [-1.18, 2.42] as V2,
  PB: [1.5, 2.375] as V2,
  PI: [0.5, 2.4325] as V2,
  Z: 12,
  PITCH: 30,
  RT: 0.9,
  RR: 0.7,
  LEAD: 4,
  BACK: 22,
  BULGE: -0.05,
  TH0: 69,
  ROLLER: { R: 0.31, NU: -100.7, WALL: [[0.31, -90.7], [0.27, -100.7], [0.16, -120.7]] as [number, number][] },
  XD: -0.7 + 0.9 * Math.cos(69 * D2R),
  YT: 1.4 + 0.9 * Math.sin(69 * D2R),
  LOCK: 0.06,
  BLADE_B: 2.35,
  BLADE_T: 2.4,
  XT: -1.09,
  SP_Y0: 2.42,
  SP_T: 0.025,
  RPATH: 0.17,
  RPIN: 0.035,
  TP0: 13,
  AMP: 200,
  TR: 0.505468,
  TE: 0.604777,
  TD: 0.589399,
  /** 표 기대값 [t, ψ, δ, σ, φ] */
  EXPECT: [
    [0, -200, 0, 0, 0],
    [0.47, -18.822, 0.405, 0, 0.068],
    [0.5, 0, 1.668, 0, 0.318],
    [0.52, 12.558, 2.455, 0, -6.952],
    [0.55, 31.287, 3.438, 0, -11.465],
    [0.58, 49.738, 3.961, 0, -16.19],
    [0.6, 61.803, 0, 0, -20.612],
    [0.65, 90.798, 0, 0, -30],
    [1.5, 0, 0, 0.823, -30],
    [1.55, -31.287, 0, 4.273, -30],
    [2.0, -200, 0, 0, -30],
    [30, -200, 0, 0, -450]
  ] as [number, number, number, number, number][]
} as const;
const K = K291;

const rotP = (p: V2, deg: number, c: V2): V2 => {
  const t = deg * D2R;
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(t) - y * Math.sin(t), c[1] + x * Math.sin(t) + y * Math.cos(t)];
};
const polar = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
const addV = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];

// ───────────────────────── 접촉 계산 ─────────────────────────

const XD = K.XD;
const YT = K.YT;
const XT = K.XT;
const Y0 = K.SP_Y0;
const Y1 = K.SP_Y0 + K.SP_T;

function above(c: V2, lift: number): boolean {
  const [u, v] = rotP(c, lift, K.PB);
  if (u <= XT - K.RPIN) return true;
  if (u >= XT) return v + K.RPIN <= Y0;
  return v < Y0 && (u - XT) ** 2 + (v - Y0) ** 2 >= K.RPIN ** 2;
}
function below(c: V2, dep: number): boolean {
  const [u, v] = rotP(c, -dep, K.PI);
  if (u <= XT - K.RPIN) return true;
  if (u >= XT) return v - K.RPIN >= Y1;
  return v > Y1 && (u - XT) ** 2 + (v - Y1) ** 2 >= K.RPIN ** 2;
}
const pinC = (psi: number): V2 => addV(K.A, polar(K.RPATH, K.TP0 + psi));

/** 멈치 들림 δ(rising=true) 또는 스프링 눌림 σ(rising=false), 도 */
export function lift291(psi: number, rising: boolean): number {
  const c = pinC(psi);
  const f = rising ? (d: number) => above(c, d) : (d: number) => below(c, d);
  if (f(0)) return 0;
  let lo = 0;
  let hi = 15;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (f(m)) hi = m;
    else lo = m;
  }
  const u = rising ? rotP(c, hi, K.PB)[0] : rotP(c, -hi, K.PI)[0];
  if (u <= XT - K.RPIN + 1e-7) return 0;
  return hi;
}

const wrapNear = (a: number, ref: number): number => (((a - ref + 180) % 360) + 360) % 360 - 180 + ref;

/** 이끝 원(W, RT)과 꺾은선의 교점 중 가장 큰 각(먼저 닿는 점)에서 이 k 의 φ. 없으면 null */
function contact(face: V2[], k: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < face.length - 1; i++) {
    const p = face[i]!;
    const q = face[i + 1]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const fx = p[0] - K.W[0];
    const fy = p[1] - K.W[1];
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - K.RT * K.RT;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    for (const s of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (s < 0 || s > 1) continue;
      const qx = p[0] + s * dx;
      const qy = p[1] + s * dy;
      const al = wrapNear(Math.atan2(qy - K.W[1], qx - K.W[0]) / D2R, 85);
      if (best === null || al > best) best = al;
    }
  }
  return best === null ? null : best - (K.TH0 + K.PITCH * k);
}

/** d 의 왼면(잠금면) 선분 — PB 둘레 −δ 돌림 */
const dFace = (delta: number): V2[] => [rotP([XD, K.BLADE_B], -delta, K.PB), rotP([XD, YT - K.LOCK], -delta, K.PB)];
/** 롤러 홈 앞쪽 꺾은선(앞벽·비탈) — A 둘레 ψ */
const wallFace = (psi: number): V2[] => K.ROLLER.WALL.map(([r, a]) => addV(K.A, polar(r, a + psi)));

function bisect(a: number, b: number, f: (x: number) => boolean): number {
  let lo = a;
  let hi = b;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m)) hi = m;
    else lo = m;
  }
  return hi;
}

const psiOf = (tau: number): number => -K.AMP * Math.cos(Math.PI * tau);

export interface State291 {
  psi: number;
  delta: number;
  sigma: number;
  phi: number;
  holder: 'd' | 'g';
  justDropped: boolean;
}

export function state291(t: number): State291 {
  const n = Math.floor(t / 2 + 1e-12);
  const tau = t - 2 * n;
  const psi = psiOf(tau);
  const rising = tau < 1;
  const lf = lift291(psi, rising);
  const delta = rising ? lf : 0;
  const sigma = rising ? 0 : lf;
  let holder: 'd' | 'g' = 'd';
  let r: number | null;
  if (tau < K.TR) r = contact(dFace(delta), 0);
  else if (tau < K.TE) {
    r = contact(wallFace(psi), 2);
    holder = 'g';
  } else r = contact(dFace(delta), 1);
  // 설계표대로면 일어나지 않는다(경계 수치만) — 0 으로 두면 튀므로 직전 자세로 대신한다
  if (r === null) r = holder === 'g' ? contact(dFace(delta), 1) ?? 0 : 0;
  return { psi, delta, sigma, phi: r - K.PITCH * n, holder, justDropped: tau >= K.TR && tau < K.TR + 0.1 };
}

// 값 검증용 — TR·TE 를 접촉에서 다시 구해 본다(설계표 값과 같아야 함)
export function recomputeTrTe(): { TR: number; TE: number } {
  const TR = bisect(0.3, 0.75, (x) => contact(dFace(lift291(psiOf(x), true)), 0) === null);
  const TE = bisect(TR + 1e-4, 0.9, (x) => contact(wallFace(psiOf(x)), 2) === null);
  return { TR, TE };
}

// ───────────────────────── 부품 ─────────────────────────

function slab(outline: V2[], z0: number, z1: number, mat: THREE.Material, holeR = 0): THREE.Mesh {
  const shape = shapeFrom(outline);
  if (holeR > 0) shape.holes.push(circlePath(0, 0, holeR));
  const geo = extrude(shape, z1 - z0, 0, 6);
  geo.translate(0, 0, (z0 + z1) / 2);
  return mesh(geo, mat);
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

/** 바퀴 윤곽(W 원점, 반시계) — 이끝 T → 안으로 오목한 등면 → 등 뿌리 B → 뿌리 원호 → 앞 뿌리 F → 다음 이끝 */
export function wheelOutline291(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < K.Z; k++) {
    const th = K.TH0 + K.PITCH * k;
    const T = polar(K.RT, th);
    const B = polar(K.RR, th + K.BACK);
    const mx = T[0] + B[0];
    const my = T[1] + B[1];
    const ml = Math.hypot(mx, my);
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const bl = K.BULGE * 4 * s * (1 - s);
      pts.push([(1 - s) * T[0] + s * B[0] + (bl * mx) / ml, (1 - s) * T[1] + s * B[1] + (bl * my) / ml]);
    }
    const a0 = th + K.BACK;
    const a1 = th + K.PITCH + K.LEAD;
    const n = Math.max(2, Math.round((a1 - a0) / 2));
    for (let i = 1; i <= n; i++) pts.push(polar(K.RR, a0 + ((a1 - a0) * i) / n));
  }
  return pts;
}

/** 탈진 바퀴 B + 허브 칼라 + 빨간 표시 + 태엽통. 원점 = W, 회전축 = 로컬 Z. 몸통 메시 name `escapeWheel`·`barrel` */
export function escWheel291(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const outline = wheelOutline291();
  const wheel = slab(outline, 0, 0.06, brass(), 0.042);
  wheel.name = 'escapeWheel';
  wheel.userData.outline = outline;
  g.add(wheel);
  g.userData.wheelMat = wheel.material;
  // 허브 칼라 z 0.058(바퀴 속에 0.002 박음)~0.09
  const col = lathe(tubeProfile(0.042, 0.08, 0.058, 0.09, 0.002), 40);
  col.rotateX(Math.PI / 2);
  g.add(mesh(col, darkSteel()));
  // 빨간 표시 — 바퀴 앞면 위(0.0005 박음), 반지름 0.55, 각 90°
  const red = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.004), paint(0xd03020));
  red.position.set(0, 0.55, 0.0615);
  g.add(red);
  // 태엽통 z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.45, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  const yel = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.25, 0, -0.079);
  g.add(yel);
  return g;
}

/** 롤러 윤곽(A 원점, ψ = 0) — 테 원호 → 홈 뒷벽 → 바닥 원호 → 앞벽 → 비탈 */
export function rollerOutline291(): V2[] {
  const R = K.ROLLER.R;
  const pts: V2[] = [];
  const a0 = -90.7;
  const a1 = -134.7 + 360;
  const n = Math.round((a1 - a0) / 0.2);
  for (let i = 0; i <= n; i++) pts.push(polar(R, a0 + ((a1 - a0) * i) / n));
  // 뒷벽: 테 → 바닥(0.16, −134.7°)
  pts.push(polar(0.16, -134.7));
  for (let i = 1; i <= 8; i++) pts.push(polar(0.16, -134.7 + (14 * i) / 8));
  // 앞벽(0.16, −120.7°) → (0.27, −100.7°) 비탈 → 테(0.31, −90.7°)
  pts.push(polar(0.27, -100.7));
  return pts;
}

/** 충격 롤러 + 허브 고리 + 핀 막대 + 방출 핀 a. 원점 = A, 회전축 = 로컬 Z. 몸통 메시 name `impulseRoller`·`dischargePin` */
export function roller291(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rollerGroup';
  const outline = rollerOutline291();
  const mat = steel();
  const roller = slab(outline, 0, 0.06, mat, 0.042);
  roller.name = 'impulseRoller';
  roller.userData.outline = outline;
  g.add(roller);
  g.userData.rollerMat = mat;
  const ring = lathe(tubeProfile(0.042, 0.07, 0.058, 0.13), 40);
  ring.rotateX(Math.PI / 2);
  g.add(mesh(ring, darkSteel()));
  // 핀 막대: 13° 방향, 반지름 0.05~0.20, 폭 0.04, z 0.11~0.128
  const rodLen = 0.15;
  const rod = box(0, rodLen, -0.02, 0.02, 0.11, 0.128, steel());
  const rg = new THREE.Group();
  rg.rotation.z = K.TP0 * D2R;
  rod.position.x += 0.05;
  rg.add(rod);
  g.add(rg);
  // 방출 핀 a — 원기둥 반지름 0.035, 중심 0.17∠13°, z 0.065~0.13
  const pin = mesh(new THREE.CylinderGeometry(K.RPIN, K.RPIN, 0.065, 32), steel());
  pin.rotation.x = Math.PI / 2;
  const [px, py] = polar(K.RPATH, K.TP0);
  pin.position.set(px, py, 0.0975);
  pin.name = 'dischargePin';
  g.add(pin);
  return g;
}

/**
 * 멈치 그룹 — 원점 = PB(회전점). 안쪽 틀 `inner` 가 −PB 만큼 옮겨져 있어 세계 좌표 그대로 적는다.
 * 몸통 메시 name `detentBlade`·`detentStop`·`studI`·`hookK`·`passingSpring`(작은 그룹, 원점 PI 에서 σ 회전)
 */
export function detent291(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'detentGroup';
  const inner = new THREE.Group();
  inner.position.set(-K.PB[0], -K.PB[1], 0);
  g.add(inner);
  const XK0 = -0.8;
  const XK1 = -0.74;
  // 멈치 스프링 A — 띠 + 왼끝 세움(한 다각형)
  const bladeOut: V2[] = [[XK0, K.BLADE_B], [K.PB[0] + 0.01, K.BLADE_B], [K.PB[0] + 0.01, K.BLADE_T], [XK1, K.BLADE_T], [XK1, 2.49], [XK0, 2.49]];
  const blade = slab(bladeOut, 0, 0.06, steel());
  blade.name = 'detentBlade';
  inner.add(blade);
  // 멈치 d — z 0.002~0.058(띠와 같은 높이 면이 겹치지 않게 안쪽으로), 위 0.01 이 띠에 묻힘
  const dOut: V2[] = [[XD, YT - K.LOCK], [XD + 0.03, YT + 0.012], [XD + 0.03, K.BLADE_B + 0.01], [XD, K.BLADE_B + 0.01]];
  const dMat = steel();
  const d = slab(dOut, 0.002, 0.058, dMat);
  d.name = 'detentStop';
  d.userData.outline = dOut;
  inner.add(d);
  g.userData.dMat = dMat;
  // 스터드 i — 띠 위(0.002 박음)
  const stud = box(0.5, 0.6, 2.398, 2.5, 0.002, 0.11, brass());
  stud.name = 'studI';
  inner.add(stud);
  // 갈고리 k 입술 — 세움 앞면에 붙음(0.002 박음)
  const hook = box(XK0, XK1, 2.445, 2.49, 0.058, 0.12, steel());
  hook.name = 'hookK';
  inner.add(hook);
  // 가벼운 스프링 — 회전점 PI
  const sp = new THREE.Group();
  sp.position.set(K.PI[0], K.PI[1], 0);
  const spMat = steel();
  const spring = box(XT - K.PI[0], 0.55 - K.PI[0], Y0 - K.PI[1], Y1 - K.PI[1], 0.065, 0.105, spMat);
  spring.name = 'passingSpring';
  sp.add(spring);
  sp.name = 'passingSpringGroup';
  inner.add(sp);
  g.userData.spring = sp;
  g.userData.springMat = spMat;
  return g;
}

/** 고정 블록 b(뒤판에 붙음) + 앞면 나사 머리 */
export function blockB291(): THREE.Group {
  const g = new THREE.Group();
  const blk = box(1.5, 1.8, 2.25, 2.5, -0.3, 0.062, castIron());
  blk.name = 'blockB';
  g.add(blk);
  const head = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.032, 24), steel());
  head.rotation.x = Math.PI / 2;
  head.position.set(1.65, 2.375, 0.076);
  g.add(head);
  return g;
}
