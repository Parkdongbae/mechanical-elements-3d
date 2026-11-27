// 254번 체인 스프로킷 전용 키트 — Y자 갈래 이, 테 단면, 고리 하나, 고리 42개를 한 메시로 합친 체인.
// 설계표 docs/mm507-sheets/254.md
import * as THREE from 'three';
import { steel } from '../../models/materials';
import { merge, mesh, type V2 } from '../../models/parts/geom';
import { beltPathAround } from './belt';

const DEG = Math.PI / 180;

export const K254 = {
  C1: [0, 2.12] as V2,
  C2: [0, 0.83655] as V2,
  ZC: 0.1,
  PITCH: 0.12,
  N_LINKS: 42,
  WIRE: 0.016,
  LINK_HALF: 0.076,
  LINK_W: 0.036,
  R_PATH_BIG: 0.53476,
  R_PATH_DRIVE: 0.22918,
  RM_BIG: 0.5314,
  RM_DRIVE: 0.22137,
  RC_BIG: 0.4829,
  RC_DRIVE: 0.17287,
  FORK_A0_BIG: 20.2025,
  FORK_A0_DRIVE: 17.1391,
  OMEGA: 1.0,
  RATIO: 0.42857
} as const;
const K = K254;

/** 테 단면 (r, a) 10점 — lathe 에는 끝에 첫 점을 한 번 더 */
export function sprocketProfile254(rimOut: number, rimIn: number, webIn: number): [number, number][] {
  return [
    [webIn, -0.04], [rimIn, -0.04], [rimIn, -0.135], [rimOut - 0.008, -0.135], [rimOut, -0.127],
    [rimOut, 0.127], [rimOut - 0.008, 0.135], [rimIn, 0.135], [rimIn, 0.04], [webIn, 0.04]
  ];
}

/** Y자 갈래 이 n 개를 합친 메시(bronze). 로컬 (r, a) = (X, Z) */
export function forks254(n: number, rimOut: number, rc: number, a0deg: number): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  for (let j = 0; j < n; j++) {
    const rz = (a0deg + (j * 360) / n) * DEG;
    const stem = new THREE.BoxGeometry(rc - rimOut + 0.01, 0.045, 0.034);
    stem.translate((rc + rimOut - 0.01) / 2, 0, 0);
    // 갈래: 굵게(둘레 0.045, 두께 0.026) — 두께는 고리 철사 반대쪽(바깥)으로만 늘려 맞닿음 유지
    const f1 = new THREE.BoxGeometry(0.137, 0.045, 0.026);
    f1.rotateY(-Math.PI / 3);
    f1.translate(rc + 0.03425 - 0.00433, 0, 0.05932 + 0.0025);
    const f2 = new THREE.BoxGeometry(0.137, 0.045, 0.026);
    f2.rotateY(Math.PI / 3);
    f2.translate(rc + 0.03425 - 0.00433, 0, -0.05932 - 0.0025);
    for (const gg of [stem, f1, f2]) {
      gg.rotateZ(rz);
      geos.push(gg);
    }
  }
  return mesh(merge(geos), steel());
}

/** 고리 하나: 경기장꼴 중심선(로컬 XY, x = 길이) 따라 둥근 철사 */
export function chainLinkGeo254(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const R = K.LINK_W;
  const hx = 0.04;
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 12;
    pts.push(new THREE.Vector3(hx + R * Math.cos(a), R * Math.sin(a), 0));
  }
  for (const x of [0.02, 0, -0.02]) pts.push(new THREE.Vector3(x, R, 0));
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 12;
    pts.push(new THREE.Vector3(-hx + R * Math.cos(a), R * Math.sin(a), 0));
  }
  for (const x of [-0.02, 0, 0.02]) pts.push(new THREE.Vector3(x, -R, 0));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  return new THREE.TubeGeometry(curve, 96, K.WIRE, 8, true);
}

// 경로: 처음 한 번만
let PATH: { P: V2[]; cum: number[]; L: number } | null = null;
function getPath(): { P: V2[]; cum: number[]; L: number } {
  if (PATH) return PATH;
  const P = beltPathAround(
    [{ c: K.C1, r: K.R_PATH_BIG, ccw: true }, { c: K.C2, r: K.R_PATH_DRIVE, ccw: true }],
    96
  );
  const cum: number[] = [0];
  for (let i = 0; i < P.length; i++) {
    const a = P[i]!;
    const b = P[(i + 1) % P.length]!;
    cum.push(cum[i]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  PATH = { P, cum, L: cum[P.length]! };
  return PATH;
}

/** 마디 42개: 경로 위 호장 (k·L/42 + s) mod L 의 점 */
export function chainJoints254(s: number): THREE.Vector2[] {
  const { P, cum, L } = getPath();
  const n = P.length;
  const out: THREE.Vector2[] = [];
  const pos = (sg: number): THREE.Vector2 => {
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! <= sg) lo = mid;
      else hi = mid;
    }
    const a = P[lo]!;
    const b = P[(lo + 1) % n]!;
    const len = cum[lo + 1]! - cum[lo]!;
    const f = len > 1e-12 ? (sg - cum[lo]!) / len : 0;
    return new THREE.Vector2(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
  };
  for (let k = 0; k < K.N_LINKS; k++) {
    let sg = (k * L) / K.N_LINKS + s;
    sg = ((sg % L) + L) % L;
    out.push(pos(sg));
  }
  return out;
}

/** 고리 42개를 한 메시로 */
export class ChainMesh254 {
  mesh: THREE.Mesh;
  private base: Float32Array;
  private baseN: Float32Array;
  private vc: number;
  private pos: THREE.BufferAttribute;
  private nor: THREE.BufferAttribute;
  constructor() {
    const g = chainLinkGeo254();
    this.base = Float32Array.from(g.getAttribute('position').array as ArrayLike<number>);
    this.baseN = Float32Array.from(g.getAttribute('normal').array as ArrayLike<number>);
    const idx = Array.from(g.getIndex()!.array as ArrayLike<number>);
    this.vc = g.getAttribute('position').count;
    const N = K.N_LINKS;
    const positions = new Float32Array(this.base.length * N);
    const normals = new Float32Array(this.baseN.length * N);
    const indices = new Uint32Array(idx.length * N);
    for (let k = 0; k < N; k++) {
      for (let i = 0; i < idx.length; i++) indices[k * idx.length + i] = idx[i]! + k * this.vc;
    }
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(positions, 3);
    this.nor = new THREE.BufferAttribute(normals, 3);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('normal', this.nor);
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.vc * N * 2), 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    g.dispose();
    this.mesh = mesh(geo, steel());
    this.mesh.name = 'chain';
    this.mesh.frustumCulled = false;
    this.update(chainJoints254(0));
  }
  update(J: THREE.Vector2[]): void {
    const N = K.N_LINKS;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const v = new THREE.Vector3();
    const pa = this.pos.array as Float32Array;
    const na = this.nor.array as Float32Array;
    for (let k = 0; k < N; k++) {
      const a = J[k]!;
      const b = J[(k + 1) % N]!;
      const th = Math.atan2(b.y - a.y, b.x - a.x);
      p.set((a.x + b.x) / 2, (a.y + b.y) / 2, K.ZC);
      if (k % 2 === 0) e.set(Math.PI / 2, 0, th, 'ZYX');
      else e.set(0, 0, th, 'XYZ');
      q.setFromEuler(e);
      m.compose(p, q, one);
      const o = k * this.vc * 3;
      for (let i = 0; i < this.vc; i++) {
        v.set(this.base[i * 3]!, this.base[i * 3 + 1]!, this.base[i * 3 + 2]!).applyMatrix4(m);
        pa[o + i * 3] = v.x;
        pa[o + i * 3 + 1] = v.y;
        pa[o + i * 3 + 2] = v.z;
        v.set(this.baseN[i * 3]!, this.baseN[i * 3 + 1]!, this.baseN[i * 3 + 2]!).applyQuaternion(q);
        na[o + i * 3] = v.x;
        na[o + i * 3 + 1] = v.y;
        na[o + i * 3 + 2] = v.z;
      }
    }
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
}
