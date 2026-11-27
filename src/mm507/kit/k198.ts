// 198번 이음 맹글 랙 전용 키트 — 안내 홈이 파인 홈 틀(안쪽 이 줄 + 홈 속 섬), 미끄럼 틀, 붙듦 막대, 롤러, 풀이식
// 설계표 docs/mm507-sheets/198.md (2026-11-27 다시 만듦)
import * as THREE from 'three';
import { aluminum, brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { lathe, loft, mesh, rodProfile, tubeProfile, TAU } from '../../models/parts/geom';
import type { V2 } from './belt';
import { setMM } from './mm';

const N = 8; // 피니언 잇수
const M = 0.025; // 모듈
const NE = 12; // 끝 반원 하나의 이 수(피치선 기준)
const NS = 16; // 곧은 줄 하나의 이 수
const RP = (N * M) / 2; // 0.1
const R_END = NE * M; // 끝 반원 피치 반지름 0.3
const H = R_END - RP; // 홈 중심선 반원 반지름 0.2 (= 틀이 오르내리는 반폭)
const LH = (NS * Math.PI * M) / 2; // 곧은 줄 반길이 0.6283
const LS = 4 * LH + 2 * Math.PI * H; // 홈 중심선 한 바퀴 3.7699

export const K198 = {
  N,
  M,
  RP,
  RA: RP + M,
  R_END,
  H,
  LH,
  LS,
  YC: 1.75, // 피니언(고정 축) 높이 = 미끄럼 틀 가운데 높이
  PR: 0.58, // 홈 틀 바깥 반원 반지름(홈 중심선 기준)
  SLOT_HW: 0.037, // 안내 홈 반폭
  GUIDE_R: 0.035, // 홈 속 굴림대 반지름
  SHAFT_R: 0.024,
  HS: 0.87, // 미끄럼 틀 반높이
  WS: 1.3, // 미끄럼 틀 반폭
  WIN: 0.87, // 미끄럼 틀 가로 창 반길이
  ROLL_X: 0.4,
  ROLL_R: 0.09,
  // 막대 핀(로컬): 미끄럼 틀 쪽 aT·aB, 홈 틀 쪽 bT·bB
  aT: [-(LH + 0.6), 0.5] as V2,
  aB: [LH + 0.6, -0.5] as V2,
  bT: [LH + 0.42, 0.5] as V2,
  bB: [-(LH + 0.42), -0.5] as V2,
  LR: 2 * LH + 1.02, // 막대 핀 간 길이 2.2766
  // 층(z)
  zS0: -0.189, // 미끄럼 틀
  zS1: -0.151,
  zF0: -0.151, // 홈 판(바닥)·섬
  zF1: -0.111,
  zR1: -0.041, // 이 줄 층 앞면(zF1 ~ zR1)
  zP: -0.0815, // 피니언 가운데(폭 0.054)
  zK1: -0.011, // 띠쇠 앞면(zR1 ~ zK1)
  zE1: -0.021, // 귀(막대 핀 받침) 앞면(zR1 ~ zE1)
  zL0: -0.008, // 막대(z −0.008 ~ 0.012)
  zL1: 0.012
} as const;

export const PIN_W198 = 3.2; // 피니언 각속도(rad/s)

/** 홈 중심선(홈 틀 로컬, 원점 = 홈 가운데) — s 는 시계 방향 호장, b = 바깥 법선 각 */
export function path198(sIn: number): { x: number; y: number; b: number; seg: number } {
  const s = ((sIn % LS) + LS) % LS;
  if (s < 2 * LH) return { x: -LH + s, y: H, b: Math.PI / 2, seg: 0 };
  let u = s - 2 * LH;
  if (u < Math.PI * H) {
    const a = Math.PI / 2 - u / H;
    return { x: LH + H * Math.cos(a), y: H * Math.sin(a), b: a, seg: 1 };
  }
  u -= Math.PI * H;
  if (u < 2 * LH) return { x: LH - u, y: -H, b: -Math.PI / 2, seg: 2 };
  u -= 2 * LH;
  const a = -Math.PI / 2 - u / H;
  return { x: -LH + H * Math.cos(a), y: H * Math.sin(a), b: a, seg: 3 };
}

/** 홈 중심선에서 바깥으로 off 만큼 띄운 닫힌 곡선 */
function offsetCurve(off: number): V2[] {
  const pts: V2[] = [];
  const n = 360;
  for (let i = 0; i < n; i++) {
    const p = path198((LS * i) / n);
    pts.push([p.x + Math.cos(p.b) * off, p.y + Math.sin(p.b) * off]);
  }
  return pts;
}

/** 홈 틀 바깥 윤곽(반원 반지름 PR 의 경기장꼴) */
function stadium(r: number, n = 64): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([LH + r * Math.cos(a), r * Math.sin(a)]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([-LH + r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

const slab = (z0: number, z1: number) => [
  { z: z0, s: 1, hs: 1 },
  { z: z1, s: 1, hs: 1 }
];

/**
 * 안쪽 이 줄(피치선 = 홈 중심선 바깥 RP). 피니언이 홈 틀에 대해 θrel = s/RP 만큼 돌 때
 * 피니언 자기 좌표로 본 접촉 방향 각 G(s) = b(s) − s/RP. 이 줄의 이골(피니언 이가 들어갈 곳) = G 가 (j + ½)·피치각.
 */
export function toothHole198(): V2[] {
  const step = TAU / N;
  const segS = [0, 2 * LH, 2 * LH + Math.PI * H, 4 * LH + Math.PI * H, LS];
  const segK = [-1 / RP, -1 / H - 1 / RP, -1 / RP, -1 / H - 1 / RP];
  const gAt: number[] = [Math.PI / 2];
  for (let i = 0; i < 4; i++) gAt.push(gAt[i]! + segK[i]! * (segS[i + 1]! - segS[i]!));
  const invG = (g: number): number => {
    for (let i = 0; i < 4; i++) if (g <= gAt[i]! + 1e-12 && g >= gAt[i + 1]! - 1e-12) return segS[i]! + (g - gAt[i]!) / segK[i]!;
    return 0;
  };
  const SA = 0.24;
  const TA = 0.38;
  const prof = (f: number): number => {
    const a = Math.abs(f);
    if (a >= TA) return -M;
    if (a <= SA) return 1.25 * M;
    return 1.25 * M + (-M - 1.25 * M) * ((a - SA) / (TA - SA));
  };
  const F = [-0.5, -(0.5 + TA) / 2, -TA, -SA, -SA / 2, 0, SA / 2, SA, TA, (0.5 + TA) / 2];
  const gHi = gAt[0]!;
  const gLo = gAt[4]!;
  const pts: V2[] = [];
  const j0 = Math.floor(gLo / step) - 1;
  const j1 = Math.ceil(gHi / step) + 1;
  const vals: { g: number; f: number }[] = [];
  for (let j = j0; j <= j1; j++) {
    for (const f of F) {
      const g = (j + 0.5 + f) * step;
      if (g > gHi + 1e-9 || g <= gLo + 1e-9) continue;
      vals.push({ g, f });
    }
  }
  vals.sort((a, b) => b.g - a.g); // s 증가 순
  for (const { g, f } of vals) {
    const p = path198(invG(g));
    const r = RP + prof(f);
    pts.push([p.x + Math.cos(p.b) * r, p.y + Math.sin(p.b) * r]);
  }
  return pts;
}

/** 귀(막대 핀 받침) 윤곽: 0.8·q 에서 q 까지 반폭 0.075 의 둥근 막대꼴 */
function capsule(q: V2, hw: number): V2[] {
  const p0: V2 = [q[0] * 0.8, q[1] * 0.8];
  const ang = Math.atan2(q[1] - p0[1], q[0] - p0[0]);
  const pts: V2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = ang - Math.PI / 2 + (Math.PI * i) / 16;
    pts.push([q[0] + hw * Math.cos(a), q[1] + hw * Math.sin(a)]);
  }
  for (let i = 0; i <= 16; i++) {
    const a = ang + Math.PI / 2 + (Math.PI * i) / 16;
    pts.push([p0[0] + hw * Math.cos(a), p0[1] + hw * Math.sin(a)]);
  }
  return pts;
}

/** 핀(축 z, 반지름 r, z0~z1) + 앞 와셔 */
function pinWithWasher(r: number, z0: number, z1: number, washerR: number): THREE.Group {
  const g = new THREE.Group();
  const geo = lathe(rodProfile(r, 0, z1 - z0, 0, r * 0.3), 20);
  geo.rotateX(Math.PI / 2);
  const p = mesh(geo, steel());
  p.position.z = z0;
  g.add(p);
  const w = lathe(tubeProfile(r, washerR, 0, 0.008, 0.002), 24);
  w.rotateX(Math.PI / 2);
  const wm = mesh(w, darkSteel());
  wm.position.z = K198.zL1;
  g.add(wm);
  return g;
}

export interface Parts198 {
  /** 홈 틀 전체(원점 = 홈 가운데) */
  frame: THREE.Group;
  /** 홈 판(안내 홈이 뚫린 바닥) */
  groove: THREE.Mesh;
  rack: THREE.Mesh;
  island: THREE.Mesh;
  strap: THREE.Mesh;
  pinT: THREE.Object3D;
  pinB: THREE.Object3D;
}

/** 홈 틀: 바닥(안내 홈) + 이 줄 층 + 섬(기둥으로 띠쇠에) + 띠쇠 + 귀 2 + 막대 핀 2 */
export function rackFrame198(): Parts198 {
  const K = K198;
  const frame = new THREE.Group();
  const outline = stadium(K.PR);
  // 바닥 판: 홈 바깥 벽(중심선 + SLOT_HW) 안을 뚫음 → 섬은 따로
  const groove = mesh(loft(outline, [offsetCurve(K.SLOT_HW)], slab(K.zF0, K.zF1)), aluminum({ roughness: 0.5 }));
  groove.name = 'groove';
  frame.add(groove);
  // 섬: 홈 안쪽 벽(중심선 − SLOT_HW)
  const island = mesh(loft(offsetCurve(-K.SLOT_HW), [], slab(K.zF0, K.zF1)), aluminum({ roughness: 0.5 }));
  island.name = 'island';
  frame.add(island);
  // 이 줄 층
  const hole = toothHole198();
  const rack = mesh(loft(outline, [hole], slab(K.zF1, K.zR1)), brass({ roughness: 0.4 }));
  rack.name = 'rack';
  rack.userData.outlines = { hole };
  frame.add(rack);
  // 섬 기둥(섬 앞면 → 띠쇠 뒷면)
  const postGeo = lathe(rodProfile(0.025, 0, K.zR1 - K.zF1), 24);
  postGeo.rotateX(Math.PI / 2);
  const post = mesh(postGeo, darkSteel());
  post.position.z = K.zF1;
  frame.add(post);
  // 띠쇠(가운데 세로, 이 줄 층 앞면에 얹혀 홈 위를 건너감)
  const sw = 0.04;
  const sh = 0.5;
  const strapPts: V2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI * i) / 12;
    strapPts.push([sw * Math.cos(a), sh - sw + sw * Math.sin(a)]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (Math.PI * i) / 12;
    strapPts.push([sw * Math.cos(a), -sh + sw + sw * Math.sin(a)]);
  }
  const strap = mesh(loft(strapPts, [], slab(K.zR1, K.zK1)), steel());
  strap.name = 'strap';
  frame.add(strap);
  for (const sy of [1, -1]) {
    const rv = lathe(rodProfile(0.016, 0, 0.002, 0, 0.001), 16);
    rv.rotateX(Math.PI / 2);
    const rm = mesh(rv, darkSteel());
    rm.position.set(0, sy * (sh - 0.05), K.zK1);
    frame.add(rm);
  }
  // 귀 + 핀
  const pins: THREE.Object3D[] = [];
  for (const q of [K.bT, K.bB]) {
    const ear = mesh(loft(capsule(q, 0.075), [], slab(K.zR1, K.zE1)), brass({ roughness: 0.4 }));
    frame.add(ear);
    const pin = pinWithWasher(0.02, K.zE1, K.zL1 + 0.008, 0.036);
    pin.position.set(q[0], q[1], 0);
    frame.add(pin);
    pins.push(pin);
  }
  // 섬 위 노란 표시(홈 가운데)
  const mk = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.004), paint(0xf2b619));
  mk.position.set(-0.3, 0, K.zF1 + 0.002);
  frame.add(mk);
  setMM(frame, { kind: 'plate', fn: 'rackFrame198', module: M, teeth: 2 * (NS + NE), groove: 'closed' });
  return { frame, groove, rack, island, strap, pinT: pins[0]!, pinB: pins[1]! };
}

/** 미끄럼 틀: 둥근 사각 판 + 고정 축이 지나는 가로 창 + 막대 핀 2 (원점 = 틀 가운데) */
export function slide198(): { slide: THREE.Group; pinT: THREE.Object3D; pinB: THREE.Object3D } {
  const K = K198;
  const g = new THREE.Group();
  const rr = 0.06;
  const out: V2[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (Math.PI / 2) * (i / 6);
      out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  };
  corner(K.WS - rr, -K.HS + rr, -Math.PI / 2);
  corner(K.WS - rr, K.HS - rr, 0);
  corner(-K.WS + rr, K.HS - rr, Math.PI / 2);
  corner(-K.WS + rr, -K.HS + rr, Math.PI);
  const win: V2[] = [];
  const wh = 0.03;
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    win.push([K.WIN + wh * Math.cos(a), wh * Math.sin(a)]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    win.push([-K.WIN + wh * Math.cos(a), wh * Math.sin(a)]);
  }
  g.add(mesh(loft(out, [win], slab(K.zS0, K.zS1)), castIron()));
  const pins: THREE.Object3D[] = [];
  for (const a of [K.aT, K.aB]) {
    const pin = pinWithWasher(0.02, K.zS1, K.zL1 + 0.008, 0.036);
    pin.position.set(a[0], a[1], 0);
    g.add(pin);
    pins.push(pin);
  }
  setMM(g, { kind: 'plate', fn: 'slide198' });
  return { slide: g, pinT: pins[0]!, pinB: pins[1]! };
}

/** 납작 막대: 원점 = 첫 구멍, +x 로 len 떨어진 둘째 구멍 (z zL0~zL1) */
export function link198(len: number): THREE.Group {
  const K = K198;
  const g = new THREE.Group();
  const rEnd = 0.038;
  const pts: V2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 16;
    pts.push([len + rEnd * Math.cos(a), rEnd * Math.sin(a)]);
  }
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 16;
    pts.push([rEnd * Math.cos(a), rEnd * Math.sin(a)]);
  }
  const holeAt = (cx: number): V2[] => {
    const h: V2[] = [];
    for (let i = 0; i < 20; i++) h.push([cx + 0.0202 * Math.cos((TAU * i) / 20), 0.0202 * Math.sin((TAU * i) / 20)]);
    return h;
  };
  g.add(mesh(loft(pts, [holeAt(0), holeAt(len)], slab(K.zL0, K.zL1)), steel()));
  return g;
}

/** 롤러(실패 꼴: 뒤 테 + 굴림 면 + 앞 테), 원점 = 축 중심, z −0.20 ~ −0.14 */
export function spool198(): THREE.Group {
  const K = K198;
  const g = new THREE.Group();
  const r = K.ROLL_R;
  const prof: V2[] = [
    [0.026, -0.2],
    [0.115, -0.2],
    [0.12, -0.195],
    [0.12, -0.19],
    [r, -0.19],
    [r, -0.15],
    [0.12, -0.15],
    [0.12, -0.145],
    [0.115, -0.14],
    [0.026, -0.14],
    [0.026, -0.2]
  ];
  const geo = lathe(prof.map(([a, b]) => [a, b] as V2), 40);
  geo.rotateX(Math.PI / 2);
  g.add(mesh(geo, brass()));
  const mk = mesh(new THREE.BoxGeometry(0.03, 0.014, 0.004), paint(0xf2b619));
  mk.position.set(0.09, 0, -0.138);
  g.add(mk);
  setMM(g, { kind: 'wheel', fn: 'spool198', axis: 'z', r, width: 0.04, rim: 'flat', span: [-0.19, -0.15], bottom: r, outer: 0.12 });
  return g;
}

/** 뒤판에 박힌 고정 축 + 보스(축 z −0.30 ~ z1). 롤러용 끝 덮개 포함 */
export function axle198(r: number, z1: number, bossR: number, cap: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = lathe(rodProfile(r, 0, z1 + 0.3, 0, r * 0.3), 24);
  body.rotateX(Math.PI / 2);
  const bm = mesh(body, steel());
  bm.position.z = -0.3;
  g.add(bm);
  const boss = lathe(rodProfile(bossR, 0, 0.1, 0.01, 0.008), 32);
  boss.rotateX(Math.PI / 2);
  const bo = mesh(boss, darkSteel());
  bo.position.z = -0.3;
  g.add(bo);
  if (cap) {
    const c = lathe(tubeProfile(r, 0.04, 0, 0.01, 0.003), 24);
    c.rotateX(Math.PI / 2);
    const cm = mesh(c, darkSteel());
    cm.position.z = -0.14;
    g.add(cm);
  }
  setMM(g, { kind: 'shaft', axis: 'z', r, z0: -0.3, z1 });
  return g;
}

const rot = (p: V2, f: number): V2 => [Math.cos(f) * p[0] - Math.sin(f) * p[1], Math.sin(f) * p[0] + Math.cos(f) * p[1]];

export interface Pose198 {
  s: number;
  /** 홈 틀 회전(rad) */
  phi: number;
  /** 홈 틀 원점(세계) */
  X: number;
  Y: number;
  /** 미끄럼 틀 가운데 x */
  xs: number;
}

/** 홈 위치 s 에서: 피니언 축(0, YC)이 홈 중심선 위 → 홈 틀 자세, 두 막대 길이 LR → 회전 phi 와 미끄럼 틀 xs */
export function pose198(s: number, phi0 = 0): Pose198 {
  const K = K198;
  const c = path198(s);
  const F = (phi: number): { f: number; xs: number; X: number; Y: number } => {
    const rc = rot([c.x, c.y], phi);
    const X = -rc[0];
    const Y = K.YC - rc[1];
    const bt = rot(K.bT, phi);
    const bb = rot(K.bB, phi);
    const BT: V2 = [X + bt[0], Y + bt[1]];
    const BB: V2 = [X + bb[0], Y + bb[1]];
    const dyT = BT[1] - (K.YC + K.aT[1]);
    const dyB = BB[1] - (K.YC + K.aB[1]);
    const xs1 = BT[0] - K.aT[0] - Math.sqrt(K.LR * K.LR - dyT * dyT);
    const xs2 = BB[0] - K.aB[0] + Math.sqrt(K.LR * K.LR - dyB * dyB);
    return { f: xs1 - xs2, xs: (xs1 + xs2) / 2, X, Y };
  };
  let phi = phi0;
  for (let i = 0; i < 20; i++) {
    const a = F(phi);
    if (Math.abs(a.f) < 1e-13) break;
    const d = (F(phi + 1e-7).f - a.f) / 1e-7;
    phi -= a.f / d;
  }
  const r = F(phi);
  return { s, phi, X: r.X, Y: r.Y, xs: r.xs };
}

/** 피니언 절대 각 theta → 자세. theta = s/RP + phi(s) (홈 틀에 대한 구름 + 틀의 기울기) */
export function solve198(theta: number): Pose198 {
  let s = RP * theta;
  let p = pose198(s);
  for (let i = 0; i < 8; i++) {
    s = RP * (theta - p.phi);
    p = pose198(s, p.phi);
  }
  return p;
}
