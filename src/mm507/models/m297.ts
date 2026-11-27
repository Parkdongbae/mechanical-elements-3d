// 297 랜턴 바퀴 탈진기 — 팔 A(진자)가 흔들리며 바깥 팔레트 B 와 안쪽 팔레트 C 가 핀을 번갈아 막는다. 설계표 docs/mm507-sheets/297.md · 부품·접촉 계산은 kit/k297
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K297, arm297, pinWheel297, state297 } from '../kit/k297';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K297;

export default function buildM297(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.WC;
  const [px, py] = K.P;

  const wheel = pinWheel297();
  wheel.position.set(wx, wy, 0);
  const arm = arm297();
  arm.position.set(px, py, 0);
  g.add(shaftZ(wx, wy, 0.1, 0.045), shaftZ(px, py, 0.23, 0.03), wheel, arm);

  const arrow = rotArrow(0.22, true);
  arrow.position.set(-1.35, 1.55, 0.15);
  g.add(arrow);

  g.add(
    leaderTo(tag('랜턴 바퀴', v(-1.55, 0.5, 0.3)), 'pinWheel'),
    leaderTo(tag('A 팔', v(1.35, 2.75, 0.3)), 'pendulumArm'),
    leaderTo(tag('B 팔레트', v(1.65, 2.2, 0.3)), 'palletB'),
    leaderTo(tag('C 팔레트', v(1.65, 1.45, 0.3)), 'palletC'),
    leaderTo(tag('핀', v(-1.55, 2.6, 0.3)), 'pins')
  );

  const wheelMat = wheel.userData.wheelMat as THREE.MeshStandardMaterial;
  const mB = arm.userData.matB as THREE.MeshStandardMaterial;
  const mC = arm.userData.matC as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state297(0);
  const place = (): void => {
    st = state297(t);
    wheel.rotation.z = st.phi * D2R;
    arm.rotation.z = st.psi * D2R;
    mB.emissive.setHex(st.holder === 'B' ? 0xb36b00 : 0x000000);
    mC.emissive.setHex(st.holder === 'C' ? 0xb36b00 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [-0.1, 1.55, 5.6], target: [-0.1, 1.55, 0] },
    notes: () => [
      { label: '팔 각', value: st.psi.toFixed(1) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'B' ? 'B — 핀 원 바깥에서 막음' : 'C — 핀 원 안쪽에서 막음' },
      { label: '나아간 핀 수', value: ((st.phi - K.EXPECT[0]![2]) / K.PITCH).toFixed(2) },
      { label: '메모', value: '팔 A 가 P 를 중심으로 돌아 팔레트 면이 핀에 대해 비스듬히 움직인다 — 그래서 핀이 걸린 동안에도 바퀴가 조금 앞뒤로 움직인다' },
      { label: '메모', value: '팔이 한 번 오갈 때 바퀴는 핀 하나(45°)만큼 돈다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
