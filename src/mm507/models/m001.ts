// 001 열린 벨트 전동 — 같은 크기 풀리 2개가 위아래, 열린 벨트로 같은 방향 1:1 (판화 1번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, openBeltPath, planar, pulley, rotArrow, shaftZ, tag, type V2 } from '../kit';

const RA = 0.52; // 풀리 A(구동) 반지름
const RB = 0.52; // 풀리 B(종동) 반지름
const CA: V2 = [0, 2.55]; // A 중심
const CB: V2 = [0, 0.95]; // B 중심
const Z = 0.25; // 풀리·벨트 높이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM001(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 풀리 A(구동, bronze)·B(종동, brass) — z = 0.25, Z축 축
  const pA = pulley(RA, { spokes: 4, driver: true });
  pA.position.set(CA[0], CA[1], Z);
  const pB = pulley(RB, { spokes: 4 });
  pB.position.set(CB[0], CB[1], Z);
  g.add(pA, pB, shaftZ(CA[0], CA[1]), shaftZ(CB[0], CB[1]));

  // 열린 벨트: 림 바깥(반지름 + 띠 두께 절반)을 감는다
  const path = openBeltPath(CA, RA + 0.01, CB, RB + 0.01);
  const belt = new Belt(planar(path, Z), { width: 0.13 });
  g.add(belt.group);

  // 회전 방향 화살표(둘 다 반시계) + 이름표(각 풀리 오른쪽)
  const arrowA = rotArrow(0.7, true);
  arrowA.position.set(CA[0], CA[1], Z + 0.09);
  const arrowB = rotArrow(0.7, true);
  arrowB.position.set(CB[0], CB[1], Z + 0.09);
  g.add(arrowA, arrowB);
  g.add(tag('구동 풀리', v(CA[0] + 1.0, CA[1] + 0.2, Z + 0.1)), tag('종동 풀리', v(CB[0] + 1.0, CB[1] + 0.2, Z + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '회전 방향', value: '같은 방향' },
      { label: '속도비', value: '1 : 1' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pA.rotation.z = theta;
      pB.rotation.z = theta; // 열린 벨트·같은 반지름: 같은 방향, 같은 속도
      belt.setOffset(theta * (RA + 0.01)); // 표시가 림과 같은 속도로 흐른다
    }
  };
}
