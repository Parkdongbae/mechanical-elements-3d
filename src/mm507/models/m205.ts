// 205 두 이빨 피니언 — 피니언은 실은 캠 두 장(앞·뒤 층). 바퀴 앞면·뒷면에 반 칸 엇갈린 이 줄 둘이 있어
// 앞 캠은 앞 줄 이를, 뒤 캠은 뒤 줄 이를 번갈아 밀어 피니언 12바퀴에 바퀴가 1바퀴 돈다 (판화 205번)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K205, pinion205, state205, wheel205 } from '../kit/k205';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM205(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  const [wx, wy] = K205.W;
  const [px, py] = K205.P;

  const wheel = wheel205();
  wheel.position.set(wx, wy, 0);
  g.add(wheel, shaftZ(wx, wy, 0.32, 0.05));

  const pinion = pinion205();
  pinion.position.set(px, py, 0);
  const pShaft = shaftZ(px, py, 0.3, 0.045);
  g.add(pinion, pShaft);

  const arrP = rotArrow(0.3, true);
  arrP.position.set(px, py, 0.44);
  const arrW = rotArrow(0.5, false);
  arrW.position.set(wx, wy, 0.34);
  g.add(arrP, arrW);

  const glowF = pinion.getObjectByName('glowF')!;
  const glowB = pinion.getObjectByName('glowB')!;

  g.add(
    leaderTo(tag('큰 바퀴', v(1.65, 3.05, 0.6)), 'wheelPlate'),
    leaderTo(tag('앞 줄 이(긴 막대)', v(1.75, 2.1, 0.6)), 'toothF3'),
    leaderTo(tag('뒤 줄 이(반 칸 엇갈림)', v(-1.75, 2.1, 0.6)), 'toothB9'),
    leaderTo(tag('앞 캠', v(0.95, 0.3, 0.6)), 'camF'),
    leaderTo(tag('뒤 캠', v(-0.95, 0.3, 0.6)), 'camB')
  );

  let t = 0;
  let st = state205(0);
  const place = (): void => {
    st = state205(t);
    pinion.rotation.z = st.psi;
    pShaft.rotation.z = st.psi;
    wheel.rotation.z = st.thetaW;
    glowF.visible = st.front;
    glowB.visible = !st.front;
  };
  place();

  return {
    group: g,
    view: { pos: [1.3, 1.5, 5.9], target: [0, 1.45, 0.15] },
    notes: () => [
      { label: '피니언 바퀴 수', value: `${(st.psi / (Math.PI * 2)).toFixed(2)} 바퀴` },
      { label: '바퀴 각', value: `${(st.thetaW * DEG).toFixed(1)}°` },
      { label: '지금 미는 캠', value: st.front ? '앞 캠' : '뒤 캠' },
      { label: '속도비', value: '피니언 12바퀴에 바퀴 1바퀴(앞 12 + 뒤 12 이)' },
      { label: '원리', value: '캠 하나가 반 바퀴씩 이 하나를 밀고, 반 칸 엇갈린 다른 줄의 이를 다른 캠이 이어받는다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
