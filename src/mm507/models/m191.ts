// 191 소용돌이 기어 — 대수 나선 피치 곡선의 같은 기어 두 개가 맞물려, 한 번 도는 동안 속도가 점점 빨라진다(끝의 계단 벽에서 멈춤) (판화 191번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { C191, K191, SHAFT_Z191, CY2_191, pinCap191, pose191, scrollGear191 } from '../kit/k191';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM191(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const sh1 = shaftZ(K191.cx, K191.cy1, SHAFT_Z191 + 0.005, 0.055);
  const sh2 = shaftZ(K191.cx, CY2_191, SHAFT_Z191 + 0.005, 0.055);
  sh1.name = 'shaftU';
  sh2.name = 'shaftL';
  g.add(sh1, sh2);
  const cap1 = pinCap191();
  cap1.position.set(K191.cx, K191.cy1, 0);
  const cap2 = pinCap191();
  cap2.position.set(K191.cx, CY2_191, 0);
  g.add(cap1, cap2);

  const gU = scrollGear191(true);
  gU.name = 'gearU';
  gU.position.set(K191.cx, K191.cy1, 0);
  const gL = scrollGear191(false);
  gL.name = 'gearL';
  gL.position.set(K191.cx, CY2_191, 0);
  g.add(gU, gL);

  const aU = new THREE.Group();
  const aL = new THREE.Group();
  const pU = rotArrow(0.3, true);
  const nU = rotArrow(0.3, false);
  const pL = rotArrow(0.3, true);
  const nL = rotArrow(0.3, false);
  aU.add(pU, nU);
  aL.add(pL, nL);
  aU.position.set(K191.cx, K191.cy1, 0.3);
  aL.position.set(K191.cx, CY2_191, 0.3);
  g.add(aU, aL);

  g.add(
    leaderTo(tag('위 기어(구동)', v(-1.5, 3.1, 0.45)), 'gearU'),
    leaderTo(tag('아래 기어', v(-1.5, 0.45, 0.45)), 'gearL'),
    leaderTo(tag('계단 벽', v(1.5, 1.7, 0.45)), 'gearU'),
    leaderTo(tag('축(고정)', v(1.5, 2.9, 0.45)), 'shaftU')
  );

  let cur = pose191(0);
  let dir = 0;
  const apply = (): void => {
    cur = pose191(theta);
    const nxt = pose191(theta + 0.01);
    dir = Math.sign(nxt.th2 - cur.th2);
    gU.rotation.z = cur.th1;
    gL.rotation.z = cur.th2;
    // 위 기어는 th1 이 줄어드는 쪽(시계)으로 돈다 — dir > 0 이면 아래 기어 반시계, 위 기어 시계
    pU.visible = dir < 0;
    nU.visible = dir > 0;
    pL.visible = dir > 0;
    nL.visible = dir < 0;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '속도비 아래/위', value: `${cur.ratio.toFixed(2)} (중심 거리 ${C191.toFixed(2)})` },
      { label: '접점 반지름', value: `위 기어 ${(K191.rmin * Math.exp(cur.phi1 / (6.2832 / Math.log(K191.rmax / K191.rmin)))).toFixed(2)}` },
      { label: '진행', value: `${Math.round(cur.u * 100)} %` },
      { label: '원리', value: '접점의 반지름이 점점 커져 아래 기어가 점점 빨리 돈다. 끝의 계단 벽에서 멈춘다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.9, 6.4], target: [0, 1.75, 0] }
  };
}
