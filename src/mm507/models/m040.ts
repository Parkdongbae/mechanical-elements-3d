// 040 V자 톱니 기어 — 가로축 두 개가 위아래로 놓이고 폭 넓은 헤링본(V자 이) 기어가 옆에서 맞물려 돈다 (판화 40번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { castIron, darkSteel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { displayStand, herringboneGear, meshAngle, rod, rotArrow, tag, type V2 } from '../kit';

const NT = 24; // 두 기어 잇수(같음)
const RP = 0.46; // 피치 반지름 (이끝 0.5 — 깊이 방향으로도 z −0.23 ~ 0.77 안에 들게)
const MOD = (2 * RP) / NT;
const ZC = 0.27; // 축 높이(깊이 z) — 기어 지름이 깊이 방향으로도 나오므로 앞으로 당겨 둔다
const Y1 = 2.25; // 위(구동)
const Y2 = 1.33; // 아래(피동) — 중심 거리 0.92 = 2·RP
const FACE = 0.42; // 이 폭
const TWIST = Math.tan((30 * Math.PI) / 180) * (FACE / 2 / RP); // 헬릭스각 약 30° → 가장자리 단면 비틀림
// 기어 로컬 좌표: 로컬 Z → 세계 +X, 로컬 y → 세계 y. 중심선은 로컬 -y 방향
const C1: V2 = [0, 0];
const C2: V2 = [0, -(Y1 - Y2)];

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const XA = new THREE.Vector3(1, 0, 0);
const QY90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

export default function buildM040(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const g1 = herringboneGear(NT, MOD, { width: FACE, twist: TWIST, hand: 1, driver: true });
  g1.position.set(0, Y1, ZC);
  const g2 = herringboneGear(NT, MOD, { width: FACE, twist: TWIST, hand: -1 });
  g2.position.set(0, Y2, ZC);
  g.add(g1, g2);

  // 가로축 + 뒤판에서 나온 받침 기둥(양끝 2곳씩)과 끝 너트
  for (const y of [Y1, Y2]) {
    g.add(rod(v(-0.78, y, ZC), v(0.78, y, ZC), 0.047));
    for (const x of [-0.7, 0.7]) {
      const post = lathe(rodProfile(0.07, 0, ZC + 0.3, 0.01, 0.01), 28);
      post.rotateX(Math.PI / 2);
      const pm = mesh(post, castIron());
      pm.position.set(x, y, -0.3);
      g.add(pm);
      const ring = lathe(tubeProfile(0.047, 0.085, 0, 0.07, 0.01), 28);
      ring.rotateX(Math.PI / 2);
      const rm = mesh(ring, darkSteel());
      rm.position.set(x, y, ZC - 0.035);
      g.add(rm);
    }
  }

  // 회전 방향 화살표(축이 X 방향이라 YZ 평면에 눕힌다)
  const a1 = rotArrow(0.4, true);
  a1.rotation.y = Math.PI / 2;
  a1.position.set(0.52, Y1, ZC);
  const a2 = rotArrow(0.4, false);
  a2.rotation.y = Math.PI / 2;
  a2.position.set(0.52, Y2, ZC);
  g.add(a1, a2);
  g.add(tag('구동 기어(V자 이)', v(-1.35, Y1, 0.5)), tag('피동 기어(V자 이)', v(-1.35, Y2, 0.5)), tag('이가 비스듬해 계속 물린다', v(1.5, 1.8, 0.5)));

  const q = new THREE.Quaternion();
  return {
    group: g,
    view: { pos: [1.2, 2.2, 6.2], target: [0, 1.8, 0.2] },
    notes: () => [
      { label: '잇수', value: `${NT} : ${NT}` },
      { label: '속도비', value: '1 : 1 (서로 반대 방향)' },
      { label: '이 모양', value: 'V자(헤링본) — 한 쌍이 떨어지기 전에 다음 쌍이 물림' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      q.setFromAxisAngle(XA, theta).multiply(QY90);
      g1.quaternion.copy(q);
      q.setFromAxisAngle(XA, meshAngle(C1, NT, theta, C2, NT)).multiply(QY90);
      g2.quaternion.copy(q);
    }
  };
}
