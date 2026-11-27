// 248번 유니언 이음 전용 키트 — 반쪽 회전체, 진짜 나선 나사 반쪽 면, 상태 닫힌 식. 설계표 docs/mm507-sheets/248.md
import * as THREE from 'three';
import { lathe, mesh, shapeFrom, type V2 } from '../../models/parts/geom';

export const K248 = { Y0: 1.5, ZC: 0.36, PITCH: 0.04, DEPTH: 0.04, CLEAR: 0.003, RISE: 0.16, TURNS: 4, PERIOD: 16 };

export const PROFILE_C248: [number, number][] = [
  [0.348, 0], [0.448, 0], [0.448, -0.408], [0.356, -0.408], [0.356, -1.28], [0.5, -1.28], [0.5, -1.32], [0.23, -1.32], [0.23, -0.248], [0.348, -0.248]
];
export const PROFILE_B248: [number, number][] = [
  [0.34, 0.248], [0.61, 0.248], [0.62, 0.238], [0.62, -0.24], [0.7, -0.24], [0.7, -0.38], [0.491, -0.38], [0.491, 0], [0.496, 0], [0.496, 0.12], [0.34, 0.12]
];
/** 관 A 전체 윤곽 */
export const PROFILE_A248: [number, number][] = (() => {
  const p: [number, number][] = [[0.234, -0.232], [0.344, -0.232], [0.344, 0]];
  for (let i = 0; i < 9; i++) {
    const a = ((-90 + 22.5 * i) * Math.PI) / 180;
    p.push([0.372 + 0.06 * Math.cos(a), 0.06 + 0.06 * Math.sin(a)]);
  }
  p.push([0.318, 0.12], [0.318, 1.2], [0.234, 1.2]);
  return p;
})();
/** 관 A 아래 조각(꽂이 + 플랜지 테, y −0.232~0.12)과 위 조각(관 몸, y 0.12~1.20) — 같은 윤곽을 y 0.12 에서 나눈 것 */
export const PROFILE_A_LOW248: [number, number][] = [...PROFILE_A248.slice(0, 12), [0.318, 0.12], [0.234, 0.12]];
export const PROFILE_A_UP248: [number, number][] = [[0.234, 0.12], [0.318, 0.12], [0.318, 1.2], [0.234, 1.2]];

const ss = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export function state248(t: number): { tc: number; Lf: number; nutY: number; alpha: number; gap: number; tightening: boolean; loosening: boolean } {
  const P = K248.PERIOD;
  const tc = ((t % P) + P) % P;
  let Lf: number;
  if (tc < 2) Lf = 1;
  else if (tc < 8) Lf = 1 - ss((tc - 2) / 6);
  else if (tc < 10) Lf = 0;
  else Lf = ss((tc - 10) / 6);
  return { tc, Lf, nutY: K248.Y0 + K248.RISE * Lf, alpha: 8 * Math.PI * Lf, gap: K248.RISE * Lf, tightening: tc >= 2 && tc < 8, loosening: tc >= 10 };
}

function area(p: V2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]!;
    a += p[i]![0] * q[1] - q[0] * p[i]![1];
  }
  return a / 2;
}

/** 뒤 반쪽 회전체 + 잘린 면 두 조각(z 0). 윤곽은 닫힌 (r, y) 다각형 */
export function halfLathe248(profile: [number, number][], segs: number, body: THREE.Material, cut: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const prof: V2[] = area(profile) < 0 ? [...profile].reverse() : [...profile];
  g.add(mesh(lathe([...prof, prof[0]!], segs, Math.PI / 2, Math.PI), body));
  cut.side = THREE.DoubleSide;
  g.add(mesh(new THREE.ShapeGeometry(shapeFrom(profile)), cut));
  g.add(mesh(new THREE.ShapeGeometry(shapeFrom([...profile].reverse().map(([r, y]) => [-r, y] as V2))), cut));
  return g;
}

/** 나선 나사 반쪽(뒤 반쪽 φ ∈ [0, π]). 표면 S = r0 + depth·tri(frac(y/pitch − φ/2π)) */
export function threadHalf248(o: { r0: number; depth: number; pitch: number; y0: number; y1: number; side: 'ext' | 'int'; rBase?: number }, body: THREE.Material, cut: THREE.Material): THREE.Group {
  const { r0, depth, pitch, y0, y1, side } = o;
  const rBase = o.rBase ?? (side === 'ext' ? r0 : r0 + depth);
  const NP = 48;
  const ny = Math.max(2, Math.round(((y1 - y0) / pitch) * 16));
  const S = (phi: number, y: number): number => {
    const x = y / pitch - phi / (2 * Math.PI);
    const u = x - Math.floor(x);
    return r0 + depth * (1 - Math.abs(2 * u - 1));
  };
  const pos: number[] = [];
  const idx: number[] = [];
  const P = (r: number, phi: number, y: number): number => {
    pos.push(r * Math.cos(phi), y, -r * Math.sin(phi));
    return pos.length / 3 - 1;
  };
  const yAt = (j: number): number => y0 + ((y1 - y0) * j) / ny;
  const phiAt = (i: number): number => (Math.PI * i) / NP;
  // ① 표면 격자
  const grid: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= NP; i++) row.push(P(S(phiAt(i), yAt(j)), phiAt(i), yAt(j)));
    grid.push(row);
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < NP; i++) {
      const a = grid[j]![i]!;
      const b = grid[j]![i + 1]!;
      const c = grid[j + 1]![i + 1]!;
      const d = grid[j + 1]![i]!;
      idx.push(a, b, c, a, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  body.side = THREE.DoubleSide;
  const g = new THREE.Group();
  g.add(mesh(geo, body));
  // ② φ 0·π 의 잘린 면 띠, ③ y0·y1 끝 반 고리 띠
  const cp: number[] = [];
  const ci: number[] = [];
  const CP = (x: number, y: number, z: number): number => {
    cp.push(x, y, z);
    return cp.length / 3 - 1;
  };
  for (const phi of [0, Math.PI]) {
    const sg = phi === 0 ? 1 : -1;
    for (let j = 0; j < ny; j++) {
      const ya = yAt(j);
      const yb = yAt(j + 1);
      const a = CP(sg * rBase, ya, 0);
      const b = CP(sg * S(phi, ya), ya, 0);
      const c = CP(sg * S(phi, yb), yb, 0);
      const d = CP(sg * rBase, yb, 0);
      ci.push(a, b, c, a, c, d);
    }
  }
  const cgeo = new THREE.BufferGeometry();
  cgeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cgeo.setIndex(ci);
  cgeo.computeVertexNormals();
  cut.side = THREE.DoubleSide;
  g.add(mesh(cgeo, cut));
  const ep: number[] = [];
  const ei: number[] = [];
  for (const y of [y0, y1]) {
    const base = ep.length / 3;
    for (let i = 0; i <= NP; i++) {
      const phi = phiAt(i);
      ep.push(rBase * Math.cos(phi), y, -rBase * Math.sin(phi));
      const s = S(phi, y);
      ep.push(s * Math.cos(phi), y, -s * Math.sin(phi));
    }
    for (let i = 0; i < NP; i++) {
      const a = base + 2 * i;
      ei.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const egeo = new THREE.BufferGeometry();
  egeo.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
  egeo.setIndex(ei);
  egeo.computeVertexNormals();
  g.add(mesh(egeo, body));
  return g;
}
