// 290 또 다른 추 탈진기 — 고리 틀 진자의 팔레트 A·B 가 갈고리 이 7 바퀴를 번갈아 막고 놓는다. 설계표 docs/mm507-sheets/290.md · 부품·식은 kit/k290
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K290, escWheel290, ringFrame290, state290, suspension290 } from '../kit/k290';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K290;

export default function buildM290(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [dx, dy] = K.D;
  const [cx, cy] = K.C;

  const wheel = escWheel290();
  wheel.position.set(dx, dy, 0);
  const ring = ringFrame290();
  ring.position.set(cx, cy, 0);
  g.add(shaftZ(dx, dy, 0.12, 0.04), suspension290(), wheel, ring);

  const arrow = rotArrow(0.25, false);
  arrow.position.set(dx, dy, 0.25);
  g.add(arrow);

  g.add(
    leaderTo(tag('D 바퀴', v(-1.45, 0.55, 0.3)), 'escapeWheel'),
    leaderTo(tag('A 팔레트', v(1.45, 2.55, 0.3)), 'palletA'),
    leaderTo(tag('B 팔레트', v(-1.45, 2.55, 0.3)), 'palletB'),
    leaderTo(tag('고리 틀', v(1.45, 0.55, 0.3)), 'ringFrame'),
    leaderTo(tag('C 매단 곳', v(-1.1, 3.05, 0.3)), 'suspension')
  );

  const wMat = wheel.userData.mat as THREE.MeshStandardMaterial;
  const mA = ring.userData.matA as THREE.MeshStandardMaterial;
  const mB = ring.userData.matB as THREE.MeshStandardMaterial;
  const phi0 = state290(0).phi;

  let t = 0;
  let st = state290(0);
  const place = (): void => {
    st = state290(t);
    wheel.rotation.z = st.phi * D2R;
    ring.rotation.z = st.psi * D2R;
    mA.emissive.setHex(st.holder === 'A' ? 0xb36b00 : 0x000000);
    mB.emissive.setHex(st.holder === 'B' ? 0xb36b00 : 0x000000);
    wMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.75, 5.6], target: [0, 1.75, 0] },
    notes: () => [
      { label: '진자 각', value: st.psi.toFixed(1) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'A' ? 'A — 위에서 내려오는 이를 막음' : 'B — 아래에서 올라오는 이를 막음' },
      { label: '나아간 이 수', value: (-(st.phi - phi0) / K.PITCH).toFixed(2) },
      { label: '메모', value: '고리 틀이 C 를 중심으로 흔들려서 팔레트 면이 조금 오르내린다 — 그래서 이가 걸려 있는 동안에도 바퀴가 3.5° 쯤 앞뒤로 움직인다' },
      { label: '메모', value: '이 수가 홀수라 마주 보는 두 팔레트가 반 칸 어긋나 번갈아 문다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
