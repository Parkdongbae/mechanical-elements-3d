// 294 원통 탈진기(사시) — 반 껍질로 깎인 원통에 쐐기 이가 바깥·안에 번갈아 얹히고, 입술을 밀며 드나든다. 한 번 오갈 때 충격 두 번, 바퀴는 이 하나(30°).
// 설계표 docs/mm507-sheets/294.md · 부품·접촉 계산은 kit/k294
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K294, cylWheel294, cylinder294, state294 } from '../kit/k294';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K294;

export default function buildM294(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.WC;
  const [cx, cy] = K.C;

  const wheel = cylWheel294();
  wheel.position.set(wx, wy, 0);
  const cyl = cylinder294();
  cyl.position.set(cx, cy, 0);
  g.add(shaftZ(wx, wy, 0.127, 0.04), shaftZ(cx, cy, -0.064, 0.04), wheel, cyl);

  const arrow = rotArrow(0.3, false);
  arrow.position.set(0.75, 1.3, 0.12);
  g.add(arrow);

  g.add(
    leaderTo(tag('원통', v(-0.95, 2.75, 0.3)), 'cylinder'),
    leaderTo(tag('쐐기 이', v(1.15, 2.7, 0.3)), 'wheelTeeth'),
    leaderTo(tag('탈진 바퀴', v(-1.65, 0.65, 0.3)), 'escapeWheel'),
    leaderTo(tag('밸런스', v(-1.15, 3.2, -0.1)), 'balanceRing')
  );

  const teethMat = wheel.userData.teethMat as THREE.MeshStandardMaterial;
  const mA = cyl.userData.matA as THREE.MeshPhysicalMaterial;
  const mB = cyl.userData.matB as THREE.MeshPhysicalMaterial;
  const phi0 = 0.8837;

  let t = 0;
  let st = state294(0);
  const place = (): void => {
    st = state294(t);
    wheel.rotation.z = st.phi * D2R;
    cyl.rotation.z = st.psi * D2R;
    mA.emissive.setHex(st.phase === 'in1' ? 0x803000 : 0x000000);
    mB.emissive.setHex(st.phase === 'out2' ? 0x103070 : 0x000000);
    teethMat.emissive.setHex(st.phase === 'in' ? 0x332200 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [1.3, 2.9, 4.9], target: [0, 1.78, 0.05] },
    notes: () => [
      { label: '원통 각', value: st.psi.toFixed(0) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '쐐기 이', value: st.phase === 'in' ? '원통 안쪽 벽에 얹힘' : st.phase === 'out' ? '원통 바깥에 얹힘' : '입술을 밀며 지나감(충격)' },
      { label: '나아간 이 수', value: (-(st.phi - phi0) / 30).toFixed(2) },
      { label: '메모', value: '원통 가운데가 반쯤 깎여, 쐐기 이가 바깥과 안에 번갈아 얹힌다 — 한 번 오갈 때 충격 두 번' },
      { label: '메모', value: '줄기가 지나는 높이는 더 깊이 깎인 통로(90°만 남음)' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
