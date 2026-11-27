// 268 크랭크와 흔들막대 전용 키트 — 상수·닫힌 상태식·막대 판 (설계표 docs/mm507-sheets/268.md)
// 막대는 크랭크 핀 A 를 지나고 고정 축 도르래 홈 바닥에 접선으로 얹혀 미끄러지며, 도르래는 미끄러짐 없이 구른다.
import * as THREE from 'three';
import { circlePath, extrude, mesh } from '../../models/parts/geom';
import { steel } from '../../models/materials';

export const K268 = {
  D: [1.36, 1.6] as [number, number], // 원판 중심
  RC: 0.336, // 크랭크 반지름
  O: [-0.94, 1.56] as [number, number], // 도르래 중심
  R_ROLL: 0.208, // 도르래 홈 바닥 반지름
  ROD_H: 0.048, // 막대 반높이
  RHO: 0.258, // 도르래 중심 ~ 막대 중심선 거리
  ROD_L: 3.1, // 핀 → 막대 끝 길이
  PHI0: 1.2392, // t = 0 크랭크 각
  OMEGA: 1.0472, // 크랭크 각속도
  PSI0: 1.6119, // t = 0 접점 방향각
  LAM0: 2.4221 // t = 0 핀 ~ 접점 거리
} as const;

export interface State268 {
  phi: number; // 크랭크 각
  A: [number, number]; // 크랭크 핀(세계)
  beta: number; // 핀 → 도르래 쪽 막대 방향각
  alpha: number; // 막대 로컬 +x(끝 → 핀) 의 세계각
  lam: number; // 핀 → 접점 거리
  psi: number; // 도르래 중심 → 접점 방향각
  thetaR: number; // 도르래 구름각
  tip: [number, number]; // 막대 끝
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세 */
export function state268(t: number): State268 {
  const K = K268;
  const phi = K.PHI0 + K.OMEGA * t;
  const A: [number, number] = [K.D[0] + K.RC * Math.cos(phi), K.D[1] + K.RC * Math.sin(phi)];
  const vx = K.O[0] - A[0];
  const vy = K.O[1] - A[1];
  const d = Math.hypot(vx, vy);
  const sigma = Math.asin(K.RHO / d);
  const beta = Math.atan2(vy, vx) - sigma;
  const alpha = Math.atan2(-Math.sin(beta), -Math.cos(beta));
  const lam = Math.sqrt(d * d - K.RHO * K.RHO);
  const cx = A[0] + lam * Math.cos(beta);
  const cy = A[1] + lam * Math.sin(beta);
  const psi = Math.atan2(cy - K.O[1], cx - K.O[0]);
  const thetaR = psi - K.PSI0 - (lam - K.LAM0) / K.R_ROLL;
  const tip: [number, number] = [A[0] + K.ROD_L * Math.cos(beta), A[1] + K.ROD_L * Math.sin(beta)];
  return { phi, A, beta, alpha, lam, psi, thetaR, tip };
}

/** 막대 판 — 로컬 +x = 끝 → 핀, 눈(원호)은 원점, 깊이 0.17~0.23, 눈 구멍 0.027 */
export function rodPlate268(): THREE.Mesh {
  const h = K268.ROD_H;
  const a0 = Math.atan2(-h, -0.036) + 2 * Math.PI; // 233.13°
  const a1 = a0 + (253.74 * Math.PI) / 180; // → 486.87°
  const s = new THREE.Shape();
  s.moveTo(-3.1, -h);
  s.lineTo(-0.036, -h);
  s.absarc(0, 0, 0.06, a0, a1, false);
  s.lineTo(-3.1, h);
  s.closePath();
  s.holes.push(circlePath(0, 0, 0.027));
  const geo = extrude(s, 0.06, 0, 24);
  geo.translate(0, 0, 0.2);
  return mesh(geo, steel());
}
