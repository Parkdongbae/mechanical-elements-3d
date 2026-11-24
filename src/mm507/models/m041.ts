// 041 비스듬한 톱니 기어 — 평행축 헬리컬 기어 2개(잇수 20:28), 이 줄이 서로 반대로 비스듬해 연속적으로 물린다 (판화 41번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, meshAngle, rod, rotArrow, tag, type V2 } from '../kit';
import { helicalGear } from '../kit/gear5';
import { castIron, darkSteel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const ZA = 20; // 위 기어 A(구동) 잇수
const ZB = 28; // 아래 기어 B(피동) 잇수
const MOD = 0.92 / ZB; // 모듈 — B 피치 반지름 0.46, A 피치 반지름 0.3286
const DIST = (MOD * (ZA + ZB)) / 2; // 축간 거리 0.7886 = rpA + rpB
const ZC = 0.27; // 축 깊이(z) — 이끝 0.493 → z −0.223~0.763, 전시 영역 안
const Y2 = 1.32; // 아래 기어 B 중심 y
const Y1 = Y2 + DIST; // 위 기어 A 중심 y = 2.1086
const HELIX = (35 * Math.PI) / 180; // 헬릭스각(판화 빗금 30~37°)
// 기어 로컬 좌표: 로컬 Z → 세계 +X, 로컬 y → 세계 y. 중심선은 로컬 -y 방향
const C1: V2 = [0, 0];
const C2: V2 = [0, -DIST];

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const XA = new THREE.Vector3(1, 0, 0);
const QY90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

export default function buildM041(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 위 기어 A(구동, bronze, hand −1 → 정면에서 이 줄 `/`)·아래 기어 B(피동, hand +1 → `\`)
  const gearA = helicalGear(ZA, MOD, { width: 0.25, helix: HELIX, hand: -1, driver: true });
  gearA.name = 'gearA';
  gearA.position.set(0, Y1, ZC);
  const gearB = helicalGear(ZB, MOD, { width: 0.25, helix: HELIX, hand: 1 });
  gearB.name = 'gearB';
  gearB.position.set(0, Y2, ZC);
  g.add(gearA, gearB);

  // 가로축 2개 + 뒤판에서 나온 받침 기둥(판화에 없음, 최소 — x=±0.45)과 끝 고리
  for (const y of [Y1, Y2]) {
    g.add(rod(v(-0.55, y, ZC), v(0.55, y, ZC), 0.045));
    for (const x of [-0.45, 0.45]) {
      // 기둥은 뒤판(z −0.3)에서 고리 바깥면(z = ZC − 0.085)까지 — 축·고리 구멍을 파고들지 않게
      const post = lathe(rodProfile(0.07, 0, ZC + 0.3 - 0.083, 0.01, 0), 28);
      post.rotateX(Math.PI / 2);
      const pm = mesh(post, castIron());
      pm.position.set(x, y, -0.3);
      g.add(pm);
      // 끝 고리: 구멍 축이 X(축 방향)를 향해야 가로축이 구멍을 지난다
      const ring = lathe(tubeProfile(0.047, 0.085, -0.07, 0.07, 0.01), 28);
      ring.rotateZ(Math.PI / 2);
      const rm = mesh(ring, darkSteel());
      rm.position.set(x, y, ZC);
      g.add(rm);
    }
  }

  // 회전 방향 화살표(축이 X 방향이라 YZ 평면에 눕힌다)
  const aA = rotArrow(0.4, true);
  aA.rotation.y = Math.PI / 2;
  aA.position.set(0.52, Y1, ZC);
  const aB = rotArrow(0.4, false);
  aB.rotation.y = Math.PI / 2;
  // 호의 빈 곳(110°)을 위(위 기어 화살표 쪽)로 — 시계 화살표 250° 호가 위 화살표 호와 맞닿지 않게
  aB.rotation.z = (98 * Math.PI) / 180;
  aB.position.set(0.52, Y2, ZC);
  g.add(aA, aB);
  g.add(
    tag('구동 기어(비스듬한 이)', v(-1.3, 2.11, 0.5)),
    tag('피동 기어(반대로 비스듬)', v(-1.3, 1.32, 0.5)),
    tag('이가 비스듬해 부드럽게 물린다', v(1.4, 1.7, 0.5))
  );

  const q = new THREE.Quaternion();
  return {
    group: g,
    notes: () => [
      { label: '잇수', value: `${ZA} : ${ZB}` },
      { label: '속도비', value: `1 : ${(ZB / ZA).toFixed(2)} (반대 방향)` },
      { label: '이 모양', value: '비스듬한 이(헬릭스각 35°) — 이 하나가 빠지기 전에 다음 이가 물림' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — A 를 구동하면 B 는 −20/28 배(≈0.71)로 반대로 돈다
      theta += OMEGA * speed * dt;
      q.setFromAxisAngle(XA, theta).multiply(QY90);
      gearA.quaternion.copy(q);
      q.setFromAxisAngle(XA, meshAngle(C1, ZA, theta, C2, ZB)).multiply(QY90);
      gearB.quaternion.copy(q);
    }
  };
}
