// 078 폴 래칫 구동 변형 — 레버 B 의 갈고리 폴 2개가 번갈아 톱니 바퀴 A 를 당긴다 (판화 78번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K78, aFrame78, handLever78, hookPawl78, sawWheel78, solve78, state78 } from '../kit/k077';

const OX = -0.3;
const OY = 0.96;
const PIV_Y = 2.03;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM078(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const wheel = sawWheel78(0.08);
  wheel.name = 'wheelA';
  wheel.position.set(OX, OY, 0.1);
  g.add(wheel);

  g.add(shaftZ(OX, OY, 0.33, 0.045));

  const frame = aFrame78(0.6, 0.06);
  frame.name = 'frame';
  frame.position.set(OX, OY, 0.26);
  g.add(frame);

  const lever = handLever78(1.3, 0.3);
  lever.name = 'leverB';
  lever.position.set(OX, PIV_Y, 0.37);
  g.add(lever);

  const pawl1 = hookPawl78(K78.L1);
  pawl1.name = 'pawl1';
  const pawl2 = hookPawl78(solve78().L2);
  pawl2.name = 'pawl2';
  pawl1.position.z = 0.1;
  pawl2.position.z = 0.1;
  g.add(pawl1, pawl2);

  const arrow = rotArrow(0.45, false);
  arrow.position.set(OX, OY, 0.33);
  g.add(arrow);

  g.add(
    tag('톱니 바퀴 A(28개)', v(0.85, 0.5, 0.4)),
    tag('손잡이 레버 B', v(0.7, 2.75, 0.4)),
    tag('폴 1(위로 당김)', v(-1.6, 1.75, 0.4)),
    tag('폴 2(오른쪽으로 당김)', v(-0.9, 2.42, 0.4)),
    tag('A 자 틀', v(0.75, 0.2, 0.4))
  );

  const apply = (): void => {
    const s = state78(theta);
    lever.rotation.z = s.phi;
    wheel.rotation.z = s.wheel;
    pawl1.position.set(OX + s.pin1[0], OY + s.pin1[1], 0.1);
    pawl1.rotation.z = s.psi1;
    pawl2.position.set(OX + s.pin2[0], OY + s.pin2[1], 0.1);
    pawl2.rotation.z = s.psi2;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.6, 6.4], target: [-0.1, 1.35, 0.2] },
    notes: () => {
      const s = state78(theta);
      return [
        {
          label: '지금 당기는 폴',
          value: s.pulling === 1 ? '폴 1(손잡이 내림)' : s.pulling === 2 ? '폴 2(손잡이 올림)' : '교대 중(바퀴 정지)'
        },
        { label: '속도', value: '레버 한 번 왕복에 톱니 2개(25.7°)' },
        { label: '넘긴 톱니 수', value: s.steps.toFixed(1) },
        { label: '원리', value: '77번과 같다 — 한 폴이 돌아가는 동안 다른 폴이 당긴다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
