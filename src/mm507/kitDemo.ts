// 키트 시연: 부품 하나씩 전시대에 늘어놓은 장면 (?mm=kit)
// 왼쪽: 열린 벨트 풀리 쌍(회전), 가운데 위: 맞물림 기어(회전), 아래: 원뿔 풀리·지레·추, 왼쪽 위: 단차 풀리
import * as THREE from 'three';
import { OMEGA, type MovementModel } from './types';
import {
  Belt,
  conePulley,
  displayStand,
  lever,
  meshAngle,
  openBeltPath,
  pillow,
  planar,
  pulley,
  rod,
  rotArrow,
  shaftZ,
  spurGear,
  steppedPulley,
  tag,
  weight,
  PILLOW_BOSS_Y,
  type V2
} from './kit';

const R1 = 0.3; // 구동 풀리 반지름
const R2 = 0.2; // 피동 풀리 반지름
const Z1 = 20; // 기어1 잇수
const Z2 = 12; // 기어2 잇수
const MOD = 0.042; // 기어 모듈 → 기어1 피치 r = 0.42
const C1: V2 = [0.42, 1.98];
const C2: V2 = [0.97, 2.366];

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildKitDemo(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 벨트·풀리 쌍 (왼쪽)
  const pA = pulley(R1, { driver: true, crowned: true, spokes: 4 });
  pA.position.set(-1.5, 1.0, 0);
  const pB = pulley(R2, { spokes: 4 });
  pB.position.set(-0.62, 1.82, 0);
  g.add(pA, pB, shaftZ(-1.5, 1.0, 0.42), shaftZ(-0.62, 1.82, 0.42));
  // 벨트: 띠 두께 절반만큼 큰 반지름으로 감아 풀리 림에 밀착
  const path = openBeltPath([-1.5, 1.0], R1 + 0.01, [-0.62, 1.82], R2 + 0.01, 24);
  const belt = new Belt(planar(path, 0), { width: 0.13, thickness: 0.02, marks: 6 });
  g.add(belt.group);
  const arrow = rotArrow(R1 + 0.14, true);
  arrow.position.set(-1.5, 1.0, 0.12);
  g.add(arrow);

  // 맞물림 스퍼 기어 (가운데 위)
  const g1 = spurGear(Z1, MOD, { width: 0.13, spokes: 5 });
  g1.position.set(C1[0], C1[1], 0);
  const g2 = spurGear(Z2, MOD, { width: 0.13, spokes: 4, driver: true });
  g2.position.set(C2[0], C2[1], 0);
  g.add(g1, g2, shaftZ(C1[0], C1[1], 0.4), shaftZ(C2[0], C2[1], 0.4));

  // 단차 풀리 (왼쪽 위)
  const stepped = steppedPulley([0.26, 0.185, 0.12], 0.08);
  stepped.position.set(-1.62, 2.62, 0);
  g.add(stepped, shaftZ(-1.62, 2.62, 0.4));

  // 원뿔 풀리: 두 필로 블록 사이 X축 축에 걸침 (가운데 아래)
  const py0 = 0.545;
  const axleY = py0 + PILLOW_BOSS_Y;
  g.add(pillow(0.3, py0, 0.42, 'x'), pillow(0.94, py0, 0.42, 'x'));
  g.add(rod(v(0.3, 0.18, 0.42), v(0.3, py0 - 0.028, 0.42), 0.028), rod(v(0.94, 0.18, 0.42), v(0.94, py0 - 0.028, 0.42), 0.028));
  g.add(rod(v(0.28, axleY, 0.42), v(0.96, axleY, 0.42), 0.024));
  const cone = conePulley(0.09, 0.22, 0.34, true);
  cone.position.set(0.62, axleY, 0.42);
  g.add(cone);

  // 지레 + 추 (받침 위)
  const leverP = lever(0.85, { handle: true });
  leverP.position.set(-1.05, 0.545, 0.42);
  leverP.rotation.z = 0.1;
  g.add(leverP, rod(v(-1.05, 0.18, 0.42), v(-1.05, 0.5, 0.42), 0.03));
  const wt = weight(0.22, 0.3);
  wt.position.set(1.62, 0.33, 0.42);
  g.add(wt);

  // 이름표 (layer 1)
  g.add(
    tag('벨트와 풀리', v(-1.85, 1.55, 0.35)),
    tag('맞물림 기어', v(0.72, 2.9, 0.3)),
    tag('단차 풀리', v(-1.62, 3.0, 0.3)),
    tag('원뿔 풀리', v(0.62, 0.32, 0.85)),
    tag('추', v(1.62, 0.62, 0.6))
  );

  return {
    group: g,
    view: { pos: [0, 2.1, 6.2], target: [0, 1.75, 0] },
    notes: () => [
      { label: '풀리 속도비', value: `${R1.toFixed(2)} : ${R2.toFixed(2)}` },
      { label: '기어 잇수', value: `${Z1} : ${Z2}` }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 다시 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pA.rotation.z = theta;
      pB.rotation.z = (theta * R1) / R2; // 열린 벨트: 같은 방향, 반경 반비례
      stepped.rotation.z = theta * 0.6;
      belt.setOffset(theta * R1);
      g1.rotation.z = -theta;
      g2.rotation.z = meshAngle(C1, Z1, -theta, C2, Z2);
      cone.rotation.x = theta * 0.9;
    }
  };
}
