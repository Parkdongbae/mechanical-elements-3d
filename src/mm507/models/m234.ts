// 234 버지 탈진기 — 스핀들 S 가 흔들리며 두 팔레트 A 가 크라운 휠의 이를 번갈아 막고 놓는다. 설계표 docs/mm507-sheets/234.md · 부품·식은 kit/k234
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { D2R, K234, crown234, frame234, spindle234, state234 } from '../kit/k234';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K234;

export default function buildM234(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  const verge = new THREE.Group();
  verge.name = 'verge';
  verge.position.set(K.POS[0], K.POS[1], K.POS[2]);
  verge.rotation.y = K.ROT_Y;
  g.add(verge);

  const crown = crown234();
  const spindle = spindle234();
  verge.add(frame234(), crown, spindle);

  const arrow = rotArrow(0.35, false);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, 1.45, 0);
  verge.add(arrow);

  g.add(
    leaderTo(tag('S 스핀들', v(-1.3, 1.85, 0.0)), 'spindle'),
    leaderTo(tag('A 팔레트(앞)', v(1.05, 1.75, 0.45)), 'pallet1'),
    leaderTo(tag('A 팔레트(뒤)', v(-0.55, 1.92, -0.1)), 'pallet2'),
    leaderTo(tag('크라운 휠(13이)', v(0.95, 0.95, 0.6)), 'crown'),
    leaderTo(tag('흔들이 막대(폴리오트)', v(-1.45, 1.15, 0.0)), 'foliot'),
    leaderTo(tag('태엽 상자(바퀴를 돌림)', v(0.8, 0.4, 0.5)), 'barrel')
  );

  const crownMat = crown.userData.mat as THREE.MeshStandardMaterial;
  const pm1 = spindle.userData.pallet1Mat as THREE.MeshStandardMaterial;
  const pm2 = spindle.userData.pallet2Mat as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state234(0);
  const place = (): void => {
    st = state234(t);
    spindle.rotation.x = -st.sigma * D2R;
    crown.rotation.y = -st.phi * D2R;
    pm1.emissive.setHex(st.holder === 'pallet1' ? 0xb36b00 : 0x000000);
    pm2.emissive.setHex(st.holder === 'pallet2' ? 0xb36b00 : 0x000000);
    crownMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0.6, 2.3, 3.7], target: [-0.05, 1.05, 0.25] },
    notes: () => [
      { label: '스핀들', value: st.sigma.toFixed(0) + '°' },
      { label: '막는 팔레트', value: st.holder === 'pallet1' ? 'A(앞 오른쪽)' : 'A(뒤 왼쪽)' },
      { label: '나아간 이', value: ((st.phi - K.PHI0) / K.P_STEP).toFixed(2) },
      { label: '원리', value: '지름 양 끝의 이는 서로 반대로 움직인다 → 두 팔레트가 번갈아 막고 놓아 한 번 오갈 때 이 하나. 놓은 직후 다른 팔레트에 밀려 조금 되돌아감(되밀림)' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
