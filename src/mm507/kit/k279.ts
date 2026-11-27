// 279 홈 있는 십자머리 크랭크와 클레이턴 미끄럼 저널 상자 전용 키트 — 상수·닫힌 식 운동(state279)·안감·쐐기·틀 윤곽
// 설계표 docs/mm507-sheets/279.md 의 치수·식을 그대로 옮겼다. 안감·쐐기는 왼쪽 기준(오른쪽은 x 를 뒤집은 거울).
import * as THREE from 'three';
import { pathFrom, shapeFrom, TAU, type V2 } from '../../models/parts/geom';

export const K279 = {
  C: [0, 1.55] as V2,
  R: 0.38,
  WRIST_R: 0.08,
  SLOT_HW: 0.202,
  SLOT_Y: [-0.53, 0.76] as V2,
  TAPER: 0.15,
  S_WORN: -0.12,
  PITCH: 0.04,
  PERIOD: 14
};

export interface State279 {
  tc: number;
  /** 0 운전, 1 풀기, 2 틈 보이기, 3 조이기 */
  phase: 0 | 1 | 2 | 3;
  /** 크랭크 각(rad, 반시계 +) */
  theta: number;
  /** 십자머리 위치 X */
  X: number;
  /** 손목·상자 가운데 W (세계) */
  W: V2;
  /** 쐐기 올림(≤ 0) */
  s: number;
  /** 왼쪽 쐐기 가로 이동 −0.15·s (오른쪽은 반대) */
  dx: number;
  /** 쐐기와 홈 벽 틈 */
  gap: number;
  /** 너트 회전(rad) */
  nutAngle: number;
}

const ss = (u: number): number => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** 279번 운동식(t = 초, 한 주기 14 초, 닫힌 식). t 가 음수여도 된다 */
export function state279(t: number): State279 {
  const P = K279.PERIOD;
  const tc = ((t % P) + P) % P;
  let theta = 0;
  let s = 0;
  let phase: State279['phase'] = 0;
  if (tc < 10) {
    const u = tc / 10;
    theta = 4 * Math.PI * (u - Math.sin(TAU * u) / TAU);
  } else if (tc < 11) {
    theta = 4 * Math.PI;
    s = K279.S_WORN * ss(tc - 10);
    phase = 1;
  } else if (tc < 12) {
    theta = 4 * Math.PI;
    s = K279.S_WORN;
    phase = 2;
  } else {
    theta = 4 * Math.PI;
    s = K279.S_WORN * (1 - ss((tc - 12) / 2));
    phase = 3;
  }
  const X = K279.R * Math.cos(theta);
  const W: V2 = [X, K279.C[1] + K279.R * Math.sin(theta)];
  const dx = -K279.TAPER * s;
  return { tc, phase, theta, X, W, s, dx, gap: 0.002 - K279.TAPER * s, nutAngle: (TAU * s) / K279.PITCH };
}

/** 안감 윤곽(왼쪽, 상자 좌표). mirror = true 면 오른쪽 */
export function lining279(mirror = false): THREE.Shape {
  const m = mirror ? -1 : 1;
  const a = Math.atan2(-0.0819, -0.004);
  const b = Math.atan2(0.0819, -0.004);
  const s = new THREE.Shape();
  s.moveTo(m * -0.004, 0.13);
  s.lineTo(m * -0.1695, 0.13);
  s.lineTo(m * -0.1305, -0.13);
  s.lineTo(m * -0.004, -0.13);
  s.lineTo(m * -0.004, -0.0819);
  // 반지름 0.082 호 — 왼쪽으로 (−0.082, 0) 을 지나 (−0.004, 0.0819) 까지
  const N = 40;
  // a(≈ −92.8°) 에서 −π 를 지나 b − 2π(≈ −267.2°) 까지 시계 방향
  for (let k = 1; k < N; k++) {
    const ang = a + ((b - TAU - a) * k) / N;
    s.lineTo(m * 0.082 * Math.cos(ang), 0.082 * Math.sin(ang));
  }
  s.lineTo(m * -0.004, 0.0819);
  s.closePath();
  return s;
}

/** 쐐기(지브) 윤곽(왼쪽, s = 0, 상자 좌표). mirror = true 면 오른쪽 */
export function gib279(mirror = false): THREE.Shape {
  const m = mirror ? -1 : 1;
  return shapeFrom([
    [m * -0.2, 0.12],
    [m * -0.169, 0.12],
    [m * -0.1315, -0.13],
    [m * -0.2, -0.13]
  ]);
}

/** 십자머리 틀 윤곽 + 홈 구멍(틀 좌표) */
export function crossFrame279(): THREE.Shape {
  const sh = shapeFrom([
    [-0.42, 0.94],
    [0.42, 0.94],
    [0.54, 0.12],
    [0.54, -0.12],
    [0.42, -0.71],
    [-0.42, -0.71],
    [-0.54, -0.12],
    [-0.54, 0.12]
  ]);
  const w = K279.SLOT_HW;
  sh.holes.push(
    pathFrom([
      [-w, K279.SLOT_Y[0]],
      [-w, K279.SLOT_Y[1]],
      [w, K279.SLOT_Y[1]],
      [w, K279.SLOT_Y[0]]
    ])
  );
  return sh;
}
