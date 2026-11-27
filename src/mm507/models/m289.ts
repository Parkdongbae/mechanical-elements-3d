// 289 데드비트(정지) 탈진기 — 닻의 두 팔레트가 탈진 바퀴의 이를 번갈아 잡는다. 잠금면이 닻 축 a 를 중심으로 한 원호라 잡힌 동안 바퀴는 완전히 멈춘다.
// 설계표 docs/mm507-sheets/289.md · 부품·접촉 계산은 kit/k289
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K289, anchor289, escWheel289, state289 } from '../kit/k289';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K289;

export default function buildM289(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.W;
  const [ax, ay] = K.A_AXIS;

  const wheel = escWheel289();
  wheel.position.set(wx, wy, 0);
  const anchor = anchor289();
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
  const mK = anchor.userData.matK as THREE.MeshStandardMaterial;
  const mH = anchor.userData.matH as THREE.MeshStandardMaterial;
  const phi0 = state289(0).phi;

  let t = 0;
  let st = state289(0);
  const place = (): void => {
    st = state289(t);
    wheel.rotation.z = st.phi * D2R;
    anchor.rotation.z = st.psi * D2R;
    mK.emissive.setHex(st.holder === 'K' ? 0xb36b00 : 0x000000);
    mH.emissive.setHex(st.holder === 'H' ? 0xb36b00 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.8, 5.2], target: [0, 1.8, 0] },
    notes: () => [
      { label: '진자 각', value: st.psi.toFixed(1) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(2) + '°' },
      { label: '닿은 면', value: st.face === 'lock' ? st.holder + ' 원호 — 바퀴 멈춤' : st.holder + ' 충격면 — 바퀴가 진자를 밂' },
      { label: '나아간 이 수', value: ((st.phi - phi0) / 12).toFixed(2) },
      { label: '원리', value: '잠금면이 축 a 를 중심으로 한 원호라서, 닻이 더 흔들려도 이 끝과 a 사이 거리가 같다 — 그래서 바퀴가 꼼짝하지 않는다(정지·데드비트)' },
      { label: '배치', value: '판화 289 는 팔레트가 바퀴를 크게 감싸지만, 모델은 288 과 같은 90° 벌림으로 만들었다 — 그래야 이가 a 를 향해 곧게 움직여 원호 면 위에서 멈출 수 있다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
