// 238 탈진기 — 진자에 매달린 팔레트 틀의 B·C 가 6각 별 바퀴 D 의 끝을 번갈아 받치고 놓는다. 설계표 docs/mm507-sheets/238.md · 부품·식은 kit/k238
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K238, frame238, star238, state238 } from '../kit/k238';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K238;

export default function buildM238(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [dx, dy] = K.D;
  const [ax, ay] = K.A;

  const star = star238();
  star.position.set(dx, dy, 0);
  const frame = frame238();
  frame.position.set(ax, ay, 0);
  g.add(shaftZ(dx, dy, 0.09, 0.045), shaftZ(ax, ay, 0.0, 0.04), star, frame);

  const arrow = rotArrow(0.3, true);
  arrow.position.set(dx, dy, 0.3);
  g.add(arrow);

  g.add(
    leaderTo(tag('D 탈진 바퀴', v(-1.45, 2.85, 0.3)), 'escapeD'),
    leaderTo(tag('C 팔레트', v(1.3, 2.75, 0.3)), 'palletC'),
    leaderTo(tag('B 팔레트', v(-1.5, 1.95, 0.3)), 'palletB'),
    leaderTo(tag('A 팔레트 축', v(1.3, 1.25, 0.3)), 'palletFrame'),
    leaderTo(tag('진자(흔듦)', v(1.1, 0.5, 0.3)), 'pendulum'),
    leaderTo(tag('태엽통(바퀴를 돌림)', v(-1.5, 2.4, 0.3)), 'barrel')
  );

  const starMat = star.userData.mat as THREE.MeshStandardMaterial;
  const mB = frame.userData.matB as THREE.MeshStandardMaterial;
  const mC = frame.userData.matC as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state238(0);
  const place = (): void => {
    st = state238(t);
    star.rotation.z = st.phi * D2R;
    frame.rotation.z = st.psi * D2R;
    mB.emissive.setHex(st.holder === 'B' ? 0xb36b00 : 0x000000);
    mC.emissive.setHex(st.holder === 'C' ? 0xb36b00 : 0x000000);
    starMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0.0, 1.65, 6.1], target: [0.0, 1.62, 0] },
    notes: () => [
      { label: '진자', value: st.psi.toFixed(1) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'C' ? 'C — 오른쪽에서 올라오는 끝을 막음' : 'B — 왼쪽 아래로 내려오는 끝을 받침' },
      { label: '나아간 이', value: ((st.phi - state238(0).phi) / 60).toFixed(2) },
      { label: '원리', value: '진자가 한 번 오가면(2초) 이 하나(60°). 한 번 흔들 때마다 반 칸씩 툭 — 팔레트가 끝을 잡은 뒤엔 바퀴가 조금 뒤로 밀림(되밀림)' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
