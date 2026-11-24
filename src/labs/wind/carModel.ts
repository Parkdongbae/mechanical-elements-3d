// 풍동 실험용 세단(패스트백) 3D 모델 — 단면을 이어 붙인(로프트) 차체 + 바꿔 끼우는 부품들.
// 좌표: 차 길이 방향 = X(앞 −X, 뒤 +X, 바람은 +X로 흐름), 위 = +Y(바닥 y=0), 옆 = Z. 1 단위 ≈ 1.3 m.
// 차체 모양 함수(BodyShape)는 유동 모델(flow.ts)의 거리 함수와 공유해 유선이 실제 차체를 감싸게 한다.

import * as THREE from 'three';
import { paint, chrome, plastic, darkSteel, castIron, steel, rubber, aluminum } from '../../models/materials';
import { buildWheel } from '../../machines/drivetrainParts';
import type { Config } from './aero';

export const XF = -1.84;
export const XR = 1.84;
export const WHEEL_R = 0.3;
export const WHEEL_X = [-1.2, 1.17] as const;
export const WHEEL_Z = 0.6;
const BODY_COLOR = 0x37506e;
const GLASS_COLOR = 0x10161d;

type Pt = [number, number];

/** 넘침 없는 단조 3차 보간(Fritsch–Carlson) — 차체 윤곽이 울퉁불퉁 출렁이지 않게 */
function monotone(pts: Pt[]): (x: number) => number {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  const m: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!));
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1]!;
    const b = d[i]!;
    m[i] = a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  }
  return (x: number): number => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (x - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h * m[i + 1]!;
  };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 차체 모양 — 길이 방향 x마다 바닥·허리·어깨·지붕 높이와 폭 */
export class BodyShape {
  readonly clearance: number;
  readonly dy: number;
  readonly angular: boolean;
  private fW: (x: number) => number;
  private fB: (x: number) => number;
  private fM: (x: number) => number;
  private fS: (x: number) => number;
  private fT: (x: number) => number;
  // 유동 계산에서 초당 수만 번 부르므로 표로 미리 펴 둔다
  private lut: Float32Array;
  private static N = 512;

  constructor(pillar: number, ride: number) {
    this.angular = pillar === 0;
    this.clearance = ride === 0 ? 0.2 : 0.13;
    const dy = (this.dy = this.clearance - 0.13);
    this.fW = monotone([
      [-1.84, 0.5],
      [-1.78, 0.61],
      [-1.6, 0.675],
      [-1.2, 0.7],
      [1.2, 0.7],
      [1.6, 0.68],
      [1.78, 0.63],
      [1.84, 0.56]
    ]);
    const B = monotone([
      [-1.84, 0.31],
      [-1.74, 0.19],
      [-1.55, 0.14],
      [-1.4, 0.13],
      [1.35, 0.13],
      [1.6, 0.17],
      [1.84, 0.29]
    ]);
    this.fB = (x) => B(x) + dy;
    const M = monotone([
      [-1.84, 0.4],
      [-1.6, 0.5],
      [-1.0, 0.54],
      [0.5, 0.57],
      [1.5, 0.6],
      [1.84, 0.58]
    ]);
    this.fM = (x) => M(x) + dy;
    const S = monotone([
      [-1.84, 0.5],
      [-1.5, 0.66],
      [-0.8, 0.735],
      [0.4, 0.765],
      [1.4, 0.81],
      [1.84, 0.815]
    ]);
    this.fS = (x) => S(x) + dy;
    const front: Pt[] = this.angular
      ? [
          [-0.62, 0.762],
          [-0.42, 0.95],
          [-0.24, 1.095],
          [-0.12, 1.11]
        ]
      : [
          [-0.7, 0.752],
          [-0.3, 0.98],
          [0.0, 1.08]
        ];
    const T = monotone([
      [-1.84, 0.46],
      [-1.79, 0.58],
      [-1.65, 0.65],
      [-1.2, 0.705],
      [-0.78, 0.738],
      ...front,
      [0.35, 1.12],
      [0.75, 1.09],
      [1.05, 1.0],
      [1.32, 0.865],
      [1.55, 0.825],
      [1.78, 0.815],
      [1.84, 0.7]
    ]);
    this.fT = (x) => T(x) + dy;
    const N = BodyShape.N;
    this.lut = new Float32Array((N + 1) * 5);
    for (let i = 0; i <= N; i++) {
      const x = XF + ((XR - XF) * i) / N;
      this.lut.set([this.fW(x), this.fB(x), this.fM(x), this.fS(x), this.fT(x)], i * 5);
    }
  }

  w(x: number): number {
    return this.fW(x);
  }
  yB(x: number): number {
    return this.fB(x);
  }
  yM(x: number): number {
    return this.fM(x);
  }
  shoulder(x: number): number {
    return this.fS(x);
  }
  yT(x: number): number {
    return this.fT(x);
  }
  /** 어깨선(유리 아래) 높이 — 보닛·트렁크 구간에서는 윗면과 같다 */
  yS(x: number): number {
    return Math.min(this.fT(x), this.fS(x));
  }
  /** 지붕 가장자리 반폭 */
  wR(x: number): number {
    return this.fW(x) - (this.angular ? 0.13 : 0.17);
  }
  /** 실내(유리) 높이 비율 0~1 */
  cabin(x: number): number {
    return smooth(0.004, 0.06, this.fT(x) - this.fS(x));
  }

  /** 표에서 빠르게: [w, yB, yM, yS, yT] */
  sample(x: number, out: Float32Array): void {
    const N = BodyShape.N;
    const f = ((Math.min(XR, Math.max(XF, x)) - XF) / (XR - XF)) * N;
    const i = Math.min(N - 1, Math.floor(f));
    const t = f - i;
    const L = this.lut;
    for (let k = 0; k < 5; k++) out[k] = L[i * 5 + k]! * (1 - t) + L[(i + 1) * 5 + k]! * t;
    out[3] = Math.min(out[3]!, out[4]!);
  }
}

// ───────────────────────── 차체 단면 ─────────────────────────

/** 단면 오른쪽 절반의 조절점 사이마다 찍는 점 개수 — 구간 경계가 모든 단면에서 같은 정점 번호에 오도록 고정 */
const SEG_COUNTS = [4, 3, 4, 5, 4, 3, 8, 4, 5];
const NH = SEG_COUNTS.reduce((s, n) => s + n, 0) + 1; // 반쪽 점 수(아래 중심 ~ 위 중심)
const RING = NH * 2 - 2;
/** 정점이 속한 조절 구간(유리·필러 판정용) */
const SEG_OF: number[] = [];
{
  for (let s = 0; s < SEG_COUNTS.length; s++) for (let k = 0; k < SEG_COUNTS[s]!; k++) SEG_OF.push(s + k / SEG_COUNTS[s]!);
  SEG_OF.push(SEG_COUNTS.length);
}

function sectionControls(sh: BodyShape, x: number): Pt[] {
  const w = sh.w(x);
  const yB = sh.yB(x);
  const yM = sh.yM(x);
  const yS = sh.yS(x);
  const yT = sh.yT(x);
  const cf = sh.cabin(x);
  const wR = sh.wR(x);
  const wG = w - 0.05;
  const p: Pt[] = [
    [0, yB],
    [0.7 * w, yB],
    [w - 0.035, yB + 0.03],
    [w, Math.min(yB + 0.12, yM - 0.03)],
    [w, yM],
    [w - 0.02, yS - 0.025]
  ];
  const ang = sh.angular;
  const cab: Pt[] = [
    [wG, yS + 0.008],
    [ang ? wR + 0.025 : wR, yT - (ang ? 0.03 : 0.06)],
    [wR - (ang ? 0.06 : 0.12), yT - 0.006],
    [0, yT]
  ];
  const hood: Pt[] = [
    [w - 0.09, yS - 0.004],
    [w * 0.6, yT - 0.001],
    [w * 0.3, yT],
    [0, yT]
  ];
  for (let i = 0; i < 4; i++) p.push([lerp(hood[i]![0], cab[i]![0], cf), lerp(hood[i]![1], cab[i]![1], cf)]);
  return p;
}

/** Catmull-Rom으로 조절점 사이를 SEG_COUNTS대로 채운 오른쪽 반 단면 */
function sectionHalf(ctrl: Pt[]): Pt[] {
  const out: Pt[] = [];
  const n = ctrl.length;
  const P = (i: number): Pt => ctrl[Math.max(0, Math.min(n - 1, i))]!;
  for (let s = 0; s < n - 1; s++) {
    const p0 = P(s - 1);
    const p1 = P(s);
    const p2 = P(s + 1);
    const p3 = P(s + 2);
    const cnt = SEG_COUNTS[s]!;
    for (let k = 0; k < cnt; k++) {
      const t = k / cnt;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([Math.max(0, f(p0[0], p1[0], p2[0], p3[0])), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P(n - 1));
  return out;
}

export type Region = 0 | 1 | 2 | 3 | 4 | 5; // 0 도장 1 유리 2 바퀴집 3 전조등 4 후미등 5 필러 몰딩

export interface BodyMesh {
  mesh: THREE.Mesh;
  region: Uint8Array;
  /** 오른쪽 옆면 z(x, y) — 부품을 표면에 붙일 때 */
  sideZ(x: number, y: number): number;
}

const STATIONS = 170;

export function buildBody(sh: BodyShape, mat: THREE.Material): BodyMesh {
  const halves: Pt[][] = [];
  const xs: number[] = [];
  for (let i = 0; i < STATIONS; i++) {
    // 양 끝을 촘촘하게(코·꼬리 곡률)
    const u = i / (STATIONS - 1);
    const x = XF + (XR - XF) * (0.5 - 0.5 * Math.cos(Math.PI * u)) * 0.35 + (XR - XF) * u * 0.65;
    xs.push(x);
    halves.push(sectionHalf(sectionControls(sh, x)));
  }
  const nv = STATIONS * RING + 2;
  const pos = new Float32Array(nv * 3);
  const region = new Uint8Array(nv);
  const slope = (x: number): number => (sh.yT(x + 0.02) - sh.yT(x - 0.02)) / 0.04;
  let v = 0;
  for (let i = 0; i < STATIONS; i++) {
    const x = xs[i]!;
    const half = halves[i]!;
    const cf = sh.cabin(x);
    const sl = slope(x);
    for (let j = 0; j < RING; j++) {
      const hj = j < NH ? j : RING - j;
      const sgn = j < NH ? 1 : -1;
      const p = half[hj]!;
      let z = p[0] * sgn;
      const y = p[1];
      const seg = SEG_OF[hj]!;
      let r: Region = 0;
      if (cf > 0.55 && seg >= 6 && seg < 7) r = 1; // 옆 유리
      if (cf > 0.45 && seg >= 7 && Math.abs(sl) > 0.3) r = 1; // 앞·뒤 유리
      if (cf > 0.45 && seg >= 6.75 && seg <= 7.25 && sl > 0.3) r = sh.angular ? 5 : 0; // A필러
      if (r === 1 && seg < 7 && x > 0.27 && x < 0.37) r = 5; // B필러
      if (x < -1.6 && seg >= 3.6 && seg <= 5.4 && Math.abs(z) > 0.3) r = 3;
      if (x > 1.72 && seg >= 3.4 && seg <= 5.2 && Math.abs(z) > 0.25) r = 4;
      // 바퀴집: 바퀴 둘레 원 안쪽 옆면을 안으로 밀어 넣는다
      for (const wx of WHEEL_X) {
        const d = Math.hypot(x - wx, y - WHEEL_R);
        const ra = WHEEL_R + 0.05;
        if (d < ra + 0.045 && Math.abs(z) > 0.46) {
          const k = smooth(ra, ra + 0.045, d);
          z = Math.sign(z) * lerp(0.47, Math.abs(z), k);
          if (k < 0.5) r = 2;
        }
      }
      pos.set([x, y, z], v * 3);
      region[v] = r;
      v++;
    }
  }
  // 앞·뒤 끝 마개 중심점
  const cap = (i: number, dx: number): void => {
    const half = halves[i]!;
    let cy = 0;
    for (const p of half) cy += p[1];
    pos.set([xs[i]! + dx, cy / half.length, 0], v * 3);
    region[v] = 0;
    v++;
  };
  cap(0, -0.025);
  cap(STATIONS - 1, 0.025);
  const idx: number[] = [];
  for (let i = 0; i < STATIONS - 1; i++) {
    for (let j = 0; j < RING; j++) {
      const a = i * RING + j;
      const b = i * RING + ((j + 1) % RING);
      const c = (i + 1) * RING + j;
      const d = (i + 1) * RING + ((j + 1) % RING);
      idx.push(a, c, b, b, c, d);
    }
  }
  const fc = STATIONS * RING;
  const rc = fc + 1;
  const last = (STATIONS - 1) * RING;
  for (let j = 0; j < RING; j++) {
    const j2 = (j + 1) % RING;
    idx.push(fc, j, j2);
    idx.push(rc, last + j2, last + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const sideZ = (x: number, y: number): number => {
    let i = 0;
    while (i < STATIONS - 2 && xs[i + 1]! < x) i++;
    const t = Math.min(1, Math.max(0, (x - xs[i]!) / (xs[i + 1]! - xs[i]!)));
    const zAt = (half: Pt[]): number => {
      let best = 0;
      for (let k = 1; k < NH - 1; k++) {
        const a = half[k]!;
        const b = half[k + 1]!;
        if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) {
          const u = (y - a[1]) / (b[1] - a[1]);
          best = Math.max(best, lerp(a[0], b[0], u));
        }
      }
      return best;
    };
    return lerp(zAt(halves[i]!), zAt(halves[i + 1]!), t);
  };
  return { mesh, region, sideZ };
}

// ───────────────────────── 색칠(도장/압력) ─────────────────────────

const REGION_COLORS: Record<Region, THREE.Color> = {
  0: new THREE.Color(BODY_COLOR),
  1: new THREE.Color(GLASS_COLOR),
  2: new THREE.Color(0x15171a),
  3: new THREE.Color(0xe8eef5),
  4: new THREE.Color(0xb3172a),
  5: new THREE.Color(0x0c0e11)
};

/** 압력 계수 색: 음압(빠른 흐름) 파랑 ← 0 흰색 → 정체점 빨강 */
export function cpColor(cp: number, out: THREE.Color): THREE.Color {
  const lo = new THREE.Color(0x1f5fe0);
  const mid = new THREE.Color(0xf2f2ee);
  const hi = new THREE.Color(0xe0312b);
  if (cp >= 0) return out.copy(mid).lerp(hi, Math.min(1, cp));
  return out.copy(mid).lerp(lo, Math.min(1, -cp / 1.1));
}

export interface PressureCtx {
  /** 차 뒤 후류의 세기(0~1) — 뒷면 음압 */
  wake: number;
  /** 하부 처리 0 노출 1 언더커버 2 디퓨저 */
  under: number;
}

/**
 * 맛보기 압력 계수 Cp ≈ 1 − (국소 속도/자유류 속도)². 국소 속도는 표면이 바람을 마주 보는 정도로 근사:
 * 정면(정체점) 속도 0 → Cp 1, 바람과 나란한 지붕·옆면은 빨라져 Cp < 0, 뒷면은 흐름이 떨어져 나가 약한 음압.
 */
export function surfaceCp(n: THREE.Vector3, p: THREE.Vector3, sh: BodyShape, pc: PressureCtx): number {
  const nx = n.x;
  if (n.y < -0.6) {
    // 바닥: 노출이면 느린 공기(+), 언더커버는 빨라지고, 디퓨저는 뒤쪽에서 더 빨라짐
    const rear = smooth(0.4, 1.6, p.x);
    return pc.under === 0 ? 0.15 : pc.under === 1 ? -0.3 : -0.3 - 0.45 * rear;
  }
  if (nx > 0.25) return -0.12 - 0.3 * pc.wake;
  const tang = 1 - nx * nx; // 0 정면 ~ 1 나란함
  // 지붕 앞쪽·앞유리 위 모서리에서 가장 빨라진다
  const top = smooth(0.3, 0.8, n.y);
  const roofFront = top * smooth(-0.9, -0.1, p.x) * (1 - smooth(0.4, 1.2, p.x));
  const k = 1.15 + 0.75 * top + 0.5 * roofFront;
  let cp = 1 - k * tang;
  if (nx > 0) cp = lerp(cp, -0.12 - 0.3 * pc.wake, nx / 0.25);
  void sh;
  return Math.max(-1.3, Math.min(1, cp));
}

export function paintBody(body: BodyMesh, sh: BodyShape, mode: 'paint' | 'pressure', pc: PressureCtx, angularTrim: boolean): void {
  const geo = body.mesh.geometry;
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < col.count; i++) {
    if (mode === 'paint') {
      let r = body.region[i] as Region;
      if (r === 5 && !angularTrim) r = 0;
      c.copy(REGION_COLORS[r]);
    } else {
      n.fromBufferAttribute(nor, i);
      p.fromBufferAttribute(pos, i);
      cpColor(surfaceCp(n, p, sh, pc), c);
    }
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

// ───────────────────────── 부품 ─────────────────────────

function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x0 = -w / 2 + r;
  const y0 = -h / 2 + r;
  s.moveTo(x0, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, y0);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(x0, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, y0);
  s.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
  const bev = Math.min(r, d / 2) * 0.8;
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * bev) / 2);
  return g;
}

/** 표면 위 점열을 따라가는 얇은 띠(도어 틈새선) */
function ribbon(pts: THREE.Vector3[], halfW: number, across: THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    pos.push(p.x - across.x * halfW, p.y - across.y * halfW, p.z - across.z * halfW);
    pos.push(p.x + across.x * halfW, p.y + across.y * halfW, p.z + across.z * halfW);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 날개 단면(뒤집은 에어포일) — x 앞전→뒷전, y 두께 */
function airfoil(chord: number, thick: number): THREE.Shape {
  const s = new THREE.Shape();
  const N = 18;
  const up: Pt[] = [];
  const lo: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const t = 5 * thick * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4);
    const camber = -0.06 * Math.sin(Math.PI * u) * chord; // 아래로 휜(거꾸로) 날개
    up.push([u * chord, camber + t * chord]);
    lo.push([u * chord, camber - t * chord]);
  }
  s.moveTo(up[0]![0], up[0]![1]);
  for (const p of up.slice(1)) s.lineTo(p[0], p[1]);
  for (const p of lo.reverse().slice(1)) s.lineTo(p[0], p[1]);
  return s;
}

function disposeGeoms(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}

export interface NoiseSpot {
  kind: 'mirror' | 'pillar' | 'gap' | 'handle' | 'under' | 'wheel' | 'spoiler';
  pos: THREE.Vector3;
}

/** 바꿔 끼우는 부품이 달린 풍동 실험용 세단 */
export class WindCar {
  readonly group = new THREE.Group();
  shape: BodyShape;
  body: BodyMesh | null = null;
  readonly wheels: THREE.Group[] = [];
  private spins: THREE.Group[] = [];
  private parts = new THREE.Group();
  private covers: THREE.Mesh[] = [];
  private mats: THREE.Material[] = [];
  private bodyMat: THREE.MeshPhysicalMaterial;
  private partPaint: THREE.MeshPhysicalMaterial;
  private chromeM: THREE.Material;
  private blackM: THREE.Material;
  private trimM: THREE.Material;
  private steelM: THREE.Material;
  private ironM: THREE.Material;
  private darkM: THREE.Material;
  private rubberM: THREE.Material;
  private coverM: THREE.Material;
  private mirrorGlass: THREE.Material;
  private coverPlateM: THREE.Material;
  private finM: THREE.Material;
  private wheelProto: THREE.Group;
  cfg: Config | null = null;
  colorMode: 'paint' | 'pressure' = 'paint';
  pressureCtx: PressureCtx = { wake: 0.5, under: 0 };
  spots: NoiseSpot[] = [];
  /** '하부 보기'에서 붙일 이름표(차 기준 좌표) */
  underLabels: { text: string; pos: THREE.Vector3 }[] = [];
  /** 큰 윙의 위치(유동 거리 함수에 넣는다) */
  wing: { x0: number; x1: number; y0: number; y1: number; hz: number } | null = null;

  constructor() {
    this.group.name = 'wind-car';
    this.bodyMat = paint(0xffffff, { roughness: 0.32 });
    this.bodyMat.vertexColors = true;
    this.bodyMat.side = THREE.DoubleSide;
    this.partPaint = paint(BODY_COLOR, { roughness: 0.32 });
    this.chromeM = chrome();
    this.blackM = plastic(0x15181c, { roughness: 0.5 });
    this.trimM = plastic(0x090a0c, { roughness: 0.35 });
    this.steelM = steel();
    this.ironM = castIron();
    this.darkM = darkSteel();
    this.rubberM = rubber();
    this.coverM = aluminum({ color: 0xb9c0c9, roughness: 0.3 });
    this.mirrorGlass = chrome({ color: 0xa9c2dc });
    this.coverPlateM = plastic(0x6b7480, { roughness: 0.6 });
    this.finM = plastic(0x2b3038, { roughness: 0.45 });
    this.mats.push(this.bodyMat, this.partPaint, this.chromeM, this.blackM, this.trimM, this.steelM, this.ironM, this.darkM, this.rubberM, this.coverM, this.mirrorGlass, this.coverPlateM, this.finM);
    this.shape = new BodyShape(0, 0);
    this.group.add(this.parts);

    // 바퀴 4개 — 공용 빌더로 1개 만들고 복제(지오메트리·재질 공유)
    this.wheelProto = buildWheel(1);
    this.wheelProto.scale.setScalar(WHEEL_R / 0.25);
    for (const wx of WHEEL_X) {
      for (const sz of [1, -1]) {
        const holder = new THREE.Group();
        holder.position.set(wx, WHEEL_R, sz * WHEEL_Z);
        holder.rotation.y = sz > 0 ? -Math.PI / 2 : Math.PI / 2; // 로컬 +X(바깥 면) → ±Z
        const spin = new THREE.Group();
        const w = this.wheelProto.clone(true);
        spin.add(w);
        // 에어로 휠 커버(바깥 면에 덮는 살짝 볼록한 원판)
        const cover = new THREE.Mesh(
          new THREE.LatheGeometry(
            [
              [0.001, 0.104],
              [0.09, 0.1],
              [0.17, 0.088],
              [0.205, 0.076],
              [0.205, 0.066]
            ].map(([r, y]) => new THREE.Vector2(r, y)),
            48
          ).rotateZ(-Math.PI / 2),
          this.coverM
        );
        cover.castShadow = true;
        spin.add(cover);
        this.covers.push(cover);
        holder.add(spin);
        this.group.add(holder);
        this.wheels.push(holder);
        this.spins.push(spin);
      }
    }
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }

  /** 설정 반영 — 차체를 다시 깎고 부품을 갈아 끼운다 */
  apply(cfg: Config): void {
    const bodyChanged = !this.cfg || this.cfg.pillar !== cfg.pillar || this.cfg.ride !== cfg.ride;
    this.cfg = { ...cfg };
    if (bodyChanged) {
      this.shape = new BodyShape(cfg.pillar, cfg.ride);
      if (this.body) {
        this.group.remove(this.body.mesh);
        this.body.mesh.geometry.dispose();
      }
      this.body = buildBody(this.shape, this.bodyMat);
      this.group.add(this.body.mesh);
    }
    this.repaint();
    disposeGeoms(this.parts);
    this.parts.clear();
    this.spots = [];
    this.underLabels = [];
    this.buildHandles(cfg.handle);
    this.buildMirrors(cfg.mirror);
    this.buildPillarTrim(cfg.pillar);
    this.buildGaps(cfg.gap);
    this.buildUnder(cfg.under);
    this.buildSpoiler(cfg.spoiler);
    for (const c of this.covers) c.visible = cfg.wheel === 1;
    for (const wx of WHEEL_X) for (const sz of [1, -1]) this.spots.push({ kind: 'wheel', pos: new THREE.Vector3(wx, WHEEL_R, sz * (WHEEL_Z + 0.12)) });
    this.parts.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }

  repaint(): void {
    if (!this.body || !this.cfg) return;
    paintBody(this.body, this.shape, this.colorMode, this.pressureCtx, this.cfg.pillar === 0);
  }

  setXray(on: boolean): void {
    this.bodyMat.transparent = on;
    this.bodyMat.opacity = on ? 0.28 : 1;
    this.bodyMat.depthWrite = !on;
    this.bodyMat.needsUpdate = true;
    if (this.body) this.body.mesh.castShadow = !on;
  }

  spinWheels(angle: number): void {
    for (const s of this.spins) s.rotation.x = -angle;
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    this.parts.add(m);
    return m;
  }

  private side(x: number, y: number): number {
    return this.body ? this.body.sideZ(x, y) : 0.7;
  }

  private buildHandles(choice: number): void {
    const sh = this.shape;
    for (const xc of [-0.12, 0.66]) {
      const y = sh.yS(xc) - 0.075;
      for (const sz of [1, -1]) {
        const z = this.side(xc, y);
        if (choice === 0) {
          // 돌출형: 손잡이 막대 + 받침
          const g = roundedBox(0.17, 0.034, 0.034, 0.014);
          const m = this.add(g, this.chromeM);
          m.position.set(xc, y, sz * (z + 0.022));
          const base = this.add(roundedBox(0.2, 0.05, 0.012, 0.012), this.blackM);
          base.position.set(xc, y, sz * (z + 0.003));
        } else {
          // 매립형: 차체 면과 같은 높이의 얇은 판(틈새만 보인다)
          const g = roundedBox(0.15, 0.026, 0.004, 0.002);
          const m = this.add(g, this.trimM);
          m.position.set(xc, y, sz * (z + 0.001));
          const inner = this.add(roundedBox(0.142, 0.019, 0.004, 0.002), this.partPaint);
          inner.position.set(xc, y, sz * (z + 0.0025));
        }
        this.spots.push({ kind: 'handle', pos: new THREE.Vector3(xc, y, sz * (z + 0.03)) });
      }
    }
  }

  private buildMirrors(choice: number): void {
    const sh = this.shape;
    const x = -0.56;
    const y = sh.yS(x) + 0.02;
    for (const sz of [1, -1]) {
      const z = this.side(x, sh.yS(x) - 0.04) - 0.02;
      const g = new THREE.Group();
      g.position.set(x, y, sz * z);
      g.scale.z = sz;
      this.parts.add(g);
      const put = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number): THREE.Mesh => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(px, py, pz);
        g.add(m);
        return m;
      };
      let tipZ = 0.2;
      if (choice === 0) {
        // 큰 사각 미러: 바람을 정면으로 받는 네모난 하우징
        put(roundedBox(0.07, 0.04, 0.12, 0.012), this.blackM, 0.0, 0.0, 0.06);
        put(roundedBox(0.1, 0.15, 0.2, 0.016), this.partPaint, 0.01, 0.07, 0.2);
        const glassM = put(roundedBox(0.006, 0.13, 0.18, 0.004), this.mirrorGlass, 0.062, 0.07, 0.2);
        glassM.castShadow = false;
        tipZ = 0.3;
      } else if (choice === 1) {
        // 유선형: 앞이 둥근 물방울 하우징
        put(roundedBox(0.06, 0.026, 0.09, 0.01), this.blackM, 0.0, 0.0, 0.05);
        const shell = new THREE.SphereGeometry(1, 28, 18);
        shell.scale(0.085, 0.06, 0.12);
        const pos = shell.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0.03) pos.setX(i, 0.03 + (pos.getX(i) - 0.03) * 0.25); // 뒷면(거울 면)을 평평하게
        shell.computeVertexNormals();
        put(shell, this.partPaint, 0.0, 0.055, 0.17);
        const glassM = put(new THREE.CircleGeometry(1, 28).scale(0.05, 0.1, 1).rotateY(Math.PI / 2), this.mirrorGlass, 0.047, 0.055, 0.17);
        glassM.castShadow = false;
        tipZ = 0.27;
      } else {
        // 카메라 미러: 가는 받침 + 작은 카메라
        put(roundedBox(0.05, 0.02, 0.1, 0.008), this.blackM, 0.0, 0.0, 0.05);
        put(roundedBox(0.07, 0.035, 0.05, 0.012), this.partPaint, -0.005, 0.012, 0.11);
        const lens = put(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 16).rotateZ(Math.PI / 2), this.trimM, 0.032, 0.012, 0.11);
        lens.castShadow = false;
        tipZ = 0.14;
      }
      this.spots.push({ kind: 'mirror', pos: new THREE.Vector3(x + 0.05, y + 0.06, sz * (z + tipZ)) });
    }
  }

  private buildPillarTrim(choice: number): void {
    const sh = this.shape;
    // 앞유리 옆 기둥선 위를 따라 표시(각진 필러는 굵은 검은 몰딩 + 빗물 홈)
    const pts: THREE.Vector3[] = [];
    const x0 = choice === 0 ? -0.62 : -0.7;
    const x1 = choice === 0 ? -0.15 : -0.02;
    for (let i = 0; i <= 16; i++) {
      const x = lerp(x0, x1, i / 16);
      const yT = sh.yT(x);
      const z = sh.wR(x) + (choice === 0 ? 0.025 : 0);
      pts.push(new THREE.Vector3(x, yT - (choice === 0 ? 0.03 : 0.06), z));
    }
    if (choice === 0) {
      for (const sz of [1, -1]) {
        const p = pts.map((v) => new THREE.Vector3(v.x, v.y + 0.006, sz * (v.z + 0.012)));
        const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 24, 0.016, 6, false);
        this.add(g, this.trimM);
      }
    }
    const mid = pts[8]!;
    for (const sz of [1, -1]) this.spots.push({ kind: 'pillar', pos: new THREE.Vector3(mid.x, mid.y, sz * (mid.z + 0.05)) });
  }

  private buildGaps(choice: number): void {
    const sh = this.shape;
    const hw = choice === 0 ? 0.011 : 0.0035;
    const lift = choice === 0 ? 0.003 : 0.0015;
    for (const sz of [1, -1]) {
      for (const xs of [-0.6, 0.31, 1.0]) {
        const pts: THREE.Vector3[] = [];
        const y0 = sh.yB(xs) + 0.07;
        const y1 = sh.yS(xs) - 0.005;
        for (let i = 0; i <= 14; i++) {
          const y = lerp(y0, y1, i / 14);
          pts.push(new THREE.Vector3(xs, y, sz * (this.side(xs, y) + lift)));
        }
        this.add(ribbon(pts, hw, new THREE.Vector3(1, 0, 0)), this.trimM);
        if (choice === 0) {
          // 단차: 뒤쪽 패널 끝이 바깥으로 살짝 튀어나온 턱
          const lip = pts.map((p) => new THREE.Vector3(p.x + hw + 0.006, p.y, p.z + sz * 0.008));
          this.add(ribbon(lip, 0.006, new THREE.Vector3(1, 0, 0)), this.partPaint);
        }
      }
      // 문 아래쪽 가로 틈
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const x = lerp(-0.6, 1.0, i / 24);
        const y = sh.yB(x) + 0.07;
        pts.push(new THREE.Vector3(x, y, sz * (this.side(x, y) + lift)));
      }
      this.add(ribbon(pts, hw, new THREE.Vector3(0, 1, 0)), this.trimM);
      this.spots.push({ kind: 'gap', pos: new THREE.Vector3(0.31, sh.yM(0.31), sz * (this.side(0.31, sh.yM(0.31)) + 0.03)) });
    }
  }

  private buildUnder(choice: number): void {
    const c = this.shape.clearance;
    if (choice === 0) {
      // 노출: 배기관·소음기·서스펜션 팔·연료 탱크·오일 팬이 바닥 아래로 드러남
      const exhaust = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.25, c - 0.02, 0.18),
        new THREE.Vector3(-0.9, c - 0.05, 0.22),
        new THREE.Vector3(0.9, c - 0.05, 0.22),
        new THREE.Vector3(1.2, c - 0.05, 0.3),
        new THREE.Vector3(1.86, c + 0.02, 0.36)
      ]);
      this.add(new THREE.TubeGeometry(exhaust, 48, 0.03, 12, false), this.steelM);
      const muffler = this.add(roundedBox(0.5, 0.1, 0.26, 0.04), this.darkM);
      muffler.position.set(1.35, c - 0.05, 0.3);
      const muffler2 = this.add(roundedBox(0.28, 0.08, 0.16, 0.03), this.darkM);
      muffler2.position.set(0.1, c - 0.045, 0.22);
      const tank = this.add(roundedBox(0.55, 0.07, 0.6, 0.03), this.ironM);
      tank.position.set(0.75, c - 0.035, -0.12);
      const pan = this.add(roundedBox(0.4, 0.08, 0.36, 0.03), this.ironM);
      pan.position.set(-1.35, c - 0.04, 0);
      // 바닥 철판의 가로 보강 리브와 가운데 터널(요철)
      for (let x = -0.85; x <= 1.0; x += 0.3) {
        const rib = this.add(roundedBox(0.05, 0.03, 1.1, 0.01), this.darkM);
        rib.position.set(x, c - 0.012, 0);
      }
      const tunnel = this.add(roundedBox(1.9, 0.05, 0.16, 0.025), this.darkM);
      tunnel.position.set(-0.1, c - 0.02, -0.02);
      // 스페어 타이어 자리(트렁크 바닥이 아래로 볼록)
      const well = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.07, 32), this.ironM);
      well.position.set(1.45, c - 0.03, -0.18);
      this.parts.add(well);
      // 뒤 서스펜션 트레일링 암
      for (const sz of [1, -1]) {
        const arm = this.add(roundedBox(0.7, 0.04, 0.05, 0.015), this.darkM);
        arm.position.set(WHEEL_X[1] - 0.35, c - 0.03, sz * 0.45);
      }
      const lab = (text: string, x: number, y: number, z: number): void => {
        this.underLabels.push({ text, pos: new THREE.Vector3(x, y, z) });
      };
      lab('배기관', 0.35, c - 0.2, 0.3);
      lab('머플러', 1.35, c - 0.22, 0.42);
      lab('연료 탱크', 0.75, c - 0.2, -0.32);
      lab('서스펜션 암', WHEEL_X[0], c - 0.2, -0.42);
      lab('오일 팬', -1.35, c - 0.22, 0.05);
      lab('스페어 타이어 자리', 1.5, c - 0.2, -0.4);
      lab('울퉁불퉁 → 공기가 엉켜요', -0.6, c - 0.34, 0.45);
      for (const wx of WHEEL_X) {
        for (const sz of [1, -1]) {
          const a = new THREE.Vector3(wx - 0.05, c - 0.02, sz * 0.18);
          const b = new THREE.Vector3(wx, WHEEL_R - 0.06, sz * 0.5);
          const len = a.distanceTo(b);
          const arm = new THREE.CylinderGeometry(0.022, 0.022, len, 10);
          arm.translate(0, len / 2, 0);
          const m = this.add(arm, this.darkM);
          m.position.copy(a);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        }
        const cross = this.add(roundedBox(0.12, 0.05, 0.75, 0.02), this.ironM);
        cross.position.set(wx - 0.05, c - 0.02, 0);
      }
      this.spots.push({ kind: 'under', pos: new THREE.Vector3(0.2, 0.06, 0) });
      return;
    }
    // 언더커버: 바닥 전체를 덮는 평평한 판
    const plate = this.add(roundedBox(3.05, 0.016, 1.14, 0.008), this.coverPlateM);
    plate.position.set(-0.05, c - 0.006, 0);
    this.underLabels.push({ text: choice === 1 ? '평평한 언더커버' : '언더커버', pos: new THREE.Vector3(-0.2, c - 0.22, 0) });
    if (choice === 1) this.underLabels.push({ text: '매끈한 판 → 공기가 곧게', pos: new THREE.Vector3(0.7, c - 0.3, 0.25) });
    if (choice === 2) {
      this.underLabels.push({ text: '디퓨저(뒤로 갈수록 위로 꺾임)', pos: new THREE.Vector3(1.62, c - 0.08, 0.1) });
      this.underLabels.push({ text: '세로 핀', pos: new THREE.Vector3(1.6, c - 0.12, -0.45) });
      // 디퓨저: 뒤쪽을 위로 벌린 판 + 세로 핀(스트레이크)
      const len = 0.48;
      const ang = 0.3;
      const ramp = this.add(roundedBox(len, 0.014, 1.06, 0.006), this.finM);
      ramp.position.set(1.47 + (len / 2) * Math.cos(ang) - len / 2 + 0.02, c + (len / 2) * Math.sin(ang), 0);
      ramp.rotation.z = ang;
      for (const zz of [-0.36, -0.12, 0.12, 0.36]) {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(len, len * Math.tan(ang));
        s.lineTo(len, -0.01);
        s.lineTo(0, -0.04);
        s.closePath();
        const fin = this.add(new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false }), this.coverPlateM);
        fin.position.set(1.36, c - 0.004, zz - 0.006);
      }
    }
    this.spots.push({ kind: 'under', pos: new THREE.Vector3(0.2, 0.06, 0) });
  }

  private buildSpoiler(choice: number): void {
    this.wing = null;
    if (choice === 0) return;
    const sh = this.shape;
    const xe = 1.79;
    const yT = sh.yT(xe - 0.06);
    if (choice === 1) {
      // 립 스포일러: 트렁크 끝의 작은 턱
      const s = new THREE.Shape();
      s.moveTo(-0.16, 0);
      s.lineTo(0.03, 0);
      s.lineTo(0.05, 0.045);
      s.quadraticCurveTo(-0.05, 0.02, -0.16, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2 });
      g.translate(0, 0, -0.5);
      const m = this.add(g, this.partPaint);
      m.position.set(xe - 0.02, yT - 0.006, 0);
      this.spots.push({ kind: 'spoiler', pos: new THREE.Vector3(xe, yT + 0.06, 0.4) });
      return;
    }
    // 큰 윙: 받침 2개 + 거꾸로 단 날개 + 끝판
    const chord = 0.3;
    const wy = yT + 0.27;
    const wx = 1.5;
    const span = 1.3;
    const g = new THREE.ExtrudeGeometry(airfoil(chord, 0.12), { depth: span, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -span / 2);
    const wing = this.add(g, this.blackM);
    wing.position.set(wx, wy, 0);
    wing.rotation.z = -0.12; // 받음각(앞이 내려간 쪽 — 아래로 누름)
    for (const sz of [1, -1]) {
      const st = new THREE.Shape();
      st.moveTo(0, 0);
      st.lineTo(0.14, 0);
      st.lineTo(0.12, 0.27);
      st.lineTo(0.04, 0.27);
      st.closePath();
      const up = this.add(new THREE.ExtrudeGeometry(st, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), this.blackM);
      up.position.set(wx + 0.06, sh.yT(wx + 0.12) - 0.01, sz * 0.42 - 0.01);
      const ep = this.add(roundedBox(0.34, 0.12, 0.012, 0.01), this.blackM);
      ep.position.set(wx + chord / 2, wy - 0.01, sz * (span / 2 + 0.006));
    }
    this.wing = { x0: wx - 0.02, x1: wx + chord + 0.02, y0: wy - 0.06, y1: wy + 0.05, hz: span / 2 };
    this.spots.push({ kind: 'spoiler', pos: new THREE.Vector3(wx + chord, wy + 0.04, 0.45) });
  }

  /** 시험 코스용 복제(지오메트리 공유, 재질 선택적 교체) */
  makeClone(material?: THREE.Material): THREE.Group {
    const g = this.group.clone(true);
    if (material) {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = material;
          m.castShadow = false;
        }
      });
    }
    return g;
  }

  dispose(): void {
    disposeGeoms(this.parts);
    if (this.body) this.body.mesh.geometry.dispose();
    for (const c of this.covers) c.geometry.dispose();
    // 바퀴 원본(복제들이 같은 지오메트리·재질을 공유)
    this.wheelProto.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mm = m.material;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm.dispose();
      }
    });
    for (const m of this.mats) m.dispose();
  }
}
