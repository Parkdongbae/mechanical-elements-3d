// 115 두 바퀴로 움직이는 이중 랙 — 같은 기어 둘이 고리 틀의 위·아래 랙을 함께 민다 (판화 115번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { barGuide113, K115, k115Frame, k115State, rackFrame113 } from '../kit/k113';

const CY = 1.75; // 틀 가운데선(두 기어가 물리는 높이)
const ZF = 0.2; // 기어·틀 가운데 평면
const YA = 2.03; // 위 기어 축 높이
const YB = 1.47; // 아래 기어 축 높이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM115(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 위 기어(구동)
  const gearA = spurGear(14, K115.module, { width: 0.1, spokes: 4, driver: true });
  gearA.name = 'gearA';
  gearA.position.set(0, YA, ZF);
  // 아래 기어
  const gearB = spurGear(14, K115.module, { width: 0.1, spokes: 4 });
  gearB.name = 'gearB';
  gearB.position.set(0, YB, ZF);
  g.add(gearA, gearB);

  g.add(shaftZ(0, YA, 0.3, 0.035), shaftZ(0, YB, 0.3, 0.035));

  // 고리 틀(이중 랙)
  const frame = rackFrame113(k115Frame());
  frame.name = 'frame';
  frame.position.set(0, CY, ZF);
  g.add(frame);

  // 막대 안내 2개(고정)
  g.add(barGuide113(-1.48, CY, ZF, 0.09, 0.1), barGuide113(1.48, CY, ZF, 0.09, 0.1));

  // 회전 화살표(실제 방향에 따라 기어마다 하나씩만 보임)
  const arrAccw = rotArrow(0.13, true);
  const arrAcw = rotArrow(0.13, false);
  const arrBcw = rotArrow(0.13, false);
  const arrBccw = rotArrow(0.13, true);
  for (const a of [arrAccw, arrAcw]) {
    a.position.set(0, YA, 0.33);
    g.add(a);
  }
  for (const a of [arrBcw, arrBccw]) {
    a.position.set(0, YB, 0.33);
    g.add(a);
  }

  const tagFrame = tag('이중 랙 틀', v(0.9, 2.8, 0.3));
  g.add(
    tag('위 기어(구동)', v(-0.9, 2.8, 0.3)),
    tag('아래 기어(반대로 돎)', v(0.9, 0.72, 0.3)),
    tagFrame,
    tag('막대 안내', v(-1.48, 1.3, 0.35))
  );

  const place = (): void => {
    const s = k115State(theta);
    gearA.rotation.z = s.phiA;
    gearB.rotation.z = s.phiB;
    frame.position.x = s.x;
    arrAccw.visible = s.ccw;
    arrAcw.visible = !s.ccw;
    arrBcw.visible = s.ccw;
    arrBccw.visible = !s.ccw;
    tagFrame.position.x = s.x + 0.9;
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.9, 6.4], target: [0, 1.7, 0.2] },
    notes: () => {
      const s = k115State(theta);
      return [
        { label: '두 기어', value: '이 14개씩, 크기 같음 → 속도비 1 : −1' },
        { label: '틀 이동', value: `${Math.round(s.x * 1000)} mm` },
        { label: '위 랙·아래 랙', value: '같은 방향, 같은 속도' },
        { label: '위 기어 각', value: `${Math.round((s.phiA * 180) / Math.PI)}°` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      place();
    }
  };
}
