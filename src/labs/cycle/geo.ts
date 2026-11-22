// 13-A 컷어웨이 엔진용 지오메트리 도구
// 엔진은 z=0 평면에서 반으로 잘린 모습이다: 뒤쪽 절반(z≤0)만 만들고, 잘린 면은 캔버스로 그린 단면 판(빗금)으로 덮는다.
// 가스가 지나는 통로(포트·관)는 반원 홈(half tube)으로 만들어 앞에서 안쪽이 들여다보이게 한다.

import * as THREE from 'three';
import type { V2 } from '../../models/parts/geom';

export const TAU = Math.PI * 2;

export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

function shapeOf(pts: V2[], holes: V2[][] = []): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    h.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
    p.closePath();
    s.holes.push(p);
  }
  return s;
}

/** XY 다각형을 z 평면에 놓은 판 */
export function flatXY(pts: V2[], z: number, holes: V2[][] = []): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapeOf(pts, holes));
  g.translate(0, 0, z);
  return g;
}

/** (x, z) 다각형을 높이 y의 수평 판으로 */
export function flatXZ(pts: V2[], y: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapeOf(pts));
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** (z, y) 다각형을 x 위치의 세로 판으로 */
export function flatZY(pts: V2[], x: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapeOf(pts));
  g.rotateY(-Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

/**
 * 단면 윤곽을 뒤(-z)로 깊이 depth만큼 민 껍데기: 옆벽 + 뒤 뚜껑(앞 뚜껑은 단면 판이 대신함).
 * skip(i)가 true인 변(outline[i]→outline[i+1])은 벽을 만들지 않는다(다른 덩어리와 맞닿는 면, 통로가 뚫린 면).
 */
export function shell(outline: V2[], depth: number, skip: (i: number) => boolean = () => false, backHoles: V2[][] = [], back = true): THREE.BufferGeometry {
  const pos: number[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    if (skip(i)) continue;
    const a = outline[i]!;
    const b = outline[(i + 1) % n]!;
    pos.push(a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], -depth, a[0], a[1], 0, b[0], b[1], -depth, a[0], a[1], -depth);
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  walls.computeVertexNormals();
  if (!back) return walls;
  const cap = flatXY(outline, -depth, backHoles);
  return mergeSimple([walls, cap]);
}

/** position(+normal)만 가진 지오메트리 병합 */
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const p = g.getAttribute('position');
    const nn = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(nn.getX(i), nn.getY(i), nn.getZ(i));
    }
    if (g !== g0) g.dispose();
    g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** 포트 출구가 반원으로 뚫린 옆벽 (z, y) 윤곽 — flatZY로 세운다 */
export function portWall(y0: number, y1: number, yc: number, r: number, depth: number): V2[] {
  const out: V2[] = [[0, y0], [0, yc - r]];
  for (let i = 1; i < 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI;
    out.push([-r * Math.cos(a), yc + r * Math.sin(a)]);
  }
  out.push([0, yc + r], [0, y1], [-depth, y1], [-depth, y0]);
  return out;
}

/** 관 이음 플랜지: 반원 고리 (z, y) 윤곽 */
export function halfAnnulus(yc: number, ri: number, ro: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 + (i / 20) * Math.PI;
    out.push([-ro * Math.cos(a), yc + ro * Math.sin(a)]);
  }
  for (let i = 20; i >= 0; i--) {
    const a = -Math.PI / 2 + (i / 20) * Math.PI;
    out.push([-ri * Math.cos(a), yc + ri * Math.sin(a)]);
  }
  return out;
}

/** 통로의 중심선(XY 평면). 3D 반원 홈과 단면 그림이 같은 점열을 쓴다. */
export class Duct {
  readonly pts: THREE.Vector3[];
  readonly curve: THREE.CatmullRomCurve3;
  constructor(
    ctrl: V2[],
    readonly r: number,
    samples = 64
  ) {
    this.curve = new THREE.CatmullRomCurve3(
      ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'centripetal'
    );
    this.pts = this.curve.getSpacedPoints(samples);
  }
  get pts2(): V2[] {
    return this.pts.map((p) => [p.x, p.y] as V2);
  }
}

/** 중심선을 따라가는 반원 홈(z≤0 쪽). clamp로 정점을 다른 면(실린더 벽) 위로 밀어 붙일 수 있다. */
export function halfTube(path: THREE.Vector3[], r: number, radial = 14, clamp?: (v: THREE.Vector3) => void, full = false): THREE.BufferGeometry {
  const n = path.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const v = new THREE.Vector3();
  const span = full ? TAU : Math.PI;
  const cols = radial + (full ? 0 : 1);
  for (let k = 0; k < n; k++) {
    const p0 = path[Math.max(0, k - 1)]!;
    const p1 = path[Math.min(n - 1, k + 1)]!;
    T.subVectors(p1, p0).normalize();
    // 평면 경로: N = 경로 안쪽 수직, B = -z. z 방향 경로: N = +x, B = 위아래
    if (Math.abs(T.z) > 0.9) {
      N.set(1, 0, 0);
      B.crossVectors(T, N).normalize();
    } else {
      N.set(-T.y, T.x, 0).normalize();
      B.set(0, 0, -1);
    }
    for (let j = 0; j < cols; j++) {
      const a = (j / radial) * span;
      v.copy(path[k]!).addScaledVector(N, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r);
      if (clamp) clamp(v);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let k = 0; k < n - 1; k++) {
    for (let j = 0; j < radial; j++) {
      const j1 = full ? (j + 1) % cols : j + 1;
      const a = k * cols + j;
      const b = (k + 1) * cols + j;
      const c = (k + 1) * cols + j1;
      const d = k * cols + j1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 실린더 보어의 뒤쪽 반원통 안쪽 면. isWindow(x,y,z)가 참인 칸은 비운다(포트 구멍).
 */
export function boreSurface(R: number, y0: number, y1: number, isWindow: (x: number, y: number, z: number) => boolean = () => false, segs = 96, dy = 0.012): THREE.BufferGeometry {
  const rows = Math.max(2, Math.ceil((y1 - y0) / dy) + 1);
  const pos: number[] = [];
  const cell = (i: number, j: number): [number, number, number] => {
    const ph = Math.PI / 2 + (i / segs) * Math.PI;
    const y = y0 + ((y1 - y0) * j) / (rows - 1);
    return [R * Math.sin(ph), y, R * Math.cos(ph)];
  };
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = cell(i, j);
      const b = cell(i + 1, j);
      const c = cell(i + 1, j + 1);
      const d = cell(i, j + 1);
      const mx = (a[0] + c[0]) / 2;
      const my = (a[1] + c[1]) / 2;
      const mz = (a[2] + c[2]) / 2;
      if (isWindow(mx, my, mz)) continue;
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // 법선: 축을 향함
  const nor: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]!;
    const z = pos[i + 2]!;
    const l = Math.hypot(x, z) || 1;
    nor.push(-x / l, 0, -z / l);
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** 보어 아래 끝 둥근 테두리와 평평한 뒷벽(z=-depth) 사이를 메우는 수평 판 */
export function boreSkirtFill(R: number, depth: number, y: number): THREE.BufferGeometry {
  const pts: V2[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI - (i / 32) * Math.PI; // x: -R → R, z: 0 → -R → 0
    pts.push([R * Math.cos(a), -R * Math.sin(a)]);
  }
  pts.push([R, -depth], [-R, -depth]);
  return flatXZ(pts, y);
}

/** 볼록 껍질(모노톤 체인) */
export function convexHull(points: V2[]): V2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** 풀리 여러 개를 감는 벨트 띠(z 위치, 폭 w, 두께 th) */
export function beltRibbon(circles: { c: V2; r: number }[], z: number, w: number, th: number): THREE.BufferGeometry {
  const samples: V2[] = [];
  for (const c of circles) for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    samples.push([c.c[0] + Math.cos(a) * (c.r + th / 2), c.c[1] + Math.sin(a) * (c.r + th / 2)]);
  }
  const hull = convexHull(samples);
  const pos: number[] = [];
  const n = hull.length;
  const off = (i: number, s: number): V2 => {
    const a = hull[(i - 1 + n) % n]!;
    const b = hull[(i + 1) % n]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const p = hull[i]!;
    return [p[0] + (ty / l) * s, p[1] - (tx / l) * s];
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (const s of [th / 2, -th / 2]) {
      const a = off(i, s);
      const b = off(j, s);
      pos.push(a[0], a[1], z + w / 2, b[0], b[1], z + w / 2, b[0], b[1], z - w / 2, a[0], a[1], z + w / 2, b[0], b[1], z - w / 2, a[0], a[1], z - w / 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ─────────────────────── 단면 판(캔버스) ───────────────────────

interface StrokeCav {
  pts: V2[];
  w: number;
}

/** 잘린 면: 고체 윤곽을 칠하고 빗금을 넣은 뒤, 빈 공간(보어·포트·크랭크실)을 지워 낸 그림을 z=0 판에 붙인다. */
export class CutFace {
  private solids: V2[][] = [];
  private cavPolys: V2[][] = [];
  private cavStrokes: StrokeCav[] = [];

  solid(p: V2[]): this {
    this.solids.push(p);
    return this;
  }
  cavity(p: V2[]): this {
    this.cavPolys.push(p);
    return this;
  }
  duct(d: Duct, extra = 0): this {
    this.cavStrokes.push({ pts: d.pts2, w: 2 * d.r + extra });
    return this;
  }

  build(z = 0.0015, S = 300): THREE.Mesh {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of this.solids) for (const [x, y] of p) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const pad = 0.02;
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
    const W = Math.ceil((x1 - x0) * S);
    const H = Math.ceil((y1 - y0) * S);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable');
    const tx = (x: number): number => (x - x0) * S;
    const ty = (y: number): number => (y1 - y) * S;
    const poly = (p: V2[]): void => {
      g.beginPath();
      p.forEach(([x, y], i) => (i === 0 ? g.moveTo(tx(x), ty(y)) : g.lineTo(tx(x), ty(y))));
      g.closePath();
    };
    const line = (p: V2[]): void => {
      g.beginPath();
      p.forEach(([x, y], i) => (i === 0 ? g.moveTo(tx(x), ty(y)) : g.lineTo(tx(x), ty(y))));
    };
    const edge = 5;
    // 1) 고체
    g.fillStyle = '#c4ccd5';
    for (const p of this.solids) {
      poly(p);
      g.fill();
    }
    // 2) 빗금(고체 위에만)
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = '#9ea9b6';
    g.lineWidth = 2.2;
    g.beginPath();
    for (let k = -H; k < W + H; k += 16) {
      g.moveTo(k, H);
      g.lineTo(k + H, 0);
    }
    g.stroke();
    // 3) 바깥 윤곽선
    g.strokeStyle = '#38414c';
    g.lineWidth = edge * 2;
    g.lineJoin = 'round';
    for (const p of this.solids) {
      poly(p);
      g.stroke();
    }
    // 4) 빈 공간의 윤곽선(테두리만큼 넓게 칠함)
    g.fillStyle = '#38414c';
    for (const p of this.cavPolys) {
      poly(p);
      g.fill();
      g.stroke();
    }
    g.lineCap = 'butt';
    for (const s of this.cavStrokes) {
      g.lineWidth = s.w * S + edge * 2;
      line(s.pts);
      g.stroke();
    }
    // 5) 빈 공간 지우기
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    for (const p of this.cavPolys) {
      poly(p);
      g.fill();
    }
    for (const s of this.cavStrokes) {
      g.lineWidth = s.w * S;
      line(s.pts);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.62, metalness: 0.15 });
    const plane = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    plane.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    const m = new THREE.Mesh(plane, mat);
    m.userData.noAO = true;
    m.receiveShadow = true;
    m.userData.cutTex = tex;
    return m;
  }
}

/** 경로 위 위치(호장 비율 s)와 수직 오프셋 — 가스 입자가 관 속을 지나게 한다 */
export class PathSampler {
  private pts: THREE.Vector3[];
  private ns: THREE.Vector3[] = [];
  private bs: THREE.Vector3[] = [];
  constructor(ctrl: THREE.Vector3[], samples = 160) {
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    this.pts = curve.getSpacedPoints(samples);
    const n = this.pts.length;
    const T = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      T.subVectors(this.pts[Math.min(n - 1, k + 1)]!, this.pts[Math.max(0, k - 1)]!).normalize();
      const N = Math.abs(T.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-T.y, T.x, 0).normalize();
      const B = new THREE.Vector3().crossVectors(T, N).normalize();
      if (B.z > 0.01) B.negate();
      this.ns.push(N);
      this.bs.push(B);
    }
  }
  /** s∈[0,1], a·b: 단면 안 오프셋(관 반지름 단위가 아니라 실제 거리) */
  at(s: number, a: number, b: number, out: THREE.Vector3): THREE.Vector3 {
    const n = this.pts.length - 1;
    const u = Math.min(n, Math.max(0, s * n));
    const k = Math.min(n - 1, Math.floor(u));
    const f = u - k;
    out.lerpVectors(this.pts[k]!, this.pts[k + 1]!, f);
    out.addScaledVector(this.ns[k]!, a).addScaledVector(this.bs[k]!, b);
    return out;
  }
}

export function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** 결정적 의사 난수(입자 배치가 매번 같게) */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
