// 077 두 개의 폴 래칫 구동(핀 바퀴) — 레버 C 가 받침점 A 에서 흔들리면 번갈아 미는 두 폴이 바퀴 B 의 핀을 민다 (판화 77번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K77, notchPawl77, pinWheel77, rockLever77, solve77, state77 } from '../kit/k077';

const OX = -0.55;
const OY = 1.55;
const AX = 1.04;
const AY = 2.025;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM077(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 바퀴 B 와 축
  const wheel = pinWheel77(0.2);
  wheel.name = 'wheelB';
  wheel.position.set(OX, OY, 0);
  g.add(wheel, shaftZ(OX, OY, 0.12, 0.05));

  // 레버 C 와 받침 핀 A
  const lever = rockLever77(1.25, 0.11);
  lever.name = 'leverC';
  lever.position.set(AX, AY, 0.06);
  g.add(lever, shaftZ(AX, AY, 0.11, 0.03));

  // 두 폴
  const pawlU = notchPawl77(K77.LU);
  pawlU.name = 'pawlU';
  pawlU.position.z = 0.13;
  const pawlL = notchPawl77(solve77().LL);
  pawlL.name = 'pawlL';
  pawlL.position.z = 0.13;
  g.add(pawlU, pawlL);

  // 회전 화살표(바퀴 반시계)
  const arr = rotArrow(0.5, true);
  arr.position.set(OX, OY, 0.1);
  g.add(arr);

  g.add(
    tag('바퀴 B(핀 24개)', v(-1.45, 2.7, 0.3)),
    tag('레버 C(흔든다)', v(1.65, 1.2, 0.3)),
    tag('받침점 A', v(1.6, 2.05, 0.3)),
    tag('위 폴', v(0.3, 2.75, 0.3)),
    tag('아래 폴', v(0.66, 1.58, 0.3))
  );

  let cur = state77(0);
  const apply = (): void => {
    const s = state77(theta);
    cur = s;
    lever.rotation.z = s.phi;
    wheel.rotation.z = s.wheel;
    pawlU.position.set(OX + s.pivotU[0], OY + s.pivotU[1], 0.13);
    pawlU.rotation.z = s.psiU;
    pawlL.position.set(OX + s.pivotL[0], OY + s.pivotL[1], 0.13);
    pawlL.rotation.z = s.psiL;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 1.7, 6.4], target: [0, 1.6, 0.1] },
    notes: () => [
      { label: '지금 미는 폴', value: cur.pushing === 'U' ? '위 폴' : cur.pushing === 'L' ? '아래 폴' : '교대 중(바퀴 정지)' },
      { label: '속도', value: '레버 한 번 왕복에 핀 2칸(30°)' },
      { label: '넘긴 핀 칸 수', value: cur.steps.toFixed(1) },
      { label: '원리', value: '한 폴이 돌아오는 동안 다른 폴이 민다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
