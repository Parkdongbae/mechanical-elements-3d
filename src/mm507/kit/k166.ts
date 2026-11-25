// 166번 전용 키트 — 멈춤이 있는 홈 크랭크(벽돌 프레스)
//  크랭크 원판(핀) — 긴 홈 눈이 달린 연결봉 — 벽돌 틀(미끄럼 받침 위에서 좌우 왕복).
//  핀이 홈 속을 지나는 동안(홈의 빈 길이 Ls) 틀은 멈춘다 → 행정 양 끝에서 쉼.
//  자세: 틀 위치 M 은 "놀이(play)" — 홈의 두 끝이 만드는 아래·위 한계 사이에서 밀릴 때만 움직인다.
//  한 주기 표(1440 칸, 두 바퀴 돌려 정상 상태)를 만들어 보간 → 주기마다 정확히 닫힌다.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { annularSector, extrude, hexPrism, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;

export const K166 = {
  cx: -1.05, // 원판 축
  cy: 1.35,
  R: 0.85, // 원판 반지름
  rp: 0.45, // 크랭크 반지름
  zD: 0.03, // 원판 가운데 z (두께 0.06 → 0~0.06)
  zR: 0.13, // 연결봉 가운데 z (두께 0.06 → 0.10~0.16)
  pinR: 0.05,
  dmin: 1.55, // 틀 핀 M → 핀(홈 가까운 끝)
  Ls: 0.28, // 홈 빈 길이(핀이 멈춤 동안 지나는 길이)
  phase0: 0.966, // t = 1 (theta 1.6) 에서 핀 각 147° — 판화 자세
  railTop: 1.22, // 미끄럼 받침 윗면
  moldW: 0.7, // 틀 가로
  moldH: 0.26, // 틀 높이
  moldGap: 0.1, // 틀 핀 M → 틀 왼면
  zM: 0.13, // 틀 가운데 z (깊이 0.2 → 0.03~0.23)
  railX0: 0.05,
  railX1: 1.95,
} as const;

const DMAX = K166.dmin + K166.Ls;
const N = 1440;

function pinAt(a: number): V2 {
  return [K166.cx + K166.rp * Math.cos(a), K166.cy + K166.rp * Math.sin(a)];
}
function bound(a: number, d: number): number {
  const p = pinAt(a);
  const dy = p[1] - K166.cy;
  return p[0] + Math.sqrt(d * d - dy * dy);
}

/** 한 주기 표: 핀 각 a = 2π·i/N 에서 틀 핀 M 의 x */
const TABLE: number[] = (() => {
  const out: number[] = new Array<number>(N + 1);
  let m = bound(0, K166.dmin);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= N; i++) {
      const a = (TAU * i) / N;
      m = Math.min(Math.max(m, bound(a, K166.dmin)), bound(a, DMAX));
      if (pass === 1) out[i] = m;
    }
  }
  return out;
})();

export interface Pose166 {
  /** 원판 각(rotation.z) */
  crank: number;
  /** 핀 세계 좌표 */
  pin: V2;
  /** 틀 핀 M 의 x (y = cy) */
  mx: number;
  /** 연결봉 각(rotation.z) — 로컬 −X 가 M → 핀 */
  rod: number;
  /** 핀이 홈 속에서 M 으로부터 떨어진 거리(dmin ~ dmin + Ls) */
  d: number;
  /** 틀이 멈춰 있는가 */
  dwell: boolean;
}

export function pose166(theta: number): Pose166 {
  const a = theta + K166.phase0;
  const am = ((a % TAU) + TAU) % TAU;
  const f = (am / TAU) * N;
  const i = Math.min(N - 1, Math.floor(f));
  const w = f - i;
  const mx = TABLE[i]! * (1 - w) + TABLE[i + 1]! * w;
  const pin = pinAt(a);
  const d = Math.hypot(mx - pin[0], K166.cy - pin[1]);
  const dwell = Math.abs(TABLE[i + 1]! - TABLE[i]!) < 1e-7;
  return { crank: a, pin, mx, rod: Math.atan2(K166.cy - pin[1], mx - pin[0]), d, dwell };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
function circleHole(cx: number, cy: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, true);
  return p;
}
/** 가로 스타디움 윤곽 점(x0~x1, 반폭 w) — 반시계 */
function stadiumPts(x0: number, x1: number, w: number, n = 16): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([x1 + w * Math.cos(t), w * Math.sin(t)]);
  }
  for (let i = 0; i <= n; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([x0 + w * Math.cos(t), w * Math.sin(t)]);
  }
  return pts;
}

/**
 * 크랭크 원판(청동 대신 주철). group 원점 = 축 — 모델은 (cx, cy, 0) 에 놓고 rotation.z = crank.
 * 원판 r 0.85 (z 0~0.06), 허브 r 0.16 (z 0.06~0.075), 핀 r 0.05 가 로컬 (+rp, 0) 에서 z 0.06~0.19,
 * 덮개 r 0.075 (z 0.165~0.19). 핀 길 표시 고리(r rp, 얇은 띠), 노랑 표시.
 * 표식 child `crankPin`.
 */
export function crankDisc166(): THREE.Group {
  const g = new THREE.Group();
  const { R, rp, pinR } = K166;
  g.add(meshAt(cylZ(R, 0, 0.06, 0.01, 96), castIron(), 0, 0, 0));
  g.add(mesh(tubeZ(0.05, 0.16, 0.055, 0.075, 0.004, 40), darkSteel()));
  // 핀 길 표시(판화의 점선 원) — 짧은 호 24개
  const dash = paint(0x3a3a3a);
  for (let k = 0; k < 24; k++) {
    const a0 = (TAU * k) / 24;
    g.add(meshAt(extrude(annularSector(rp - 0.006, rp + 0.006, a0, a0 + TAU / 48), 0.002, 0, 4), dash, 0, 0, 0.061));
  }
  g.add(meshAt(cylZ(pinR, 0.055, 0.19, 0.006), steel(), rp, 0, 0));
  g.add(meshAt(cylZ(0.075, 0.165, 0.19, 0.006), darkSteel(), rp, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.035, 0.004), paint(0xf2b619), -0.6, 0, 0.062));
  g.add(pinMark('crankPin', rp, 0, K166.zR));
  setMM(g, { kind: 'wheel', r: R, width: 0.06, rim: 'flat', axis: 'z' });
  return g;
}

/**
 * 홈 연결봉. group 원점 = 틀 핀 M — 모델은 (mx, cy, 0) 에 놓고 rotation.z = rod. 로컬 −X 쪽으로 핀.
 * 판 두께 0.06 (z 0.10~0.16). 긴 홈(로컬 x −dmax ~ −dmin, 반폭 0.054)을 둘러싼 둥근 눈(반폭 0.12) —
 * 곧은 봉(반폭 0.035) — M 의 눈(바깥 0.07, 구멍 0.034). 표식 `rodM`.
 */
export function slotRod166(): THREE.Group {
  const g = new THREE.Group();
  const { dmin, zR } = K166;
  const eye = shapeFrom(stadiumPts(-DMAX, -dmin, 0.12));
  const slot = new THREE.Path();
  stadiumPts(-DMAX, -dmin, 0.054).forEach(([x, y], i) => (i === 0 ? slot.moveTo(x, y) : slot.lineTo(x, y)));
  slot.closePath();
  eye.holes.push(slot);
  g.add(meshAt(extrude(eye, 0.06, 0.006, 16), steel(), 0, 0, zR));
  // 곧은 봉(눈 오른끝 → M 눈 왼끝)
  g.add(meshAt(extrude(shapeFrom([[-dmin + 0.1, -0.035], [-0.06, -0.035], [-0.06, 0.035], [-dmin + 0.1, 0.035]]), 0.06, 0.006, 4), steel(), 0, 0, zR));
  // M 의 눈
  const me = shapeFrom(stadiumPts(-0.001, 0.001, 0.07, 20));
  me.holes.push(circleHole(0, 0, 0.034));
  g.add(meshAt(extrude(me, 0.06, 0.006, 24), steel(), 0, 0, zR));
  g.add(pinMark('rodM', 0, 0, zR));
  setMM(g, { kind: 'link', a: [0, 0, 0], slot: [-DMAX, -K166.dmin] });
  return g;
}

/**
 * 벽돌 틀(왕복). group 원점 = 틀 핀 M — 모델은 (mx, cy, 0) 에 놓는다(z 절대값).
 * 나무 틀(바닥 없는 상자, 칸 둘) x 0.1~0.8, y railTop ~ railTop + 0.26, z 0.03~0.23.
 * 왼면의 귀(쇠판, z 0.04~0.095)에 핀 M(r 0.03, z 0.04~0.19) + 덮개.
 */
export function mold166(): THREE.Group {
  const g = new THREE.Group();
  const { moldW, moldH, moldGap, zM, cy, railTop } = K166;
  const y0 = railTop - cy;
  const yc = y0 + moldH / 2;
  const x0 = moldGap;
  const x1 = moldGap + moldW;
  const t = 0.04;
  const dz = 0.2;
  const wd = wood(0x9a6a3a);
  g.add(meshAt(new THREE.BoxGeometry(moldW, moldH, t), wd, (x0 + x1) / 2, yc, zM + dz / 2 - t / 2));
  g.add(meshAt(new THREE.BoxGeometry(moldW, moldH, t), wd, (x0 + x1) / 2, yc, zM - dz / 2 + t / 2));
  for (const x of [x0 + t / 2, (x0 + x1) / 2, x1 - t / 2]) {
    g.add(meshAt(new THREE.BoxGeometry(t, moldH, dz - 2 * t), wd, x, yc, zM));
  }
  // 귀: 틀 왼면에서 M 까지(핀 높이 y 0 을 지나도록 세움)
  const ear = shapeFrom([[x0 + 0.002, y0 + 0.02], [x0 + 0.002, 0.09], [0, 0.07], [-0.07, 0], [0, -0.07]]);
  g.add(meshAt(extrude(ear, 0.055, 0.004, 8), darkSteel(), 0, 0, 0.0675));
  g.add(meshAt(cylZ(0.03, 0.04, 0.19, 0.005), darkSteel(), 0, 0, 0));
  g.add(meshAt(cylZ(0.05, 0.165, 0.19, 0.005), darkSteel(), 0, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.025, 0.004), paint(0xf2b619), (x0 + x1) / 2, yc, zM + dz / 2 + 0.002));
  g.add(pinMark('moldPin', 0, 0, K166.zR));
  setMM(g, { kind: 'slider', axis: 'x' });
  return g;
}

/**
 * 미끄럼 받침(고정). group 원점 = 세계 원점 — 받침 판 x railX0~railX1, y railTop−0.06 ~ railTop, z 0~0.26,
 * 다리 둘(받침 윗면 0.18 에서), 뒤판까지 버팀.
 */
export function rail166(): THREE.Group {
  const g = new THREE.Group();
  const { railX0, railX1, railTop } = K166;
  const L = railX1 - railX0;
  const xm = (railX0 + railX1) / 2;
  g.add(meshAt(new THREE.BoxGeometry(L, 0.06, 0.26), castIron(), xm, railTop - 0.03, 0.13));
  // 앞·뒤 턱(틀이 앞뒤로 빠지지 않게)
  g.add(meshAt(new THREE.BoxGeometry(L, 0.04, 0.02), darkSteel(), xm, railTop + 0.02, 0.24));
  g.add(meshAt(new THREE.BoxGeometry(L, 0.04, 0.02), darkSteel(), xm, railTop + 0.02, 0.02));
  const legH = railTop - 0.06 - 0.18;
  for (const x of [railX0 + 0.12, railX1 - 0.12]) {
    g.add(meshAt(new THREE.BoxGeometry(0.1, legH, 0.16), castIron(), x, 0.18 + legH / 2, 0.13));
  }
  // 뒤판 버팀
  g.add(meshAt(new THREE.BoxGeometry(0.3, 0.05, -STAGE.backZ), castIron(), xm, railTop - 0.085, STAGE.backZ / 2));
  setMM(g, { kind: 'frame', fn: 'rail166' });
  return g;
}

/** 육각 너트(축 = Z) — 쓰지 않으면 지워도 됨 */
export function nut166(r: number, z: number): THREE.Mesh {
  const geo = hexPrism(r * 2.2, r * 0.9, true, true, r * 1.05);
  geo.rotateX(Math.PI / 2);
  return meshAt(geo, darkSteel(), 0, 0, z);
}
