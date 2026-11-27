// 266 피치가 다른 두 나사 전용 키트 — 상수·닫힌 상태식·암나사 기둥 몸 (설계표 docs/mm507-sheets/266.md)
// 한 주기 24 초: 10 초 앞으로 5바퀴 → 2 초 멈춤 → 10 초 되돌림 → 2 초 멈춤.
// 축 이동 u = P_A·θ/2π, 움직이는 베어링 이동 w = (P_A − P_B)·θ/2π — u : w = 4 : 1.
import * as THREE from 'three';
import { TAU, circlePath, extrude, mesh, shapeFrom } from '../../models/parts/geom';
import { castIron } from '../../models/materials';

export const K266 = {
  Y_AXIS: 1.4, // 축 중심선 높이
  Z_AXIS: 0.1, // 축 중심선 깊이
  P_A: 0.12, // 나사 A(왼쪽, 고정 기둥 암나사) 피치 — 거친 나사
  P_B: 0.09, // 나사 B(오른쪽, 움직이는 기둥 암나사) 피치 — 고운 나사
  TURNS: 5, // 한 방향 회전 수
  PERIOD: 24, // 한 주기(초)
  SCREW_R: 0.12, // 나사 바깥 반지름
  BORE: 0.122 // 암나사 구멍 반지름(물림 틈 0.002)
} as const;

export interface State266 {
  tc: number; // 주기 안의 시각(0~24)
  theta: number; // 축 각(세계 +x 둘레, 오른손)
  u: number; // 축 옆 이동(+x)
  w: number; // 움직이는 베어링 옆 이동(+x)
  dir: number; // +1 앞으로 / −1 되돌림 / 0 멈춤
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세(역회전·seek 안전) */
export function state266(t: number): State266 {
  const tc = ((t % K266.PERIOD) + K266.PERIOD) % K266.PERIOD;
  let theta = 0;
  if (tc < 10) theta = K266.TURNS * Math.PI * (1 - Math.cos((Math.PI * tc) / 10));
  else if (tc < 12) theta = K266.TURNS * 2 * Math.PI;
  else if (tc < 22) theta = K266.TURNS * Math.PI * (1 + Math.cos((Math.PI * (tc - 12)) / 10));
  const u = (K266.P_A * theta) / TAU;
  const w = ((K266.P_A - K266.P_B) * theta) / TAU;
  const dir = tc < 10 ? 1 : tc < 12 ? 0 : tc < 22 ? -1 : 0;
  return { tc, theta, u, w, dir };
}

/** 암나사 기둥 몸: y−z 사각(yBottom~1.62 × z −0.08~0.28)에 구멍(K266.BORE, 중심 y 1.40·z 0.10)을 내어 x0~x1 로 압출(castIron).
 *  고정 기둥 몸·움직이는 기둥 몸에 같이 쓴다. */
export function nutPost266(x0: number, x1: number, yBottom: number): THREE.Mesh {
  // 모양 면 (x=z, y=y) — 반시계 사각
  const s = shapeFrom([
    [-0.08, yBottom],
    [0.28, yBottom],
    [0.28, 1.62],
    [-0.08, 1.62]
  ]);
  s.holes.push(circlePath(K266.Z_AXIS, K266.Y_AXIS, K266.BORE));
  const geo = extrude(s, x1 - x0).rotateY(-Math.PI / 2); // 모양 면 → 세계 y−z, 압출 방향 → x
  const m = mesh(geo, castIron());
  m.position.x = (x0 + x1) / 2;
  return m;
}
