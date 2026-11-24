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

export interface BeltOpts {
  width?: number;
  thickness?: number;
  closed?: boolean;
  marks?: number;
}

/** 경로 접선마다 폭 방향(기본 +Z)을 병렬 운반해 띠 단면을 스윕한다 */
function frames(pts: THREE.Vector3[], closed: boolean): { ns: THREE.Vector3[]; bs: THREE.Vector3[] } {
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
    const B0 = new THREE.Vector3(0, 0, 1);
    const Ni = new THREE.Vector3().crossVectors(B0, T);
    if (Ni.lengthSq() < 1e-8) Ni.copy(N);
    Ni.normalize();
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

  constructor(path: THREE.Vector3[], opts: BeltOpts = {}) {
    this.width = opts.width ?? 0.13;
    this.thickness = opts.thickness ?? 0.02;
    this.closed = opts.closed ?? true;
    this.setPath(path);
    const markMat = paint(0xf2b619);
    const count = opts.marks ?? 6;
    for (let i = 0; i < count; i++) {
      const m = mesh(new THREE.BoxGeometry(0.016, 0.005, this.width * 0.62), markMat);
      this.marks.push(m);
      this.group.add(m);
    }
    this.setOffset(0);
  }

  /** 같은 점 개수의 새 경로로 띠를 다시 만든다 (setOffset 위치는 유지) */
  setPath(path: THREE.Vector3[]): void {
    this.pts = path.map((p) => p.clone());
    const n = this.pts.length;
    if (n < 2) return;
    const f = frames(this.pts, this.closed);
    this.ns = f.ns;
    this.bs = f.bs;
    this.cum = [0];
    for (let i = 1; i < n; i++) this.cum.push(this.cum[i - 1]! + this.pts[i]!.distanceTo(this.pts[i - 1]!));
    this.len = this.cum[n - 1]! + (this.closed ? this.pts[0]!.distanceTo(this.pts[n - 1]!) : 0);
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

  /** 표시(이음매) 위치를 호장거리 s로 설정(절대값, 흐르는 방향 = 진행 방향) */
  setOffset(s: number): void {
    this.offset = s;
    const L = this.len;
    const count = this.marks.length;
    if (L <= 0 || count === 0) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const si = (((s + (L * i) / count) % L) + L) % L;
      const q = this.frameAt(si);
      const mk = this.marks[i]!;
      mk.position.copy(q.p).addScaledVector(q.b, this.thickness / 2 + 0.004);
      m.makeBasis(q.t, q.n, q.b);
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
