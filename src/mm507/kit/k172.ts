// 번호 전용 키트 (507 · 172번) — 달걀형 타원 운동: 4절 링크(크랭크 + 막대 + 흔들이)의 풀이와 눈 달린 링크 판
import * as THREE from 'three';
import { circleIntersect } from './misc';
import { steel, darkSteel, brass } from '../../models/materials';
import { circlePath, extrude, mesh, stadiumShape } from '../../models/parts/geom';
import { setMM } from './mm';

const PH0 = (-125.5 * Math.PI) / 180;

export const K172 = {
  O1: [-1.185, 1.85] as [number, number],
  O2: [1.215, 0.9275] as [number, number],
  a: 0.58,
  c: 0.9,
  L: 2.774,
  s: 0.35, // 막대 위 표시점 비율
  ph0: PH0,
  holeR: 0.034,
  pinR: 0.03,
  zCrank: 0.08,
  zRod: 0.16,
  thick: 0.06
} as const;

export interface Four172 {
  phi: number;
  A: [number, number];
  B: [number, number];
  P: [number, number];
  rodAng: number;
  rockAng: number;
}

/** theta → 4절 링크 자세 (닫힌 식). B = 원(A, L) ∩ 원(O2, c) 중 위쪽 해 */
export function four172(theta: number): Four172 {
  const { O1, O2, a, c, L, s } = K172;
  const phi = PH0 + theta;
  const A: [number, number] = [O1[0] + a * Math.cos(phi), O1[1] + a * Math.sin(phi)];
  const p1 = circleIntersect(A, L, O2, c, true);
  const p2 = circleIntersect(A, L, O2, c, false);
  if (p1 === null || p2 === null) throw new Error('172: 링크가 닫히지 않음');
  const B = p1[1] > p2[1] ? p1 : p2;
  const P: [number, number] = [A[0] + s * (B[0] - A[0]), A[1] + s * (B[1] - A[1])];
  return { phi, A, B, P, rodAng: Math.atan2(B[1] - A[1], B[0] - A[0]), rockAng: Math.atan2(B[1] - O2[1], B[0] - O2[0]) };
}

/** 눈 둘 달린 판: 원점 = 첫 눈 중심, +X 로 len. 두께 thick, 가운데 z = 0(그룹 안) */
export function linkPlate172(len: number, halfW: number, holeR: number, mat: THREE.Material = steel()): THREE.Group {
  const g = new THREE.Group();
  const shape = stadiumShape(0, 0, len, 0, halfW);
  shape.holes.push(circlePath(0, 0, holeR));
  shape.holes.push(circlePath(len, 0, holeR));
  g.add(mesh(extrude(shape, K172.thick, 0.006, 32), mat));
  setMM(g, { kind: 'link', length: len });
  return g;
}

/** z 방향 원기둥 (z0~z1) */
export function cylZ172(r: number, z0: number, z1: number, mat: THREE.Material = darkSteel()): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, z1 - z0, 24);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 달걀 궤적 점선: 한 바퀴 위 표시점 자리에 작은 점 48개 (고정 장식) */
export function eggDots172(z: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.013, 10, 8);
  const mat = brass();
  const N = 96;
  for (let i = 0; i < N; i += 2) {
    const p = four172((i / N) * Math.PI * 2).P;
    const m = mesh(geo, mat);
    m.position.set(p[0], p[1], z);
    g.add(m);
  }
  g.name = 'egg';
  return g;
}
