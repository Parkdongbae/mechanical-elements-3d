// 236 두 폴 래칫 2 — 레버를 내릴 때는 폴 b 가, 올릴 때는 폴 c 가 밀어 래칫 바퀴가 늘 반시계로 도는 기구 (판화 236번)
//  설계표 docs/mm507-sheets/236.md · 부품·운동식은 kit/k236 + kit/k092(크랭크 원판·연결봉) 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K236, lever236, pawl236, ratchetWheel236, state236 } from '../kit/k236';
import { connectingRod, crankDisc } from '../kit/k092';
import { paint } from '../../models/materials';
import { extrude, shapeFrom } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const P = (2 * Math.PI) / 16;
const ACTIVE = 0x7a4a00;

export default function buildM236(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [WX, WY] = K236.W;
  const [FX, FY] = K236.F;
  const [KX, KY] = K236.K;

  g.add(displayStand());

  // 축 셋(고정, 뒤판에서 나옴)
  const axle = shaftZ(WX, WY, 0.12, 0.055);
  axle.name = 'axle';
  g.add(axle);
  const fulcrum = shaftZ(FX, FY, 0.17, 0.035);
  fulcrum.name = 'fulcrum';
  g.add(fulcrum);
  g.add(shaftZ(KX, KY, 0.1, 0.05));

  const wheel = ratchetWheel236();
  wheel.name = 'ratchet';
  wheel.position.set(WX, WY, 0);
  g.add(wheel);

  const lever = lever236();
  lever.name = 'lever';
  lever.position.set(FX, FY, 0);
  g.add(lever);

  const pawlB = pawl236('b');
  pawlB.name = 'pawlB';
  g.add(pawlB);
  const pawlC = pawl236('c');
  pawlC.name = 'pawlC';
  g.add(pawlC);
  const matB = pawlB.userData.mat as THREE.MeshStandardMaterial;
  const matC = pawlC.userData.mat as THREE.MeshStandardMaterial;

  const crank = crankDisc(0.211, K236.rk, { thick: 0.08, pinR: 0.045, pinTop: 0.25, pinZ: 0.19 });
  crank.name = 'crank';
  crank.position.set(KX, KY, 0);
  g.add(crank);

  const link = connectingRod(K236.Lk, { thick: 0.05 });
  link.name = 'link';
  g.add(link);

  // 표시: 바퀴 반시계 화살표, 손잡이 아래·위 화살표
  const arrow = rotArrow(0.3, true);
  arrow.position.set(WX, WY, 0.16);
  g.add(arrow);
  // 납작한 노란 화살표를 레버 손잡이 앞면(z 0.135)에 붙여 레버와 함께 움직인다
  const mkCone = (name: string, down: boolean): THREE.Mesh => {
    const shape = shapeFrom([[-0.008, -0.045], [0.008, -0.045], [0.008, 0.005], [0.032, 0.005], [0, 0.05], [-0.032, 0.005], [-0.008, 0.005]]);
    const m = new THREE.Mesh(extrude(shape, 0.008, 0.001, 4), paint(0xffcc00));
    m.name = name;
    m.castShadow = true;
    m.position.set(-1.075, 0.099, 0.138);
    m.rotation.z = down ? Math.PI : 0;
    lever.add(m);
    return m;
  };
  const downArrow = mkCone('downArrow', true);
  const upArrow = mkCone('upArrow', false);

  // 이름표 6개(자리는 기구 바깥, 지시선은 이름으로)
  g.add(
    leaderTo(tag('레버 a', v(-0.3, 3.12, 0.3)), 'lever'),
    leaderTo(tag('폴 b', v(-1.35, 1.45, 0.3)), 'pawlB'),
    leaderTo(tag('폴 c', v(1.3, 1.6, 0.3)), 'pawlC'),
    leaderTo(tag('래칫 바퀴(16이)', v(-1.58, 0.35, 0.3)), 'ratchet'),
    leaderTo(tag('크랭크(구동)', v(1.8, 2.15, 0.3)), 'crank'),
    leaderTo(tag('연결봉', v(0.35, 2.75, 0.3)), 'link')
  );

  const pose = (th: number): void => {
    const s = state236(th);
    wheel.rotation.z = s.wheel;
    lever.rotation.z = s.gamma;
    pawlB.position.set(s.Qb[0], s.Qb[1], 0);
    pawlB.rotation.z = s.lamB;
    pawlC.position.set(s.Qc[0], s.Qc[1], 0);
    pawlC.rotation.z = s.lamC;
    matB.emissive.setHex(s.drive === 'b' ? ACTIVE : 0x000000);
    matC.emissive.setHex(s.drive === 'c' ? ACTIVE : 0x000000);
    crank.rotation.z = K236.thF + th;
    link.position.set(s.P[0], s.P[1], 0.19);
    link.rotation.z = Math.atan2(s.Qc[1] - s.P[1], s.Qc[0] - s.P[0]);
    downArrow.visible = s.lowering;
    upArrow.visible = !s.lowering;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.0, 1.7, 6.4], target: [0.0, 1.65, 0] },
    notes: () => {
      const s = state236(theta);
      return [
        { label: '손잡이', value: s.lowering ? '내림 → 폴 b 가 밂' : '올림 → 폴 c 가 밂' },
        { label: '바퀴', value: '늘 반시계' },
        { label: '보낸 이', value: `${(s.phi / P).toFixed(2)}` },
        { label: '한 번 왕복에', value: '내릴 때 1.32이 + 올릴 때 0.68이 = 2이' },
        { label: '206 과 다른 점', value: '두 폴이 받침점 양쪽에 따로, 둘 다 미는 폴' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
