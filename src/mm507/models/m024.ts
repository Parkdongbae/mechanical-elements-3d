// 024 평기어 — 축이 종이에 수직인 스퍼 기어 2장(28:34)이 맞물려 서로 반대로 돈다 (판화 24번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, meshAngle, rotArrow, spurGear, shaftZ, tag, type V2 } from '../kit';

const MOD = 0.05; // 모듈
const N1 = 28; // G1(구동, 작은) 잇수 — 피치 반지름 0.70
const N2 = 34; // G2(피동, 큰) 잇수 — 피치 반지름 0.85
const C1: V2 = [-0.85, 1.75]; // G1 중심 (피치원이 정확히 접함: 중심 거리 1.55)
const C2: V2 = [0.7, 1.75]; // G2 중심
const Z = 0.12; // 기어 높이 (폭 0.16 → z 0.04~0.20)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM024(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // G1(작은 기어)의 회전각

  g.add(displayStand());

  // G1(구동, bronze)·G2(피동, brass) — 민판(spokes 0), Z축 회전
  const g1 = spurGear(N1, MOD, { width: 0.16, spokes: 0, driver: true });
  g1.position.set(C1[0], C1[1], Z);
  const g2 = spurGear(N2, MOD, { width: 0.16, spokes: 0 });
  g2.position.set(C2[0], C2[1], Z);
  g.add(g1, g2);

  // 축: 기어 축구멍(bore)의 0.95배 반지름으로 끼운다. 끝 육각 너트가 판화의 짙은 허브
  g.add(shaftZ(C1[0], C1[1], 0.34, 0.093), shaftZ(C2[0], C2[1], 0.34, 0.113));

  // 회전 방향 화살표: G1 반시계, G2 시계 — 기어 앞 z = 0.30
  const a1 = rotArrow(0.55, true);
  a1.position.set(C1[0], C1[1], 0.3);
  const a2 = rotArrow(0.65, false);
  a2.position.set(C2[0], C2[1], 0.3);
  g.add(a1, a2);

  // 이름표
  g.add(tag('구동 28', v(-0.85, 0.68, 0.4)), tag('피동 34', v(0.7, 0.68, 0.4)));

  return {
    group: g,
    notes: () => [
      { label: '잇수', value: '28 : 34' },
      { label: '속도비', value: '1 : 0.82 (작은 쪽이 더 빠름)' },
      { label: '회전 방향', value: '서로 반대' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 매 프레임 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      g1.rotation.z = theta; // 반시계 +
      g2.rotation.z = meshAngle(C1, N1, theta, C2, N2); // 이가 이골에 물리는 위상, 반대 방향
    }
  };
}
