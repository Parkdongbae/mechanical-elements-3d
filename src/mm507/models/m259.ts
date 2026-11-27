// 259 톱니 V홈 풀리 — V홈 두 비탈에 이랑(톱니) 72개씩 새겨 둥근 줄이 이랑 끝에 걸린다.
// 아래 매끈한 V홈 구동 풀리가 줄을 흘려 위 톱니 V홈 풀리를 0.468배로 돌린다(헛돌지 않음).
// 설계표 docs/mm507-sheets/259.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { Belt, beltPathAround, displayStand, leaderTo, planar, rotArrow, shaftZ, tag } from '../kit';
import { K259, bigHub259, cutRim259, ribs259, vGroovePulley259, type Rib259 } from '../kit/k259';
import { steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM259(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 큰 풀리 축(φ1) + 칼라(뒷판 보스 −0.30~−0.20 ↔ 칼라 −0.20~−0.13 ↔ 너트 0.33~0.384)
  const bigShaft = shaftZ(K259.C1[0], K259.C1[1], 0.384, 0.06);
  bigShaft.name = 'bigShaft';
  const bigCollar = lathe(tubeProfile(0.06, 0.09, -0.2, -0.13, 0.004), 36);
  bigCollar.rotateX(Math.PI / 2);
  bigShaft.add(mesh(bigCollar, steel()));

  // 큰 풀리 회전부(허브 + 이랑, φ1) — 바탕 림은 회전 대칭이라 세계에 고정
  const bigPulley = bigHub259();
  bigPulley.name = 'bigPulley';
  bigPulley.position.set(K259.C1[0], K259.C1[1], K259.ZC);
  const ribGroup = ribs259();
  bigPulley.add(ribGroup); // 이랑은 풀리와 함께 돈다
  const ribs = ribGroup.userData.ribs as Rib259[];

  const bigRimGroup = cutRim259();
  bigRimGroup.position.set(K259.C1[0], K259.C1[1], K259.ZC);

  // 구동 풀리 축(φ2) + 칼라(−0.20~−0.11, 너트 0.31~0.3505)
  const driveShaft = shaftZ(K259.C2[0], K259.C2[1], 0.3505, 0.045);
  driveShaft.name = 'driveShaft';
  const driveCollar = lathe(tubeProfile(0.045, 0.07, -0.2, -0.11, 0.004), 32);
  driveCollar.rotateX(Math.PI / 2);
  driveShaft.add(mesh(driveCollar, steel()));

  // 구동 풀리(φ2, 온 바퀴, 매끈한 V홈)
  const drivePulley = vGroovePulley259(0.32);
  drivePulley.name = 'drivePulley';
  drivePulley.position.set(K259.C2[0], K259.C2[1], K259.ZC);

  // 둥근 줄 — 두 V홈 가운데 평면(z 0.10) 위 닫힌 고리, 반시계
  const path2d = beltPathAround(
    [
      { c: K259.C1, r: K259.R_ROPE_BIG, ccw: true },
      { c: K259.C2, r: K259.R_ROPE_DRIVE, ccw: true }
    ],
    48
  );
  const pts = planar(path2d, K259.ZC);
  const rope = new Belt(pts, {
    style: 'rope',
    ropeR: K259.ROPE_R,
    widthDirs: pts.map(() => v(0, 0, 1)),
    marks: 6
  });
  rope.group.name = 'rope';
  rope.group.children[0]!.name = 'ropeStrip';

  // 회전 방향 화살표(구동 풀리 앞, 반시계)
  const arrow = rotArrow(0.4, true);
  arrow.position.set(K259.C2[0], K259.C2[1], 0.39);

  g.add(bigShaft, bigPulley, bigRimGroup, driveShaft, drivePulley, rope.group, arrow);

  // 이름표 4개 — 이름표 표대로 leaderTo
  g.add(
    leaderTo(tag('톱니 V홈 풀리', v(-1.4, 2.9, 0.5)), 'bigRim'),
    leaderTo(tag('홈 단면', v(0.4, 2.6, 1.1)), 'bigCutFace'),
    leaderTo(tag('둥근 줄', v(-1.0, 1.3, 0.5)), 'ropeStrip'),
    leaderTo(tag('구동 풀리', v(-1.35, 0.6, 0.5)), 'driveRim')
  );

  // 결정적 자세 계산 — theta 에서 전부 다시
  const apply = (): void => {
    const phi2 = theta; // φ2 = 1.2·t
    const phi1 = K259.RATIO * phi2; // φ1 = 0.46785·φ2
    bigShaft.rotation.z = phi1;
    bigPulley.rotation.z = phi1;
    driveShaft.rotation.z = phi2;
    drivePulley.rotation.z = phi2;
    rope.setOffset(K259.R_ROPE_DRIVE * phi2);
    // 이랑 감추기 — 잘린 자리 ψ −90°~−25° 에 든 이랑만 끈다(이랑 반폭 1° + 여유 1°)
    const phi1deg = (phi1 * 180) / Math.PI;
    for (const rib of ribs) {
      let w = (((rib.deg + phi1deg + 180) % 360) + 360) % 360 - 180; // (−180°, 180°]
      if (w === -180) w = 180;
      const hide = w >= -92 && w <= -23;
      rib.front.visible = !hide;
      rib.back.visible = !hide;
    }
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '구동 풀리', value: '1.20 rad/s' },
      { label: '톱니 V홈 풀리', value: '0.561 rad/s (×0.468, 같은 방향)' },
      { label: '톱니', value: 'V 비탈마다 이랑 72개(5° 간격, 높이 0.012)' },
      { label: '원리', value: '줄이 이랑 끝에 눌려 파고들 듯 걸리므로 매끈한 V홈보다 덜 미끄러진다' }
    ],
    update(dt: number, speed: number): void {
      theta += K259.OMEGA * speed * dt;
      apply();
    },
    view: { pos: [3.3, 2.5, 1.6], target: [0, 1.7, 0.2] }
  };
}
