// 169번 전용 키트 — 짧은 링크로 이은 크랭크(홈 없음). 168 의 피트먼·둘째 크랭크·흔들이 막대를 그대로 쓰고(k168),
//  홈 크랭크 대신 보통 크랭크(반지름 R1, 핀 Q) + 짧은 링크(길이 Lk, Q ↔ 피트먼 끝 P1)로 주축을 돌린다.
//  좌우를 뒤집은 배치(피트먼 오른끝이 주축 쪽): 판화 169 는 168 의 거울상이다.
//  자세: 주축 각 psi = theta + psi0 → 둘째 크랭크 각 phi(거꾸로 표) → 피트먼·흔들이 막대·링크.
import * as THREE from 'three';
import { steel } from '../../models/materials';
import { circlePts } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { ZL, circInt, coupler, flatPlate, hullOf, makeInverse, pinMark, throughPin, K168 } from './k168';
import type { Coupler, Four } from './k168';
import { setMM } from './mm';

export const K169 = {
  four: { S2: [0.1, 1.55], r2: 0.33, L23: 1.5, H: [-1.45, 2.95], Lr: 1.45, L12: 1.15 } as Four,
  O1: [1.25, 1.59] as V2, // 주축
  R1: 0.55, // 주축 크랭크 반지름(핀 Q)
  Lk: 0.5, // 링크 길이 Q ↔ P1
  psi0: -0.713, // t = 1 에서 둘째 크랭크 핀이 판화처럼 위쪽(108°)
  pinR: K168.pinR,
} as const;

function qOf(c: Coupler): V2 {
  const q = circInt(K169.O1, K169.R1, c.P1, K169.Lk, 1);
  if (!q) throw new Error('169: 링크가 닫히지 않음');
  return q;
}

const inv169 = makeInverse((phi) => {
  const q = qOf(coupler(K169.four, phi));
  return Math.atan2(q[1] - K169.O1[1], q[0] - K169.O1[0]);
});

export interface Pose169 {
  psi: number;
  phi: number;
  c: Coupler;
  Q: V2;
  /** 링크 방향(Q → P1) */
  gamma: number;
}

export function pose169(theta: number): Pose169 {
  const psi = theta + K169.psi0;
  const phi = inv169(psi);
  const c = coupler(K169.four, phi);
  const Q = qOf(c);
  return { psi, phi, c, Q, gamma: Math.atan2(c.P1[1] - Q[1], c.P1[0] - Q[0]) };
}

/**
 * 링크 — 원점 = 크랭크 핀 Q, 로컬 +X 가 P1 쪽. z 0.19~0.24(피트먼 앞 층).
 * 눈 둘(구멍 0.029). P1 쪽 핀(z 0.125~0.265)이 피트먼 눈 P1 을 꿰어 피트먼에 걸린다.
 * Q 쪽은 크랭크가 가진 핀(앞 머리 z 0.24~0.265)이 링크 눈을 꿴다.
 */
export function link169(): THREE.Group {
  const g = new THREE.Group();
  const L = K169.Lk;
  const outline = hullOf([[0, 0, 0.065], [L, 0, 0.065]], 28);
  g.add(flatPlate(outline, [circlePts(0.029, 20, 0, 0), circlePts(0.029, 20, L, 0)], ZL.rocker, steel()));
  const pin = throughPin(K169.pinR, 0.125, 0.265, 0.045);
  pin.position.x = L;
  g.add(pin);
  g.add(pinMark('Q', 0, 0, 0.215));
  g.add(pinMark('P1', L, 0, 0.215));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [L, 0, 0], length: L });
  return g;
}
