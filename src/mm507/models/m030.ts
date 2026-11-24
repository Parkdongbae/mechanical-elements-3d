// 030 사각 기어 — 같은 4엽 비원형 기어 2개가 미끄럼 없이 맞물려, 피동 기어가 변하는 속도로 돈다 (판화 30번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, squareGear, squareGearAngle, squareGearSpec, tag } from '../kit';

const C = 1.2; // 축 간 거리
const E = 3 - 2 * Math.SQRT2;
const Y = 1.75;
const Z = 0.15;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM030(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 기어 1 의 회전각

  g.add(displayStand());

  const spec = squareGearSpec(C, 40);
  const g1 = squareGear(spec, 0, { driver: true });
  g1.position.set(-C / 2, Y, Z);
  const g2 = squareGear(spec, 0.5);
  g2.position.set(C / 2, Y, Z);
  g.add(g1, g2, shaftZ(-C / 2, Y, 0.32), shaftZ(C / 2, Y, 0.32));

  const a1 = rotArrow(0.55, true);
  a1.position.set(-C / 2, Y, 0.24);
  const a2 = rotArrow(0.55, false);
  a2.position.set(C / 2, Y, 0.24);
  g.add(a1, a2);

  g.add(tag('기어 1 (구동, 일정 속도)', v(-1.2, 0.85, 0.4)), tag('기어 2 (속도가 변함)', v(1.2, 0.85, 0.4)));

  return {
    group: g,
    notes: () => [
      { label: '기어 2 / 기어 1 속도비 (지금)', value: ((1 - E * E) / (1 + E * E - 2 * E * Math.cos(4 * theta))).toFixed(2) },
      { label: '속도비 범위', value: '0.71 ~ 1.41' },
      { label: '한 바퀴 평균', value: '1 : 1' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 미끄럼 없는 구름의 닫힌 식
      theta += OMEGA * speed * dt;
      g1.rotation.z = theta;
      g2.rotation.z = (3 * Math.PI) / 4 - squareGearAngle(theta);
    }
  };
}
