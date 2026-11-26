// 210 굽은 홈 팔과 직선 막대 — 축을 약 102° 앞뒤로 돌리면 홈 속 핀을 따라 세로 막대가 위아래로 곧게 움직이고,
// 홈 모양 때문에 같은 팔 각에도 막대 속도가 달라진다. 설계표 docs/mm507-sheets/210.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { rodGuideY } from '../kit/k092';
import { K210, bar210, pinY210, slotArm210, theta210 } from '../kit/k210';
import { darkSteel, paint } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const K = K210;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;
const TAG_Z = 0.3;
const BAR_Z = -0.08;

export default function buildM210(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  const shaft = shaftZ(K.S.x, K.S.y, 0.17, 0.06);
  shaft.name = 'shaft';
  g.add(shaft);

  const arm = slotArm210();
  arm.name = 'arm';
  g.add(arm);

  const bar = bar210();
  bar.name = 'bar';
  bar.position.set(0, pinY210(theta210(0)), BAR_Z);
  g.add(bar);

  const guideLow = rodGuideY(0, 0.91, BAR_Z, K.barR, 0.1);
  guideLow.name = 'guideLow';
  const guideHigh = rodGuideY(0, 2.57, BAR_Z, K.barR, 0.1);
  guideHigh.name = 'guideHigh';
  g.add(guideLow, guideHigh);

  // 속도 눈금자(고정): 팔이 같은 각(10.2°)을 돌 때마다의 막대 끝 높이
  const scale = new THREE.Group();
  scale.name = 'scale';
  const sPlate = mesh(new THREE.BoxGeometry(0.12, 0.64, 0.03), paint(0xf3f4f6));
  sPlate.position.set(0.19, 2.94, -0.035);
  const sStem = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.25), darkSteel());
  sStem.position.set(0.19, 2.94, -0.175);
  scale.add(sPlate, sStem);
  const tickGeo = new THREE.BoxGeometry(0.09, 0.008, 0.006);
  for (let k = 0; k <= 10; k++) {
    const th = K.thTop - (k * 10.2 * Math.PI) / 180;
    const tick = mesh(tickGeo, darkSteel());
    tick.position.set(0.19, pinY210(th) + 0.85 + 0.015, -0.017);
    scale.add(tick);
  }
  g.add(scale);

  // 회전 화살표: 내려가는 반 주기엔 시계, 올라오는 반엔 반시계
  const arrCw = rotArrow(0.28, false);
  const arrCcw = rotArrow(0.28, true);
  for (const a of [arrCw, arrCcw]) a.position.set(K.S.x, K.S.y, 0.2);
  g.add(arrCw, arrCcw);

  g.add(
    leaderTo(tag('굽은 홈 팔(축과 함께 돎)', v(-1.4, 2.4, TAG_Z)), 'arm'),
    leaderTo(tag('세로 막대', v(0.95, 0.55, TAG_Z)), 'bar'),
    leaderTo(tag('핀(홈 속)', v(1.1, 2.25, TAG_Z)), 'barPin'),
    leaderTo(tag('안내 부시(고정)', v(-1.1, 0.75, TAG_Z)), 'guideLow'),
    leaderTo(tag('같은 팔 각마다 눈금(간격이 다름)', v(1.15, 3.05, TAG_Z)), 'scale')
  );

  let theta = 0;
  let y = 0;
  let ratio = 0;
  const apply = (dir: number): void => {
    theta = theta210(tm);
    y = pinY210(theta);
    arm.rotation.z = theta;
    bar.position.y = y;
    const e = 1e-4;
    const w = (theta210(tm + e) - theta210(tm - e)) * dir;
    arrCw.visible = w < 0;
    arrCcw.visible = w >= 0;
    ratio = Math.abs(pinY210(theta + 0.001) - pinY210(theta - 0.001)) / 0.002;
  };
  apply(1);

  return {
    group: g,
    notes: () => [
      { label: '팔 각', value: `${(theta * DEG).toFixed(1)}°` },
      { label: '막대 높이', value: y.toFixed(3) },
      { label: '막대 속도 / 팔 속도', value: `${ratio.toFixed(3)} (단위/rad)` },
      { label: '범위', value: '0.16 ~ 0.37 — 같은 팔 속도에도 막대 속도가 변함' }
    ],
    update(dt: number, speed: number): void {
      tm += speed * dt;
      apply(speed < 0 ? -1 : 1);
    },
    view: { pos: [0.3, 1.9, 5.6], target: [0.1, 1.85, 0] }
  };
}
