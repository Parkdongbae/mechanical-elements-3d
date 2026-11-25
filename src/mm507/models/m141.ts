// 141 띠톱 — 같은 크기 풀리 2개(세로 일렬) + 끝없는 납작 띠(톱날). 아래 바퀴 구동(시계) → 띠가 직선 운동
//  (설계표 docs/mm507-sheets/141.md, 키트 kit/k140.ts 공용)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, openBeltPath, planar, pulley, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K141, sawFrame141, sawTable141 } from '../kit/k140';

/** 띠 중심선 반지름 = 바퀴 반지름 + 띠 두께 절반 */
const RE = K141.r + K141.bandT / 2;
const CU: [number, number] = [K141.x, K141.yU]; // 위 바퀴 중심
const CL: [number, number] = [K141.x, K141.yL]; // 아래 바퀴(구동) 중심

export default function buildM141(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());
  g.add(sawFrame141()); // 주물 기둥(전시 좌표 그대로)
  g.add(sawTable141([K141.x - RE, K141.x + RE])); // 테이블(구멍 = 띠 두 가닥 자리)

  // 바퀴 둘: 같은 크기, 납작 테. 위 = brass, 아래(구동) = bronze
  const wheelU = pulley(K141.r, { width: K141.width, spokes: 6, flat: true });
  wheelU.name = 'wheelU';
  wheelU.position.set(CU[0], CU[1], K141.z);
  const wheelL = pulley(K141.r, { width: K141.width, spokes: 6, flat: true, driver: true });
  wheelL.name = 'wheelL';
  wheelL.position.set(CL[0], CL[1], K141.z);
  const shaftU = shaftZ(CU[0], CU[1], 0.24);
  const shaftL = shaftZ(CL[0], CL[1], 0.24);
  g.add(wheelU, wheelL, shaftU, shaftL);

  // 톱날 띠: 닫힌 열린벨트 경로, 폭 방향을 z 로 고정(widthDirs 없으면 폭이 서 버린다)
  const path = openBeltPath(CU, RE, CL, RE);
  const belt = new Belt(planar(path, K141.z), {
    style: 'flat',
    width: K141.bandW,
    thickness: K141.bandT,
    marks: 12,
    widthDirs: path.map(() => new THREE.Vector3(0, 0, 1))
  });
  belt.group.name = 'band';
  g.add(belt.group);

  // 회전 방향 화살표(둘 다 시계) + 이름표 5개(고정 부품뿐이라 고정 위치)
  const arrowU = rotArrow(0.17, false);
  arrowU.position.set(CU[0], CU[1], 0.27);
  const arrowL = rotArrow(0.17, false);
  arrowL.position.set(CL[0], CL[1], 0.27);
  g.add(arrowU, arrowL);
  g.add(
    tag('위 바퀴', new THREE.Vector3(1.15, 2.85, 0.3)),
    leaderTo(tag('아래 바퀴(구동)', new THREE.Vector3(-0.75, 0.55, 0.5)), wheelL),
    leaderTo(tag('톱날(곧게 내려가며 켠다)', new THREE.Vector3(1.45, 1.95, 0.3)), 'band'),
    tag('테이블', new THREE.Vector3(1.45, 1.4, 0.45)),
    tag('주물 기둥', new THREE.Vector3(-1.45, 2.55, 0.3))
  );

  return {
    group: g,
    view: { pos: [0.3, 1.9, 6.4], target: [0, 1.6, 0] },
    notes: () => [
      { label: '바퀴', value: '위·아래 같은 크기(반지름 0.30) → 같은 속도' },
      { label: '톱날 속도', value: '0.49 /s (= 0.307 × 1.6 × 속도 배율)' },
      { label: '곧은 가닥', value: '길이 1.91, 오른쪽은 아래로 · 왼쪽은 위로' },
      { label: '바퀴 회전수', value: 'θ 1.6 rad/s ≈ 15 rpm' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 시계 방향(오른쪽 가닥이 내려가며 켠다)
      theta += OMEGA * speed * dt;
      wheelL.rotation.z = -theta;
      wheelU.rotation.z = -theta; // 같은 크기 · 열린 걸이 → 같은 방향 같은 속도
      shaftU.rotation.z = -theta;
      shaftL.rotation.z = -theta;
      // 점열은 반시계로 나아가므로 시계로 흐르게 하려면 음수
      belt.setOffset(-RE * theta);
    }
  };
}
