// 74·75·76번 전용 키트 — 이가 일부만 난 베벨 기어(74), 톱니(래칫) 바퀴와 폴 풀이(75·76), 계수기 탭핏(76)
// (기존 키트 파일·index.ts 는 건드리지 않는다. 모델은 '../kit/k074' 에서 직접 import)
// 치수의 근거와 침범 측정은 shots/_verify/s074.mjs · s075.mjs · s076.mjs
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, lathe, loft, mesh, rodProfile, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 회전축 = 로컬 Z 인 관(구멍 있는 원통) — z0 → z1 */
function ringZ(rIn: number, rOut: number, z0: number, z1: number, c: number, mat: THREE.Material): THREE.Mesh {
  const geo = lathe(tubeProfile(rIn, rOut, z0, z1, c), 36);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

/** 회전축 = 로컬 Z 인 속 찬 핀 — z0 → z1 */
function pinZ(r: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const geo = lathe(rodProfile(r, z0, z1, r * 0.2, r * 0.2), 24);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

const polar = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** 점 p 와 닫힌 다각형의 부호 있는 거리: 바깥 +, 안 − */
export function polyDepth74(p: V2, poly: readonly V2[]): number {
  let m = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    m = Math.min(m, segDist(p, pj, pi));
    if (pi[1] > p[1] !== pj[1] > p[1] && p[0] < ((pj[0] - pi[0]) * (p[1] - pi[1])) / (pj[1] - pi[1]) + pi[0]) inside = !inside;
  }
  return inside ? -m : m;
}

// ───────────────────────── 074 이가 일부만 난 베벨 기어 ─────────────────────────

/** 베벨 이 모양: tip·root = 이끝·이뿌리 반폭(피치각의 비율), add·ded = 이끝·이뿌리 높이(module 배, 피치 원뿔에 수직) */
export interface BevelShape74 {
  tip: number;
  root: number;
  add: number;
  ded: number;
  /** 이가 일부만 난 기어의 첫 이·끝 이의 이끝 높이 배율(기본 1). 1 보다 작게 깎으면 서 있는 상대 이의 끝을 비켜 드나든다 */
  endAdd?: number;
}
/** 74번 이 모양 — 이뿌리를 1.15 로 깊게 해 이끝(0.9)과 0.25·module 의 틈을 둔다(민 부분 위로 이가 지나간다). 첫 이·끝 이는 0.15 로 낮춘다(s074.mjs: 1 이면 드나들 때 0.015 박힘, 0.15 면 0) */
export const K74_SHAPE: BevelShape74 = { tip: 0.12, root: 0.25, add: 0.9, ded: 1.15, endAdd: 0.15 };

/**
 * 큰 쪽 끝 단면 윤곽(반시계). 이 k(0 ≤ k < present)의 중심 = 로컬 각 k·(2π/teeth), 사다리꼴 이.
 * present < teeth 이면 나머지 구간은 이뿌리 반지름의 민 원호(이를 깎아 낸 자리).
 */
export function sectorBevelOutline(teeth: number, module: number, delta: number, present: number, shape: BevelShape74 = K74_SHAPE): V2[] {
  const R = (teeth * module) / 2;
  const rt = R + (module * shape.add) / Math.cos(delta);
  const rf = R - (module * shape.ded) / Math.cos(delta);
  const p = TAU / teeth;
  const wt = shape.tip * p;
  const wr = shape.root * p;
  const out: V2[] = [];
  for (let i = 0; i < present; i++) {
    const a = i * p;
    const low = present < teeth && (i === 0 || i === present - 1) ? (shape.endAdd ?? 1) : 1;
    const rti = R + ((rt - R) * low);
    const wti = wt + (wr - wt) * (1 - low) * ((rt - R) / (rt - rf)); // 낮춘 이는 같은 옆면 기울기로 끝이 넓어진다
    out.push(polar(rf, a - wr), polar(rti, a - wti), polar(rti, a + wti), polar(rf, a + wr));
    if (i < present - 1) out.push(polar(rf, a + p / 2));
  }
  if (present < teeth) {
    const a0 = (present - 1) * p + wr;
    const a1 = TAU - wr;
    const n = Math.max(2, Math.round((a1 - a0) / (p / 4)));
    for (let k = 1; k < n; k++) out.push(polar(rf, a0 + ((a1 - a0) * k) / n));
  } else out.push(polar(rf, (present - 1) * p + p / 2));
  return out;
}

export interface SectorBevelOpts {
  /** 이 폭(원뿔 모선 방향 길이, 기본 0.16) */
  face?: number;
  driver?: boolean;
  /** 축 구멍 반지름(기본 0.045) */
  bore?: number;
  shape?: BevelShape74;
}

/**
 * 피치 원뿔 반각 delta 인 직선 이 베벨 기어. 이는 k = 0 … present−1 만 있고 나머지 둘레는 이뿌리 원뿔의 민 면(present = teeth 면 온전한 기어).
 * 회전축 = 로컬 Z, 원점 = 큰 쪽 피치원 중심, 이는 z ∈ [0, face·cosδ] 에서 꼭짓점 (0, 0, R/tanδ) 쪽으로 가늘어진다(gear5 의 coneBevelGear 와 같은 틀).
 * 뒤(z < 0)에 둥근 뒷판 + 허브. 표시선 = 이 0 의 윗면 모선.
 * userData.bevel = { teeth, present, module, delta, R, A, zT }, userData.mm = { kind:'gear', … }.
 */
export function sectorBevelGear(teeth: number, module: number, delta: number, present: number, opts: SectorBevelOpts = {}): THREE.Group {
  const face = opts.face ?? 0.16;
  const shape = opts.shape ?? K74_SHAPE;
  const R = (teeth * module) / 2;
  const A = R / Math.tan(delta);
  const zT = face * Math.cos(delta);
  const k = 1 - zT / A;
  const rf = R - (module * shape.ded) / Math.cos(delta);
  const rt = R + (module * shape.add) / Math.cos(delta);
  const bore = opts.bore ?? 0.045;
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  const outline = sectorBevelOutline(teeth, module, delta, present, shape);
  g.add(
    mesh(
      loft(outline, [circlePts(bore, 32)], [
        { z: 0, s: 1, hs: 1 },
        { z: zT, s: k, hs: 1 }
      ]),
      body
    )
  );
  const blankT = Math.min(0.08, face * 0.5);
  g.add(ringZ(bore, rf * 0.985, -blankT, 0.002, 0.008, body));
  g.add(ringZ(bore, bore * 2.0, -blankT - 0.05, -blankT, 0.007, darkSteel()));
  g.add(ringZ(bore, bore * 1.6, zT, zT + 0.04, 0.006, steel()));
  const p0 = new THREE.Vector3(rt + 0.003, 0, 0);
  const p1 = new THREE.Vector3(rt * k + 0.003, 0, zT);
  const m = mesh(new THREE.BoxGeometry(0.012, 0.012, p0.distanceTo(p1) * 0.9), paint(MARK));
  m.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p1.clone().sub(p0).normalize());
  g.add(m);
  g.userData.bevel = { teeth, present, module, delta, R, A, zT };
  setMM(g, { kind: 'gear', fn: 'sectorBevelGear', teeth, present, module, internal: false, rp: R, ra: rt, rf, width: zT, axis: 'z', delta, apex: [0, 0, A] });
  return g;
}

/**
 * 간헐 구동 각: 구동 각 theta(누적)에서, 한 바퀴(2π) 가운데 [start, start + span) 구간에서만 같은 빠르기로 따라 도는 종동의 "유효 구동 각".
 * 돌아간 바퀴 수 N = floor((theta − start)/2π), u = (theta − start) − 2πN → N·span + min(u, span). 음수 theta(역회전)에도 같은 식.
 */
export function windowAngle(theta: number, start: number, span: number): number {
  const x = theta - start;
  const n = Math.floor(x / TAU);
  return n * span + Math.min(x - n * TAU, span);
}

// ───────────────────────── 075·076 톱니(래칫) 바퀴 ─────────────────────────

/**
 * 톱니 바퀴 규격. dir = +1: 바퀴가 반시계(+)로만 돈다 — 곧은(반지름 방향) 면이 로컬 각 k·q 에 있고 시계 쪽을 보며, 그 면에서 반시계 쪽으로 등이 이끝(rOut)에서 이뿌리(rRoot)까지 내려간다.
 * dir = −1 은 그 거울(바퀴가 시계로만 돈다, 곧은 면이 반시계 쪽을 본다).
 */
export interface SawSpec {
  teeth: number;
  rOut: number;
  rRoot: number;
  dir: 1 | -1;
}

/** 로컬 극각 a 에서의 톱니 윤곽 반지름(등은 이끝과 이뿌리를 잇는 직선) */
export function sawRadius(spec: SawSpec, a: number): number {
  const q = TAU / spec.teeth;
  let x = (spec.dir * a) % q;
  if (x < 0) x += q;
  return (spec.rOut * spec.rRoot * Math.sin(q)) / (spec.rOut * Math.sin(x) + spec.rRoot * Math.sin(q - x));
}

/** 톱니 윤곽(로컬). 이끝 꼭짓점 = polar(rOut, dir·k·q) */
export function sawOutline(spec: SawSpec): V2[] {
  const q = TAU / spec.teeth;
  const out: V2[] = [];
  for (let k = 0; k < spec.teeth; k++) out.push(polar(spec.rRoot, spec.dir * k * q), polar(spec.rOut, spec.dir * k * q));
  return spec.dir === 1 ? out : out.reverse();
}

export interface SawWheelOpts {
  width?: number;
  bore?: number;
  /** 가벼운 구멍 수(기본 5, 0 이면 없음) */
  holes?: number;
  /** 안쪽 테(판화의 동심원) 반지름 — 주면 그 원에 얇은 턱 */
  ringR?: number;
  kind?: 'steel' | 'brass';
}

/**
 * 톱니(래칫) 바퀴: 회전축 = 로컬 Z, z 가운데 0, 두께 width(기본 0.08). 허브 + 표시점.
 * 판 메시의 userData.outline = 톱니 윤곽(침범 검사용), 그룹 userData.mm = { kind:'ratchet', teeth, rOut, rRoot, dir }.
 */
export function sawWheel(spec: SawSpec, opts: SawWheelOpts = {}): THREE.Group {
  const width = opts.width ?? 0.08;
  const bore = opts.bore ?? 0.05;
  const holes = opts.holes ?? 5;
  const mat = opts.kind === 'steel' ? steel() : brass();
  const outline = sawOutline(spec);
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, bore));
  const rh = spec.rRoot * 0.56;
  for (let i = 0; i < holes; i++) shape.holes.push(circlePath(Math.cos((i / holes) * TAU + 0.3) * rh, Math.sin((i / holes) * TAU + 0.3) * rh, spec.rRoot * 0.17));
  const g = new THREE.Group();
  const plate = mesh(extrude(shape, width, 0.004), mat);
  plate.userData.outline = outline;
  g.add(plate);
  g.add(ringZ(bore, bore * 2.1, -width / 2 - 0.012, width / 2 + 0.012, 0.006, darkSteel()));
  if (opts.ringR !== undefined) g.add(ringZ(opts.ringR - 0.012, opts.ringR, width / 2 - 0.002, width / 2 + 0.008, 0.002, mat));
  g.add(meshAt(new THREE.BoxGeometry(0.07, 0.016, 0.008), paint(MARK), spec.rRoot * 0.86, 0, width / 2 + 0.004));
  setMM(g, { kind: 'ratchet', fn: 'sawWheel', teeth: spec.teeth, rOut: spec.rOut, rRoot: spec.rRoot, dir: spec.dir, width, axis: 'z' });
  return g;
}

/** 풀이에서 곧은 면을 이만큼(rad) 비켜 본다 — 끝이 면에 정확히 닿은 자세에서 반올림 오차로 이끝 위로 튀지 않게 */
const FACE_EPS = 2e-4;

/**
 * 폴(따라가는 팔)의 자세 풀이. 바퀴 중심을 원점으로, 받침 핀 pivot, 핀에서 끝까지 길이 L 인 팔의 끝이 톱니 윤곽에 얹힌 자세를 찾아
 * **핀 → 끝 방향의 각(rad, 세계)** 을 돌려준다. side = +1 이면 끝이 핀의 반시계 쪽, −1 이면 시계 쪽(바퀴 중심에서 볼 때).
 * 끝은 바깥(rOut + 0.02)에서 안으로 내려오다 처음 닿는 곳에 선다(제 무게·스프링으로 눌린 폴). 팔이 바퀴 둘레를 따라 누운 폴(핀과 끝의 반지름 차 < L)에 쓴다.
 * wheelAngle = 바퀴의 회전각(로컬 → 세계).
 */
export function followerAngle(spec: SawSpec, wheelAngle: number, pivot: V2, L: number, side: 1 | -1): number {
  const rP = Math.hypot(pivot[0], pivot[1]);
  const aP = Math.atan2(pivot[1], pivot[0]);
  const tipAng = (r: number): number => aP + side * Math.acos(Math.max(-1, Math.min(1, (rP * rP + r * r - L * L) / (2 * rP * r))));
  const gap = (r: number): number => r - sawRadius(spec, tipAng(r) - wheelAngle - spec.dir * FACE_EPS);
  const hi = Math.min(spec.rOut + 0.02, rP + L - 1e-6);
  const lo = Math.max(spec.rRoot, Math.abs(rP - L) + 1e-6);
  let r = lo;
  if (gap(hi) <= 0) r = hi;
  else {
    const N = 60;
    let prev = hi;
    for (let i = 1; i <= N; i++) {
      const ri = hi - ((hi - lo) * i) / N;
      if (gap(ri) <= 0) {
        let a = ri;
        let b = prev;
        for (let k = 0; k < 26; k++) {
          const mid = (a + b) / 2;
          if (gap(mid) <= 0) a = mid;
          else b = mid;
        }
        r = b;
        break;
      }
      prev = ri;
      r = ri;
    }
  }
  const t = polar(r, tipAng(r));
  return Math.atan2(t[1] - pivot[1], t[0] - pivot[0]);
}

export interface PawlOpts {
  /** 받침 쪽 폭(기본 0.08) */
  wBase?: number;
  /** 끝(부리) 쪽 폭(기본 0.03) */
  wTip?: number;
  /** 이끝 원 위로 띄우는 틈(기본 0.022) */
  clear?: number;
  /** 부리가 차지하는 각(피치의 비율, 기본 0.42) */
  beak?: number;
  thick?: number;
  kind?: 'steel' | 'bronze';
}

export interface PawlShape {
  /** 폴 로컬 윤곽: 핀 = 원점, 물린 자세에서 끝 = (L, 0) */
  outline: V2[];
  L: number;
  /** 물린 자세의 핀 → 끝 방향 각(바퀴 각 0, 끝이 로컬 각 tipA 의 곧은 면 뿌리에 닿은 자세) */
  lambda0: number;
  /** 물린 자세의 핀 자리(바퀴 중심 원점) */
  pivot: V2;
}

/**
 * 폴 윤곽을 만든다. 바퀴 중심을 원점으로, 끝(부리 끝)이 polar(rRoot, tipA) — 곧은 면의 뿌리 — 에 닿고 핀이 polar(rPivot, tipA − dir·span) 에 있는 자세에서
 * 안쪽 가장자리가 이끝 원보다 clear 만큼 뜨도록(부리만 이 사이로 내려감) 그린 뿔 모양. 부리의 앞변은 곧은 면을 따라 반지름 방향.
 * 폴은 늘 곧은 면이 보는 쪽(−dir)에 눕는다.
 */
export function pawlShape(spec: SawSpec, rPivot: number, span: number, tipA = 0, opts: PawlOpts = {}): PawlShape {
  const wBase = opts.wBase ?? 0.08;
  const wTip = opts.wTip ?? 0.03;
  const clear = opts.clear ?? 0.022;
  const q = TAU / spec.teeth;
  const bk = (opts.beak ?? 0.42) * q;
  const s = -spec.dir; // 핀이 있는 쪽
  const rC = spec.rOut + clear;
  const tip = polar(spec.rRoot, tipA);
  const P = polar(rPivot, tipA + s * span);
  const n = 16;
  const inner: V2[] = [];
  const outer: V2[] = [];
  const aP = tipA + s * span;
  const rIn0 = Math.max(rC, rPivot - wBase / 2);
  const b0 = polar(rC, tipA + s * bk);
  const b1 = polar(rIn0, aP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = b0[0] + (b1[0] - b0[0]) * t;
    const y = b0[1] + (b1[1] - b0[1]) * t;
    const rr = Math.max(rC, Math.hypot(x, y));
    const a = Math.atan2(y, x);
    inner.push(polar(rr, a));
    outer.push(polar(rr + wTip + (wBase - wTip) * t, a));
  }
  const world: V2[] = [tip, ...inner];
  // 받침 쪽 둥근 끝(핀 둘레 반원)
  const e0 = inner[n]!;
  const e1 = outer[n]!;
  const cx = (e0[0] + e1[0]) / 2;
  const cy = (e0[1] + e1[1]) / 2;
  const rr = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) / 2;
  const a0 = Math.atan2(e0[1] - cy, e0[0] - cx);
  for (let k = 1; k < 10; k++) world.push([cx + rr * Math.cos(a0 - s * (Math.PI * k) / 10), cy + rr * Math.sin(a0 - s * (Math.PI * k) / 10)]);
  for (let i = n; i >= 0; i--) world.push(outer[i]!);
  world.push(polar(rC + wTip, tipA));
  const lambda0 = Math.atan2(tip[1] - P[1], tip[0] - P[0]);
  const L = Math.hypot(tip[0] - P[0], tip[1] - P[1]);
  const c = Math.cos(-lambda0);
  const sn = Math.sin(-lambda0);
  const outline = world.map(([x, y]): V2 => [(x - P[0]) * c - (y - P[1]) * sn, (x - P[0]) * sn + (y - P[1]) * c]);
  return { outline, L, lambda0, pivot: P };
}

/**
 * 폴 부품: pawlShape 의 윤곽을 두께 thick(기본 0.06, z 가운데 0) 판으로. 원점 = 받침 핀, 물린 자세에서 끝이 로컬 +X 의 L.
 * 모델은 group.position = 핀 자리, group.rotation.z = followerAngle(...) 로 놓는다. 판 메시 userData.outline, 그룹 userData.pawl = { L, lambda0 }.
 */
export function ratchetPawl(shape: PawlShape, opts: PawlOpts = {}): THREE.Group {
  const thick = opts.thick ?? 0.06;
  const g = new THREE.Group();
  const s = shapeFrom(shape.outline);
  s.holes.push(circlePath(0, 0, 0.018));
  const plate = mesh(extrude(s, thick, 0.005), opts.kind === 'bronze' ? bronze({ roughness: 0.34 }) : steel());
  plate.userData.outline = shape.outline;
  g.add(plate);
  g.add(pinZ(0.017, -thick / 2 - 0.01, thick / 2 + 0.016, darkSteel()));
  g.userData.pawl = { L: shape.L, lambda0: shape.lambda0 };
  setMM(g, { kind: 'pawl', fn: 'ratchetPawl', L: shape.L });
  return g;
}

// ───────────────────────── 075 흔들 막대 · 이음 막대 ─────────────────────────

/**
 * 두 팔 흔들 막대(75번 D): 원점 = 바퀴 축에 헐겁게 끼운 허브 고리, 로컬 각 aLong 방향으로 lenLong, aShort 방향으로 lenShort 의 팔. 양끝에 핀 보스.
 * 두께 thick(z 가운데 0). 윤곽은 담지 않는다(바퀴 앞 다른 층).
 */
export function rockerBar(lenLong: number, aLong: number, lenShort: number, aShort: number, opts: { halfW?: number; hubR?: number; bore?: number; thick?: number } = {}): THREE.Group {
  const hw = opts.halfW ?? 0.032;
  const hubR = opts.hubR ?? 0.11;
  const bore = opts.bore ?? 0.05;
  const thick = opts.thick ?? 0.045;
  const g = new THREE.Group();
  const arm = (len: number, a: number): void => {
    const sh = new THREE.Shape();
    const ex = Math.cos(a);
    const ey = Math.sin(a);
    const r0 = hubR * 0.8;
    const pts: V2[] = [
      [r0 * ex + hw * ey, r0 * ey - hw * ex],
      [len * ex + hw * ey, len * ey - hw * ex],
      [len * ex - hw * ey, len * ey + hw * ex],
      [r0 * ex - hw * ey, r0 * ey + hw * ex]
    ];
    pts.forEach(([x, y], i) => (i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)));
    sh.closePath();
    g.add(mesh(extrude(sh, thick, 0.006), steel()));
    const boss = ringZ(0.02, hw * 1.7, -thick / 2 - 0.006, thick / 2 + 0.006, 0.005, darkSteel());
    boss.position.set(len * ex, len * ey, 0);
    g.add(boss);
  };
  arm(lenLong, aLong);
  arm(lenShort, aShort);
  g.add(ringZ(bore, hubR, -thick / 2 - 0.01, thick / 2 + 0.01, 0.008, darkSteel()));
  setMM(g, { kind: 'lever', fn: 'rockerBar' });
  return g;
}

/** 이음 막대(75번 C): 원점 = 위쪽 눈(핀 구멍), 로컬 +X 로 length 지점에 아래쪽 눈. 둥근 막대 + 양끝 눈 고리. 축 = 로컬 X */
export function eyeRod(length: number, r = 0.026): THREE.Group {
  const g = new THREE.Group();
  const geo = lathe(rodProfile(r, 0.04, length - 0.04, 0.004, 0.004), 20);
  geo.rotateZ(-Math.PI / 2);
  g.add(mesh(geo, steel()));
  for (const x of [0, length]) {
    const eye = ringZ(0.02, 0.05, -0.022, 0.022, 0.005, darkSteel());
    eye.position.set(x, 0, 0);
    g.add(eye);
  }
  setMM(g, { kind: 'link', fn: 'eyeRod', length });
  return g;
}

// ───────────────────────── 076 큰 바퀴(테 + 살 + 스터드) ─────────────────────────

/**
 * 테와 살로 된 큰 바퀴(76번의 "큰 바퀴"): 회전축 = 로컬 Z, z 가운데 0, 테 반지름 rIn~rOut, 살 spokes 개(로컬 각 0 부터 고르게), 허브.
 * 스터드(핀) 하나가 로컬 polar(studR, studA) 에서 앞(+z)으로 studLen 만큼 솟는다 — 스터드 메시 userData.outline(원), name 'stud'.
 * userData.mm = { kind:'wheel', r: rOut, width: thick, rim:'flat', axis:'z' }.
 */
export function rimWheel(
  rIn: number,
  rOut: number,
  spokes: number,
  stud: { r: number; a: number; rad: number; len: number },
  opts: { thick?: number; spokeHalfW?: number; hubR?: number; bore?: number } = {}
): THREE.Group {
  const thick = opts.thick ?? 0.08;
  const sw = opts.spokeHalfW ?? 0.07;
  const hubR = opts.hubR ?? 0.16;
  const bore = opts.bore ?? 0.05;
  const g = new THREE.Group();
  const body = bronze({ roughness: 0.4 });
  g.add(ringZ(rIn, rOut, -thick / 2, thick / 2, 0.008, body));
  g.add(ringZ(bore, hubR, -thick / 2 - 0.01, thick / 2 + 0.01, 0.008, body));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * TAU;
    const len = rIn + 0.01 - hubR * 0.9;
    const sp = mesh(new THREE.BoxGeometry(len, sw * 2, thick * 0.7), body);
    sp.position.set(Math.cos(a) * (hubR * 0.9 + len / 2), Math.sin(a) * (hubR * 0.9 + len / 2), 0);
    sp.rotation.z = a;
    g.add(sp);
  }
  const pin = pinZ(stud.rad, thick / 2 - 0.004, thick / 2 + stud.len, steel());
  pin.position.set(Math.cos(stud.a) * stud.r, Math.sin(stud.a) * stud.r, 0);
  pin.name = 'stud';
  pin.userData.outline = circlePts(stud.rad, 20);
  g.add(pin);
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.02, 0.008), paint(MARK), (rIn + rOut) / 2, 0, thick / 2 + 0.004));
  setMM(g, { kind: 'wheel', fn: 'rimWheel', r: rOut, width: thick, rim: 'flat', axis: 'z' });
  return g;
}

// ───────────────────────── 076 탭핏(받침 막대 + 꺾이는 끝) ─────────────────────────

/**
 * 계수기 탭핏의 치수. 좌표 원점 = 큰 바퀴·톱니 바퀴의 공통 중심.
 * 막대는 고정 받침 c 둘레로 흔들리는 스타디움(반폭 hw). 쉬는 자세의 막대 방향(받침 → 스터드 쪽 끝) = psi0.
 * 스터드 쪽 팔: 둥근 끝의 중심까지 e. 톱니 쪽 팔: 이음 핀 H 까지 lh. 꺾이는 끝(B)의 윗변은 막대 윗변과 한 직선이고 코끝 N 은 H 에서 막대 방향 반대로 ln.
 * 스터드: 반지름 rs, 중심이 반지름 rD 의 원을 **시계 방향**으로 돈다.
 */
export interface TappetSpec {
  c: V2;
  psi0: number;
  e: number;
  lh: number;
  ln: number;
  hw: number;
  rD: number;
  rs: number;
}

/**
 * 스터드가 극각 aD(rad)에 있을 때 막대가 쉬는 자세에서 시계 방향으로 눌린 각 β(≥ 0).
 * 스터드가 윗변(직선)에 닿으면 ρ·sin(ν − ψ) = hw + rs, 둥근 끝에 닿으면 |D − E| = hw + rs (ρ, ν = 받침에서 본 스터드의 극좌표, ψ = psi0 − β).
 * 닿지 않으면 0. 스터드가 끝을 벗어나는 순간(ρ = e + hw + rs) β 가 가장 크다.
 */
export function tappetBeta(t: TappetSpec, aD: number): number {
  const dx = t.rD * Math.cos(aD) - t.c[0];
  const dy = t.rD * Math.sin(aD) - t.c[1];
  const rho = Math.hypot(dx, dy);
  const nu = Math.atan2(dy, dx);
  const s = t.hw + t.rs;
  if (rho >= t.e + s || rho <= s) return 0;
  let rel: number; // ν − ψ
  if (Math.sqrt(rho * rho - s * s) <= t.e) rel = Math.asin(s / rho);
  else rel = Math.acos(Math.max(-1, Math.min(1, (rho * rho + t.e * t.e - s * s) / (2 * rho * t.e))));
  let beta = t.psi0 - nu + rel;
  beta = Math.atan2(Math.sin(beta), Math.cos(beta));
  return beta > 0 ? beta : 0;
}

/** 스터드가 막대 끝을 벗어나는 극각(ρ = e + hw + rs, 시계 방향으로 도는 스터드가 받침을 지난 뒤의 해). 이 뒤로는 막대가 제 무게로 돌아간다 */
export function tappetReleaseAngle(t: TappetSpec): number {
  const rc = Math.hypot(t.c[0], t.c[1]);
  const ac = Math.atan2(t.c[1], t.c[0]);
  const rho = t.e + t.hw + t.rs;
  return ac - Math.acos((t.rD * t.rD + rc * rc - rho * rho) / (2 * t.rD * rc));
}

/** β 가 가장 큰 스터드 극각과 그 값(닿음 ~ 벗어남 사이, 황금 분할). 막대는 벗어나기 조금 전에 가장 깊이 눌린다 */
export function tappetPeak(t: TappetSpec): { a: number; beta: number } {
  let lo = tappetReleaseAngle(t) + 1e-9;
  let hi = tappetTouchAngle(t);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 60; k++) {
    const x1 = hi - g * (hi - lo);
    const x2 = lo + g * (hi - lo);
    if (tappetBeta(t, x1) > tappetBeta(t, x2)) hi = x2;
    else lo = x1;
  }
  const a = (lo + hi) / 2;
  return { a, beta: tappetBeta(t, a) };
}

/** 스터드가 처음 막대에 닿는 극각(β 가 0 을 떠나는 자리) — 이분법 */
export function tappetTouchAngle(t: TappetSpec): number {
  const rel = tappetReleaseAngle(t);
  let a = rel + 1.2; // 닿기 전
  let b = rel + 1e-4; // 닿은 뒤
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2;
    if (tappetBeta(t, m) > 0) b = m;
    else a = m;
  }
  return a;
}

/** 막대가 β 만큼 눌렸을 때의 자세: 막대 방향 psi, 이음 핀 H, 코끝 N(꺾이지 않은 자세) */
export function tappetPose(t: TappetSpec, beta: number): { psi: number; h: V2; n: V2 } {
  const psi = t.psi0 - beta;
  const ex = Math.cos(psi);
  const ey = Math.sin(psi);
  const h: V2 = [t.c[0] - t.lh * ex, t.c[1] - t.lh * ey];
  const n: V2 = [h[0] - t.ln * ex - t.hw * ey, h[1] - t.ln * ey + t.hw * ex];
  return { psi, h, n };
}

/**
 * 막대가 β 만큼 눌렸을 때 윗변(직선)이 이끝 원(rOut)과 만나는 점의 극각 — 그 윗변에 얹힌 이끝의 자리.
 * φ = ψ + π/2 − acos(d / rOut), d = hw − c.x·sin ψ + c.y·cos ψ (중심에서 윗변 직선까지의 거리).
 */
export function tappetTipAngle(t: TappetSpec, rOut: number, beta: number): number {
  const psi = t.psi0 - beta;
  const d = t.hw - t.c[0] * Math.sin(psi) + t.c[1] * Math.cos(psi);
  return psi + Math.PI / 2 - Math.acos(Math.max(-1, Math.min(1, d / rOut)));
}

/**
 * 막대가 β 만큼 눌렸을 때(끝은 꺾이지 않음) 밀리는 이의 곧은 면이 있어야 할 극각.
 * 처음에는 이끝이 윗변에 얹혀 들리고(tappetTipAngle), 윗변이 곧은 면과 나란해진 뒤로는 코끝 N 이 면을 민다(N 의 극각) — 둘 가운데 큰 값.
 */
export function tappetFaceAngle(t: TappetSpec, rOut: number, beta: number): number {
  const n = tappetPose(t, beta).n;
  const aN = Math.hypot(n[0], n[1]) < rOut ? Math.atan2(n[1], n[0]) : -Infinity;
  return Math.max(tappetTipAngle(t, rOut, beta), aN);
}

/** 꺾이는 끝(B) 윤곽(로컬: 이음 핀 H = 원점, 막대 방향 = +X, 윗변 y = hw, 코끝 = (−ln, hw)). 막대의 둥근 끝을 감싸는 오목한 자리 + 아래로 처진 배(추) */
export function nosePieceOutline(t: TappetSpec): V2[] {
  const rs = t.hw + 0.004;
  const out: V2[] = [[-t.ln, t.hw]];
  const aTop = Math.PI - Math.asin(t.hw / rs); // 윗변과 오목 자리가 만나는 각
  out.push(polar(rs, aTop));
  const aBot = (255 * Math.PI) / 180;
  const n = 14;
  for (let k = 1; k <= n; k++) out.push(polar(rs, aTop + ((aBot - aTop) * k) / n));
  // 배(둥근 추): 중심 (−0.5·ln, −1.55·hw), 반지름 1.25·hw 의 아래쪽 호
  const bc: V2 = [-0.5 * t.ln, -1.45 * t.hw];
  const br = 1.25 * t.hw;
  for (let k = 0; k <= 12; k++) {
    const a = (-20 - (170 * k) / 12) * (Math.PI / 180);
    out.push([bc[0] + br * Math.cos(a), bc[1] + br * Math.sin(a)]);
  }
  return out;
}

/**
 * 꺾이는 끝이 톱니에 박히지 않는 가장 작은 꺾임 각 κ(≥ 0, 코가 들리는 쪽 = 이음 핀 둘레 시계 방향)를 찾는다.
 * outline = nosePieceOutline, h·psi = tappetPose 의 값, wheelAngle = 톱니 바퀴 회전각. tol = 허용 침범(기본 0.0006).
 */
export function noseFold(spec: SawSpec, wheelAngle: number, outline: readonly V2[], h: V2, psi: number, maxFold = 1.2, tol = 0.0006): number {
  const q = TAU / spec.teeth;
  // 윤곽을 촘촘히(변마다 0.012 간격)
  const dense: V2[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.012));
    for (let k = 0; k < m; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m]);
  }
  const depth = (kappa: number): number => {
    const ang = psi - kappa;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let worst = 0;
    for (const [x, y] of dense) {
      const wx = h[0] + x * c - y * s;
      const wy = h[1] + x * s + y * c;
      const r = Math.hypot(wx, wy);
      if (r >= spec.rOut) continue;
      const d = sawRadius(spec, Math.atan2(wy, wx) - wheelAngle - spec.dir * FACE_EPS) - r;
      if (d > worst) worst = d;
    }
    // 이끝 꼭짓점이 B 안에 들었는가
    const a0 = Math.atan2(h[1], h[0]) - wheelAngle;
    const k0 = Math.round((spec.dir * a0) / q);
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const tp = polar(spec.rOut, wheelAngle + spec.dir * k * q);
      const lx = (tp[0] - h[0]) * c + (tp[1] - h[1]) * s;
      const ly = -(tp[0] - h[0]) * s + (tp[1] - h[1]) * c;
      const d = -polyDepth74([lx, ly], outline);
      if (d > worst) worst = d;
    }
    return worst;
  };
  if (depth(0) <= tol) return 0;
  const step = 0.02;
  let prev = 0;
  for (let k = step; k <= maxFold; k += step) {
    if (depth(k) <= tol) {
      let a = prev;
      let b = k;
      for (let i = 0; i < 18; i++) {
        const m = (a + b) / 2;
        if (depth(m) <= tol) b = m;
        else a = m;
      }
      return b;
    }
    prev = k;
  }
  return maxFold;
}

/**
 * 탭핏 받침 막대: 원점 = 고정 받침(C), 로컬 +X = 스터드 쪽(둥근 끝 중심 e), −X = 톱니 쪽(이음 핀 lh). 스타디움 판(반폭 hw, 두께 thick, z 가운데 0).
 * 판 메시 userData.outline. 그룹 rotation.z = psi 로 놓는다.
 */
export function tappetBar(t: TappetSpec, thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const outline: V2[] = [];
  for (let k = 0; k <= 12; k++) outline.push([t.e + t.hw * Math.cos(-Math.PI / 2 + (Math.PI * k) / 12), t.hw * Math.sin(-Math.PI / 2 + (Math.PI * k) / 12)]);
  for (let k = 0; k <= 12; k++) outline.push([-t.lh + t.hw * Math.cos(Math.PI / 2 + (Math.PI * k) / 12), t.hw * Math.sin(Math.PI / 2 + (Math.PI * k) / 12)]);
  const sh = shapeFrom(outline);
  sh.holes.push(circlePath(0, 0, 0.02));
  const plate = mesh(extrude(sh, thick, 0.005), steel());
  plate.userData.outline = outline;
  g.add(plate);
  g.add(pinZ(0.019, -thick / 2 - 0.012, thick / 2 + 0.016, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(t.e * 0.5, 0.012, 0.006), paint(MARK), t.e * 0.5, 0, thick / 2 + 0.003));
  setMM(g, { kind: 'lever', fn: 'tappetBar' });
  return g;
}

/** 꺾이는 끝(B): 원점 = 이음 핀 H, 꺾이지 않은 자세에서 로컬 +X = 막대 방향. 판 메시 userData.outline. 그룹 rotation.z = psi − κ */
export function nosePiece(t: TappetSpec, thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const outline = nosePieceOutline(t);
  const plate = mesh(extrude(shapeFrom(outline), thick, 0.005), bronze({ roughness: 0.34 }));
  plate.userData.outline = outline;
  g.add(plate);
  // 이음 핀 머리(막대 끝 가운데) — 앞뒤 덮개판이 B 와 한 몸으로 막대 끝을 문다
  for (const z of [-thick / 2 - 0.006, thick / 2 + 0.006]) {
    const cap = mesh(extrude(shapeFrom(circlePts(t.hw * 0.8, 20)), 0.012, 0.003), bronze({ roughness: 0.34 }));
    cap.position.set(-t.hw * 0.25, 0, z);
    g.add(cap);
  }
  g.add(pinZ(0.014, -thick / 2 - 0.018, thick / 2 + 0.018, darkSteel()));
  setMM(g, { kind: 'pawl', fn: 'nosePiece' });
  return g;
}

/** 고정 받침 팔(판화에 없음): 원점 = 축, 로컬 +X 로 len 지점에 핀 보스. 주철 스타디움(z 가운데 0, 두께 thick) + 끝에서 앞으로 솟은 핀(z thick/2 → pinLen) */
export function fixedArm(len: number, pinLen: number, opts: { halfW?: number; thick?: number; hubR?: number; bore?: number } = {}): THREE.Group {
  const hw = opts.halfW ?? 0.045;
  const thick = opts.thick ?? 0.04;
  const hubR = opts.hubR ?? 0.1;
  const bore = opts.bore ?? 0.05;
  const g = new THREE.Group();
  const pts: V2[] = [];
  for (let k = 0; k <= 10; k++) pts.push([len + hw * Math.cos(-Math.PI / 2 + (Math.PI * k) / 10), hw * Math.sin(-Math.PI / 2 + (Math.PI * k) / 10)]);
  pts.push([0, hw], [0, -hw]);
  g.add(mesh(extrude(shapeFrom(pts), thick, 0.006), castIron({ roughness: 0.5 })));
  g.add(ringZ(bore, hubR, -thick / 2 - 0.004, thick / 2 + 0.004, 0.006, castIron({ roughness: 0.5 })));
  const pin = pinZ(0.018, thick / 2 - 0.004, thick / 2 + pinLen, steel());
  pin.position.set(len, 0, 0);
  g.add(pin);
  return g;
}

// ───────────────────────── 075 왕복 → 간헐 회전의 시간표 ─────────────────────────

/**
 * 75번 래칫 이송의 치수. 흔들 막대의 긴 팔(폴 핀 반지름 rPivot)이 쉬는 각 a0 에서 시계 방향으로 stroke = steps·q + slack 만큼 갔다 온다.
 * 폴 끝은 핀에서 바퀴 진행 쪽으로 span 떨어진 곧은 면에 닿는다. slack = 폴 끝이 면에 닿기까지의 헛걸음 각.
 */
export interface FeedSpec {
  spec: SawSpec;
  rPivot: number;
  span: number;
  a0: number;
  steps: number;
  slack: number;
}

export interface FeedState {
  /** 한 왕복 안의 위상(0 ~ 2π). 0 ~ π 가 미는 행정 */
  u: number;
  /** 긴 팔이 쉬는 자리에서 간 각(≥ 0) */
  a: number;
  /** 긴 팔의 방향 각(세계) */
  armAngle: number;
  /** 바퀴가 돈 누적 각(≥ 0, 바퀴 진행 방향) */
  w: number;
  /** 바퀴 회전각(rotation.z) */
  wheel: number;
  pushing: boolean;
}

/** 구동 각 theta(누적) → 75번의 모든 자세. a = (stroke/2)(1 − cos u), 바퀴는 미는 행정에서 max(0, a − slack) 만큼, 한 왕복에 정확히 steps 이 */
export function feedState(f: FeedSpec, theta: number): FeedState {
  const q = TAU / f.spec.teeth;
  const stroke = f.steps * q + f.slack;
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const a = (stroke / 2) * (1 - Math.cos(u));
  const w = u < Math.PI ? f.steps * q * n + Math.max(0, a - f.slack) : f.steps * q * (n + 1);
  const d = f.spec.dir;
  // 긴 팔은 바퀴 진행 방향(d)으로 간다. 폴 끝이 닿는 면의 처음 자리 = a0 + d·(slack + span)
  return { u, a, armAngle: f.a0 + d * a, w, wheel: f.a0 + d * (f.slack + f.span) + d * w, pushing: u < Math.PI && a >= f.slack };
}

// ───────────────────────── 076 계수기의 시간표 ─────────────────────────

export interface CounterState {
  /** 큰 바퀴 한 바퀴 안의 위상(시계 방향으로 돈 각, 0 ~ 2π) */
  u: number;
  /** 스터드의 극각(세계) */
  studAngle: number;
  /** 막대가 눌린 각 */
  beta: number;
  /** 막대 방향 각(rotation.z) */
  psi: number;
  /** 이음 핀 자리(바퀴 중심 원점) */
  h: V2;
  /** 꺾이는 끝이 꺾인 각(끝의 rotation.z = psi − kappa) */
  kappa: number;
  /** 이번 바퀴에서 톱니 바퀴가 나아간 각(0 ~ q) */
  w: number;
  /** 톱니 바퀴 회전각(rotation.z) */
  wheel: number;
  phase: 'rest' | 'push' | 'return';
}

export interface Counter {
  /** 쉬는 동안 다음에 밀릴 이의 곧은 면 각 */
  phiRest: number;
  /** 위상 0 에서의 스터드 극각 */
  studStart: number;
  uTouch: number;
  uPeak: number;
  uRelease: number;
  betaMax: number;
  noseOutline: V2[];
  /** ang = 큰 바퀴가 시계 방향으로 돈 누적 각 */
  state(ang: number): CounterState;
}

/**
 * 76번 계수기의 시간표를 만든다. 스터드는 위상 lead(기본 0.6 rad)에서 막대에 닿고, 벗어난 뒤 막대는 du(기본 0.3 rad) 동안 부드럽게 제자리로 돌아간다.
 * 톱니 바퀴는 닿음 ~ 꼭대기 사이에 max(0, tappetFaceAngle − phiRest) 만큼, 꼭대기 뒤로는 정확히 한 피치. phiRest = tappetFaceAngle(β최대) − q.
 */
export function makeCounter(spec: SawSpec, t: TappetSpec, opts: { lead?: number; du?: number } = {}): Counter {
  const q = TAU / spec.teeth;
  const lead = opts.lead ?? 0.6;
  const du = opts.du ?? 0.3;
  const aTouch = tappetTouchAngle(t);
  const aRel = tappetReleaseAngle(t);
  const pk = tappetPeak(t);
  const bRel = tappetBeta(t, aRel + 1e-9);
  const phiRest = tappetFaceAngle(t, spec.rOut, pk.beta) - q;
  const studStart = aTouch + lead;
  const uTouch = lead;
  const uPeak = studStart - pk.a;
  const uRelease = studStart - aRel;
  const noseOutline = nosePieceOutline(t);
  const state = (ang: number): CounterState => {
    const n = Math.floor(ang / TAU);
    const u = ang - n * TAU;
    let beta: number;
    let w: number;
    let phase: CounterState['phase'] = 'rest';
    if (u <= uRelease) {
      beta = tappetBeta(t, studStart - u);
      w = u < uTouch ? 0 : u >= uPeak ? q : Math.max(0, tappetFaceAngle(t, spec.rOut, beta) - phiRest);
      if (u >= uTouch) phase = 'push';
    } else {
      const x = Math.max(0, Math.min(1, (u - uRelease) / du));
      beta = bRel * (1 - x * x * (3 - 2 * x));
      w = q;
      if (x < 1) phase = 'return';
    }
    const wheel = phiRest + q * n + w;
    const pose = tappetPose(t, beta);
    const kappa = noseFold(spec, wheel, noseOutline, pose.h, pose.psi);
    return { u, studAngle: studStart - u, beta, psi: pose.psi, h: pose.h, kappa, w, wheel, phase };
  };
  return { phiRest, studStart, uTouch, uPeak, uRelease, betaMax: pk.beta, noseOutline, state };
}
