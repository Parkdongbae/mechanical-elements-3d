// 번호 전용 키트 (507 · 180번) — 한쪽 죔쇠(목수 작업대 죔쇠): 고정 옆판 + 축 나사 하나로 도는 굽은 죔쇠(판화 윤곽).
// 작업물(나무 판)이 아래에서 올라오며 윗모서리로 죔쇠 위쪽 안쪽 면을 밀면 죔쇠가 시계 방향으로 돌고,
// 아래의 둥근 갈고리가 작업물을 옆판 쪽으로 눌러 문다. 작업물을 내리면 죔쇠가 되돌아 풀린다.
import * as THREE from 'three';
import { castIron, darkSteel, steel, wood } from '../../models/materials';
import { extrude, mesh, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';
import { STAGE } from './stand';

/** 판화 px(원본 180.png, 521×519) → 세계. 1 px = 0.0068 */
const S = 0.0068;
const WX = (x: number): number => (x - 236) * S;
const WY = (y: number): number => 3.12 - y * S;

export const K180 = {
  /** 죔쇠 축(나사) — 판화 [292.5·246.5] */
  P: [WX(292.5), WY(246.5)] as V2,
  /** 옆판 x(왼쪽은 판화 127 px 보다 3 px 넓힘 — 열린 죔쇠 위 끝이 옆판 뒤에 숨도록), y 위·아래 */
  sideX: [WX(124), WX(183)] as V2,
  sideY: [WY(426), WY(0)] as V2,
  /** 옆판 고정 나사 — 판화 [153·145], [152·372] */
  fix: [
    [WX(153), WY(145)],
    [WX(152), WY(372)]
  ] as V2[],
  fixR: 13 * S,
  headR: 26 * S, // 축 나사 머리(판화 반지름 26 px)
  pinR: 0.045,
  eyeR: 0.05,
  /** 층(z): 죔쇠는 옆판 뒤로 지나가고, 작업물은 두 층에 걸쳐 둘 다와 닿는다 */
  zClamp: [-0.05, 0.05] as V2,
  zWork: [-0.05, 0.11] as V2,
  zSide: [0.06, 0.16] as V2,
  headH: 0.04,
  /** 작업물 */
  workLen: 1.75, // 물림 때 아래 끝 y ≈ 0.53, 내려가면 0.21
  drop: 0.32, // 내려간 거리
  /** 열림 각(rad, 반시계 = +). 0 = 판화 자세(물림) */
  open: 0.1,
  gap: 0.004
} as const;

const P = (x: number, y: number): V2 => [WX(x) - K180.P[0], WY(y) - K180.P[1]];

/** 죔쇠 윤곽(판화 px, 물린 자세): 위 끝(옆판 뒤 점선) → 바깥 가장자리 → 아래 갈고리 → 물결 안쪽 가장자리 → 위 끝 */
const RAW: V2[] = [
  P(150, 33),
  P(160, 31.5),
  P(170, 32),
  P(183, 36),
  P(200, 43),
  P(230, 58),
  P(250, 72),
  P(270, 96),
  P(288, 125),
  P(305, 148),
  P(318, 170),
  P(330, 200),
  P(338, 230),
  P(343, 260),
  P(346, 290),
  P(346, 320),
  P(344, 350),
  P(338, 370),
  P(328, 388),
  P(315, 402),
  P(300, 412),
  P(285, 417),
  P(270, 418),
  P(255, 416),
  P(242, 410),
  P(234, 400),
  P(231, 386),
  P(232, 371),
  P(238, 355),
  P(250, 343),
  P(263, 334),
  P(271, 323),
  P(269, 310),
  P(260, 294),
  P(251, 280),
  P(244, 260),
  P(245, 240),
  P(249, 220),
  P(255, 200),
  P(256, 180),
  P(250, 155),
  P(241, 138),
  P(232, 125),
  P(226, 116),
  P(215, 101),
  P(200, 83),
  P(183, 68),
  P(178, 64),
  P(168, 56),
  P(160, 51),
  P(152, 45),
  P(148, 38)
];

let cache: V2[] | null = null;
/** 죔쇠 외곽(축 로컬, 반시계) */
export function clampOutline180(): V2[] {
  if (cache) return cache;
  const curve = new THREE.CatmullRomCurve3(RAW.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  const pts: V2[] = curve.getSpacedPoints(320).slice(0, -1).map((p): V2 => [p.x, p.y]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as V2;
    const b = pts[(i + 1) % pts.length] as V2;
    area += a[0] * b[1] - b[0] * a[1];
  }
  cache = area < 0 ? pts.reverse() : pts;
  return cache;
}

/** 축 로컬 점을 phi(반시계) 만큼 돌린 세계 좌표 */
const rotW = ([x, y]: V2, phi: number): V2 => {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return [K180.P[0] + x * c - y * s, K180.P[1] + x * s + y * c];
};

/** 물린 자세(phi = 0)에서 갈고리(축보다 아래) 가장 왼쪽 x */
function hookLeft(): number {
  let m = Infinity;
  for (const p of clampOutline180()) {
    const [x, y] = rotW(p, 0);
    if (y < K180.P[1] - 0.3 && x < m) m = x;
  }
  return m;
}

/** 작업물 왼쪽·오른쪽 면 x: 왼쪽 = 옆판 오른쪽 면, 오른쪽 = 물린 갈고리 − 틈 */
export const WORK_X: V2 = [K180.sideX[1] + 0.002, hookLeft() - K180.gap];

/** 죔쇠가 phi 일 때 작업물 기둥(WORK_X) 위에 걸친 위쪽 안쪽 면의 가장 낮은 높이(작업물 윗면이 닿는 높이) */
function camY(phi: number): number {
  // 윤곽의 각 변을 기둥 x 범위로 잘라 그 끝점의 가장 낮은 y(꼭짓점 사이를 지나는 변까지)
  const xa = WORK_X[0] - 0.01;
  const xb = WORK_X[1] + 0.002;
  const pts = clampOutline180().map((p) => rotW(p, phi));
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as V2;
    const b = pts[(i + 1) % pts.length] as V2;
    if (a[1] <= K180.P[1] && b[1] <= K180.P[1]) continue;
    const lo = Math.max(xa, Math.min(a[0], b[0]));
    const hi = Math.min(xb, Math.max(a[0], b[0]));
    if (lo > hi) continue;
    const dx = b[0] - a[0];
    for (const x of [lo, hi]) {
      const y = Math.abs(dx) < 1e-9 ? Math.min(a[1], b[1]) : a[1] + ((b[1] - a[1]) * (x - a[0])) / dx;
      if (y > K180.P[1] && y < m) m = y;
    }
  }
  return m - K180.gap;
}

/** 작업물 윗면 높이: 물림(판화 자세) / 가장 낮음 */
export const WORK_TOP_CLOSED = camY(0);
export const WORK_TOP_LOW = WORK_TOP_CLOSED - K180.drop;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface Clamp180 {
  /** 작업물 윗면 높이 */
  top: number;
  /** 죔쇠 각(rad, 반시계 = +, 0 = 물림, open = 풀림) */
  phi: number;
  /** 0~1, 1 = 물림 */
  grip: number;
  /** 갈고리와 작업물 오른쪽 면 사이 틈 */
  gap: number;
}

/** theta → 작업물 높이와 죔쇠 각. t = 1(theta 1.6) 근처가 물림에서 멈춤, theta 4.7 근처가 내려가 멈춤 */
export function clamp180(theta: number): Clamp180 {
  const s = smooth(0.5 + 0.65 * Math.cos(theta - 1.6));
  const top = WORK_TOP_LOW + K180.drop * s;
  let phi: number;
  if (top >= WORK_TOP_CLOSED) phi = 0;
  else if (top <= camY(K180.open)) phi = K180.open;
  else {
    // camY 는 phi 가 커질수록(반시계) 낮아진다 → 이분법
    let lo = 0;
    let hi: number = K180.open;
    for (let i = 0; i < 36; i++) {
      const mid = (lo + hi) / 2;
      if (camY(mid) > top) lo = mid;
      else hi = mid;
    }
    phi = (lo + hi) / 2;
  }
  let hx = Infinity;
  for (const p of clampOutline180()) {
    const [x, y] = rotW(p, phi);
    if (y < K180.P[1] - 0.3 && x < hx) hx = x;
  }
  return { top, phi, grip: 1 - phi / K180.open, gap: hx - WORK_X[1] };
}

/** 굽은 죔쇠: 원점 = 축 중심, z 가운데 0(두께 zClamp). 축 구멍 eyeR. 주철 */
export function clamp180Body(): THREE.Group {
  const g = new THREE.Group();
  const out = clampOutline180();
  const shape = shapeFrom(out);
  const hole = new THREE.Path();
  hole.absarc(0, 0, K180.eyeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  g.add(mesh(extrude(shape, K180.zClamp[1] - K180.zClamp[0], 0.005, 48), castIron({ roughness: 0.55 })));
  g.userData.outline = out;
  setMM(g, { kind: 'jaw', fn: 'clamp180Body' });
  return g;
}

/** 일자 홈 둥근 머리 나사(고정): 뒤판 보스에서 나와 zFace 앞면에 머리. slot = 홈 방향(rad), R = 머리 반지름 */
export function screw180(x: number, y: number, zFace: number, R: number, slot: number, bossTo: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const H = K180.headH;
  const pr = Math.min(K180.pinR, R * 0.45);
  const pinLen = zFace + 0.01 - STAGE.backZ;
  const pin = mesh(new THREE.CylinderGeometry(pr, pr, pinLen, 24).rotateX(Math.PI / 2), steel());
  pin.position.z = STAGE.backZ + pinLen / 2;
  g.add(pin);
  if (bossTo > STAGE.backZ) {
    const bl = bossTo - STAGE.backZ;
    const boss = mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.68, bl, 32).rotateX(Math.PI / 2), darkSteel());
    boss.position.z = STAGE.backZ + bl / 2;
    g.add(boss);
  }
  const head = new THREE.Group();
  head.rotation.z = slot;
  head.position.z = zFace;
  const base = mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.012, 40).rotateX(Math.PI / 2), darkSteel());
  base.position.z = 0.006;
  head.add(base);
  const w = Math.max(0.01, R * 0.11);
  const a0 = Math.asin(w / R);
  const half: V2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / 24;
    half.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  for (const s of [1, -1]) {
    const pts = s === 1 ? half : half.map(([px, py]): V2 => [-px, -py]);
    const m = mesh(extrude(shapeFrom(pts), H, Math.min(0.014, R * 0.12), 32, 3), steel());
    m.position.z = H / 2;
    head.add(m);
  }
  g.add(head);
  setMM(g, { kind: 'shaft', axis: 'z', r: pr, z0: STAGE.backZ, z1: zFace + H });
  return g;
}

/** 아래 끝이 끊긴 선(물결) — x0→x1 을 y 기준으로 */
function brokenEdge(x0: number, x1: number, y: number, amp: number, waves: number): V2[] {
  const pts: V2[] = [];
  const n = 6 * waves;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, y + amp * Math.sin(t * waves * Math.PI * 2)]);
  }
  return pts;
}

/** 고정 옆판(세계 좌표 그대로): 앞 층 zSide, 아래 끝은 끊긴 선. 나사 자리 뒤에 받침 조각(뒤판까지) */
export function sidePiece180(): THREE.Group {
  const g = new THREE.Group();
  const [x0, x1] = K180.sideX;
  const [y0, y1] = K180.sideY;
  const pts: V2[] = [...brokenEdge(x0, x1, y0, 0.012, 2), [x1, y1], [x0, y1]];
  const d = K180.zSide[1] - K180.zSide[0];
  const m = mesh(extrude(shapeFrom(pts), d, 0.006, 12), wood(0xe8d3a8));
  m.position.z = (K180.zSide[0] + K180.zSide[1]) / 2;
  g.add(m);
  // 받침 조각: 옆판 뒤 ↔ 뒤판(나사 자리에서만 — 죔쇠 위 끝이 지나가는 자리는 비운다)
  const bz = K180.zSide[0] - STAGE.backZ;
  for (const [, fy] of K180.fix) {
    const b = mesh(new THREE.BoxGeometry(x1 - x0 - 0.02, 0.3, bz), wood(0xb88a55));
    b.position.set((x0 + x1) / 2, fy, STAGE.backZ + bz / 2);
    g.add(b);
  }
  setMM(g, { kind: 'plate' });
  return g;
}

/** 작업물(나무 판): 원점 = 윗면 가운데 높이 0, x 는 세계값(WORK_X). 아래 끝은 끊긴 선. outline = 직사각형 */
export function workpiece180(): THREE.Group {
  const g = new THREE.Group();
  const [x0, x1] = WORK_X;
  const L = K180.workLen;
  const pts: V2[] = [...brokenEdge(x0, x1, -L, 0.01, 2), [x1, 0], [x0, 0]];
  const d = K180.zWork[1] - K180.zWork[0];
  const m = mesh(extrude(shapeFrom(pts), d, 0.004, 12), wood(0xd38a44));
  m.position.z = (K180.zWork[0] + K180.zWork[1]) / 2;
  g.add(m);
  g.userData.outline = [
    [x0, -L],
    [x1, -L],
    [x1, 0],
    [x0, 0]
  ] as V2[];
  setMM(g, { kind: 'plate' });
  return g;
}
