// 295 원통 탈진기(확대, 정면) — 294 와 같은 기구·같은 접촉 계산을 1.6 배로, 원통 축 방향에서 본다. 원통 하나가 돌고 쐐기 이들이 차례로 지나간다.
// 설계표 docs/mm507-sheets/295.md · 부품·접촉 계산은 kit/k295(공용 부분은 k294)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R } from '../kit/k294';
import { K295, cylWheel295, cylinder295, state295 } from '../kit/k295';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K295;

export default function buildM295(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.WC;
  const [cx, cy] = K.C;

  const wheel = cylWheel295();
  wheel.position.set(wx, wy, 0);
  const cyl = cylinder295();
  cyl.position.set(cx, cy, 0);
  g.add(shaftZ(wx, wy, 0.147, 0.04), shaftZ(cx, cy, -0.084, 0.04), wheel, cyl);

  const arrow = rotArrow(0.3, false);
  arrow.position.set(0, 2.25, 0.15);
  g.add(arrow);

  g.add(
    leaderTo(tag('A 입술', v(-0.7, 3.55, 0.3)), 'lipA'),
    leaderTo(tag('쐐기 이', v(-0.45, 2.45, 0.3)), 'wheelTeeth'),
    leaderTo(tag('B 입술', v(0.7, 3.55, 0.3)), 'lipB')
  );

  const teethMat = wheel.userData.teethMat as THREE.MeshStandardMaterial;
  const mA = cyl.userData.matA as THREE.MeshPhysicalMaterial;
  const mB = cyl.userData.matB as THREE.MeshPhysicalMaterial;

  let t = 0;
  let st = state295(0);
  const place = (): void => {
    st = state295(t);
    wheel.rotation.z = st.phi * D2R;
    cyl.rotation.z = st.psi * D2R;
    mA.emissive.setHex(st.phase === 'in1' ? 0x803000 : 0x000000);
    mB.emissive.setHex(st.phase === 'out2' ? 0x103070 : 0x000000);
    teethMat.emissive.setHex(st.phase === 'in' ? 0x332200 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0, 3.0, 2.4], target: [0, 2.95, 0] },
    notes: () => [
      { label: '원통 각', value: st.psi.toFixed(0) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '쐐기 이', value: st.phase === 'in' ? '원통 안쪽 벽에(판화 c)' : st.phase === 'out' ? '원통 바깥에(판화 a)' : '입술을 밀며 지나감(충격)' },
      { label: '입술', value: 'A = 들어갈 때 미는 입술, B = 나올 때 미는 입술' },
      { label: '메모', value: '판화는 원통이 바퀴에 대해 차지하는 여러 자리를 겹쳐 그렸다 — 여기서는 원통 하나가 돌고 쐐기들이 지나가며 그 자리들을 차례로 보인다' },
      { label: '메모', value: '294 와 같은 기구를 축 방향에서 크게 본 것' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
