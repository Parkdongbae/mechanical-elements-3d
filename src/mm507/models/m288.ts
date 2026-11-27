// 288 되튐(리코일) 탈진기 — 289 와 같은 바퀴·닻·진자, 잠금면만 비스듬한 평면. 이가 잡힌 뒤 진자가 더 가면 면이 이를 밀어 바퀴가 조금 뒤로 되튄다.
// 설계표 docs/mm507-sheets/288.md · 부품·접촉 계산은 kit/k288
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K288, anchor288, escWheel288, state288 } from '../kit/k288';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K288;

export default function buildM288(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.W;
  const [ax, ay] = K.A_AXIS;

  const wheel = escWheel288();
  wheel.position.set(wx, wy, 0);
  const anchor = anchor288();
  anchor.position.set(ax, ay, 0);
  g.add(shaftZ(wx, wy, 0.127, 0.04), shaftZ(ax, ay, 0.237, 0.04), wheel, anchor);

  const arrow = rotArrow(0.3, true);
  arrow.position.set(-1.05, 1.3, 0.1);
  g.add(arrow);

  g.add(
    leaderTo(tag('A 탈진바퀴', v(-1.4, 1.0, 0.3)), 'escapeWheel'),
    leaderTo(tag('H 팔레트', v(-1.4, 2.7, 0.3)), 'palletH'),
    leaderTo(tag('K 팔레트', v(1.4, 2.7, 0.3)), 'palletK'),
    leaderTo(tag('L 닻', v(1.0, 3.15, 0.3)), 'anchorFrame'),
    leaderTo(tag('진자', v(0.95, 0.55, 0.3)), 'pendulumBob')
  );

  const wheelMat = wheel.userData.wheelMat as THREE.MeshStandardMaterial;
  const markMat = wheel.userData.markMat as THREE.MeshStandardMaterial;
  const mK = anchor.userData.matK as THREE.MeshStandardMaterial;
  const mH = anchor.userData.matH as THREE.MeshStandardMaterial;
  const phi0 = state288(0).phi;

  let t = 0;
  let st = state288(0);
  const place = (): void => {
    st = state288(t);
    wheel.rotation.z = st.phi * D2R;
    anchor.rotation.z = st.psi * D2R;
    mK.emissive.setHex(st.holder === 'K' ? 0xb36b00 : 0x000000);
    mH.emissive.setHex(st.holder === 'H' ? 0xb36b00 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
    markMat.emissive.setHex(st.recoil ? 0x802000 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.8, 5.2], target: [0, 1.8, 0] },
    notes: () => [
      { label: '진자 각', value: st.psi.toFixed(1) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(2) + '°' },
      { label: '바퀴', value: st.recoil ? '뒤로 되튐' : st.face === 'lock' ? '앞으로 따라옴' : '나아감(충격)' },
      { label: '나아간 이 수', value: ((st.phi - phi0) / 12).toFixed(2) },
      { label: '원리', value: '잠금면이 축 a 를 중심으로 한 원호가 아니라 비스듬한 평면이라, 이가 잡힌 뒤 진자가 더 가면 면이 이를 밀어 바퀴가 1.6~1.9° 뒤로 돈다 — 그래서 되튐 탈진기' },
      { label: '289 와 비교', value: '289 와 바퀴·닻·진자는 같고 잠금면 모양만 다르다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
