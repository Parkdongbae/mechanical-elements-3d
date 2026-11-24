// 079 왕복 막대로 돌리는 래칫 — 막대 B 의 직선 왕복이 흔들리는 팔 C 두 개와 폴로 면 톱니 바퀴 A 를 거의 연속으로 돌린다 (판화 79번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, shaftZ, tag } from '../kit';
import { K79, faceRatchetWheel79, flapPawl79, forkRod79, linkBar79, placeFlapPawl79, radialArm79, rodGuide79, state79 } from '../kit/k077';

const OX = -0.75;
const OY = 1.6;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM079(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const wheel = faceRatchetWheel79();
  wheel.name = 'wheelA';
  wheel.position.set(OX, OY, 0.03);
  g.add(wheel);

  g.add(shaftZ(OX, OY, 0.27, 0.045));

  const armU = radialArm79(0.03, true);
  armU.name = 'armU';
  armU.position.set(OX, OY, 0.18);
  armU.add(rod(v(K79.ARM, 0, -0.07), v(K79.ARM, 0, 0.03), 0.02));
  const armL = radialArm79(0.065, true);
  armL.name = 'armL';
  armL.position.set(OX, OY, 0.215);
  armL.add(rod(v(K79.ARM, 0, -0.03), v(K79.ARM, 0, 0.07), 0.02));
  g.add(armU, armL);

  // 폴 — 바퀴 중심을 원점으로 하는 그룹의 자식
  const pg = new THREE.Group();
  pg.position.set(OX, OY, 0);
  const pawlU = flapPawl79(true);
  pawlU.name = 'pawlU';
  const pawlL = flapPawl79(true);
  pawlL.name = 'pawlL';
  pg.add(pawlU, pawlL);
  g.add(pg);

  const linkU = linkBar79();
  linkU.name = 'linkU';
  const linkL = linkBar79();
  linkL.name = 'linkL';
  g.add(linkU, linkL);

  const rodB = forkRod79(0.9, -0.09, 0.085);
  rodB.name = 'rodB';
  g.add(rodB);

  const guide = rodGuide79(0.2);
  guide.position.set(1.4, OY, 0.2);
  g.add(guide);

  const arr = rotArrow(0.4, false);
  arr.position.set(OX, OY, 0.3);
  g.add(arr);

  g.add(
    tag('면 래칫 바퀴 A(톱니 36개)', v(-1.5, 2.65, 0.4)),
    tag('흔들리는 팔 C(2개)', v(-0.35, 2.6, 0.4))
  );
  // 움직이는 부품을 따라가는 이름표
  armU.add(tag('폴(팔에 달림)', v(0.6, 0.35, 0.25)));
  linkU.add(tag('이음 막대', v(0.6, 0.3, 0.3)));
  rodB.add(tag('왕복 막대 B', v(0.5, 0.35, 0.2)));

  let s = state79(0);
  const apply = (): void => {
    s = state79(theta);
    wheel.rotation.z = s.wheel;
    armU.rotation.z = s.gamma;
    armL.rotation.z = -s.gamma;
    const bx = OX + s.xB;
    rodB.position.set(bx, OY, 0.2);
    const ex = OX + K79.ARM * Math.cos(s.gamma);
    const ey = K79.ARM * Math.sin(s.gamma);
    linkU.position.set(ex, OY + ey, 0.135);
    linkU.rotation.z = Math.atan2(OY - (OY + ey), bx - ex);
    linkL.position.set(ex, OY - ey, 0.26);
    linkL.rotation.z = Math.atan2(OY - (OY - ey), bx - ex);
    placeFlapPawl79(pawlU, s.gamma, s.tiltU, 0.15);
    placeFlapPawl79(pawlL, -s.gamma, s.tiltL, 0.15);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.8, 6.4], target: [0.2, 1.6, 0.15] },
    notes: () => [
      { label: '지금 미는 폴', value: s.pushing === 'U' ? '위 팔(막대가 오른쪽으로)' : s.pushing === 'L' ? '아래 팔(막대가 왼쪽으로)' : '교대 중(바퀴 정지)' },
      { label: '속도', value: '막대 한 번 왕복에 톱니 4칸(40°)' },
      { label: '넘긴 톱니 수', value: s.steps.toFixed(1) },
      { label: '원리', value: '직선 왕복 → 한 방향 회전: 두 팔이 번갈아 민다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
