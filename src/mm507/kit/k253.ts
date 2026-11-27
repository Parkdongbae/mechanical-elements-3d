// 253번 원심 안전 갈고리 전용 키트 — 갈고리 윤곽 45 점, 갈고리 조립, 시간표(드럼 각·속도·갈고리 각)
// 설계표 docs/mm507-sheets/253.md 의 수치·표 그대로.
import * as THREE from 'three';
import { brass } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, type V2 } from '../../models/parts/geom';

export const D2R = Math.PI / 180;
const P3 = (2 * Math.PI) / 3;

/** 253번 상수 — C 는 드럼 중심(세계) */
export const K253 = {
  C: [0, 1.75] as V2,
  PIN_R: 0.55,
  STUD_R: 0.97,
  STUD_r: 0.09,
  PSI_IN: 100 * D2R,
  PHI_C: 0.39957,
  PHI0: -0.06164,
  PERIOD: 14.766371,
  W1: 1.6,
  W2: 2.4
} as const;
const K = K253;

/** 갈고리 윤곽 45 점(핀 기준, 팔 = +x, 반시계) */
export const HOOK253: V2[] = [
  [0.62, -0.03], [0.62, 0.03], [0.6168, 0.0309], [0.6154, 0.0334], [0.5947, 0.1736], [0.593, 0.1798], [0.5895, 0.1856], [0.5823, 0.1918], [0.576, 0.1943], [0.5665, 0.1947], [0.5602, 0.193], [0.5544, 0.1895], [0.5482, 0.1823], [0.5457, 0.176], [0.5453, 0.1663], [0.5646, 0.0346], [0.5641, 0.0319], [0.5623, 0.0303], [0.0353, 0.03], [0.033, 0.0307], [0.0238, 0.0382], [0.0173, 0.0416], [0.0088, 0.0441], [0, 0.045], [-0.0102, 0.0438], [-0.0186, 0.041], [-0.0274, 0.0357], [-0.0339, 0.0296], [-0.039, 0.0225], [-0.0426, 0.0144], [-0.0446, 0.0058], [-0.0449, -0.003], [-0.0435, -0.0117], [-0.0403, -0.0199], [-0.0357, -0.0274], [-0.0296, -0.0339], [-0.0225, -0.039], [-0.0145, -0.0426], [-0.0059, -0.0446], [0.0029, -0.0449], [0.0116, -0.0435], [0.0186, -0.041], [0.0262, -0.0366], [0.033, -0.0307], [0.0353, -0.03]
];

/** 갈고리: 원점 = 핀, 팔 = +x. 두께 z −0.185~−0.155, 핀 구멍 0.0205, 앞면에 스프링 단추 */
export function hook253(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(HOOK253);
  shape.holes.push(circlePath(0, 0, 0.0205));
  const body = mesh(extrude(shape, 0.03, 0.003, 12), brass());
  body.position.z = -0.17;
  g.add(body);
  const bg = lathe(rodProfile(0.012, 0, 0.035, 0, 0.002), 20);
  bg.rotateX(Math.PI / 2);
  const button = mesh(bg, brass());
  button.position.set(0.22, 0, -0.16);
  g.add(button);
  g.userData.outline = HOOK253;
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

const ss = (u: number): number => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};
const S = (u: number): number => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x - (x * x * x * x) / 2;
};
const psiOf = (omega: number): number => K.PSI_IN * (1 - ss((omega - K.W1) / (K.W2 - K.W1)));

export type Phase253 = 'normal' | 'runaway' | 'deployed' | 'caught' | 'rewind' | 'fold' | 'restart';

export function state253(t: number): { tc: number; phi: number; omega: number; psi: number; phase: Phase253 } {
  const T = K.PERIOD;
  const tc = ((t % T) + T) % T;
  const base = K.PHI_C + 2 * P3;
  let phi: number;
  let omega: number;
  let psi: number;
  let phase: Phase253;
  if (tc < 4) {
    phi = K.PHI0 + 0.5 * tc; omega = 0.5; psi = K.PSI_IN; phase = 'normal';
  } else if (tc < 5) {
    const tau = tc - 4;
    phi = K.PHI0 + 2 + 0.5 * tau + 1.25 * tau * tau; omega = 0.5 + 2.5 * tau; psi = psiOf(omega); phase = 'runaway';
  } else if (tc < 5.3) {
    phi = K.PHI0 + 3.75 + 3 * (tc - 5); omega = 3; psi = 0; phase = 'deployed';
  } else if (tc < 6.8) {
    phi = base; omega = 0; psi = 0; phase = 'caught';
  } else if (tc < 8.3) {
    const u = (tc - 6.8) / 1.5;
    phi = base - 0.85 * ss(u); omega = (-0.85 * (6 * u - 6 * u * u)) / 1.5; psi = 0; phase = 'rewind';
  } else if (tc < 9.3) {
    phi = base - 0.85; omega = 0; psi = K.PSI_IN * ss(tc - 8.3); phase = 'fold';
  } else if (tc < 10.3) {
    phi = base - 0.85 + 0.5 * S(tc - 9.3); omega = 0.5 * ss(tc - 9.3); psi = K.PSI_IN; phase = 'restart';
  } else {
    phi = base - 0.6 + 0.5 * (tc - 10.3); omega = 0.5; psi = K.PSI_IN; phase = 'normal';
  }
  return { tc, phi, omega, psi, phase };
}
