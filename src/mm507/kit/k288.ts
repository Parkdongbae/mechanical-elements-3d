// 288번 되튐(리코일) 탈진기 전용 키트 — 289 와 같은 바퀴·닻 틀·진자에 잠금면만 비스듬한 곧은 평면. 설계표 docs/mm507-sheets/288.md
// 공용 부분(바퀴·닻·접촉 계산)은 kit/k289.ts 에서 불러 쓴다.
import type * as THREE from 'three';
import type { V2 } from './belt';
import { K289, buildAnchor, buildWheel, contactFaces, justDropped, pol, stateGeneric, type Face } from './k289';

export { D2R } from './k289';

export const K288 = {
  ...K289,
  /** 되튐 면 꼭짓점(닻 좌표) */
  F_K: [0.7431, -0.5999] as V2,
  F_H: [-0.5942, -0.4646] as V2,
  /** 되튐 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 0, -10.142],
    [0.1, 1.236, -7.001],
    [0.2, 2.351, -6.7],
    [0.5, 4.0, -7.684],
    [0.9, 1.236, -5.985],
    [1.0, 0, -4.315],
    [1.1, -1.236, -1.115],
    [1.2, -2.351, -0.811],
    [1.5, -4.0, -2.066],
    [1.9, -1.236, -0.005],
    [2.0, 0, 1.858],
    [30, 0, 169.858]
  ] as [number, number, number][]
} as const;
const K = K288;

const EK = pol(K.RKI, -46.5);
const LK = pol(K.RKO, -44.5);
const EH = pol(K.RKO, -133.5);
const LH = pol(K.RKI, -135.5);

export const FACES288 = {
  K: [
    { kind: 'seg', a: EK, b: LK, face: 'impulse' },
    { kind: 'seg', a: LK, b: K.F_K, face: 'lock' }
  ] as Face[],
  H: [
    { kind: 'seg', a: EH, b: LH, face: 'impulse' },
    { kind: 'seg', a: LH, b: K.F_H, face: 'lock' }
  ] as Face[]
};

export function escWheel288(): THREE.Group {
  return buildWheel();
}
export function anchor288(): THREE.Group {
  return buildAnchor(true);
}

export function contact288(pallet: 'K' | 'H', k: number, psi: number): number | null {
  const r = contactFaces(FACES288[pallet], k, psi);
  return r === null ? null : r.phi;
}

export interface State288 {
  psi: number;
  phi: number;
  holder: 'K' | 'H';
  face: 'lock' | 'impulse';
  recoil: boolean;
  justDropped: boolean;
}

export function state288(t: number): State288 {
  const s = stateGeneric(FACES288, t);
  const prev = stateGeneric(FACES288, t - 0.005);
  return { ...s, recoil: s.phi < prev.phi - 1e-9, justDropped: justDropped(t) };
}
