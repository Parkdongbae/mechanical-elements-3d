// 206 두 폴 래칫 — 레버가 올라갈 때는 갈고리 폴이 당기고 내려갈 때는 미는 폴이 밀어, 래칫 바퀴가 늘 시계 방향으로 돈다 (판화 206번)
//  설계표 docs/mm507-sheets/206.md · 부품·운동식은 kit/k206 + kit/k092(크랭크 원판·연결봉) 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K206, lever206, pawl206, ratchetWheel206, state206 } from '../kit/k206';
import { connectingRod, crankDisc } from '../kit/k092';
import { paint } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const P = (2 * Math.PI) / 40;
const ACTIVE = 0x7a4a00;

export default function buildM206(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [WX, WY] = K206.W;
  const [PX, PY] = K206.P0;
  const [KX, KY] = K206.K;

  g.add(displayStand());

  // 축 셋(고정, 뒤판에서 나옴)
  const axle = shaftZ(WX, WY, 0.12, 0.055);
  axle.name = 'axle';
  g.add(axle);
  const fulcrum = shaftZ(PX, PY, 0.17, 0.035);
  fulcrum.name = 'fulcrum';
  g.add(fulcrum);
  g.add(shaftZ(KX, KY, 0.1, 0.05));

  const wheel = ratchetWheel206();
  wheel.name = 'ratchet';
  wheel.position.set(WX, WY, 0);
  g.add(wheel);

  const lever = lever206();
  lever.name = 'lever';
  lever.position.set(PX, PY, 0);
  g.add(lever);

  const hook = pawl206('hook');
  hook.name = 'pawlHook';
  g.add(hook);
  const push = pawl206('push');
  push.name = 'pawlPush';
  g.add(push);
  const matHook = hook.userData.mat as THREE.MeshStandardMaterial;
  const matPush = push.userData.mat as THREE.MeshStandardMaterial;

  const crank = crankDisc(0.3, K206.rk, { thick: 0.08, pinR: 0.045, pinTop: 0.25, pinZ: 0.19 });
  crank.name = 'crank';
  crank.position.set(KX, KY, 0);
  g.add(crank);

  const link = connectingRod(K206.Lk, { thick: 0.05 });
  link.name = 'link';
  g.add(link);

  // 표시: 바퀴 시계 화살표, 레버 핀 위·아래 화살표
  const arrow = rotArrow(0.3, false);
  arrow.position.set(WX, WY, 0.16);
  g.add(arrow);
  const mkCone = (name: string, down: boolean): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 16), paint(0xffcc00));
    m.name = name;
    m.castShadow = true;
    m.position.set(-0.62, 2.35, 0.2);
    if (down) m.rotation.z = Math.PI;
    g.add(m);
    return m;
  };
  const upArrow = mkCone('upArrow', false);
  const downArrow = mkCone('downArrow', true);

  // 이름표 6개(자리는 기구 바깥, 지시선은 이름으로)
  g.add(
    leaderTo(tag('래칫 바퀴(40이)', v(-1.6, 0.7, 0.3)), 'ratchet'),
    leaderTo(tag('갈고리 폴(올라갈 때 당김)', v(-1.55, 2.45, 0.3)), 'pawlHook'),
    leaderTo(tag('미는 폴(내려갈 때 밂)', v(0.8, 1.05, 0.3)), 'pawlPush'),
    leaderTo(tag('레버(받침점 고정)', v(-0.8, 3.05, 0.3)), 'lever'),
    leaderTo(tag('크랭크(구동)', v(1.6, 1.2, 0.3)), 'crank'),
    leaderTo(tag('연결봉', v(1.5, 2.6, 0.3)), 'link')
  );

  const pose = (th: number): void => {
    const s = state206(th);
    wheel.rotation.z = s.wheel;
    lever.rotation.z = K206.hdir + s.gamma;
    hook.position.set(s.Q[0], s.Q[1], -0.03);
    hook.rotation.z = s.lamHook;
    push.position.set(s.Q[0], s.Q[1], 0.03);
    push.rotation.z = s.lamPush;
    matHook.emissive.setHex(s.drive === 'hook' ? ACTIVE : 0x000000);
    matPush.emissive.setHex(s.drive === 'push' ? ACTIVE : 0x000000);
    crank.rotation.z = K206.thF + th;
    link.position.set(s.pin[0], s.pin[1], 0.19);
    link.rotation.z = Math.atan2(s.H[1] - s.pin[1], s.H[0] - s.pin[0]);
    upArrow.visible = s.rising;
    downArrow.visible = !s.rising;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.1, 1.75, 6.3], target: [0.1, 1.7, 0] },
    notes: () => {
      const s = state206(theta);
      return [
        { label: '레버 핀', value: s.rising ? '올라감 → 갈고리 폴이 당김' : '내려감 → 미는 폴이 밂' },
        { label: '바퀴', value: '늘 시계 방향' },
        { label: '보낸 이', value: `${(s.phi / P).toFixed(2)}` },
        { label: '한 번 왕복에', value: '올라갈 때 0.47이 + 내려갈 때 1.53이 = 2이' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
