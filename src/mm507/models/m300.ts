// 300 쌍바퀴 탈진기(앞모습) — 같은 축의 탈진 바퀴 둘(반 칸 어긋남)을 가로축 팔레트가 번갈아 막고 놓는다. 301(옆모습)도 같은 키트.
// 설계표 docs/mm507-sheets/300.md · 부품·접촉 계산은 kit/k300
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K300, axlePosts300, escWheels300, pallet300, state300 } from '../kit/k300';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K300;

export default function buildM300(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.WC;

  const wheels = escWheels300();
  wheels.position.set(wx, wy, 0);
  const pallet = pallet300();
  g.add(shaftZ(wx, wy, 0.33, 0.04), axlePosts300(), wheels, pallet);

  const arrow = rotArrow(0.22, true);
  arrow.position.set(-0.75, 2.45, 0.32);
  g.add(arrow);

  g.add(
    leaderTo(tag('앞 바퀴', v(-1.25, 2.45, 0.1)), 'frontWheel'),
    leaderTo(tag('뒤 바퀴', v(1.6, 2.55, -0.1)), 'backWheel'),
    leaderTo(tag('팔레트', v(-1.25, 0.6, 0.2)), 'pallet'),
    leaderTo(tag('팔레트 축', v(-1.3, 1.65, -0.25)), 'palletAxle'),
    leaderTo(tag('진자', v(1.75, 0.7, -0.1)), 'pendulumRod')
  );

  const mF = wheels.userData.matFront as THREE.MeshStandardMaterial;
  const mB = wheels.userData.matBack as THREE.MeshStandardMaterial;
  const mP = pallet.userData.matPallet as THREE.MeshStandardMaterial;
  const phi0 = state300(0).phi;

  let t = 0;
  let st = state300(0);
  const place = (): void => {
    st = state300(t);
    wheels.rotation.z = st.phi * D2R;
    pallet.rotation.x = -st.psi * D2R;
    mF.emissive.setHex(st.holder === 'front' ? 0x553300 : 0x000000);
    mB.emissive.setHex(st.holder === 'back' ? 0x553300 : 0x000000);
    mP.emissive.setHex(st.justDropped ? 0xb36b00 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [-2.0, 2.15, 4.3], target: [0.1, 1.55, 0.1] },
    notes: () => [
      { label: '진자 각', value: st.psi.toFixed(1) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '걸린 바퀴', value: st.holder === 'front' ? '앞 바퀴(팔레트 앞쪽이 올라감)' : '뒤 바퀴(팔레트 뒤쪽이 올라감)' },
      { label: '나아간 이 수', value: ((st.phi - phi0) / K.PITCH).toFixed(2) },
      { label: '메모', value: '뒤 바퀴의 이는 앞 바퀴 이 사이(반 칸)에 있다 — 팔레트가 앞으로 기울면 앞 바퀴, 뒤로 기울면 뒤 바퀴의 이를 막는다' },
      { label: '메모', value: '팔레트 왼쪽 면이 진자 축과 나란해 이가 걸린 동안 바퀴는 완전히 멈춘다 — 충격은 윗모서리 비탈에서' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
