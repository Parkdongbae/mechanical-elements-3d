// 번호 전용 키트 (507 · 182번) — 비스듬한 걸쇠 밸브 장치(손잡이 장치): 피스톤 막대(태핏 둘), 위·아래 손잡이 축(팔·뒷추),
// 비스듬한 걸쇠(S 모양, 가운데 축), 밸브 막대·밸브 상자 셋, 그리고 theta → 모든 자세의 닫힌 식
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { extrude, hexPrism, lathe, mesh, rodProfile, roundedRect, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';
import { STAGE } from './stand';

export const K182 = {
  U: [0.08, 2.45] as V2, // 위 손잡이 축
  L: [0.12, 1.16] as V2, // 아래 손잡이 축
  C: [0.04, 1.83] as V2, // 걸쇠 축
  XR: -0.525, // 피스톤 막대 가운데 x
  RW: 0.07, // 막대 반폭
  zR0: -0.1, // 막대 z
  zR1: -0.02,
  rodLen: 2.2,
  rodMid: 0.62, // 막대 아래 끝 y = rodMid − A·cos u
  A: 0.4, // 행정의 반
  w: 0.04, // 손잡이 반폭
  HL: 1.15, // 손잡이 길이
  aTrip: 0.4, // 손잡이가 태핏에 맞아 도는 각(rad)
  zH: 0.05, // 손잡이·팔 층 가운데(0.02~0.08)
  hT: 0.06, // 손잡이 두께
  zB: -0.17, // 뒤 팔 층 가운데(−0.20~−0.14)
  zK: 0.16, // 걸쇠 층 가운데(0.13~0.19)
  kT: 0.06, // 걸쇠 두께
  dGam: -0.16, // 걸쇠가 도는 각(위 손잡이를 잡음 0 → 아래 손잡이를 잡음 dGam)
  pinR: 0.03, // 걸쇠 핀
  studR: 0.05,
  tapH: 0.1, // 태핏 높이
  snap: 0.3 // 풀린 손잡이가 제자리로 돌아오는 구간(rad)
} as const;

const W = K182;
const rot = ([x, y]: V2, a: number): V2 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const norm = (a: V2): V2 => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

/** 손잡이 축에 붙은 것들(축 로컬, 손잡이는 −X 방향) */
export const PIN_U: V2 = [-0.34, -0.03]; // 위 손잡이 몸의 걸쇠 핀
export const PIN_L: V2 = [0.226, 0.313]; // 아래 손잡이 축 돌기 끝의 걸쇠 핀

/** 밸브 셋: 축, 팔 각(로컬)·길이, 막대 길이, 상자 x, 층 z, 닫힘 쪽(seat) */
export interface Valve182 {
  key: string;
  shaft: 'U' | 'L';
  arm: number;
  len: number;
  link: number;
  xg: number;
  zc: number;
  seat: 'top' | 'bottom';
}
export const VALVES182: Valve182[] = [
  { key: 'valveU', shaft: 'U', arm: 0.106, len: 0.8, link: 1.55, xg: 0.83, zc: 0.12, seat: 'top' }, // 위 증기 + 아래 배기
  { key: 'valveLR', shaft: 'L', arm: -0.127, len: 0.55, link: 0.25, xg: 0.63, zc: 0.12, seat: 'bottom' }, // 아래 증기
  { key: 'valveLL', shaft: 'L', arm: Math.PI + 0.3, len: 0.95, link: 0.15, xg: -0.81, zc: -0.1, seat: 'top' } // 위 배기(뒤 층)
];

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** 손잡이 앙각 a(+ = 끝이 위) ↔ 축 회전 phi = −a */
// 아래 손잡이 밑면이 태핏 오른쪽 위 모서리에 닿는 높이(축 기준)
const dL = W.L[0] - (W.XR + W.RW);
const dU = W.U[0] - (W.XR + W.RW);
const yUnderL = (a: number): number => (dL - W.w * Math.sin(a)) * Math.tan(a) - W.w * Math.cos(a);
const yTopU = (a: number): number => (dU + W.w * Math.sin(a)) * Math.tan(a) + W.w * Math.cos(a);
/** 태핏 높이(축 기준)에서 앙각을 푼다. 범위 밖이면 null */
function solve(f: (a: number) => number, y: number, lo: number, hi: number): number {
  let a0 = lo;
  let a1 = hi;
  const inc = f(hi) > f(lo);
  for (let i = 0; i < 40; i++) {
    const m = (a0 + a1) / 2;
    if (f(m) < y === inc) a0 = m;
    else a1 = m;
  }
  return (a0 + a1) / 2;
}

/** 태핏(막대 로컬, 막대 아래 끝 = 0): 아래 태핏 윗면, 위 태핏 밑면 */
const rodBottom = (u: number): number => W.rodMid - W.A * Math.cos(u);
export const TAP_L_TOP = W.L[1] + yUnderL(W.aTrip) - rodBottom(Math.PI); // 맨 위에서 아래 손잡이를 aTrip 까지 올림
export const TAP_U_BOT = W.U[1] + yTopU(-W.aTrip) - rodBottom(0); // 맨 아래에서 위 손잡이를 −aTrip 까지 내림

export interface State182 {
  u: number;
  rodY: number; // 막대 아래 끝 y
  aU: number; // 위 손잡이 앙각(0 = 수평, −aTrip = 눌려 걸쇠에 걸림)
  aL: number; // 아래 손잡이 앙각(0 = 수평, +aTrip = 들려 걸쇠에 걸림)
  gam: number; // 걸쇠 각
  up: boolean; // 피스톤이 올라가는 중
}

/** u = 피스톤 위상(0 = 맨 아래, π = 맨 위). 모든 자세의 닫힌 식(주기 2π 에서 정확히 닫힘) */
export function gear182(uIn: number): State182 {
  const TAU = Math.PI * 2;
  const u = ((uIn % TAU) + TAU) % TAU;
  const rodY = rodBottom(u);
  const tl = rodY + TAP_L_TOP - W.L[1]; // 아래 태핏 윗면(아래 축 기준)
  const tu = rodY + TAP_U_BOT - W.U[1]; // 위 태핏 밑면(위 축 기준)
  const cL = tl > yUnderL(0) ? Math.min(W.aTrip, solve(yUnderL, tl, 0, W.aTrip)) : 0;
  const cU = tu < yTopU(0) ? Math.max(-W.aTrip, solve(yTopU, tu, -W.aTrip, 0)) : 0;
  let aL: number;
  let aU: number;
  let gam: number;
  const late = (p: number): number => smooth((p - 0.35) / 0.65);
  if (u < Math.PI) {
    // 올라감: 위 손잡이는 걸쇠에 걸려 눌린 채, 아래 손잡이는 방금 풀려 수평으로 떨어진 뒤 태핏에 들린다
    aU = -W.aTrip;
    aL = Math.max(W.aTrip * (1 - smooth(u / W.snap)), cL);
    gam = W.dGam * late(cL / W.aTrip);
  } else {
    // 내려감: 아래 손잡이는 걸쇠에 걸려 들린 채, 위 손잡이는 풀려 뒷추에 끌려 수평으로 올라간 뒤 태핏에 눌린다
    aL = W.aTrip;
    aU = Math.min(-W.aTrip * (1 - smooth((u - Math.PI) / W.snap)), cU);
    gam = W.dGam * (1 - late(cU / -W.aTrip));
  }
  return { u, rodY, aU, aL, gam, up: u < Math.PI };
}

/** 축 로컬 점 → 월드(축 회전 phi = −a) */
export function onShaft182(which: 'U' | 'L', local: V2, a: number): V2 {
  return add(which === 'U' ? W.U : W.L, rot(local, -a));
}

/** 걸쇠 로컬(걸쇠 각 0 = 위 손잡이를 잡은 자세) 의 두 갈고리 자리와 열린 쪽 */
function catchGeom(): { hu: V2; hl: V2; ou: V2; ol: V2 } {
  const pu1 = onShaft182('U', PIN_U, -W.aTrip); // 위 핀(눌려 걸린 자세)
  const pl2 = onShaft182('L', PIN_L, W.aTrip); // 아래 핀(들려 걸린 자세)
  const hu = sub(pu1, W.C);
  const hl = rot(sub(pl2, W.C), -W.dGam);
  // 열린 쪽: 걸리기 전 핀이 갈고리에서 본 방향(걸쇠 로컬)
  const puSet = onShaft182('U', PIN_U, 0);
  const huAtG2 = add(W.C, rot(hu, W.dGam));
  const ou = norm(rot(sub(puSet, huAtG2), -W.dGam));
  const plSet = onShaft182('L', PIN_L, 0);
  const ol = norm(sub(plSet, add(W.C, hl)));
  return { hu, hl, ou, ol };
}
export const CATCH182 = catchGeom();

// ───────── 부품 ─────────

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
const zCyl = (r: number, z0: number, z1: number, c = 0.006): THREE.BufferGeometry => lathe(rodProfile(r, z0, z1, c, c), 28).rotateX(Math.PI / 2);
const zTube = (rIn: number, rOut: number, z0: number, z1: number): THREE.BufferGeometry => lathe(tubeProfile(rIn, rOut, z0, z1, 0.006), 36).rotateX(Math.PI / 2);
/** 구멍 난 원판(Z 두께), 가운데 z */
function ring(rIn: number, rOut: number, thick: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(h);
  return extrude(s, thick, 0.006, 40);
}

/** 고정 축(뒤판 보스에서 앞으로, 끝 너트). 원점 = (x, y, 0) */
export function stud182(x: number, y: number, zFront: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  g.add(meshAt(zCyl(W.studR, STAGE.backZ, zFront), steel(), 0, 0, 0));
  g.add(meshAt(zCyl(0.12, STAGE.backZ, STAGE.backZ + 0.08, 0.012), darkSteel(), 0, 0, 0));
  const nut = hexPrism(0.11, 0.03, true, true, W.studR + 0.002);
  nut.rotateX(Math.PI / 2);
  g.add(meshAt(nut, darkSteel(), 0, 0, zFront - 0.015));
  setMM(g, { kind: 'shaft', axis: 'z', r: W.studR, z0: STAGE.backZ, z1: zFront });
  return g;
}

/** 손잡이 축 뭉치: 허브·뒤 관 + 손잡이(−X, 끝 고리) + 걸쇠 핀 + 밸브 팔(앞·뒤) + (위) 뒷추. 원점 = 축 중심, 회전 = rotation.z */
export function handle182(which: 'U' | 'L'): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  const st = steel();
  const hole = W.studR + 0.005;
  // 허브(앞) + 관(뒤 팔 층까지)
  g.add(meshAt(ring(hole, 0.12, 0.08), iron, 0, 0, W.zH));
  g.add(meshAt(zTube(hole, 0.085, STAGE.backZ + 0.085, W.zH - 0.035), iron, 0, 0, 0));
  // 손잡이(−X) + 끝 고리
  g.add(meshAt(extrude(stadiumShape(-0.11, 0, -W.HL, 0, W.w), W.hT, 0.008), iron, 0, 0, W.zH));
  const curl = new THREE.TorusGeometry(0.05, 0.017, 12, 28, Math.PI * 1.5);
  curl.rotateZ(which === 'U' ? -Math.PI * 0.25 : Math.PI * 0.75);
  g.add(meshAt(curl, iron, -W.HL - 0.035, which === 'U' ? 0.045 : -0.045, W.zH));
  // 걸쇠 핀(걸쇠 층까지)
  const pin = which === 'U' ? PIN_U : PIN_L;
  if (which === 'L') g.add(meshAt(extrude(stadiumShape(0.08 * Math.cos(0.946), 0.08 * Math.sin(0.946), pin[0], pin[1], 0.045), W.hT, 0.008), iron, 0, 0, W.zH));
  g.add(meshAt(zCyl(W.pinR, W.zH, W.zK + W.kT / 2 + 0.015), st, pin[0], pin[1], 0));
  // 밸브 팔
  for (const v of VALVES182.filter((q) => q.shaft === which)) {
    const end: V2 = [v.len * Math.cos(v.arm), v.len * Math.sin(v.arm)];
    const back = v.zc < 0;
    const z = back ? W.zB : W.zH;
    const r0 = back ? 0.07 : 0.1;
    g.add(meshAt(extrude(stadiumShape(r0 * Math.cos(v.arm), r0 * Math.sin(v.arm), end[0], end[1], 0.035), W.hT, 0.008), iron, 0, 0, z));
    g.add(meshAt(ring(0.001, 0.05, W.hT), iron, end[0], end[1], z));
    // 팔 끝 핀(밸브 막대 눈이 걸린다)
    const z1 = v.zc + 0.04;
    g.add(meshAt(zCyl(0.025, z - 0.02, z1), st, end[0], end[1], 0));
  }
  if (which === 'U') {
    // 뒷추: 뒤 층 팔 끝의 둥근 추 — 풀린 위 손잡이를 끌어올린다
    const a = -0.5;
    const e: V2 = [0.45 * Math.cos(a), 0.45 * Math.sin(a)];
    g.add(meshAt(extrude(stadiumShape(0.07 * Math.cos(a), 0.07 * Math.sin(a), e[0], e[1], 0.03), W.hT, 0.008), iron, 0, 0, W.zB));
    const wt = meshAt(zCyl(0.1, W.zB - 0.045, W.zB + 0.045, 0.012), darkSteel(), e[0], e[1], 0);
    wt.name = 'backWeight';
    g.add(wt);
  }
  // 표시점(허브 앞면) — 도는 것이 보이게
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.014, 0.01), paint(0xf2b619), -0.085, 0, W.zH + 0.042));
  setMM(g, { kind: 'handle', which });
  return g;
}

/** 굽은 띠(가운데선 점들, 반폭 hw) → 다각형 */
function band(path: V2[], hw: number): V2[] {
  const L: V2[] = [];
  const R: V2[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i] as V2;
    const a = path[Math.max(0, i - 1)] as V2;
    const b = path[Math.min(path.length - 1, i + 1)] as V2;
    const t = norm(sub(b, a));
    L.push([p[0] - t[1] * hw, p[1] + t[0] * hw]);
    R.push([p[0] + t[1] * hw, p[1] - t[0] * hw]);
  }
  return [...L, ...R.reverse()];
}
function bezier(p0: V2, c: V2, p1: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = 1 - t;
    out.push([s * s * p0[0] + 2 * s * t * c[0] + t * t * p1[0], s * s * p0[1] + 2 * s * t * c[1] + t * t * p1[1]]);
  }
  return out;
}
/** 갈고리(핀을 감싸는 반달 고리): 핀 중심 p, 열린 쪽 o */
function claw(p: V2, o: V2): V2[] {
  const rIn = W.pinR + 0.012;
  const rOut = rIn + 0.042;
  const a0 = Math.atan2(o[1], o[0]) + Math.PI * 0.5;
  const pts: V2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (Math.PI * i) / n;
    pts.push([p[0] + rOut * Math.cos(a), p[1] + rOut * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + (Math.PI * i) / n;
    pts.push([p[0] + rIn * Math.cos(a), p[1] + rIn * Math.sin(a)]);
  }
  return pts;
}

/** 비스듬한 걸쇠: 가운데 축 구멍 + 위·아래로 S 자로 굽은 팔 + 끝의 갈고리. 원점 = 걸쇠 축, 회전 = rotation.z */
export function catch182(): THREE.Group {
  const g = new THREE.Group();
  const mat = brass();
  const { hu, hl, ou, ol } = CATCH182;
  const hw = 0.042;
  const rHub = 0.11;
  const arm = (h: V2, o: V2, bend: number): void => {
    const end = sub(h, [o[0] * (W.pinR + 0.04), o[1] * (W.pinR + 0.04)]);
    const dir = norm(end);
    const start: V2 = [dir[0] * (rHub - 0.025), dir[1] * (rHub - 0.025)];
    const mid: V2 = [(start[0] + end[0]) / 2 - dir[1] * bend, (start[1] + end[1]) / 2 + dir[0] * bend];
    g.add(meshAt(extrude(shapeFrom(band(bezier(start, mid, end, 16), hw)), W.kT, 0.008), mat, 0, 0, 0));
    g.add(meshAt(extrude(shapeFrom(claw(h, o)), W.kT + 0.006, 0.008), mat, 0, 0, 0));
  };
  arm(hu, ou, 0.09);
  arm(hl, ol, 0.09);
  g.add(meshAt(ring(W.studR + 0.005, rHub, W.kT + 0.012), mat, 0, 0, 0));
  setMM(g, { kind: 'catch' });
  return g;
}

/** 피스톤 막대(밸브를 여닫는 막대, plug-rod) + 태핏 둘. 원점 = 막대 아래 끝 가운데(x = XR) */
export function plugRod182(): THREE.Group {
  const g = new THREE.Group();
  const d = W.zR1 - W.zR0;
  const zc = (W.zR0 + W.zR1) / 2;
  g.add(meshAt(new THREE.BoxGeometry(W.RW * 2, W.rodLen, d), castIron(), 0, W.rodLen / 2, zc));
  const tz0 = W.zR1;
  const tz1 = W.zH + W.hT / 2 + 0.02;
  const tapGeo = extrude(roundedRect(-W.RW, -W.tapH / 2, W.RW, W.tapH / 2, 0.015), tz1 - tz0, 0.008);
  const tL = meshAt(tapGeo, darkSteel(), 0, TAP_L_TOP - W.tapH / 2, (tz0 + tz1) / 2);
  tL.name = 'tappetL';
  const tU = meshAt(tapGeo, darkSteel(), 0, TAP_U_BOT + W.tapH / 2, (tz0 + tz1) / 2);
  tU.name = 'tappetU';
  g.add(tL, tU);
  setMM(g, { kind: 'bar', length: W.rodLen });
  return g;
}

/** 막대 안내(뒤판에 박힌 두 볼과 앞 띠). y = 가운데 높이 */
export function rodGuide182(y: number): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  const h = 0.12;
  const zf = W.zR1 + 0.024; // 앞 띠 앞면
  const x0 = W.XR - W.RW;
  const x1 = W.XR + W.RW;
  for (const s of [-1, 1]) {
    const xc = s < 0 ? x0 - 0.024 : x1 + 0.024;
    g.add(meshAt(new THREE.BoxGeometry(0.04, h, zf - STAGE.backZ), iron, xc, y, (zf + STAGE.backZ) / 2));
  }
  g.add(meshAt(new THREE.BoxGeometry(x1 - x0 + 0.088, h, 0.02), iron, W.XR, y, zf - 0.01));
  setMM(g, { kind: 'guide' });
  return g;
}

/** 밸브 하나의 기하: 팔 끝 핀(월드), 막대 아래 끝 J, 밸브 원판 y */
export interface ValvePose182 {
  pin: V2;
  J: V2;
  disc: number;
}
export function valvePose182(v: Valve182, a: number, sp: number): ValvePose182 {
  const pin = onShaft182(v.shaft, [v.len * Math.cos(v.arm), v.len * Math.sin(v.arm)], a);
  const dx = pin[0] - v.xg;
  const jy = pin[1] - Math.sqrt(v.link * v.link - dx * dx);
  return { pin, J: [v.xg, jy], disc: jy - sp };
}
const DISC_H = 0.035;
const PLATE = 0.025;
/** 밸브 상자 치수: 막대 이동 범위에서 계산 */
export function valveSpec182(v: Valve182): { sp: number; yTopPlate: number; yBotPlate: number; jMin: number; jMax: number; closedY: number } {
  const j0 = valvePose182(v, 0, 0).J[1];
  const j1 = valvePose182(v, v.shaft === 'U' ? -W.aTrip : W.aTrip, 0).J[1];
  const jMin = Math.min(j0, j1);
  const jMax = Math.max(j0, j1);
  const travel = jMax - jMin;
  const gTop = v.seat === 'top' ? 0.004 : 0.03;
  const gBot = v.seat === 'bottom' ? 0.004 : 0.02;
  const sp = travel + 0.1 + gTop;
  const yTopPlate = jMax - sp + DISC_H / 2 + gTop + PLATE / 2; // 위 판 가운데
  const yBotPlate = jMin - sp - DISC_H / 2 - gBot - PLATE / 2;
  // 닫힘 = 원판이 자리 판에 닿음: seat top → 원판이 위(J 최대), bottom → 아래
  const closedY = v.seat === 'top' ? jMax : jMin;
  return { sp, yTopPlate, yBotPlate, jMin, jMax, closedY };
}

/** 밸브 상자(고정): 뒤 몸체 + 위·아래 판(위 판에 막대 구멍) + 기둥 둘. 원점 = (xg, 0, 0) */
export function valveChest182(v: Valve182): THREE.Group {
  const g = new THREE.Group();
  g.position.set(v.xg, 0, 0);
  const s = valveSpec182(v);
  const zf = v.zc - 0.05; // 막대·원판 층
  const zb = zf - 0.08;
  const iron = castIron();
  const hw = 0.085;
  const yb = s.yBotPlate - PLATE / 2;
  const yt = s.yTopPlate + PLATE / 2;
  g.add(meshAt(new THREE.BoxGeometry(hw * 2, yt - yb, zb - STAGE.backZ), iron, 0, (yb + yt) / 2, (zb + STAGE.backZ) / 2));
  const plate = (y: number, withHole: boolean): void => {
    const sh = roundedRect(-hw, zb, hw, zf + 0.08, 0.01);
    if (withHole) {
      const h = new THREE.Path();
      h.absarc(0, zf, 0.026, 0, Math.PI * 2, true);
      sh.holes.push(h);
    }
    const geo = extrude(sh, PLATE, 0.005);
    geo.rotateX(Math.PI / 2); // 두께 → Y, 모양의 y → z
    g.add(meshAt(geo, iron, 0, y, 0));
  };
  plate(s.yTopPlate, true);
  plate(s.yBotPlate, false);
  for (const sx of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(0.02, yt - yb, 0.16), iron, sx * (hw - 0.01), (yb + yt) / 2, zf));
  setMM(g, { kind: 'chest' });
  return g;
}

/** 밸브 막대(팔 끝 핀 ↔ J, 양 끝 눈). 원점 = 팔 끝 핀, 로컬 −Y 로 link 길이. rotation.z 로 기울인다 */
export function valveLink182(v: Valve182): THREE.Group {
  const g = new THREE.Group();
  const st = steel();
  g.add(meshAt(ring(0.029, 0.055, 0.05), st, 0, 0, v.zc));
  g.add(meshAt(ring(0.026, 0.05, 0.05), st, 0, -v.link, v.zc));
  const r = mesh(lathe(rodProfile(0.02, 0.05, v.link - 0.045), 20), st);
  r.rotation.z = Math.PI;
  r.position.set(0, 0, v.zc);
  g.add(r);
  setMM(g, { kind: 'link', length: v.link });
  return g;
}

/** 밸브 심축 + 원판: 원점 = J(막대 아래 눈 핀), 아래로 sp 에 원판 */
export function valveSpindle182(v: Valve182): THREE.Group {
  const g = new THREE.Group();
  const s = valveSpec182(v);
  const zf = v.zc - 0.05;
  const st = steel();
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.06, 0.04), darkSteel(), 0, 0, zf));
  g.add(meshAt(zCyl(0.022, zf + 0.02, v.zc + 0.04, 0.004), st, 0, 0, 0));
  const sp = mesh(lathe(rodProfile(0.02, 0, s.sp - 0.03), 20), st);
  sp.rotation.z = Math.PI;
  sp.position.set(0, -0.03, zf);
  g.add(sp);
  const disc = mesh(lathe(rodProfile(0.062, -DISC_H / 2, DISC_H / 2, 0.006, 0.006), 32), brass());
  disc.position.set(0, -s.sp, zf);
  g.add(disc);
  setMM(g, { kind: 'valve', key: v.key });
  return g;
}

/** 밸브가 열렸는가(손잡이 앙각 a 에서) — 닫힘 = 원판이 자리 판에 닿은 자세 */
export function valveOpen182(v: Valve182, a: number): number {
  const s = valveSpec182(v);
  const j = valvePose182(v, a, 0).J[1];
  return Math.abs(j - s.closedY) / (s.jMax - s.jMin);
}
