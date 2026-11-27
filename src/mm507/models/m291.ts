// 291 아널드 크로노미터(자유) 탈진기 — 밸런스 롤러의 핀 a 가 돌아올 때만 멈치 스프링 A 를 들어 이 하나를 놓고, 풀린 이가 롤러 홈 g 를 밀어 힘을 돌려준다.
// 설계표 docs/mm507-sheets/291.md · 부품·접촉 계산은 kit/k291
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K291, blockB291, detent291, escWheel291, roller291, state291 } from '../kit/k291';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K291;

export default function buildM291(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.W;
  const [ax, ay] = K.A;
  const [px, py] = K.PB;

  const wheel = escWheel291();
  wheel.position.set(wx, wy, 0);
  const roller = roller291();
  roller.position.set(ax, ay, 0);
  const detent = detent291();
  detent.position.set(px, py, 0);
  g.add(
    shaftZ(wx, wy, 0.127, 0.04),
    shaftZ(ax, ay, 0.167, 0.04),
    shaftZ(0.9, 2.32, 0.06, 0.03),
    blockB291(),
    wheel,
    roller,
    detent
  );

  const a1 = rotArrow(0.25, false);
  a1.position.set(ax, ay, 0.2);
  const a2 = rotArrow(0.3, false);
  a2.position.set(wx, wy, 0.15);
  g.add(a1, a2);

  g.add(
    leaderTo(tag('a 방출핀', v(-1.85, 3.12, 0.3)), 'dischargePin'),
    leaderTo(tag('d 멈치', v(-0.35, 3.12, 0.3)), 'detentStop'),
    leaderTo(tag('가벼운 스프링', v(1.15, 3.12, 0.3)), 'passingSpring'),
    leaderTo(tag('A 멈치 스프링', v(1.1, 1.95, 0.3)), 'detentBlade'),
    leaderTo(tag('B 탈진바퀴', v(0.95, 0.7, 0.3)), 'escapeWheel'),
    leaderTo(tag('g 롤러', v(-2.0, 1.95, 0.3)), 'impulseRoller')
  );

  const rollerMat = roller.userData.rollerMat as THREE.MeshStandardMaterial;
  const dMat = detent.userData.dMat as THREE.MeshStandardMaterial;
  const spMat = detent.userData.springMat as THREE.MeshStandardMaterial;
  const spring = detent.userData.spring as THREE.Group;

  let t = 0;
  let st = state291(0);
  let turns = 0;
  const place = (): void => {
    st = state291(t);
    roller.rotation.z = st.psi * D2R;
    detent.rotation.z = -st.delta * D2R;
    spring.rotation.z = st.sigma * D2R;
    wheel.rotation.z = st.phi * D2R;
    dMat.emissive.setHex(st.delta > 0 ? 0xb36b00 : 0x000000);
    rollerMat.emissive.setHex(st.holder === 'g' ? 0x553300 : 0x000000);
    spMat.emissive.setHex(st.sigma > 0 ? 0x204080 : 0x000000);
    turns = -st.phi / K.PITCH;
  };
  place();

  return {
    group: g,
    view: { pos: [0.05, 1.7, 6.4], target: [0.05, 1.7, 0] },
    notes: () => [
      { label: '밸런스 각', value: st.psi.toFixed(0) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '멈치', value: st.delta > 0 ? '들림 ' + st.delta.toFixed(2) + '°' : st.sigma > 0 ? '그대로 — 가벼운 스프링만 눌림' : '내려와 이를 막음' },
      { label: '나아간 이 수', value: turns.toFixed(2) },
      { label: '메모', value: '핀이 한쪽으로 갈 때는 가벼운 스프링만 눌러 지나가고, 돌아올 때만 멈치를 들어 이 하나를 놓는다 — 밸런스가 방해받는 곳은 한 지점뿐' },
      { label: '메모', value: '풀린 바퀴의 다음 이가 롤러 홈 g 의 벽을 밀어 밸런스에 힘을 돌려준다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
