// 032 마찰 바퀴 — 작은 바퀴(왼쪽)와 큰 바퀴(오른쪽)가 테두리의 마찰로만 맞닿아 반대로 돈다 (판화 32번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, frictionWheel, rotArrow, shaftZ, tag } from '../kit';

const R1 = 0.7; // 구동(작은) 바퀴 반지름
const R2 = 1.2; // 피동(큰) 바퀴 반지름
const C1: [number, number] = [-1.2, 1.75];
const C2: [number, number] = [0.7, 1.75]; // 접점 x = -0.5 (중심 거리 1.9 = R1 + R2)
const Z = 0.15;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM032(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  const w1 = frictionWheel(R1, { width: 0.16, driver: true, holes: 5 });
  w1.position.set(C1[0], C1[1], Z);
  const w2 = frictionWheel(R2, { width: 0.16, holes: 7 });
  w2.position.set(C2[0], C2[1], Z);
  g.add(w1, w2, shaftZ(C1[0], C1[1], 0.36, 0.07), shaftZ(C2[0], C2[1], 0.36, 0.07));

  const a1 = rotArrow(0.45, true);
  a1.position.set(C1[0], C1[1], 0.3);
  const a2 = rotArrow(0.75, false);
  a2.position.set(C2[0], C2[1], 0.3);
  g.add(a1, a2);
  // 이름표: 바퀴를 가리지 않는 빈 곳에. '마찰 접촉'은 접점(-0.5, 1.75) 바로 위 두 바퀴 사이 틈에
  g.add(tag('구동 바퀴', v(C1[0], C1[1] - R1 - 0.25, 0.3)), tag('피동 바퀴', v(1.7, 3.03, 0.3)));
  g.add(tag('마찰 접촉', v(-0.62, 2.72, 0.3)));

  return {
    group: g,
    notes: () => [
      { label: '지름비', value: '작은 바퀴 : 큰 바퀴 = 1.4 : 2.4 (7 : 12)' },
      { label: '속도비', value: '작은 바퀴가 큰 바퀴보다 1.7배 빠르다' },
      { label: '회전 방향', value: '서로 반대(미끄러지지 않는 동안)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      w1.rotation.z = theta;
      w2.rotation.z = -theta * (R1 / R2); // 테두리 속도가 같다
    }
  };
}
