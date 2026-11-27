// 293 듀플렉스(이중) 탈진기 — 잠금 이가 밸런스 축 롤러 홈에서 걸리고, 면에 선 왕관 이가 팔레트 B 를 민다.
// 설계표 docs/mm507-sheets/293.md · 부품·접촉 계산은 kit/k293
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K293, balance293, duplexWheel293, state293 } from '../kit/k293';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K293;

export default function buildM293(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  const wheel = duplexWheel293();
  wheel.position.set(K.WC[0], K.WC[1], 0);
  const bal = balance293();
  bal.position.set(K.A[0], K.A[1], 0);
  g.add(shaftZ(K.WC[0], K.WC[1], 0.127, 0.04), shaftZ(K.A[0], K.A[1], 0.207, 0.04), wheel, bal);

  const a1 = rotArrow(0.3, false);
  a1.position.set(-0.7, 2.4, 0.2);
  const a2 = rotArrow(0.22, true);
  a2.position.set(0.32, 2.95, 0.2);
  g.add(a1, a2);

  g.add(
    leaderTo(tag('A 축(홈)', v(-1.2, 3.0, 0.3)), 'roller'),
    leaderTo(tag('B 충격 팔레트', v(1.3, 2.95, 0.3)), 'palletB'),
    leaderTo(tag('밸런스', v(1.25, 2.45, 0.3)), 'balanceRing'),
    leaderTo(tag('D 잠금 이', v(-1.4, 0.75, 0.3)), 'escapeWheel'),
    leaderTo(tag('a 왕관 이', v(1.4, 0.75, 0.3)), 'crownPins')
  );

  const wheelMat = wheel.userData.wheelMat as THREE.MeshStandardMaterial;
  const rollerMat = bal.userData.rollerMat as THREE.MeshStandardMaterial;
  const palletMat = bal.userData.palletMat as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state293(0);
  let cum = 0;
  const place = (): void => {
    st = state293(t);
    cum = -st.phi;
    wheel.rotation.z = st.phi * D2R;
    bal.rotation.z = st.psi * D2R;
    palletMat.emissive.setHex(st.holder === 'pallet' ? 0xb36b00 : 0x000000);
    rollerMat.emissive.setHex(st.holder === 'notch' ? 0x553300 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x332200 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.9, 5.4], target: [0, 1.9, 0] },
    notes: () => [
      { label: '밸런스 각', value: st.psi.toFixed(0) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '지금', value: st.holder === 'pallet' ? '왕관 이가 팔레트 B 를 밂(충격)' : st.holder === 'notch' ? '잠금 이가 축 홈에 빠짐' : '잠금 이가 롤러에 얹혀 기다림' },
      { label: '나아간 이 수', value: (cum / 30).toFixed(2) },
      { label: '원리', value: '가장자리 이(박차 바퀴)는 축의 홈에서 잠기고, 면에 선 왕관 이가 팔레트 B 를 민다 — 그래서 듀플렉스(이중)' },
      { label: '되돌이', value: '밸런스가 돌아올 때는 잠금 이가 홈에 잠깐 빠졌다가 밀려 나와 바퀴가 나아가지 않는다 — 충격은 한 번 오갈 때 한 번' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
