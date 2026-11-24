// 026 크라운 기어 — 가로축 크라운 휠(이가 옆면)과 수직축 평기어가 직각으로 맞물린다 (판화 26번)
// 구동: 평기어(피니언 20). 크라운(24)은 5/6 속도로 따라 돈다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { PILLOW_BOSS_Y, crownGear, crownGearAngle, displayStand, pillow, rod, rotArrow, spurGear, tag } from '../kit';
import { castIron, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const MOD = 0.028;
const NP = 20; // 피니언 잇수
const NC = 24; // 크라운 잇수
const ZC = 0.18; // 기구 평면
const YC = 1.5; // 크라운 축 높이
const RP = (NP * MOD) / 2; // 0.28
const RM = (NC * MOD) / 2; // 0.336
const XF = -0.15 - 1.25 * MOD; // 피치 평면 x
const XP = XF - RP; // 피니언 축 x
const YP = YC + RM; // 피니언 중심 높이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

export default function buildM026(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 피니언 각

  g.add(displayStand());

  // 크라운: 피벗(세계 X 축 회전), 안쪽 메시는 로컬 Z → 세계 −X
  const crown = new THREE.Group();
  crown.position.set(-0.15, YC, ZC);
  const crownMesh = crownGear(NC, MOD, { width: 0.12, bore: 0.045 });
  crownMesh.rotation.y = -Math.PI / 2;
  crown.add(crownMesh, rod(v(0, 0, 0), v(0.95, 0, 0), 0.04));
  crown.add(at(new THREE.BoxGeometry(0.02, 0.1, 0.02), paint(0xf2b619), 0.6, 0.05, 0));
  g.add(crown);
  g.add(pillow(0.25, YC - PILLOW_BOSS_Y, ZC, 'x'), pillow(0.65, YC - PILLOW_BOSS_Y, ZC, 'x'));
  // 필로 받침 선반: 뒤판(z −0.30)에서 나와 두 필로의 받침판을 받친다(필로가 허공에 뜨지 않게)
  g.add(at(new THREE.BoxGeometry(0.66, 0.08, 0.6), castIron(), 0.45, YC - PILLOW_BOSS_Y - 0.04, 0));

  // 피니언: 피벗(세계 Y 축 회전), 메시 로컬 Z → 세계 +Y
  const pin = new THREE.Group();
  pin.position.set(XP, YP, ZC);
  const pinMesh = spurGear(NP, MOD, { width: 0.08, spokes: 4, driver: true });
  pinMesh.rotation.x = -Math.PI / 2;
  pin.add(pinMesh, rod(v(0, -0.64, 0), v(0, 0.76, 0), 0.035));
  pin.add(at(new THREE.BoxGeometry(0.1, 0.02, 0.02), paint(0xf2b619), 0.06, 0.7, 0));
  g.add(pin);

  // 피니언 축 브래킷 2개(뒤판에서 나온 팔 + 고리)
  for (const y of [2.5, 1.4]) {
    g.add(at(new THREE.BoxGeometry(0.16, 0.1, 0.44), castIron(), XP, y, -0.08));
    g.add(at(lathe(tubeProfile(0.04, 0.065, -0.05, 0.05, 0.008), 36), darkSteel(), XP, y, ZC));
  }

  // 회전 화살표(수평, 위에서 본 반시계)
  const arrow = rotArrow(0.16, true);
  arrow.position.set(XP, 2.66, ZC);
  arrow.rotation.x = -Math.PI / 2;
  g.add(arrow);

  g.add(
    tag('평기어(구동)', v(-1.15, 2.3, 0.0)),
    tag('크라운 기어', v(0.55, 0.9, 0.3)),
    tag('직각으로 맞물림', v(0.35, 2.3, 0.18))
  );

  return {
    group: g,
    view: { pos: [-2.3, 2.5, 3.4], target: [-0.1, 1.5, 0.15] },
    notes: () => [
      { label: '축의 각도', value: '90°' },
      { label: '잇수 (평기어 : 크라운)', value: '20 : 24' },
      { label: '속도비', value: '평기어 1 회전 → 크라운 ' + (NP / NC).toFixed(2) + ' 회전' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pin.rotation.y = theta;
      crown.rotation.x = -crownGearAngle(theta, NP, NC);
    }
  };
}
