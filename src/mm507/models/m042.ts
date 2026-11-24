// 042 엇각 기어 (1) — 비스듬한 이(헬리컬) 기어가, 축이 30° 돌아간 곧은 이 기어를 돌린다 (판화 42번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { castIron, darkSteel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { displayStand, rod, rotArrow, tag } from '../kit';
import { helicalGear } from '../kit/gear5';

const rad = (d: number): number => (d * Math.PI) / 180;
const SIGMA = rad(30); // 축 사이각
const MN = 0.04; // 이직각 모듈
const ZA = 18;
const ZB = 20;
const MTA = MN / Math.cos(SIGMA); // 위 기어 단면 모듈
const RPA = (ZA * MTA) / 2; // 0.41569
const RPB = (ZB * MN) / 2; // 0.40
const ZC = 0.3;
const YB = 1.3;
const YA = YB + RPA + RPB;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const CB = v(0, YB, ZC);
const U2 = v(Math.cos(SIGMA), 0, Math.sin(SIGMA)); // 아래 축 방향
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const QA0 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rad(90));
const QB0 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rad(90) - SIGMA);
const ZAX = new THREE.Vector3(0, 0, 1);

/** 뒤판(z=-0.3)에서 나와 지정 점까지 오는 기둥 */
function post(x: number, y: number, zEnd: number, r: number): THREE.Mesh {
  const geo = lathe(rodProfile(r, 0, zEnd + 0.3, 0.01, 0.01), 28);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, castIron());
  m.position.set(x, y, -0.3);
  return m;
}

export default function buildM042(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const gearA = helicalGear(ZA, MTA, { width: 0.2, helix: rad(30), hand: -1, driver: true });
  gearA.name = 'gearA';
  gearA.position.set(0, YA, ZC);
  const gearB = helicalGear(ZB, MN, { width: 0.22, helix: 0 });
  gearB.name = 'gearB';
  gearB.position.copy(CB);
  g.add(gearA, gearB);

  // 위 축(세계 X) + 뒤판에서 나온 기둥 두 개와 끝 고리
  g.add(rod(v(-0.62, YA, ZC), v(0.62, YA, ZC), 0.045));
  // 고리는 축(X)을 감싸고, 기둥은 고리 바깥 아래쪽(뒤)에서 멈춘다 — 기둥이 축을 꿰뚫지 않게
  for (const x of [-0.55, 0.55]) {
    g.add(post(x, YA, ZC - 0.08, 0.07));
    const ring = lathe(tubeProfile(0.045, 0.085, 0, 0.14, 0.01), 28);
    ring.rotateZ(-Math.PI / 2); // 로컬 +y → 세계 +x
    const rm = mesh(ring, darkSteel());
    rm.position.set(x - 0.07, YA, ZC);
    g.add(rm);
  }

  // 아래 축(u2 방향): 뒤 끝은 뒤판의 보스에, 앞 끝은 자유
  g.add(rod(CB.clone().addScaledVector(U2, -1.2), CB.clone().addScaledVector(U2, 0.85), 0.045));
  const boss = lathe(rodProfile(0.08, 0, 0.15, 0.01, 0.01), 28); // 로컬 +y 방향 길이 0.15
  const bm = mesh(boss, darkSteel());
  bm.position.copy(CB).addScaledVector(U2, -1.2);
  bm.quaternion.setFromUnitVectors(Y_AXIS, U2);
  g.add(bm);
  // 받침 고리: 축을 감싸고 뒤판에서 기둥으로 이어진다
  const pc = CB.clone().addScaledVector(U2, -0.62);
  const ring = lathe(tubeProfile(0.045, 0.09, 0, 0.07, 0.01), 28);
  ring.rotateX(Math.PI / 2);
  const rm = mesh(ring, darkSteel());
  rm.quaternion.setFromUnitVectors(ZAX, U2);
  rm.position.copy(pc).addScaledVector(U2, -0.035);
  g.add(rm);
  g.add(post(pc.x, pc.y, pc.z - 0.09, 0.06)); // 30° 기운 고리 끝면에 기둥 가장자리가 0.003 만 닿게(0.07 이면 0.018 박힘)

  // 회전 방향 화살표
  const aA = rotArrow(0.35, true);
  aA.rotation.y = Math.PI / 2;
  aA.position.set(0.3, YA, ZC);
  const aB = rotArrow(0.35, false);
  aB.quaternion.copy(QB0);
  aB.position.copy(CB).addScaledVector(U2, 0.25);
  g.add(aA, aB);

  g.add(
    tag('구동 기어(비스듬한 이)', v(-1.25, 2.12, 0.5)),
    tag('곧은 이 기어(축이 30° 돌아감)', v(-1.25, 0.9, 0.5)),
    tag('두 축이 평행하지 않다(30°)', v(1.35, 1.7, 0.5))
  );

  const qr = new THREE.Quaternion();
  return {
    group: g,
    view: { pos: [1.2, 2.0, 6.0], target: [0, 1.7, 0.3] },
    notes: () => [
      { label: '잇수', value: `${ZA} : ${ZB}` },
      { label: '속도비', value: '1 : 0.9 (반대 방향)' },
      { label: '축 사이각', value: '30° (엇각) — 위 기어 이의 비스듬한 각과 같다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      qr.setFromAxisAngle(ZAX, theta);
      gearA.quaternion.copy(QA0).multiply(qr);
      qr.setFromAxisAngle(ZAX, -(ZA / ZB) * theta);
      gearB.quaternion.copy(QB0).multiply(qr);
    }
  };
}
