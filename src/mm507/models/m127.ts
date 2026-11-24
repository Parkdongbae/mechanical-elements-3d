// 127 공기 펌프용 랙과 피니언 — 레버를 흔들면 같은 축의 피니언이 돌고 양옆 랙이 반대로 오르내린다 (판화 127번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { K127, backRoller127, handLever127, pumpCylinder127, pump127, rack127, rp127, stemOff127 } from '../kit/k125';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM127(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [CX, CY] = K127.C;
  const rp = rp127();
  const so = stemOff127();

  g.add(displayStand());

  const pinion = spurGear(K127.z, K127.m, { width: K127.gearW, spokes: 4, driver: true });
  pinion.name = 'pinion';
  pinion.position.set(CX, CY, K127.ZG);
  g.add(pinion);

  g.add(shaftZ(CX, CY, 0.13, 0.054));

  const lever = handLever127();
  lever.name = 'lever';
  lever.position.set(CX, CY, K127.ZLv);
  g.add(lever);

  const rackL = rack127(1);
  rackL.name = 'rackL';
  g.add(rackL);
  const rackR = rack127(-1);
  rackR.name = 'rackR';
  g.add(rackR);

  // 랙 등받이 롤러 4개(고정)
  for (const sx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const r = backRoller127(0.3);
      r.position.set(sx * (rp + 0.256), CY + dy * K127.rollerDy, K127.ZG);
      g.add(r);
    }
  }

  // 펌프 실린더 2개(고정)
  for (const sx of [-1, 1]) {
    const c = pumpCylinder127();
    c.name = sx < 0 ? 'cylL' : 'cylR';
    c.position.set(sx * (rp + so), K127.cylY0, K127.ZG);
    g.add(c);
  }

  // 회전 화살표 2개를 겹쳐 두고 지금 도는 방향 것만 보인다
  const arrCcw = rotArrow(0.2, true);
  const arrCw = rotArrow(0.2, false);
  arrCcw.position.set(CX, CY, 0.2);
  arrCw.position.set(CX, CY, 0.2);
  g.add(arrCcw, arrCw);

  const leverTag = tag('레버', v(-1.3, CY + 0.25, 0.3));
  const rackTag = tag('랙과 피스톤', v(-1.3, CY - 1.05, 0.3));
  g.add(tag('피니언 (18잇수)', v(1.5, 3.05, 0.35)), tag('펌프 실린더', v(1.4, 0.5, 0.3)), leverTag, rackTag);

  const apply = (): { phi: number; yL: number } => {
    const { phi, yL, yR } = pump127(theta);
    pinion.rotation.z = phi;
    lever.rotation.z = phi;
    rackL.position.set(-rp, yL, K127.ZG);
    rackR.position.set(rp, yR, K127.ZG);
    leverTag.position.set(-1.3 * Math.cos(phi), CY - 1.3 * Math.sin(phi) + 0.25, 0.3);
    rackTag.position.set(-1.3, yL - 1.05, 0.3);
    return { phi, yL };
  };
  const setArrows = (speed: number): void => {
    const d = Math.cos(theta - K127.theta0 - 0.944) * speed;
    arrCcw.visible = d > 0;
    arrCw.visible = d <= 0;
  };
  apply();
  setArrows(1);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.65, 0] },
    notes: () => {
      const { yL } = pump127(theta);
      const hL = Math.round(((yL - 1.788) / 0.424) * 100);
      return [
        { label: '레버', value: '±30° 흔들림 → 랙 행정 0.42 (= 피치 반지름 0.405 × 각)' },
        { label: '왼쪽 랙', value: `높이 ${hL} %` },
        { label: '오른쪽 랙', value: `높이 ${100 - hL} % (늘 반대)` },
        { label: '지렛대 비', value: '손잡이 1.3 : 피치 반지름 0.405 → 손 3.2 움직일 때 랙 1' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
      setArrows(speed);
    }
  };
}
