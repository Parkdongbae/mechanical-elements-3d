// 227번 체인과 체인 풀리 전용 키트 — 별 모양 바퀴(윤곽 extrude), 판 고리, 직각 평면의 철사 고리, 굳은 사슬 마디 식.
// 설계표 docs/mm507-sheets/227.md
import * as THREE from 'three';
import { bronze, brass, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';

/** 별 바퀴 한 칸(60°)의 점 17개: 골 가운데 = 로컬 +y, 오른쪽 이끝 → 왼쪽 이끝(반시계) */
const STAR_SECTOR: V2[] = [
  [0.31, 0.5369], [0.2968, 0.5209], [0.2831, 0.5055], [0.2689, 0.4905], [0.2541, 0.4762], [0.2389, 0.4623],
  [0.2231, 0.449], [0.2068, 0.4363], [0.19, 0.4241], [-0.19, 0.4241], [-0.2068, 0.4363], [-0.2231, 0.449],
  [-0.2389, 0.4623], [-0.2541, 0.4762], [-0.2689, 0.4905], [-0.2831, 0.5055], [-0.2968, 0.5209]
];

export const K227 = {
  C: [0, 2.45] as V2,
  Z0: 0.15,
  RJ: 0.48,
  ALPHA: 0.46426,
  BETA: 0.58294,
  A_PLATE: 0.2208,
  B_LOOP: 0.2759,
  I_MIN: -8,
  I_MAX: 9,
  AMP: Math.PI / 3,
  OMEGA: 0.5,
  STAR_SECTOR
} as const;
const K = K227;

/** 별 윤곽 102점(로컬 xy, 반시계) */
export function starOutline227(): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (const [x, y] of STAR_SECTOR) out.push([x * c - y * s, x * s + y * c]);
  }
  return out;
}

/** 별 모양 바퀴: 윤곽 판(축 구멍 0.06) + 허브 보스 + 노란 점. 회전축 = 로컬 z, 두께 가운데 z = 0. userData.outline 남김 */
export function starWheel227(): THREE.Group {
  const g = new THREE.Group();
  const outline = starOutline227();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.06));
  g.add(mesh(extrude(shape, 0.07, 0.004), brass()));
  const hubGeo = lathe(tubeProfile(0.06, 0.14, -0.05, 0.05, 0.005), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, brass()));
  const dotGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20);
  dotGeo.rotateX(Math.PI / 2);
  const dot = mesh(dotGeo, paint(0xf2b619));
  dot.position.set(0, 0.3, 0.038); // 세계 z 0.188 = 바퀴 앞면(0.035) 위
  g.add(dot);
  g.userData.outline = outline;
  return g;
}

/** 판 고리 윤곽(로컬 xy 32점): 구멍 사이 A_PLATE, 끝 반지름 0.04 */
function plateOutline(): V2[] {
  const h = K.A_PLATE / 2;
  const r = 0.04;
  const pts: V2[] = [];
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 16;
    pts.push([h + r * Math.cos(a), r * Math.sin(a)]);
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 16;
    pts.push([-h + r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** 판 고리: 둥근 끝 판(두께 0.03, 바퀴와 같은 평면), 구멍 둘. 로컬 x = 구멍1 → 구멍2. userData.outline = 판 윤곽 */
export function chainPlate227(): THREE.Mesh {
  const outline = plateOutline();
  const shape = shapeFrom(outline);
  const h = K.A_PLATE / 2;
  shape.holes.push(circlePath(-h, 0, 0.016), circlePath(h, 0, 0.016));
  const m = mesh(extrude(shape, 0.03, 0.003), steel());
  m.userData.outline = outline;
  return m;
}

/** 철사 고리: (x, z) 평면 경기장 모양 둥근 철사(반지름 0.011). 꼭짓점 x = ±(B_LOOP/2) 에서 철사가 z 방향으로 판 구멍을 지난다 */
export function chainLoop227(): THREE.Mesh {
  const sx = K.B_LOOP / 2 - 0.06;
  const pts: THREE.Vector3[] = [];
  const nArc = 14;
  // 위쪽(z = +0.06) 곧은 변은 양 끝 점만, 반원은 잘게
  pts.push(new THREE.Vector3(-sx, 0, 0.06), new THREE.Vector3(sx, 0, 0.06));
  for (let i = 1; i < nArc; i++) {
    const a = Math.PI / 2 - (i * Math.PI) / nArc;
    pts.push(new THREE.Vector3(sx + 0.06 * Math.cos(a), 0, 0.06 * Math.sin(a)));
  }
  pts.push(new THREE.Vector3(sx, 0, -0.06), new THREE.Vector3(-sx, 0, -0.06));
  for (let i = 1; i < nArc; i++) {
    const a = -Math.PI / 2 - (i * Math.PI) / nArc;
    pts.push(new THREE.Vector3(-sx + 0.06 * Math.cos(a), 0, 0.06 * Math.sin(a)));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, 160, 0.011, 8, true);
  return mesh(geo, bronze());
}

/** 굳은 사슬 마디(C 기준). 배열 첨자 = i − I_MIN, i = −8 … 9 */
export function chainJoints227(theta: number): [number, number][] {
  const { RJ, ALPHA, BETA, A_PLATE, B_LOOP, I_MIN, I_MAX } = K;
  const n = I_MAX - I_MIN + 1;
  const step = (i: number): number => (((i % 2) + 2) % 2 === 0 ? ALPHA : BETA);
  const chord = (i: number): number => (((i % 2) + 2) % 2 === 0 ? A_PLATE : B_LOOP);
  const cum = new Map<number, number>();
  cum.set(0, 0);
  for (let i = 0; i < I_MAX; i++) cum.set(i + 1, cum.get(i)! + step(i));
  for (let i = 0; i > I_MIN; i--) cum.set(i - 1, cum.get(i)! - step(i - 1));
  const J: [number, number][] = new Array(n);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = I_MIN; i <= I_MAX; i++) {
    const ang = Math.PI / 2 + ALPHA / 2 + theta - cum.get(i)!;
    if (ang >= 0 && ang <= Math.PI) {
      J[i - I_MIN] = [RJ * Math.cos(ang), RJ * Math.sin(ang)];
      lo = Math.min(lo, i);
      hi = Math.max(hi, i);
    }
  }
  for (let i = lo - 1; i >= I_MIN; i--) {
    const p = J[i + 1 - I_MIN]!;
    const dx = p[0] + RJ;
    J[i - I_MIN] = [-RJ, p[1] - Math.sqrt(Math.max(0, chord(i) * chord(i) - dx * dx))];
  }
  for (let i = hi + 1; i <= I_MAX; i++) {
    const p = J[i - 1 - I_MIN]!;
    const dx = RJ - p[0];
    J[i - I_MIN] = [RJ, p[1] - Math.sqrt(Math.max(0, chord(i - 1) * chord(i - 1) - dx * dx))];
  }
  return J;
}

/** 상태: 바퀴 각 θ(t) = −AMP·sin(OMEGA·t) */
export function state227(t: number): { theta: number; J: [number, number][] } {
  const theta = -K.AMP * Math.sin(K.OMEGA * t);
  return { theta, J: chainJoints227(theta) };
}
