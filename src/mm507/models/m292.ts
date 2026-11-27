// 292 스터드(핀 바퀴) 탈진기 — 바퀴 테 앞면·뒷면에 핀이 번갈아 박혀 있고, 닻의 앞 팔레트 B·뒤 팔레트 A 가 번갈아 핀을 받친다.
// 잠금면이 닻 축 F 를 중심으로 한 원호라 받친 동안 바퀴는 완전히 멈춘다(정지 탈진기). 설계표 docs/mm507-sheets/292.md · 부품·접촉 계산은 kit/k292
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K292, anchor292, pinWheel292, state292 } from '../kit/k292';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K292;

export default function buildM292(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.WC;
  const [fx, fy] = K.F;

  const wheel = pinWheel292();
  wheel.position.set(wx, wy, 0);
  const anchor = anchor292();
  anchor.position.set(fx, fy, 0);
  g.add(shaftZ(wx, wy, 0.127, 0.04), shaftZ(fx, fy, 0.237, 0.04), wheel, anchor);

  const arrow = rotArrow(0.3, false);
  arrow.position.set(0.75, 1.1, 0.15);
  g.add(arrow);

  g.add(
    leaderTo(tag('B 앞 팔레트', v(1.3, 2.15, 0.3)), 'palletB'),
    leaderTo(tag('A 뒤 팔레트', v(1.3, 1.3, 0.3)), 'palletA'),
    leaderTo(tag('스터드(핀)', v(1.25, 0.75, 0.3)), 'frontStuds'),
    leaderTo(tag('F 닻 축', v(0.75, 3.05, 0.3)), 'anchorHub'),
    leaderTo(tag('탈진 바퀴', v(-1.45, 2.7, 0.3)), 'escapeWheel'),
    leaderTo(tag('진자', v(0.55, 0.35, 0.3)), 'pendulumBob')
  );

  const mB = anchor.userData.matB as THREE.MeshStandardMaterial;
  const mA = anchor.userData.matA as THREE.MeshStandardMaterial;
  const bobMat = anchor.userData.bobMat as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state292(0);
  const place = (): void => {
    st = state292(t);
    wheel.rotation.z = st.phi * D2R;
    anchor.rotation.z = st.psi * D2R;
    mB.emissive.setHex(st.holder === 'B' ? 0xb36b00 : 0x000000);
    mA.emissive.setHex(st.holder === 'A' ? 0xb36b00 : 0x000000);
    bobMat.emissive.setHex(st.face === 'impulse' ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [-0.1, 1.65, 5.6], target: [-0.1, 1.65, 0] },
    notes: () => [
      { label: '진자 각', value: st.psi.toFixed(2) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(2) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'B' ? 'B — 앞 핀이 앞 팔레트에' : 'A — 뒷 핀이 뒤 팔레트에' },
      { label: '나아간 핀 칸', value: (-st.phi / 12).toFixed(2) },
      { label: '원리', value: '팔레트 윗면이 F 를 중심으로 한 호라서 핀이 얹혀 있는 동안 바퀴가 꼼짝 않는다 — 정지(데드비트) 탈진기' },
      { label: '배치', value: '앞 핀은 앞 팔레트 B 에만, 뒷 핀은 뒤 팔레트 A 에만 얹힌다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
