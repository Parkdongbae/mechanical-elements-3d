// 줄(로프) 키트 — 감김 경로·로프 메시·도르래 블록·들보·줄끝 (설계표 012 키트 추가, 012~020 공용)
import * as THREE from 'three';
import { castIron, rubber, steel, wood } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { pulley } from './pulley';
import type { V2 } from './belt';

const TAU = Math.PI * 2;
const ROPE_STEP = 0.03; // Rope 재표본 간격(호장)

/** 줄이 감는 원 — r은 줄 중심선 반지름, w는 이 원에서의 법선(Z) 방향 좌표 */
export interface RopeCircle { c: V2; r: number; ccw: boolean; w?: number }
export interface RopeEnd { p: V2; w?: number }
export interface RopeOpts {
  /** 원 하나당 호 분할 수 (기본 16) */
  seg?: number;
  /** (u,v,w) → 3D 점. 기본 그대로 (w가 z가 된다) */
  map?: (u: number, v: number, w: number) => THREE.Vector3;
}

interface RopeItem { c: V2; r: number; s: number; w: number | undefined }

/** 방향 있는 접선 a→b: q = s·r, k = q2−q1, τ = β − asin(k/|D|). |k|>|D|면 ±0.999|D|로 클램프 */
function tangent(a: RopeItem, b: RopeItem): V2 {
  const dx = b.c[0] - a.c[0];
  const dy = b.c[1] - a.c[1];
  const D = Math.hypot(dx, dy);
  if (D < 1e-9) return [1, 0];
  let k = b.s * b.r - a.s * a.r;
  const lim = 0.999 * D;
  k = Math.max(-lim, Math.min(lim, k));
  const tau = Math.atan2(dy, dx) - Math.asin(k / D);
  return [Math.cos(tau), Math.sin(tau)];
}

/** 접점 = c + r·s·(t_y, −t_x). 점(r=0)이면 중심 그대로 */
function contact(it: RopeItem, t: V2): V2 {
  return [it.c[0] + it.r * it.s * t[1], it.c[1] - it.r * it.s * t[0]];
}

/** 줄 경로: start → circles(차례로 감음) → end. 점 개수 = 2 + circles.length × (seg + 1) 로 항상 일정 */
export function ropeAround(start: RopeEnd, circles: RopeCircle[], end: RopeEnd, opts: RopeOpts = {}): THREE.Vector3[] {
  const seg = opts.seg ?? 16;
  const map = opts.map ?? ((u: number, v: number, w: number) => new THREE.Vector3(u, v, w));
  const items: RopeItem[] = [
    { c: start.p, r: 0, s: 1, w: start.w },
    ...circles.map((k) => ({ c: k.c, r: k.r, s: k.ccw ? 1 : -1, w: k.w })),
    { c: end.p, r: 0, s: 1, w: end.w }
  ];
  const n = items.length;
  // 각 항목의 진입·이탈 접점 (이웃 접선의 t를 그대로 쓴다)
  const tin: (V2 | null)[] = Array(n).fill(null);
  const tout: (V2 | null)[] = Array(n).fill(null);
  for (let j = 0; j + 1 < n; j++) {
    const t = tangent(items[j]!, items[j + 1]!);
    tout[j] = contact(items[j]!, t);
    tin[j + 1] = contact(items[j + 1]!, t);
  }
  const out: THREE.Vector3[] = [map(start.p[0], start.p[1], start.w ?? 0)];
  // 호: 진입각→이탈각을 s 방향으로 seg 구간 균등 분할 (감긴 각이 변해도 점 개수 같음)
  for (let i = 1; i + 1 < n; i++) {
    const it = items[i]!;
    const a0 = Math.atan2(tin[i]![1] - it.c[1], tin[i]![0] - it.c[0]);
    const a1 = Math.atan2(tout[i]![1] - it.c[1], tout[i]![0] - it.c[0]);
    const d = ((((a1 - a0) * it.s) % TAU) + TAU) % TAU;
    const w = it.w ?? start.w ?? 0;
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (it.s * d * k) / seg;
      out.push(map(it.c[0] + Math.cos(a) * it.r, it.c[1] + Math.sin(a) * it.r, w));
    }
  }
  out.push(map(end.p[0], end.p[1], end.w ?? 0));
  return out;
}

/** 폴리라인을 호장 step 간격으로 선형 재표본 (양 끝 포함) */
function resample(pts: THREE.Vector3[], step: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  let target = 0;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = a.distanceTo(b);
    if (len < 1e-12) continue;
    while (acc + len >= target - 1e-9) {
      out.push(a.clone().lerp(b, Math.min(1, (target - acc) / len)));
      target += step;
    }
    acc += len;
  }
  const last = pts[pts.length - 1]!;
  const tail = out[out.length - 1];
  if (!tail || tail.distanceTo(last) > 1e-6) out.push(last.clone());
  return out;
}

/** 둥근 줄 메시 — setPath마다 재표본→CatmullRom→Tube로 교체(메시 1개 유지) */
export class Rope {
  readonly group = new THREE.Group();
  private readonly radius: number;
  private readonly mat: THREE.MeshStandardMaterial;
  private strand: THREE.Mesh | null = null;

  constructor(radius = 0.014) {
    this.radius = radius;
    this.mat = rubber().clone();
    this.mat.color.set(0x8a6a3a); // 삼줄색
  }

  setPath(points: THREE.Vector3[]): void {
    const pts = points.length >= 2 ? resample(points, ROPE_STEP) : [];
    if (!this.strand) {
      this.strand = mesh(new THREE.BufferGeometry(), this.mat);
      this.strand.castShadow = true;
      this.group.add(this.strand);
    }
    if (pts.length < 2) {
      this.strand.visible = false;
      return;
    }
    this.strand.visible = true;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, pts.length - 1, this.radius, 6, false);
    this.strand.geometry.dispose();
    this.strand.geometry = geo;
  }
}

/** 원호 점열: 중심 c, 반지름 r, 각 a0→a1(+X=0, +Y=π/2, a1<a0면 시계). 개수 = ceil(|a1−a0|/π×seg)+1 */
export function arcPoints(c: V2, r: number, a0: number, a1: number, z: number, seg = 14): THREE.Vector3[] {
  const count = Math.max(2, Math.ceil((Math.abs(a1 - a0) / Math.PI) * seg) + 1);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = a0 + ((a1 - a0) * i) / (count - 1);
    out.push(new THREE.Vector3(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z));
  }
  return out;
}

export interface PulleyBlockOpts {
  hookUp?: number;
  hookDown?: number;
  width?: number;
  spokes?: number;
  driver?: boolean;
}

/** 도르래 블록 — 원점 = 바퀴 중심, 회전축 = 로컬 Z. rotation은 userData.sheave 에서 돌린다 */
export function pulleyBlock(r: number, opts: PulleyBlockOpts = {}): THREE.Group {
  const width = opts.width ?? 0.07;
  const up = opts.hookUp ?? 0;
  const down = opts.hookDown ?? 0;
  const g = new THREE.Group();
  const sheave = pulley(r, { width, spokes: opts.spokes ?? 4, grooved: true, driver: opts.driver });
  g.add(sheave);
  g.userData.sheave = sheave;
  // 양쪽 평평한 띠쇠 (hook이 0이면 그쪽은 바퀴 둘레까지만)
  const yMin = down > 0 ? -(r + down - 0.02) : -r;
  const yMax = up > 0 ? r + up - 0.02 : r;
  for (const sz of [-1, 1]) {
    const strap = mesh(new THREE.BoxGeometry(0.025, yMax - yMin, 0.012), castIron());
    strap.position.set(0, (yMin + yMax) / 2, sz * (width / 2 + 0.012));
    g.add(strap);
  }
  // 중심 축 못
  const axleGeo = lathe(rodProfile(0.02, -(width + 0.05) / 2, (width + 0.05) / 2, 0.004), 24);
  axleGeo.rotateX(Math.PI / 2);
  g.add(mesh(axleGeo, steel()));
  // 눈고리 (줄을 맬 점 = 눈고리 중심)
  for (const sy of [1, -1]) {
    const h = sy > 0 ? up : down;
    if (h <= 0) continue;
    const eye = mesh(new THREE.TorusGeometry(0.028, 0.008, 12, 28), steel());
    eye.position.set(0, sy * (r + h), 0);
    g.add(eye);
  }
  return g;
}

/** 천장 들보 — wood 상자 + hooksX마다 고리(고리 아랫점 = (x, yBottom−0.06, 0.22)) */
export function ceilingBeam(x0: number, x1: number, yBottom: number, hooksX: number[]): THREE.Group {
  const g = new THREE.Group();
  const beam = mesh(new THREE.BoxGeometry(x1 - x0, 0.12, 0.72), wood());
  beam.position.set((x0 + x1) / 2, yBottom + 0.06, 0.06);
  g.add(beam);
  for (const x of hooksX) {
    const hk = mesh(new THREE.TorusGeometry(0.03, 0.008, 12, 24), steel());
    hk.position.set(x, yBottom - 0.03, 0.22);
    g.add(hk);
  }
  return g;
}

/** 줄끝 — 원점 = 줄 끝점, 아래로 매듭 원통 + wood 손잡이 구 */
export function ropeEnd(): THREE.Group {
  const g = new THREE.Group();
  const knotMat = rubber().clone();
  knotMat.color.set(0x8a6a3a);
  const knotGeo = lathe(rodProfile(0.02, -0.02, 0.02, 0.004), 16);
  knotGeo.rotateX(Math.PI / 2);
  const knot = mesh(knotGeo, knotMat);
  knot.position.y = -0.04;
  g.add(knot);
  const knob = mesh(new THREE.SphereGeometry(0.035, 18, 14), wood());
  knob.position.y = -0.07;
  g.add(knob);
  return g;
}
