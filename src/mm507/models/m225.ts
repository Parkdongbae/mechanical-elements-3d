// 225 폴이 달린 래칫 — 팔이 왼쪽으로 흔들릴 때 팔 끝의 폴이 래칫 이를 밀어 바퀴가 늘 반시계로 한 이씩 돈다 (판화 225번)
//  설계표 docs/mm507-sheets/225.md · 부품·운동식은 kit/k225 + kit/k092(크랭크 원판·연결봉) 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K225, arm225, bracket225, pawl225, ratchetWheel225, state225 } from '../kit/k225';
import { connectingRod, crankDisc } from '../kit/k092';
import { paint } from '../../models/materials';
import { extrude, shapeFrom } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const P18 = (18 * Math.PI) / 180;
const ACTIVE = 0x7a4a00;

export default function buildM225(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [WX, WY] = K225.W;
  const [BX, BY] = K225.B;
  const [KX, KY] = K225.K;

  g.add(displayStand());

  // 고정: 바퀴 축, 팔 받침, 크랭크 축
  const axle = shaftZ(WX, WY, 0.12, 0.055);
  axle.name = 'axle';
  g.add(axle);
  const bracket = bracket225();
  bracket.name = 'bracket';
  bracket.position.set(BX, 0.18, 0);
  g.add(bracket);
  g.add(shaftZ(KX, KY, 0.1, 0.05));

  const wheel = ratchetWheel225();
  wheel.name = 'ratchet';
  wheel.position.set(WX, WY, 0);
  g.add(wheel);

  const arm = arm225();
  arm.name = 'arm';
  arm.position.set(BX, BY, 0);
  g.add(arm);

  const pawl = pawl225();
  pawl.name = 'pawl';
  g.add(pawl);
  const matPawl = pawl.userData.mat as THREE.MeshStandardMaterial;

  const crank = crankDisc(0.2, K225.rk, { thick: 0.08, pinR: 0.045, pinTop: 0.25, pinZ: 0.19 });
  crank.name = 'crank';
  crank.position.set(KX, KY, 0);
  g.add(crank);

  const link = connectingRod(K225.Lk, { thick: 0.05 });
  link.name = 'link';
  g.add(link);

  // 표시: 바퀴 반시계 화살표(늘 같은 방향), 팔 움직임 화살표(왼/오른)
  const arrow = rotArrow(0.3, true);
  arrow.position.set(WX, WY, 0.16);
  g.add(arrow);
  // 납작한 노란 화살표를 팔 앞면(z 0.12)에 붙여 팔과 함께 움직인다(왼쪽/오른쪽)
  const mkArrow = (name: string, flip: boolean): THREE.Mesh => {
    const shape = shapeFrom([[-0.14, -0.015], [0.04, -0.015], [0.04, -0.05], [0.14, 0], [0.04, 0.05], [0.04, 0.015], [-0.14, 0.015]]);
    const m = new THREE.Mesh(extrude(shape, 0.008, 0.001, 4), paint(0xffcc00));
    m.name = name;
    m.castShadow = true;
    m.position.set(0, 2.22, 0.124);
    if (flip) m.rotation.z = Math.PI;
    arm.add(m);
    return m;
  };
  const leftArrow = mkArrow('leftArrow', true);
  const rightArrow = mkArrow('rightArrow', false);

  // 이름표 5개(자리는 기구 바깥, 지시선은 이름으로)
  g.add(
    leaderTo(tag('래칫 바퀴(20이)', v(-1.45, 0.35, 0.3)), 'ratchet'),
    leaderTo(tag('폴(팔이 밀 때 걸림)', v(-1.25, 3.0, 0.3)), 'pawl'),
    leaderTo(tag('흔들 팔', v(1.35, 0.8, 0.3)), 'arm'),
    leaderTo(tag('크랭크(구동)', v(1.55, 1.75, 0.3)), 'crank'),
    leaderTo(tag('연결봉', v(1.3, 3.05, 0.3)), 'link')
  );

  const pose = (th: number): void => {
    const s = state225(th);
    wheel.rotation.z = s.wheel;
    arm.rotation.z = s.gamma;
    pawl.position.set(s.T[0], s.T[1], 0);
    pawl.rotation.z = s.lam;
    matPawl.emissive.setHex(s.drive ? ACTIVE : 0x000000);
    crank.rotation.z = K225.thF + (s.u);
    link.position.set(s.P[0], s.P[1], 0.19);
    link.rotation.z = Math.atan2(s.H[1] - s.P[1], s.H[0] - s.P[0]);
    leftArrow.visible = s.pushing;
    rightArrow.visible = !s.pushing;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.1, 1.65, 6.4], target: [0.1, 1.6, 0] },
    notes: () => {
      const s = state225(theta);
      return [
        { label: '팔', value: s.pushing ? '왼쪽으로 → 폴이 이를 밂' : '오른쪽으로 → 폴이 이를 타 넘음' },
        { label: '바퀴', value: '늘 반시계, 한 번 왕복에 1이(18°)' },
        { label: '보낸 이', value: `${(s.phi / P18).toFixed(2)}` },
        { label: '원리', value: '폴은 한쪽(곧은 면)만 걸 수 있어 돌아올 때는 미끄러진다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
