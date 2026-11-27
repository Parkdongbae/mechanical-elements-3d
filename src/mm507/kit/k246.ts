// 246 팬터그래프 전용 부품·기구학 — 설계표 docs/mm507-sheets/246.md 「키트 추가」
import * as THREE from 'three';
import { darkSteel, steel } from '../../models/materials';
import { circlePath, extrude, mesh, stadiumShape } from '../../models/parts/geom';
import { setMM } from './mm';

/** 설계표 상수 — C·B0 는 세계 좌표, L 은 막대 6마디 공통 길이, Z 는 각 층 가운데 z */
export const K246 = {
  C: [-1.2, 0.712] as [number, number],
  B0: [-1.2, 1.7] as [number, number],
  L: 1.22525,
  RHO: 0.17,
  RIN: 0.06494,
  OVER: 0.15,
  Z: { board: -0.29, armCF: -0.22, linkBD: -0.18, linkBE: -0.14, armAF: -0.1 },
  PERIOD: 13
};

export type V2 = [number, number];

/** B 별 꼭짓점 10개 — B0 중심, 첫 꼭짓점 위 90°, 36°마다 바깥·안 번갈아 */
export function starPts246(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 === 0 ? K246.RHO : K246.RIN;
    pts.push([K246.B0[0] + r * Math.cos(a), K246.B0[1] + r * Math.sin(a)]);
  }
  return pts;
}

export interface Kin246 { D: V2; E: V2; F: V2; A: V2 }

/** 닫힌 식 — C 고정, B 가 주어지면 D·E·F·A 가 하나로 정해진다(6마디 모두 L) */
export function kin246(B: V2): Kin246 {
  const ux = B[0] - K246.C[0];
  const uy = B[1] - K246.C[1];
  const d = Math.hypot(ux, uy);
  const mx = (K246.C[0] + B[0]) / 2;
  const my = (K246.C[1] + B[1]) / 2;
  const h = Math.sqrt(K246.L * K246.L - (d / 2) * (d / 2));
  const D: V2 = [mx + (h * uy) / d, my - (h * ux) / d]; // C→B 의 오른쪽 수직 방향
  const F: V2 = [2 * D[0] - K246.C[0], 2 * D[1] - K246.C[1]];
  const E: V2 = [B[0] + F[0] - D[0], B[1] + F[1] - D[1]];
  const A: V2 = [2 * E[0] - F[0], 2 * E[1] - F[1]]; // = 2B − C
  return { D, E, F, A };
}

/** u(0~10) 에서 B — k번 변을 f 비율로 지난 자리 */
export function tracer246(u: number): V2 {
  const v = starPts246();
  const k = Math.floor(u) % 10;
  const f = u - Math.floor(u);
  const a = v[k]!;
  const b = v[(k + 1) % 10]!;
  return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
}

/** 핀 자리 — x 위치, 구멍 반지름(기본 0.027 = 핀 0.025 + 틈 0.002), 앞면 고리 표시 on/off */
export interface Seat246 { x: number; r?: number; ring?: boolean }

/** 둥근 끝 막대(폭 0.07, 두께 0.03, 로컬 x −over ~ len) — 핀 자리마다 구멍 + 앞면 고리 표시 */
export function bar246(len: number, over: number, mat?: THREE.Material, seats?: Seat246[]): THREE.Group {
  const list = seats ?? [{ x: 0 }, { x: len }];
  const shape = stadiumShape(-over, 0, len, 0, 0.035);
  for (const s of list) shape.holes.push(circlePath(s.x, 0, s.r ?? 0.027));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, 0.03, 0.004), mat ?? steel()));
  for (const s of list) {
    if (s.ring === false) continue;
    const r = (s.r ?? 0.027) + 0.001;
    const ring = mesh(new THREE.RingGeometry(r, r + 0.008, 24), darkSteel());
    ring.position.set(s.x, 0, 0.0155); // 앞면 위 평면 표시(두께 없는 링)
    g.add(ring);
  }
  setMM(g, { kind: 'rod', fn: 'bar246', a: [0, 0, 0], b: [len, 0, 0], length: len });
  return g;
}

/** 별 꺾은선(10점 닫힘)을 따라 관 — 변마다 20 마디(tubular 200) */
export function starTube246(pts: V2[], r: number, z: number): THREE.TubeGeometry {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let k = 0; k < 10; k++) {
    const a = pts[k]!;
    const b = pts[(k + 1) % 10]!;
    path.add(new THREE.LineCurve3(new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z)));
  }
  return new THREE.TubeGeometry(path, 200, r, 6, false);
}

/** 연필 자취 — 두 배 별(2V − C) 관, z −0.282 */
export function trailGeo246(): THREE.TubeGeometry {
  return starTube246(
    starPts246().map(([x, y]) => [2 * x - K246.C[0], 2 * y - K246.C[1]] as V2),
    0.008,
    K246.Z.board + 0.008
  );
}

export interface State246 {
  u: number;
  tc: number;
  B: V2;
  D: V2;
  E: V2;
  F: V2;
  A: V2;
  /** 빨간 선을 그린 마디 수(0~200) — drawRange = n·36 */
  n: number;
  opacity: number;
}

/** t초 상태 — tc = t mod 13: 0~10 그리기, 10~12 완성 별, 12~13 지우기(결정적) */
export function state246(t: number): State246 {
  const tc = ((t % K246.PERIOD) + K246.PERIOD) % K246.PERIOD;
  const u = Math.min(tc, 10);
  const B = tracer246(u);
  const { D, E, F, A } = kin246(B);
  const n = Math.min(200, Math.floor(u * 20));
  const opacity = tc <= 12 ? 1 : Math.max(0, 1 - (tc - 12));
  return { u, tc, B, D, E, F, A, n, opacity };
}
