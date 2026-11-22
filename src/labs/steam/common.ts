// 증기 기관 실험 공용 도구: 색, 벽돌·돌 재질, 반쯤 잘린(컷어웨이) 회전체, 화살표, 불, 밸브 표시, 재생기.

import * as THREE from 'three';
import { creased, mesh, TAU, type V2 } from '../../models/parts/geom';
import { glow, plastic, paint } from '../../models/materials';

/** 물·증기·불 색 — 3D와 범례(DOM)가 같은 값을 쓴다 */
export const COL = {
  water: 0x2f7fe0,
  steam: 0xffe3ec,
  fire: 0xff7a1a,
  cold: 0x7fd3ff,
  air: 0x8a4fd8,
  used: 0xaab4c0,
  smoke: 0x50555d,
  force: 0xe5484d,
  open: 0x22c55e,
  closed: 0xe5484d
} as const;

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

// ───────────── 벽돌 ─────────────

let _brick: THREE.CanvasTexture | null = null;
/** 벽돌 무늬(1 단위 = 가로 4장 × 12단) — 월드 좌표 UV와 함께 쓴다 */
function brickTexture(): THREE.CanvasTexture {
  if (_brick) return _brick;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.fillStyle = '#cdbfae';
  g.fillRect(0, 0, 256, 256);
  const rows = 12;
  const cols = 4;
  const bh = 256 / rows;
  const bw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off;
      const v = 0.82 + Math.random() * 0.3;
      const R = Math.min(255, 168 * v);
      const G = Math.min(255, 86 * v);
      const B = Math.min(255, 62 * v);
      g.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  _brick = t;
  return t;
}

export function brickMat(): THREE.MeshStandardMaterial {
  const m = plastic(0xffffff, { roughness: 0.9 });
  m.map = brickTexture();
  return m;
}

export function stoneMat(color = 0x9d978c): THREE.MeshStandardMaterial {
  return plastic(color, { roughness: 0.92 });
}

/** 자른 면(단면) 색 — 공학 단면도처럼 붉은 톤으로 구분 */
export function cutMat(): THREE.MeshPhysicalMaterial {
  const m = paint(0xd2593f, { roughness: 0.6 });
  m.side = THREE.DoubleSide;
  return m;
}

/** 상자(중심·크기). 벽돌처럼 무늬가 있는 재질을 위해 UV를 실제 크기(단위)로 맞춘다 */
export function box(
  parent: THREE.Object3D,
  mat: THREE.Material,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number
): THREE.Mesh {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z (면마다 정점 4개)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f]!;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * su + x0 * 0.37, uv.getY(i) * sv + y0);
    }
  }
  const m = mesh(g, mat, parent);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

// ───────────── 컷어웨이 회전체 ─────────────

/**
 * (r, y) 닫힌 단면을 Y축 둘레로 돌리되, dir 방향(라디안, 0=+Z, +X 쪽이 양수)으로 gap만큼 잘라 낸다.
 * 잘린 두 면에는 단면 뚜껑을 붙인다(capMat가 없으면 본체 재질).
 */
export function cutSolid(profile: V2[], gap: number, dir: number, mat: THREE.Material, capMat?: THREE.Material, segs = 48): THREE.Group {
  const grp = new THREE.Group();
  // 잘린 회전체는 안쪽 면도 보여야 한다
  mat.side = THREE.DoubleSide;
  const p0 = dir + gap / 2;
  const len = TAU - gap;
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const lat = creased(new THREE.LatheGeometry(pts, Math.max(8, Math.round((segs * len) / TAU)), p0, len), 40);
  mesh(lat, mat, grp);
  if (gap > 0.001) {
    const shape = new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)));
    for (const phi of [p0, p0 + len]) {
      const g = new THREE.ShapeGeometry(shape);
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const r = pos.getX(i);
        pos.setXYZ(i, r * Math.sin(phi), pos.getY(i), r * Math.cos(phi));
      }
      g.computeVertexNormals();
      const cm = mesh(g, capMat ?? mat, grp);
      cm.castShadow = false;
    }
  }
  return grp;
}

/** 원기둥 부피(유체) — 높이 0~1, scale.y로 높이를 바꾼다 */
export function cutVolume(r: number, gap: number, dir: number, mat: THREE.Material): THREE.Group {
  const g = cutSolid([[0, 0], [r, 0], [r, 1], [0, 1]], gap, dir, mat, mat, 40);
  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    o.userData.noAO = true;
  });
  return g;
}

/** 관(파이프): 꺾이는 점마다 둥근 굽힘을 넣은 튜브 */
export function pipe(pts: THREE.Vector3[], r: number, mat: THREE.Material, parent: THREE.Object3D, bend = 0.08): THREE.Mesh {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cur = pts[0]!.clone();
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const next = pts[i + 1];
    if (!next) {
      path.add(new THREE.LineCurve3(cur, p.clone()));
      break;
    }
    const a = p.clone().sub(cur);
    const b = next.clone().sub(p);
    const ra = Math.min(bend, a.length() / 2);
    const rb = Math.min(bend, b.length() / 2);
    const s = p.clone().sub(a.normalize().multiplyScalar(ra));
    const e = p.clone().add(b.normalize().multiplyScalar(rb));
    if (s.distanceTo(cur) > 1e-4) path.add(new THREE.LineCurve3(cur, s));
    path.add(new THREE.QuadraticBezierCurve3(s, p.clone(), e));
    cur = e;
  }
  const segs = Math.max(8, Math.round(path.getLength() / 0.04));
  const g = new THREE.TubeGeometry(path, segs, r, 16, false);
  return mesh(g, mat, parent);
}

/** 플랜지(관 이음 고리) */
export function flange(parent: THREE.Object3D, mat: THREE.Material, p: THREE.Vector3, axis: 'x' | 'y' | 'z', r: number, t = 0.025): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, t, 24);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = mesh(g, mat, parent);
  m.position.copy(p);
  return m;
}

/** 원기둥(축 방향 지정) */
export function cyl(parent: THREE.Object3D, mat: THREE.Material, r: number, len: number, axis: 'x' | 'y' | 'z', p: THREE.Vector3, seg = 24): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = mesh(g, mat, parent);
  m.position.copy(p);
  return m;
}

export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

// ───────────── 화살표 ─────────────

/** 힘·흐름 화살표(길이 len, 기본 방향 -Y). 그룹을 회전시켜 방향을 바꾼다 */
export function arrow(color: number, len = 0.4, r = 0.028): THREE.Group {
  const g = new THREE.Group();
  const mat = glow(color, 0.55);
  mat.transparent = true;
  const head = Math.min(len * 0.4, r * 4.2);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len - head, 12), mat);
  shaft.position.y = -(len - head) / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 2.3, head, 16), mat);
  cone.rotation.x = Math.PI;
  cone.position.y = -len + head / 2;
  g.add(shaft, cone);
  g.traverse((o) => (o.userData.noAO = true));
  g.userData.mat = mat;
  return g;
}

/** 화살표를 from에서 dir 방향으로 놓는다 */
export function aimArrow(a: THREE.Object3D, from: THREE.Vector3, dir: THREE.Vector3): void {
  a.position.copy(from);
  a.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
}

/** 화살표 그룹 표시 정도(0~1) — 서서히 나타나고 사라지게 */
export function fadeGroup(g: THREE.Object3D, k: number): void {
  g.visible = k > 0.02;
  const s = 0.6 + 0.4 * k;
  g.scale.setScalar(s);
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && m.transparent) m.opacity = k;
  });
}

// ───────────── 불 ─────────────

/** 화실의 불: 불꽃 몇 개 + 숯불 + 깜빡이는 점광원 */
export class Fire {
  readonly group = new THREE.Group();
  private flames: THREE.Mesh[] = [];
  private light: THREE.PointLight;
  private seeds: number[] = [];
  level = 1;

  constructor(w: number, d: number, h: number, power = 3) {
    const bed = glow(0xff4d12, 1.4);
    const coal = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.12, d), bed);
    coal.position.y = h * 0.06;
    this.group.add(coal);
    const outer = glow(COL.fire, 1.6);
    outer.transparent = true;
    outer.opacity = 0.85;
    const inner = glow(0xffd25a, 2.2);
    const cone = new THREE.ConeGeometry(1, 1, 10, 1, true);
    cone.translate(0, 0.5, 0);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(cone, i % 3 === 0 ? inner : outer);
      const u = (i + 0.5) / n - 0.5;
      f.position.set(u * w * 0.85, h * 0.1, ((i * 37) % 5) / 5 * d * 0.6 - d * 0.3);
      this.group.add(f);
      this.flames.push(f);
      this.seeds.push(i * 1.7);
    }
    this.light = new THREE.PointLight(0xff8a3a, power, 2.6, 2);
    this.light.position.y = h * 0.6;
    this.group.add(this.light);
    this.group.traverse((o) => {
      o.castShadow = false;
      o.userData.noAO = true;
    });
    this.basePower = power;
    this.h = h;
    this.w = w;
  }

  private basePower: number;
  private h: number;
  private w: number;

  update(t: number): void {
    const L = this.level;
    this.flames.forEach((f, i) => {
      const s = this.seeds[i]!;
      const k = 0.65 + 0.35 * Math.sin(t * 9 + s) * Math.sin(t * 5.3 + s * 2);
      const big = (0.45 + 0.55 * L) * k;
      f.scale.set(this.w * 0.09 * (0.8 + 0.3 * L), this.h * 0.75 * big, this.w * 0.09 * (0.8 + 0.3 * L));
      f.visible = L > 0.03;
    });
    this.light.intensity = this.basePower * (0.25 + 0.75 * L) * (0.85 + 0.15 * Math.sin(t * 13.1) * Math.sin(t * 7.7));
  }
}

// ───────────── 밸브 표시 ─────────────

/** 밸브 열림(초록)/닫힘(빨강) 표시 구슬 */
export class ValveMark {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private on = -1;
  constructor(parent: THREE.Object3D, p: THREE.Vector3, r = 0.035) {
    this.mat = glow(COL.closed, 0.9);
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), this.mat);
    this.mesh.position.copy(p);
    this.mesh.userData.noAO = true;
    parent.add(this.mesh);
  }
  set(open: boolean): void {
    const v = open ? 1 : 0;
    if (v === this.on) return;
    this.on = v;
    const c = open ? COL.open : COL.closed;
    this.mat.color.setHex(c);
    this.mat.emissive.setHex(c);
  }
}

// ───────────── 재생기 ─────────────

export interface Seg {
  a: number;
  b: number;
  dur: number;
}

/**
 * 한 사이클을 0~1(u)로 보고, 연속 재생(속도 rate 사이클/초) 또는 한 구간 [a,b]만 천천히 반복 재생한다.
 * u는 감기지 않은 누적 값이라 바퀴의 굴러간 거리 계산에도 쓴다.
 */
export class Player {
  u = 0;
  seg: Seg | null = null;
  loops = 0;
  rate = 0;
  private s = 0;
  private hold = 0;
  private base = 0;

  play(seg: Seg | null): void {
    this.seg = seg;
    this.loops = 0;
    if (seg) {
      this.base = Math.floor(this.u);
      this.s = 0;
      this.hold = 0;
      this.u = this.base + seg.a;
    }
  }

  update(dt: number, rate: number): void {
    const seg = this.seg;
    const u0 = this.u;
    if (!seg) {
      this.u += rate * dt;
    } else if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) {
        this.s = 0;
        this.u = this.base + seg.a;
      }
    } else {
      this.s = Math.min(1, this.s + dt / seg.dur);
      this.u = this.base + seg.a + (seg.b - seg.a) * this.s;
      if (this.s >= 1) {
        this.hold = 1.1;
        this.loops++;
      }
    }
    this.rate = dt > 0 ? Math.max(0, (this.u - u0) / dt) : 0;
  }

  /** 사이클 안의 위치 0~1 */
  get phase(): number {
    if (this.seg) return Math.min(0.99999, Math.max(0, this.u - this.base));
    return this.u - Math.floor(this.u);
  }
}

// ───────────── 모델 공통 인터페이스 ─────────────

export interface ValveInfo {
  name: string;
  open: boolean;
  /** 열림/닫힘 대신 쓸 글자(예: 조절 밸브 60%) */
  text?: string;
}

export interface SteamModel {
  readonly root: THREE.Group;
  setStage(i: number): void;
  update(dt: number, t: number): void;
  /** 이름표 위치(root 좌표) */
  anchor(name: string): THREE.Vector3 | null;
  valves(): ValveInfo[];
  /** 지금 피스톤을 움직이는 힘 한 줄 */
  force(): string;
  /** 링크 길이 오차 최댓값(검증용) */
  residual(): number;
  dispose(): void;
}

export const smooth = (x: number): number => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const approach = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * Math.min(1, rate * dt);

/** 두 원의 교점(c1 중심 r1, c2 중심 r2). 없으면 null */
export function circles(c1x: number, c1y: number, r1: number, c2x: number, c2y: number, r2: number): [[number, number], [number, number]] | null {
  const dx = c2x - c1x;
  const dy = c2y - c1y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1x + (a * dx) / d;
  const my = c1y + (a * dy) / d;
  return [
    [mx + (h * -dy) / d, my + (h * dx) / d],
    [mx - (h * -dy) / d, my - (h * dx) / d]
  ];
}
