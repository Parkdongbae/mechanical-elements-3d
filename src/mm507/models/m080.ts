// 080 갈고리 폴로 올리는 홈 랙 — 레버 C 가 흔들리면 X 자 갈고리 폴 둘이 번갈아 막대 A 의 톱니에 걸려 막대를 끌어올린다 (판화 80번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, shaftZ, tag, leaderTo } from '../kit';
import { K80, hookPawl80, k80State, rockLever80, slotKeeper80, slottedRack80 } from '../kit/k080';

const OY = 2.13; // 받침 핀 높이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM080(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 받침 핀(고정): 뒤판에서 나와 레버 구멍·막대 홈·덮개 판을 꿴다
  g.add(shaftZ(0, OY, 0.21, K80.studR));

  // 레버 C
  const lever = rockLever80(0.262);
  lever.name = 'leverC';
  lever.position.set(0, OY, 0);
  const pins = lever.userData.pins as THREE.Mesh[];
  pins[0]!.name = 'pinL';
  pins[1]!.name = 'pinR';
  g.add(lever);

  // 막대 A
  const rack = slottedRack80(0.07);
  rack.name = 'rackA';
  rack.position.set(0, OY, 0.09);
  g.add(rack);

  // 갈고리 폴 둘 (X 자)
  const pawl1 = hookPawl80(false, 0.165, 0.09);
  pawl1.name = 'pawl1';
  const pawl2 = hookPawl80(true, 0.225, 0.09);
  pawl2.name = 'pawl2';
  g.add(pawl1, pawl2);

  // 덮개 판 + 안내 블록(고정)
  const keeper = slotKeeper80(0.145, 0.05);
  keeper.name = 'keeper';
  keeper.position.set(0, OY, 0);
  g.add(keeper);

  g.add(
    tag('레버 C', v(1.05, 2.62, 0.3)),
    tag('홈 랙 막대 A', v(-0.95, 0.62, 0.3)),
    tag('갈고리 폴', v(0.95, 1.2, 0.3)),
    leaderTo(tag('받침 핀과 안내 블록', v(-1.15, 2.75, 0.3)), 'keeper')
  );

  let st = k80State(0);
  const apply = (): void => {
    st = k80State(theta);
    const c = Math.cos(st.phi);
    const s = Math.sin(st.phi);
    lever.rotation.z = st.phi;
    rack.position.y = OY + st.barY;
    pawl1.position.set(-K80.a * c, OY - K80.a * s, 0);
    pawl1.rotation.z = st.psi1;
    pawl2.position.set(K80.a * c, OY + K80.a * s, 0);
    pawl2.rotation.z = -st.psi2;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 6.4], target: [0, 1.9, 0.1] },
    notes: () => [
      { label: '지금 상태', value: st.phase === 'lift' ? '올림' : '되돌림(폴을 젖히고 내림)' },
      { label: '받치는 폴', value: st.holder === 1 ? '왼쪽 핀의 폴' : st.holder === 2 ? '오른쪽 핀의 폴' : '없음' },
      { label: '올라간 높이', value: `${st.lift.toFixed(2)} / ${K80.liftTotal.toFixed(2)} (톱니 ${st.teethUp} / 8)` },
      { label: '레버 각 φ', value: `${((st.phi * 180) / Math.PI).toFixed(1)}° (±${((K80.PHI * 180) / Math.PI).toFixed(1)}°)` },
      { label: '레버 한 번 왕복', value: '톱니 4개를 넘긴다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
