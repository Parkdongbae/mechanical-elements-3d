// 벨트 — 열린/엇걸이 경로 생성과 띠 스윕 (작업 지시서 16 · 3-3)
import * as THREE from 'three';
import { paint, rubber } from '../../models/materials';
import { mesh, sweep } from '../../models/parts/geom';

export type V2 = [number, number];

const TAU = Math.PI * 2;

/** 두 원 사이 호(arc) 점을 추가한다 (CCW 진행, 끝점 제외) */
function arc(pts: V2[], cx: number, cy: number, r: number, a0: number, a1: number, seg: number): void {
  for (let i = 1; i < seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
}

/** 바깥을 감는 열린 벨트 경로(닫힌 점열, 반시계 진행). D > |r1-r2| 필요 */
export function openBeltPath(c1: V2, r1: number, c2: V2, r2: number, seg = 24): V2[] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const D = Math.hypot(dx, dy);
  const ax = dx / D;
  const ay = dy / D; // c1→c2 방향
  const lx = -ay;
  const ly = ax; // 그 왼쪽 법선
  const s = Math.max(-0.999, Math.min(0.999, (r1 - r2) / D));
  const b = Math.asin(s);
  const sb = Math.sin(b);
  const cb = Math.sqrt(1 - s * s);
  // 위·아래 접선의 바깥 법선 (m·α̂ = (r1-r2)/D)
  const up: V2 = [sb * ax + cb * lx, sb * ay + cb * ly];
  const lo: V2 = [sb * ax - cb * lx, sb * ay - cb * ly];
  const aUp = Math.atan2(up[1], up[0]);
  const aLo = Math.atan2(lo[1], lo[0]);
  const pts: V2[] = [];
  pts.push([c1[0] + r1 * lo[0], c1[1] + r1 * lo[1]]);
  pts.push([c2[0] + r2 * lo[0], c2[1] + r2 * lo[1]]);
  arc(pts, c2[0], c2[1], r2, aLo, aUp, seg);
  pts.push([c2[0] + r2 * up[0], c2[1] + r2 * up[1]]);
  pts.push([c1[0] + r1 * up[0], c1[1] + r1 * up[1]]);
  arc(pts, c1[0], c1[1], r1, aUp, aLo + TAU, seg);
  return pts;
}

/** 엇걸이(교차) 벨트 경로(닫힌 점열, 반시계 진행). D > r1+r2 필요 */
export function crossedBeltPath(c1: V2, r1: number, c2: V2, r2: number, seg = 24): V2[] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const D = Math.hypot(dx, dy);
  const ax = dx / D;
  const ay = dy / D;
  const lx = -ay;
  const ly = ax;
  const s = Math.max(-0.999, Math.min(0.999, (r1 + r2) / D));
  const g = Math.asin(s); // 내부 접선 각
  const sg = Math.sin(g);
  const cg = Math.sqrt(1 - s * s);
  const mA: V2 = [sg * ax + cg * lx, sg * ay + cg * ly]; // 기어1 윗쪽 접선 법선
  const mB: V2 = [sg * ax - cg * lx, sg * ay - cg * ly]; // 아랫쪽
  const aA = Math.atan2(mA[1], mA[0]);
  const aB = Math.atan2(mB[1], mB[0]);
  const pts: V2[] = [];
  // 아래 가닥 1→2 (기어2 쪽은 반대편 접점 c2 - r2·m)
  pts.push([c1[0] + r1 * mB[0], c1[1] + r1 * mB[1]]);
  pts.push([c2[0] - r2 * mB[0], c2[1] - r2 * mB[1]]);
  arc(pts, c2[0], c2[1], r2, aB + Math.PI, aA + Math.PI, seg);
  pts.push([c2[0] - r2 * mA[0], c2[1] - r2 * mA[1]]);
  pts.push([c1[0] + r1 * mA[0], c1[1] + r1 * mA[1]]);
  arc(pts, c1[0], c1[1], r1, aA, aB + TAU, seg);
  return pts;
}

/** 평면(XY) 경로를 z 높이의 3D 점열로 */
export function planar(path: V2[], z: number): THREE.Vector3[] {
  return path.map((p) => new THREE.Vector3(p[0], p[1], z));
}

/** 로프(둥근 벨트) 기본 반지름 — 풀리 홈(pulley 기본 림)이 이 굵기에 맞춰져 있다.
 *  벨트 경로 반지름 = 풀리 r + 0.01 일 때 로프가 홈 바닥에 앉는다. */
export const ROPE_R = 0.045;

/** 평면 원 여러 개를 차례로 감는 닫힌 벨트 경로(점열). ccw = 그 원을 반시계로 감는지.
 *  이웃한 두 원의 감는 방향이 같으면 바깥 접선, 다르면 안쪽(교차) 접선을 자동 고른다. */
export function beltPathAround(circles: { c: V2; r: number; ccw: boolean }[], seg = 24): V2[] {
  const n = circles.length;
  if (n < 2) return [];
  const sgn = (i: number): number => (circles[i]!.ccw ? 1 : -1);
  // 접선 j: circles[j] → circles[j+1]. 부호 있는 반지름 ρ = ±r 로 외접·내접을 한 식으로 푼다
  const deps: V2[] = [];
  const arrs: V2[] = [];
  for (let j = 0; j < n; j++) {
    const A = circles[j]!;
    const B = circles[(j + 1) % n]!;
    const dx = B.c[0] - A.c[0];
    const dy = B.c[1] - A.c[1];
    const D = Math.hypot(dx, dy);
    if (D < 1e-9) return [];
    const rhoA = A.r * sgn(j);
    const rhoB = B.r * sgn((j + 1) % n);
    const k = Math.max(-0.999, Math.min(0.999, (rhoA - rhoB) / D));
    const th = Math.atan2(dy, dx) + Math.asin(k);
    const tx = Math.cos(th);
    const ty = Math.sin(th);
    // 접점 = 중심 + ρ·(ty, −tx): 접선 방향이 각 원의 감는 방향과 일치한다
    deps.push([A.c[0] + rhoA * ty, A.c[1] - rhoA * tx]);
    arrs.push([B.c[0] + rhoB * ty, B.c[1] - rhoB * tx]);
  }
  const pts: V2[] = [deps[0]!];
  for (let i = 1; i < n; i++) {
    pts.push(arrs[i - 1]!);
    const C = circles[i]!;
    pushWrap(pts, C, angleAt(arrs[i - 1]!, C), angleAt(deps[i]!, C), C.ccw, seg);
    pts.push(deps[i]!);
  }
  pts.push(arrs[n - 1]!);
  const C0 = circles[0]!;
  pushWrap(pts, C0, angleAt(arrs[n - 1]!, C0), angleAt(deps[0]!, C0), C0.ccw, seg);
  return pts;
}

/** 점 p 의 원 c 위 각도 */
function angleAt(p: V2, c: { c: V2; r: number }): number {
  return Math.atan2(p[1] - c.c[1], p[0] - c.c[0]);
}

/** 원 위 도착각→출발각을 감는 방향으로 잇는 호 점 (끝점 제외) */
function pushWrap(pts: V2[], c: { c: V2; r: number }, a0: number, a1: number, ccw: boolean, seg: number): void {
  let d = ccw ? (a1 - a0) % TAU : (a0 - a1) % TAU;
  if (d < 0) d += TAU;
  for (let i = 1; i < seg && d > 1e-9; i++) {
    const a = ccw ? a0 + (d * i) / seg : a0 - (d * i) / seg;
    pts.push([c.c[0] + Math.cos(a) * c.r, c.c[1] + Math.sin(a) * c.r]);
  }
}

export interface BeltOpts {
  width?: number;
  thickness?: number;
  closed?: boolean;
  marks?: number;
  /** 'rope'(기본): 판화처럼 세 가닥 꼬인 둥근 로프 · 'flat': 납작한 가죽 띠 */
  style?: 'rope' | 'flat';
  /** 로프 반지름(기본 ROPE_R) */
  ropeR?: number;
  /** 경로 점마다 띠의 폭 방향(단위 벡터). 없으면 기존 계산을 따른다 (flat 스윕용) */
  widthDirs?: THREE.Vector3[];
}

const ROPE_SEG = 18; // 로프 단면 꼭짓점 수
const ROPE_STRANDS = 3;

/** 경로 접선마다 폭 방향(기본 +Z)을 병렬 운반해 띠 단면을 스윕한다.
 *  widthDirs 를 주면 점마다 폭 방향을 직접 쓴다(1/4 비틀림 같은 꼬임용). */
function frames(
  pts: THREE.Vector3[],
  closed: boolean,
  widthDirs?: THREE.Vector3[]
): { ns: THREE.Vector3[]; bs: THREE.Vector3[] } {
  const n = pts.length;
  const ns: THREE.Vector3[] = [];
  const bs: THREE.Vector3[] = [];
  let N = new THREE.Vector3(-1, 0, 0);
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(i - 1 + n) % n]! : pts[Math.max(0, i - 1)]!;
    const next = closed ? pts[(i + 1) % n]! : pts[Math.min(n - 1, i + 1)]!;
    const T = next.clone().sub(prev);
    if (T.lengthSq() < 1e-12) T.copy(N).cross(new THREE.Vector3(0, 0, 1));
    T.normalize();
    let Ni: THREE.Vector3 | null = null;
    const wd = widthDirs?.[i];
    if (wd) {
      const c = new THREE.Vector3().crossVectors(T, wd);
      if (c.lengthSq() > 1e-8) Ni = wd.clone().normalize();
    }
    if (Ni === null) {
      const B0 = new THREE.Vector3(0, 0, 1);
      Ni = new THREE.Vector3().crossVectors(B0, T);
      if (Ni.lengthSq() < 1e-8) Ni.copy(N);
      Ni.normalize();
    }
    const Bi = new THREE.Vector3().crossVectors(T, Ni);
    ns.push(Ni);
    bs.push(Bi);
    N = Ni;
  }
  return { ns, bs };
}

/** 평평한 가죽 벨트: 경로를 따라 스윕된 띠 + 흐르는 이음매 표시 */
export class Belt {
  readonly group = new THREE.Group();
  /** 경로 총 호장 (setPath에서 갱신) */
  get length(): number {
    return this.len;
  }

  private pts: THREE.Vector3[] = [];
  private ns: THREE.Vector3[] = [];
  private bs: THREE.Vector3[] = [];
  private cum: number[] = [];
  private closed: boolean;
  private readonly width: number;
  private readonly thickness: number;
  private readonly marks: THREE.Mesh[] = [];
  private strip: THREE.Mesh | null = null;
  private offset = 0;
  private len = 0;
  private readonly rope: boolean;
  private readonly ropeR: number;
  private twistPitch = 0.25;

  constructor(path: THREE.Vector3[], opts: BeltOpts = {}) {
    this.width = opts.width ?? 0.13;
    this.thickness = opts.thickness ?? 0.02;
    this.closed = opts.closed ?? true;
    this.rope = (opts.style ?? 'rope') === 'rope';
    this.ropeR = opts.ropeR ?? ROPE_R;
    this.setPath(path, opts.widthDirs);
    const markMat = paint(0xf2b619);
    const count = opts.marks ?? 6;
    for (let i = 0; i < count; i++) {
      const m = this.rope
        ? mesh(new THREE.TorusGeometry(this.ropeR * 1.02, 0.006, 6, 20), markMat) // 로프를 감은 노란 띠
        : mesh(new THREE.BoxGeometry(0.016, 0.005, this.width * 0.62), markMat);
      this.marks.push(m);
      this.group.add(m);
    }
    this.setOffset(0);
  }

  /** 같은 점 개수의 새 경로로 띠를 다시 만든다 (setOffset 위치는 유지). widthDirs 는 점마다 띠 폭 방향 */
  setPath(path: THREE.Vector3[], widthDirs?: THREE.Vector3[]): void {
    this.pts = path.map((p) => p.clone());
    const n = this.pts.length;
    if (n < 2) return;
    const f = frames(this.pts, this.closed, widthDirs);
    this.ns = f.ns;
    this.bs = f.bs;
    this.cum = [0];
    for (let i = 1; i < n; i++) this.cum.push(this.cum[i - 1]! + this.pts[i]!.distanceTo(this.pts[i - 1]!));
    this.len = this.cum[n - 1]! + (this.closed ? this.pts[0]!.distanceTo(this.pts[n - 1]!) : 0);
    if (this.rope) {
      this.buildRope();
      this.setOffset(this.offset);
      return;
    }
    const hw = this.width / 2;
    const ht = this.thickness / 2;
    const prof: V2[] = [
      [-hw, -ht],
      [hw, -ht],
      [hw, ht],
      [-hw, ht]
    ];
    const geo = sweep(this.pts, this.ns, this.bs, prof, this.closed, !this.closed);
    if (this.strip) {
      this.strip.geometry.dispose();
      this.strip.geometry = geo;
    } else {
      this.strip = mesh(geo, rubber({ color: 0x4a3524, roughness: 0.78 }));
      this.group.add(this.strip);
    }
    this.setOffset(this.offset);
  }

  /** 로프 메시(점마다 단면 고리, 인덱스는 한 번만) — 꼭짓점 위치는 writeRope 가 꼬임 위상으로 쓴다 */
  private buildRope(): void {
    const n = this.pts.length;
    const K = ROPE_SEG;
    // 닫힌 로프는 이음매에서 꼬임이 맞도록 한 바퀴 꼬임 수를 정수로
    const want = this.ropeR * 7;
    const turns = Math.max(1, Math.round(this.len / want));
    this.twistPitch = this.closed ? this.len / turns : want;
    const rings = this.closed ? n + 1 : n;
    const need = rings * K * 3;
    const old = this.strip?.geometry;
    if (!old || (old.getAttribute('position') as THREE.BufferAttribute | undefined)?.array.length !== need) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(need), 3));
      const idx: number[] = [];
      for (let i = 0; i < rings - 1; i++) {
        for (let k = 0; k < K; k++) {
          const a = i * K + k;
          const b = i * K + ((k + 1) % K);
          const c = (i + 1) * K + k;
          const d = (i + 1) * K + ((k + 1) % K);
          idx.push(a, c, b, b, c, d);
        }
      }
      geo.setIndex(idx);
      if (this.strip) {
        this.strip.geometry.dispose();
        this.strip.geometry = geo;
      } else {
        this.strip = mesh(geo, rubber({ color: 0x8a6440, roughness: 0.85 })); // 삼줄색
        this.group.add(this.strip);
      }
    }
    this.writeRope();
  }

  /** 꼬임 위상(offset 만큼 흐름)을 반영해 로프 꼭짓점을 다시 쓴다 */
  private writeRope(): void {
    if (!this.strip) return;
    const pos = this.strip.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = this.pts.length;
    const K = ROPE_SEG;
    const rings = this.closed ? n + 1 : n;
    const R = this.ropeR;
    for (let i = 0; i < rings; i++) {
      const j = i % n;
      const s = i < n ? this.cum[i]! : this.len;
      const p = this.pts[j]!;
      const N = this.ns[j]!;
      const B = this.bs[j]!;
      const phase = ((s - this.offset) / this.twistPitch) * Math.PI * 2;
      for (let k = 0; k < K; k++) {
        const th = (k / K) * Math.PI * 2;
        // 세 가닥: 단면 반지름이 가닥 사이에서 살짝 들어간다(꼬인 로프)
        const r = R * (0.84 + 0.16 * Math.abs(Math.cos((ROPE_STRANDS / 2) * (th - phase))));
        const cx = Math.cos(th) * r;
        const cy = Math.sin(th) * r;
        const o = (i * K + k) * 3;
        arr[o] = p.x + N.x * cx + B.x * cy;
        arr[o + 1] = p.y + N.y * cx + B.y * cy;
        arr[o + 2] = p.z + N.z * cx + B.z * cy;
      }
    }
    pos.needsUpdate = true;
    this.strip.geometry.computeVertexNormals();
    this.strip.geometry.computeBoundingSphere();
  }

  /** 표시(이음매) 위치를 호장거리 s로 설정(절대값, 흐르는 방향 = 진행 방향) */
  setOffset(s: number): void {
    this.offset = s;
    if (this.rope) this.writeRope();
    const L = this.len;
    const count = this.marks.length;
    if (L <= 0 || count === 0) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const si = (((s + (L * i) / count) % L) + L) % L;
      const q = this.frameAt(si);
      const mk = this.marks[i]!;
      if (this.rope) {
        // 토러스 축(로컬 Z)을 로프 진행 방향에 맞춘다
        mk.position.copy(q.p);
        m.makeBasis(q.n, q.b, q.t);
      } else {
        mk.position.copy(q.p).addScaledVector(q.b, this.thickness / 2 + 0.004);
        m.makeBasis(q.t, q.n, q.b);
      }
      mk.quaternion.setFromRotationMatrix(m);
    }
  }

  /** 호장 s 위치의 중심점·접선·법선 (선형 보간) */
  private frameAt(s: number): { p: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3 } {
    const n = this.pts.length;
    const segs = this.closed ? n : n - 1;
    let i = 0;
    while (i < segs - 1 && this.cum[i + 1]! < s) i++;
    const a = this.pts[i]!;
    const b = this.pts[(i + 1) % n]!;
    const segLen = Math.max(1e-9, a.distanceTo(b));
    const u = Math.min(1, Math.max(0, (s - this.cum[i]!) / segLen));
    const p = a.clone().lerp(b, u);
    const iN = i < this.ns.length ? i : this.ns.length - 1;
    return { p, t: this.ns[iN]!.clone().cross(this.bs[iN]!), n: this.ns[iN]!.clone(), b: this.bs[iN]!.clone() };
  }
}
