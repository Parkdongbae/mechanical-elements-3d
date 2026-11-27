// 228번 체인과 체인 풀리 2 전용 키트 — 쐐기 이(삼각 기둥)와 사다리 체인의 굳은 사슬 마디 식. 설계표 docs/mm507-sheets/228.md
import * as THREE from 'three';
import { steel } from '../../models/materials';
import { extrude, mesh, shapeFrom, type V2 } from '../../models/parts/geom';

const WEDGE: V2[] = [[-0.04, 0.5445], [0.103, 0.62], [0.115, 0.62], [0.115, 0.5338]];

export const K228 = {
  C: [0, 2.35] as V2,
  Z0: 0.15,
  R_DRUM: 0.55,
  RR: 0.573,
  P: 0.2966,
  I_MIN: -7,
  I_MAX: 7,
  WEDGE,
  AMP: Math.PI / 3,
  OMEGA: 0.5
} as const;
const K = K228;

/** 쐐기 한 개: 골 가운데 = 로컬 +y, z −0.15 ~ 0.15(테 폭 전체) */
export function wedge228(): THREE.Mesh {
  return mesh(extrude(shapeFrom([...WEDGE]), 0.3, 0.002), steel());
}

/** 굳은 사슬 마디(C 기준). 배열 첨자 = i − I_MIN, i = −7 … 7 */
export function chainJoints228(theta: number): [number, number][] {
  const { RR, P, I_MIN, I_MAX } = K;
  const J: [number, number][] = new Array(I_MAX - I_MIN + 1);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = I_MIN; i <= I_MAX; i++) {
    const ang = Math.PI / 2 + theta - (i * Math.PI) / 6;
    if (ang >= 0 && ang <= Math.PI) {
      J[i - I_MIN] = [RR * Math.cos(ang), RR * Math.sin(ang)];
      lo = Math.min(lo, i);
      hi = Math.max(hi, i);
    }
  }
  for (let i = lo - 1; i >= I_MIN; i--) {
    const p = J[i + 1 - I_MIN]!;
    const dx = p[0] + RR;
    J[i - I_MIN] = [-RR, p[1] - Math.sqrt(Math.max(0, P * P - dx * dx))];
  }
  for (let i = hi + 1; i <= I_MAX; i++) {
    const p = J[i - 1 - I_MIN]!;
    const dx = RR - p[0];
    J[i - I_MIN] = [RR, p[1] - Math.sqrt(Math.max(0, P * P - dx * dx))];
  }
  return J;
}

/** 상태: 드럼 각 θ(t) = −AMP·sin(OMEGA·t) */
export function state228(t: number): { theta: number; J: [number, number][] } {
  const theta = -K.AMP * Math.sin(K.OMEGA * t);
  return { theta, J: chainJoints228(theta) };
}
