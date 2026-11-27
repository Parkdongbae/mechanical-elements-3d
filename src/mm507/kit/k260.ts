// 260 차동 나사 전용 키트 — 상수와 닫힌 상태식 (설계표 docs/mm507-sheets/260.md)
// θA = A0·(1 − cos(2π·tc/PERIOD)): 12 초 앞으로, 12 초 뒤로 — 나사가 0.1216 나아갔다 돌아온다.
// θD = −θA·Z_F/Z_D, θE = −θA·Z_B/Z_E → 나사 이동 xs = PITCH·(θD − θE)/2π = 0.002653·θA.
import { TAU } from '../../models/parts/geom';

export const K260 = {
  M: 0.02, // 기어 모듈(4 개 공통)
  Z_F: 8, // 긴 피니언 F 잇수
  Z_D: 48, // 바퀴 D 잇수
  Z_B: 14, // 피니언 B 잇수
  Z_E: 42, // 바퀴 E 잇수
  YA: 1.76, // 축 A 높이
  YC: 1.2, // 나사 축 높이
  ZC: 0.28, // 축 깊이
  PITCH: 0.1, // 나사 피치
  A0: 22.92, // θA 진폭(rad)
  PERIOD: 24 // 한 주기(초)
} as const;

export interface State260 {
  tc: number; // 주기 안의 시각(0~24)
  thetaA: number; // 축 A 각
  thetaD: number; // D 상대각(−θA/6)
  thetaE: number; // E 상대각(−θA/3)
  xs: number; // 나사 옆 이동
  omegaA: number; // 축 A 각속도 dθA/dt
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세(역회전·seek 안전) */
export function state260(t: number): State260 {
  const tc = ((t % K260.PERIOD) + K260.PERIOD) % K260.PERIOD;
  const w = (TAU * tc) / K260.PERIOD;
  const thetaA = K260.A0 * (1 - Math.cos(w));
  const thetaD = (-thetaA * K260.Z_F) / K260.Z_D;
  const thetaE = (-thetaA * K260.Z_B) / K260.Z_E;
  const xs = (K260.PITCH * (thetaD - thetaE)) / TAU;
  const omegaA = ((K260.A0 * TAU) / K260.PERIOD) * Math.sin(w);
  return { tc, thetaA, thetaD, thetaE, xs, omegaA };
}
