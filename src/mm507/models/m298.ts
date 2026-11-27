// 298 옛 회중시계 탈진기(왕관 바퀴·버지) — 가로축 왕관 바퀴의 톱니 앞을 세로 굴대(버지)가 지나고, 버지의 두 깃발 팔레트가 맨 위·맨 아래 이를 번갈아 막는다.
// 균형 바퀴 각만 시간표(30°·sin πt), 왕관 바퀴 각은 이 끝 모서리와 팔레트 닿는 면의 접촉에서 계산. 설계표 docs/mm507-sheets/298.md · 부품·접촉은 kit/k298
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { D2R, K298, crown298, frame298, state298, verge298 } from '../kit/k298';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM298(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  const frame = frame298();
  const crown = crown298();
  crown.position.set(...K298.CROWN);
  const verge = verge298();
  verge.position.set(K298.VERGE[0], 0, K298.VERGE[1]);
  g.add(...frame.children, crown, verge); // 받침 묶음은 풀어서 넣는다(큰 묶음 상자가 이름표 자리를 덮지 않게)
  const spin = frame.userData.wormSpin as THREE.Group;

  // 화살표: 웜 휠(반시계) · 왕관 바퀴(+x 쪽에서 볼 때 반시계)
  const arrowW = rotArrow(0.25, true);
  arrowW.position.set(-0.85, 0.93, 0.36);
  const arrowC = rotArrow(0.2, true);
  arrowC.rotation.y = Math.PI / 2;
  arrowC.position.set(0.2, 1.55, 0.27);
  g.add(arrowW, arrowC);

  g.add(
    leaderTo(tag('C 균형 바퀴', v(-0.85, 3.0, 0.0)), 'balanceWheel'),
    leaderTo(tag('왕관 바퀴', v(-1.1, 2.35, 0.1)), 'crownWheel'),
    leaderTo(tag('버지', v(1.6, 1.55, -0.2)), 'verge'),
    leaderTo(tag('위 팔레트', v(1.45, 2.25, -0.25)), 'palletUpper'),
    leaderTo(tag('아래 팔레트', v(1.35, 0.7, 0.0)), 'palletLower'),
    leaderTo(tag('웜 휠', v(-1.9, 0.6, 0.1)), 'wormWheel')
  );

  const wheelMat = crown.userData.wheelMat as THREE.MeshStandardMaterial;
  const mU = verge.userData.matU as THREE.MeshStandardMaterial;
  const mL = verge.userData.matL as THREE.MeshStandardMaterial;
  const phi0 = state298(0).phi;

  let t = 0;
  let st = state298(0);
  const place = (): void => {
    st = state298(t);
    verge.rotation.y = st.theta * D2R;
    crown.rotation.x = st.phi * D2R;
    spin.rotation.z = (st.phi / 20) * D2R - Math.PI / 20;
    mU.emissive.setHex(st.holder === 'upper' ? 0xb36b00 : 0x000000);
    mL.emissive.setHex(st.holder === 'lower' ? 0xb36b00 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [1.2, 2.9, 5.0], target: [-0.15, 1.65, 0.25] },
    notes: () => [
      { label: '균형 바퀴 각', value: st.theta.toFixed(1) + '°' },
      { label: '왕관 바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'upper' ? '위 — 맨 위 이(앞으로 감)를 막음' : '아래 — 맨 아래 이(뒤로 감)를 막음' },
      { label: '나아간 이 수', value: ((st.phi - phi0) / 24).toFixed(2) },
      { label: '메모', value: '맨 위 이와 맨 아래 이는 반대로 움직인다 — 그래서 100° 벌어진 두 팔레트가 번갈아 막는다(이 수가 홀수라 위아래가 반 칸 어긋남)' },
      { label: '메모', value: '균형 바퀴가 놓인 뒤에도 더 돌면 팔레트가 이를 뒤로 민다 — 버지 탈진기의 되튐' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
