// 068 한 톱니 간헐 기어 — 톱니 하나 달린 바퀴 B 가 한 바퀴 돌 때마다 홈 10개 바퀴 C 를 한 칸(36°) 돌린다 (판화 68번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { oneToothAngleC, oneToothWheel, slotWheel, ONE_TOOTH } from '../kit/k067';

const CY = 1.75; // 두 축 높이
const BX = -0.69;
const CX = 0.69;
const WZ = 0.12; // 바퀴 가운데 깊이
const PHASE = 4.561; // t=1 에서 θe mod 2π = 353° (판화 자세: 잠김)
const PUSH0 = (28 * Math.PI) / 180;
const PUSH1 = (72 * Math.PI) / 180;
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM068(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const wb = oneToothWheel(0.14);
  wb.name = 'wheelB';
  wb.position.set(BX, CY, WZ);
  const wc = slotWheel(0.14);
  wc.name = 'wheelC';
  wc.position.set(CX, CY, WZ);
  g.add(wb, wc);

  g.add(shaftZ(BX, CY, 0.34, 0.07), shaftZ(CX, CY, 0.34, 0.07));

  const ab = rotArrow(0.5, false);
  ab.position.set(BX, CY, 0.22);
  const ac = rotArrow(0.5, true);
  ac.position.set(CX, CY, 0.22);
  g.add(ab, ac);

  g.add(
    tag('구동 바퀴 B(톱니 A 하나)', v(-0.95, 2.7, 0.3)),
    tag('피동 바퀴 C(홈 10개)', v(1.0, 2.7, 0.3)),
    tag('톱니 A', v(-0.05, 2.5, 0.3)),
    tag('오목한 둘레에 B 가 맞아 잠금', v(0.0, 0.8, 0.3))
  );

  const apply = (): void => {
    const te = theta + PHASE;
    wb.rotation.z = -te;
    wc.rotation.z = oneToothAngleC(te);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.9, 5.6], target: [0, 1.75, 0.12] },
    notes: () => {
      const te = theta + PHASE;
      const a = ((te % TAU) + TAU) % TAU;
      const pushing = a > PUSH0 && a < PUSH1;
      const steps = Math.floor((oneToothAngleC(te) / TAU) * ONE_TOOTH.n + 1e-6);
      return [
        { label: '속도비', value: 'B 10바퀴에 C 1바퀴(홈 10개)' },
        { label: '지금 상태', value: pushing ? '밀기(C 회전 중)' : '잠김' },
        { label: 'C 가 돈 칸 수', value: `${steps} 칸` },
        { label: '구동 B 회전수', value: `${(te / TAU).toFixed(2)} 바퀴` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
