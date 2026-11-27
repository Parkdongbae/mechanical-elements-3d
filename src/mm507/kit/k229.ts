// 229번 체인과 체인 풀리 3 전용 키트 — 14각형 + 꼭짓점 홈 바퀴, 갈고리 이 달린 앞뒤 판 고리, 굳은 사슬 마디 식.
// 설계표 docs/mm507-sheets/229.md
import * as THREE from 'three';
import { brass, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';

const D2R = Math.PI / 180;
const BARB: V2[] = [[0.045, -0.0183], [-0.035, -0.0557], [-0.035, 0.0058], [0.045, 0.0058]];
const NOTCH: V2[] = [[0.06, 0.5863], [-0.05, 0.535], [-0.05, 0.5886]];

export const K229 = {
  C: [0, 2.45] as V2,
  Z0: 0.15,
  N: 14,
  R_WHEEL: 0.6,
  RP: 0.63,
  P: 0.2804,
  I_MIN: -8,
  I_MAX: 8,
  NOTCH,
  BARB,
  AMP: Math.PI / 3,
  OMEGA: 0.5
} as const;
const K = K229;

/** 바퀴 윤곽 42점(로컬 xy, 반시계) */
export function wheelOutline229(): V2[] {
  const out: V2[] = [];
  const pitch = (2 * Math.PI) / K.N;
  for (let j = 0; j < K.N; j++) {
    const a = 12.857 * D2R + j * pitch; // vj − 90°
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (const [x, y] of NOTCH) out.push([x * c - y * s, x * s + y * c]);
  }
  return out;
}

/** 홈 바퀴: 윤곽 판(두께 0.08, 축 구멍 0.05) + 허브 보스 + 노란 점. 회전축 = 로컬 z. userData.outline = 42점 */
export function notchWheel229(): THREE.Group {
  const g = new THREE.Group();
  const outline = wheelOutline229();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.05));
  g.add(mesh(extrude(shape, 0.08, 0.004), brass()));
  const hubGeo = lathe(tubeProfile(0.05, 0.1, -0.06, 0.06, 0.005), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, brass()));
  const dotGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20);
  dotGeo.rotateX(Math.PI / 2);
  const dot = mesh(dotGeo, paint(0xf2b619));
  dot.position.set(0, 0.35, 0.043); // 세계 z 0.193
  g.add(dot);
  g.userData.outline = outline;
  return g;
}

/** 판 윤곽: 둥근 끝 막대(x ±0.1402, 반폭 0.028) + 아래로 튀어나온 갈고리 삼각 */
function plateOutline(): V2[] {
  const h = 0.1402;
  const r = 0.028;
  const pts: V2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 12;
    pts.push([h + r * Math.cos(a), r * Math.sin(a)]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 12;
    pts.push([-h + r * Math.cos(a), r * Math.sin(a)]);
  }
  // 왼쪽 반원이 (−h, −r) 에서 끝남 → 아래 변을 오른쪽으로, 갈고리 삼각을 지난다
  pts.push([-0.035, -r], [-0.035, -0.0557], [0.0242, -r]);
  return pts;
}

/** 갈고리 이 달린 고리 k(마디 k → k+1). 원점 = 가운데, 로컬 x = k → k+1, y = 바깥, z = 바퀴 축. userData.outline = 갈고리 사각 4점 */
export function toothedLink229(k: number): THREE.Group {
  const g = new THREE.Group();
  const even = (((k % 2) + 2) % 2) === 0;
  const zc = even ? 0.06 : 0.08; // 판 가운데
  const zb = even ? 0.052 : 0.072; // 갈고리 덩이 반폭
  const outline = plateOutline();
  const h = 0.1402;
  for (const s of [-1, 1]) {
    const shape = shapeFrom(outline);
    shape.holes.push(circlePath(-h, 0, 0.013), circlePath(h, 0, 0.013));
    const m = mesh(extrude(shape, 0.016, 0.002), steel());
    m.position.z = s * zc;
    g.add(m);
  }
  const block = mesh(extrude(shapeFrom([...BARB]), 2 * zb, 0.002), steel());
  g.add(block);
  g.userData.outline = [...BARB];
  return g;
}

/** 굳은 사슬 마디(C 기준). 배열 첨자 = i − I_MIN, i = −8 … 8 */
export function chainJoints229(theta: number): [number, number][] {
  const { RP, P, I_MIN, I_MAX } = K;
  const step = (2 * Math.PI) / K.N;
  const J: [number, number][] = new Array(I_MAX - I_MIN + 1);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = I_MIN; i <= I_MAX; i++) {
    const ang = Math.PI / 2 + theta - i * step;
    if (ang >= 0 && ang <= Math.PI) {
      J[i - I_MIN] = [RP * Math.cos(ang), RP * Math.sin(ang)];
      lo = Math.min(lo, i);
      hi = Math.max(hi, i);
    }
  }
  for (let i = lo - 1; i >= I_MIN; i--) {
    const p = J[i + 1 - I_MIN]!;
    const dx = p[0] + RP;
    J[i - I_MIN] = [-RP, p[1] - Math.sqrt(Math.max(0, P * P - dx * dx))];
  }
  for (let i = hi + 1; i <= I_MAX; i++) {
    const p = J[i - 1 - I_MIN]!;
    const dx = RP - p[0];
    J[i - I_MIN] = [RP, p[1] - Math.sqrt(Math.max(0, P * P - dx * dx))];
  }
  return J;
}

/** 상태: 바퀴 각 θ(t) = −AMP·sin(OMEGA·t) */
export function state229(t: number): { theta: number; J: [number, number][] } {
  const theta = -K.AMP * Math.sin(K.OMEGA * t);
  return { theta, J: chainJoints229(theta) };
}
