// 번호 전용 키트 (507 · 174번) — 목수의 작업대 죔쇠: 굽은 턱(판화 윤곽 + 눈), 일자 홈 둥근 머리 나사, 죔쇠 막대, 받침 판,
// 턱 각 → 막대 끝 위치 식(막대 끝 모서리가 엇갈린 꼬리의 안쪽 가장자리를 민다)
import * as THREE from 'three';
import { castIron, darkSteel, steel, wood } from '../../models/materials';
import { extrude, mesh, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';
import { STAGE } from './stand';

export const K174 = {
  CY: 1.7, // 막대 가운데 높이
  PX: -0.15, // 턱 축(나사) x
  PD: 0.62, // 축 ↔ 막대 가운데 높이 차
  hb: 0.19, // 막대 반폭
  cham: 0.07, // 막대 끝 모따기
  barL: 2.35,
  eyeR: 0.056,
  pinR: 0.05,
  thick: 0.06,
  zBar0: 0.03,
  zBar1: 0.17,
  zUp: 0.04, // 위 턱 z 0.04~0.10 (뒤 층)
  zLo: 0.104, // 아래 턱 z 0.104~0.164 (앞 층) — 꼬리가 앞뒤로 엇갈려 X 로 교차
  headR: 0.15, // 나사 머리 반지름(판화 25 px)
  headH: 0.04,
  open: 0.1, // 막대를 뺐을 때 턱이 벌어지는 각(rad)
  extra: 0.55, // 막대를 뺐을 때 접점보다 더 물러나는 거리
  gap: 0.006,
  clipX: -1.0 // 윤곽 검사용: 축 로컬 x < clipX 의 꼬리 끝(두 턱이 앞뒤 층으로 엇갈리는 곳)은 뺀다
} as const;

/** 판화 px(원본 174.png) → 위 턱 축 로컬. 1 px = 0.0075, 축 = 나사 [230·155] */
const S = 0.0075;
const P = (x: number, y: number): V2 => [(x - 230) * S, -(y - 155) * S];

/** 위 턱 윤곽(판화 닫힘 자세 그대로): 꼬리 끝 → 바깥(위) 가장자리 → 갈고리 → 홈 → 안쪽 가장자리 → 꼬리 끝 */
const RAW: V2[] = [
  P(22, 273), // 위 턱 꼬리 끝(엇갈린 뒤 왼쪽 아래)
  P(16, 262),
  P(21, 248),
  P(33, 230),
  P(50, 208),
  P(75, 184),
  P(108, 160),
  P(150, 138),
  P(200, 121),
  P(250, 110),
  P(300, 106),
  P(335, 109),
  P(362, 121),
  P(380, 141),
  P(387, 165),
  P(382, 190),
  P(369, 206),
  P(351, 214), // 갈고리 아랫끝 — 막대 윗면을 문다
  P(339, 211),
  P(333, 199),
  P(326, 187),
  P(315, 181),
  P(303, 185),
  P(294, 195),
  P(275, 202),
  P(240, 199),
  P(200, 197),
  P(160, 200),
  P(125, 206),
  P(100, 215),
  P(70, 226),
  P(50, 240),
  P(38, 255),
  P(31, 269)
];

let cacheUp: V2[] | null = null;
function outlineUp(): V2[] {
  if (cacheUp) return cacheUp;
  const curve = new THREE.CatmullRomCurve3(RAW.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  const pts: V2[] = curve.getSpacedPoints(240).slice(0, -1).map((p): V2 => [p.x, p.y]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as V2;
    const b = pts[(i + 1) % pts.length] as V2;
    area += a[0] * b[1] - b[0] * a[1];
  }
  cacheUp = area < 0 ? pts.reverse() : pts;
  return cacheUp;
}

/** 턱 외곽(축 로컬, 반시계). sgn = +1 위 턱(갈고리가 아래로), −1 아래 턱(위아래 뒤집음) */
export function jawOutline174(sgn: 1 | -1): V2[] {
  const up = outlineUp();
  return sgn === 1 ? up : up.map(([x, y]): V2 => [x, -y]).reverse();
}

/** 다각형을 x ≥ X 반평면으로 자른다(Sutherland–Hodgman) */
function clipX(pts: V2[], X: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as V2;
    const b = pts[(i + 1) % pts.length] as V2;
    const ia = a[0] >= X;
    const ib = b[0] >= X;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (X - a[0]) / (b[0] - a[0]);
      out.push([X, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** 위 턱을 각 phi(시계, rad) 만큼 돌렸을 때 막대 기준(막대 가운데 높이 = 0) 좌표 */
const rot = ([x, y]: V2, phi: number): V2 => [K174.PX + x * Math.cos(phi) + y * Math.sin(phi), K174.PD - x * Math.sin(phi) + y * Math.cos(phi)];

/** 갈고리가 막대 윗면에 닿는 닫힘 각(rad): 갈고리 쪽(로컬 x>0.5) 가장 낮은 점이 막대 윗면 + 0.004 */
function solveClosed(): number {
  const pts = outlineUp().filter((p) => p[0] > 0.5);
  const target = K174.hb + 0.004;
  const minY = (b: number): number => Math.min(...pts.map((p) => rot(p, b)[1]));
  let lo = -0.3;
  let hi = 0.3;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (minY(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export const BETA_CLOSED174 = solveClosed();

/** 막대 끝(가운데)이 꼬리에 닿는 x: 막대 띠 안에 든 꼬리 점이 막대(끝 모따기 포함) 밖에 남는 가장 왼쪽 위치 */
let dense: V2[] | null = null;
function contactX(phi: number): number {
  if (!dense) {
    const src = outlineUp().filter((p) => p[0] < -0.4);
    dense = [];
    for (let i = 0; i < src.length - 1; i++) {
      const a = src[i] as V2;
      const b = src[i + 1] as V2;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.005));
      for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
  }
  let best = -Infinity;
  for (const p of dense) {
    const [x, y] = rot(p, phi);
    const ay = Math.abs(y);
    if (ay > K174.hb) continue;
    const off = Math.max(0, ay - (K174.hb - K174.cham)); // 모따기만큼 막대가 뒤로 물러남
    best = Math.max(best, x - off);
  }
  return best + K174.gap;
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface Clamp174 {
  xTip: number;
  /** 위 턱 각(rad, 시계 = +, 막대를 밀어 넣을수록 커져 갈고리가 닫힘). 아래 턱은 거울 */
  beta: number;
  closed: number;
}

/** theta → 턱 각과 막대 끝. closed = 1 이 판화 자세(막대 끝이 엇갈린 꼬리를 밀어 갈고리가 막대를 문다) */
export function clamp174(theta: number): Clamp174 {
  const closed = smooth(0.5 + 0.5 * Math.cos(theta - 1.6) * 1.15);
  const beta = BETA_CLOSED174 - K174.open * (1 - closed);
  const xTip = contactX(beta) + K174.extra * (1 - closed);
  return { xTip, beta, closed };
}

/** 굽은 턱: 원점 = 축(나사) 중심, z 가운데 0. 눈 구멍 반지름 eyeR. 주철. outline = 꼬리 끝(엇갈림 구간)을 뺀 윤곽 */
export function jaw174(sgn: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const out = jawOutline174(sgn);
  const shape = shapeFrom(out);
  const hole = new THREE.Path();
  hole.absarc(0, 0, K174.eyeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  g.add(mesh(extrude(shape, K174.thick, 0.004, 48), castIron()));
  g.userData.outline = clipX(out, K174.clipX);
  setMM(g, { kind: 'jaw', fn: 'jaw174' });
  return g;
}

/** 일자 홈 둥근 머리 나사(고정): 뒤판에서 나와 턱 눈을 꿰고, 턱 앞면(zFace)에 둥근 머리. slot = 홈 방향(rad) */
export function screw174(x: number, y: number, zFace: number, slot: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const R = K174.headR;
  const H = K174.headH;
  const pinLen = zFace + 0.01 - STAGE.backZ;
  const pin = mesh(new THREE.CylinderGeometry(K174.pinR, K174.pinR, pinLen, 24).rotateX(Math.PI / 2), steel());
  pin.position.z = STAGE.backZ + pinLen / 2;
  g.add(pin);
  const boss = mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 32).rotateX(Math.PI / 2), darkSteel());
  boss.position.z = STAGE.backZ + 0.03;
  g.add(boss);
  // 머리: 얇은 바닥 원판(홈 바닥, 어두움) + 홈을 사이에 둔 반원 두 쪽(모따기로 둥글게)
  const head = new THREE.Group();
  head.rotation.z = slot;
  head.position.z = zFace;
  const base = mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.012, 40).rotateX(Math.PI / 2), darkSteel());
  base.position.z = 0.006;
  head.add(base);
  const w = 0.016; // 홈 반폭
  const a0 = Math.asin(w / R);
  const half: V2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / 24;
    half.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  for (const s of [1, -1]) {
    const pts = s === 1 ? half : half.map(([px, py]): V2 => [-px, -py]);
    const m = mesh(extrude(shapeFrom(pts), H, 0.014, 32, 3), steel());
    m.position.z = H / 2;
    head.add(m);
  }
  g.add(head);
  setMM(g, { kind: 'shaft', axis: 'z', r: K174.pinR, z0: STAGE.backZ, z1: zFace + H });
  return g;
}

/** 죔쇠 막대(나무 판): 원점 = 끝 가운데, +X 로 barL. 끝은 모를 깎음. z 가운데 0 */
export function clampBar174(): THREE.Group {
  const g = new THREE.Group();
  const h = K174.hb;
  const c = K174.cham;
  const pts: V2[] = [
    [0, -h + c],
    [c, -h],
    [K174.barL, -h],
    [K174.barL, h],
    [c, h],
    [0, h - c]
  ];
  g.add(mesh(extrude(shapeFrom(pts), K174.zBar1 - K174.zBar0, 0.004), wood(0xc9985a)));
  g.userData.outline = pts;
  setMM(g, { kind: 'bar', length: K174.barL });
  return g;
}

/** 막대 받침 판(작업대 윗면의 홈): 뒤판에서 z 0.025 까지 */
export function benchSlab174(x0: number, x1: number): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(x1 - x0, 0.48, 0.325), steel());
  m.position.set((x0 + x1) / 2, K174.CY, -0.1375);
  return m;
}
