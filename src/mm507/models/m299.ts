// 299 옛 시계 탈진기(날개형) — 눕힌 왕관 바퀴 위를 지나는 버지의 앞·뒤 팔레트가 앞쪽 이와 뒤쪽 이를 번갈아 막는다(버지 축 방향에서 본 298).
// 날개 각만 시간표(35°·sin πt), 바퀴 각은 이 끝 모서리와 팔레트 닿는 면의 접촉에서 계산. 설계표 docs/mm507-sheets/299.md · 부품·접촉은 kit/k299
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { D2R } from '../kit/k298';
import { K299, crown299, frame299, state299, verge299 } from '../kit/k299';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM299(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  const frame = frame299();
  const crown = crown299();
  crown.position.set(K299.CROWN[0], 0, K299.CROWN[1]);
  const verge = verge299();
  verge.position.set(K299.VERGE[0], K299.VERGE[1], 0);
  g.add(...frame.children, crown, verge);

  const arrow = rotArrow(0.2, true);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0.55, 1.1, 0.25);
  g.add(arrow);

  g.add(
    leaderTo(tag('왕관 바퀴', v(-0.9, 0.6, 0.3)), 'crownWheel'),
    leaderTo(tag('버지', v(0.95, 0.62, 0.3)), 'verge'),
    leaderTo(tag('앞 팔레트', v(0.9, 2.25, 0.3)), 'palletFront'),
    leaderTo(tag('뒤 팔레트', v(-0.95, 2.25, 0.0)), 'palletBack'),
    leaderTo(tag('날개', v(-1.25, 1.8, 0.0)), 'foliot')
  );

  const wheelMat = crown.userData.wheelMat as THREE.MeshStandardMaterial;
  const mF = verge.userData.matF as THREE.MeshStandardMaterial;
  const mB = verge.userData.matB as THREE.MeshStandardMaterial;
  const phi0 = state299(0).phi;

  let t = 0;
  let st = state299(0);
  const place = (): void => {
    st = state299(t);
    verge.rotation.z = st.theta * D2R;
    crown.rotation.y = st.phi * D2R;
    mF.emissive.setHex(st.holder === 'front' ? 0xb36b00 : 0x000000);
    mB.emissive.setHex(st.holder === 'back' ? 0xb36b00 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0.3, 2.1, 3.3], target: [0, 1.35, 0.3] },
    notes: () => [
      { label: '날개 각', value: st.theta.toFixed(1) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'front' ? '앞 — 오른쪽으로 가는 앞쪽 이를 막음' : '뒤 — 왼쪽으로 가는 뒤쪽 이를 막음' },
      { label: '나아간 이 수', value: ((st.phi - phi0) / 24).toFixed(2) },
      { label: '메모', value: '판화의 X 꼴은 앞쪽 이와 뒤쪽 이가 겹쳐 보이는 것 — 둘은 반대로 움직인다' },
      { label: '메모', value: '날개가 놓인 뒤에도 더 돌면 팔레트가 이를 뒤로 민다 — 버지 탈진기의 되튐(8.5°)' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
