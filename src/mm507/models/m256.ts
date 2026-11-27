// 256 평 풀리 — 아래 구동 풀리가 평벨트로 큰 볼록 림 풀리를 같은 방향(반시계)으로 0.365배 속도로 돌린다.
// 볼록 림이 벨트를 가운데로 모은다. 큰 풀리 림은 앞 오른쪽 아래(ψ −90°~−28°)를 잘라 단면판이 보이고,
// 림·단면판은 세계에 고정(회전은 허브 표시·너트·벨트 표시로 보인다). 설계표 docs/mm507-sheets/256.md
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { Belt, beltPathAround, displayStand, leaderTo, planar, pulley, rotArrow, shaftZ, tag } from '../kit';
import { bigHub256, cutRim256, K256 } from '../kit/k256';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM256(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // 큰 풀리 축(φ1): 뒤판 보스 + 축 + 끝 너트(뒷면 0.31 = 허브 앞면). 칼라(−0.20~−0.11)가 허브 뒤를 받친다
  const bigShaft = shaftZ(K256.C1[0], K256.C1[1], 0.364, 0.06);
  bigShaft.name = 'bigShaft';
  const bigCollarGeo = lathe(tubeProfile(0.06, 0.09, -0.2, -0.11, 0.004), 36);
  bigCollarGeo.rotateX(Math.PI / 2);
  bigShaft.add(mesh(bigCollarGeo, steel()));
  g.add(bigShaft);

  // 큰 풀리 회전부(φ1): 허브 + 노란 표시 — 잘린 볼록 림은 여기에 안 속한다(세계 고정)
  const bigPulley = bigHub256();
  bigPulley.name = 'bigPulley';
  bigPulley.position.set(K256.C1[0], K256.C1[1], K256.ZC);
  g.add(bigPulley);

  // 큰 풀리 림(고정): 잘린 볼록 회전체 + 주홍 단면판 둘 — 단면이 늘 앞 오른쪽 아래에 있다
  const bigRimGroup = cutRim256();
  bigRimGroup.name = 'bigRimGroup';
  bigRimGroup.position.set(K256.C1[0], K256.C1[1], K256.ZC);
  g.add(bigRimGroup);

  // 구동 풀리 축(φ2): 너트 뒷면 0.24 = 허브 앞면. 칼라(−0.20~−0.04)가 허브 뒤를 받친다
  const driveShaft = shaftZ(K256.C2[0], K256.C2[1], 0.2805, 0.045);
  driveShaft.name = 'driveShaft';
  const driveCollarGeo = lathe(tubeProfile(0.045, 0.07, -0.2, -0.04, 0.004), 32);
  driveCollarGeo.rotateX(Math.PI / 2);
  driveShaft.add(mesh(driveCollarGeo, steel()));
  g.add(driveShaft);

  // 구동 풀리(키트 납작 림, φ2) — 평벨트 ↔ 납작 림 짝
  const drivePulley = pulley(0.22, { flat: true, width: 0.24, spokes: 4, hub: 0.045, driver: true });
  drivePulley.name = 'drivePulley';
  drivePulley.position.set(K256.C2[0], K256.C2[1], K256.ZC);
  drivePulley.children[0]!.name = 'driveRim'; // 림 메시
  g.add(drivePulley);

  // 평벨트(닫힌 고리, 반시계) — 폭 방향 +Z 로 띠가 볼록 림 위에 눕는다
  const path = planar(
    beltPathAround(
      [
        { c: K256.C1, r: K256.R_BELT_BIG, ccw: true },
        { c: K256.C2, r: K256.R_BELT_DRIVE, ccw: true }
      ],
      48
    ),
    K256.ZC
  );
  const belt = new Belt(path, {
    style: 'flat',
    width: 0.22,
    thickness: 0.02,
    widthDirs: path.map(() => new THREE.Vector3(0, 0, 1)),
    marks: 8
  });
  belt.group.name = 'belt';
  belt.group.children[0]!.name = 'beltStrip'; // 띠 메시
  g.add(belt.group);

  // 회전 방향 화살표(구동 풀리 앞, 반시계)
  const arrow = rotArrow(0.3, true);
  arrow.position.set(K256.C2[0], K256.C2[1], 0.32);
  g.add(arrow);

  // 이름표 4개 — 이름표 표의 자리·지시 대상 그대로
  g.add(
    leaderTo(tag('평 풀리', v(-1.05, 2.8, 0.5)), 'bigRim'),
    leaderTo(tag('림 단면', v(0.4, 2.6, 1.1)), 'bigCutFace'),
    leaderTo(tag('평벨트', v(-0.95, 1.35, 0.5)), 'beltStrip'),
    leaderTo(tag('구동 풀리', v(-1.2, 0.65, 0.5)), 'driveRim')
  );

  // 모든 자세를 φ2 하나에서 다시 계산(절대 자세)
  const apply = (phi2: number): void => {
    const phi1 = K256.RATIO * phi2;
    bigShaft.rotation.z = phi1;
    bigPulley.rotation.z = phi1;
    driveShaft.rotation.z = phi2;
    drivePulley.rotation.z = phi2;
    belt.setOffset(K256.R_BELT_DRIVE * phi2);
  };
  let theta = 0;
  apply(0);

  return {
    group: g,
    view: { pos: [3.3, 2.5, 1.6], target: [0, 1.7, 0.2] },
    notes: () => [
      { label: '구동 풀리', value: '1.20 rad/s' },
      { label: '평 풀리', value: '0.438 rad/s (×0.365, 같은 방향)' },
      { label: '림', value: '평평한 넓은 테 — 가운데가 0.008 볼록' },
      { label: '원리', value: '납작한 벨트가 림과의 마찰로 돌린다. 볼록한 림이 벨트를 가운데로 모은다' }
    ],
    update(dt: number, speed: number): void {
      theta += K256.OMEGA * speed * dt;
      apply(theta);
    }
  };
}
