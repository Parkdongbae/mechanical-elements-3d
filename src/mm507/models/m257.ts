// 257 둥근 홈 풀리 — 아래 구동 풀리가 둥근 줄을 흘려 위 둥근 홈 풀리를 0.477배로 돌린다.
// 설계표 docs/mm507-sheets/257.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { Belt, beltPathAround, displayStand, leaderTo, planar, rotArrow, shaftZ, tag } from '../kit';
import { K257, bigHub257, cutRim257, roundGroovePulley257 } from '../kit/k257';
import { steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM257(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 큰 풀리 축(φ1) + 칼라(뒷판 보스 −0.30~−0.20 ↔ 칼라 −0.20~−0.125 ↔ 너트 0.325~0.379)
  const bigShaft = shaftZ(K257.C1[0], K257.C1[1], 0.379, 0.06);
  bigShaft.name = 'bigShaft';
  const bigCollar = lathe(tubeProfile(0.06, 0.09, -0.2, -0.125, 0.004), 36);
  bigCollar.rotateX(Math.PI / 2);
  bigShaft.add(mesh(bigCollar, steel()));

  // 큰 풀리 회전부(허브, φ1) — 림은 고정이라 세계에 따로
  const bigPulley = bigHub257();
  bigPulley.name = 'bigPulley';
  bigPulley.position.set(K257.C1[0], K257.C1[1], K257.ZC);
  const bigRimGroup = cutRim257();
  bigRimGroup.position.set(K257.C1[0], K257.C1[1], K257.ZC);

  // 구동 풀리 축(φ2) + 칼라(−0.20~−0.105, 너트 0.305~0.3455)
  const driveShaft = shaftZ(K257.C2[0], K257.C2[1], 0.3455, 0.045);
  driveShaft.name = 'driveShaft';
  const driveCollar = lathe(tubeProfile(0.045, 0.07, -0.2, -0.105, 0.004), 32);
  driveCollar.rotateX(Math.PI / 2);
  driveShaft.add(mesh(driveCollar, steel()));

  // 구동 풀리(φ2, 온 바퀴)
  const drivePulley = roundGroovePulley257(0.3);
  drivePulley.name = 'drivePulley';
  drivePulley.position.set(K257.C2[0], K257.C2[1], K257.ZC);

  // 둥근 줄 — 두 홈 가운데 평면(z 0.10) 위 닫힌 고리, 반시계
  const path2d = beltPathAround(
    [
      { c: K257.C1, r: K257.R_ROPE_BIG, ccw: true },
      { c: K257.C2, r: K257.R_ROPE_DRIVE, ccw: true }
    ],
    48
  );
  const pts = planar(path2d, K257.ZC);
  const rope = new Belt(pts, {
    style: 'rope',
    ropeR: K257.ROPE_R,
    widthDirs: pts.map(() => v(0, 0, 1)),
    marks: 6
  });
  rope.group.name = 'rope';
  rope.group.children[0]!.name = 'ropeStrip';

  // 회전 방향 화살표(구동 풀리 앞, 반시계)
  const arrow = rotArrow(0.38, true);
  arrow.position.set(K257.C2[0], K257.C2[1], 0.38);

  g.add(bigShaft, bigPulley, bigRimGroup, driveShaft, drivePulley, rope.group, arrow);

  // 이름표 4개 — 이름표 표대로 leaderTo
  g.add(
    leaderTo(tag('둥근 홈 풀리', v(-1.2, 2.95, 0.5)), 'bigRim'),
    leaderTo(tag('홈 단면', v(0.4, 2.6, 1.1)), 'bigCutFace'),
    leaderTo(tag('둥근 줄', v(-1.1, 1.4, 0.5)), 'ropeStrip'),
    leaderTo(tag('구동 풀리', v(-1.3, 0.6, 0.5)), 'driveRim')
  );

  // 결정적 자세 계산 — theta 에서 전부 다시
  const apply = (): void => {
    const phi2 = theta; // φ2 = 1.2·t
    const phi1 = K257.RATIO * phi2; // φ1 = 0.47712·φ2
    bigShaft.rotation.z = phi1;
    bigPulley.rotation.z = phi1;
    driveShaft.rotation.z = phi2;
    drivePulley.rotation.z = phi2;
    rope.setOffset(K257.R_ROPE_DRIVE * phi2);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '구동 풀리', value: '1.20 rad/s' },
      { label: '둥근 홈 풀리', value: '0.573 rad/s (×0.477, 같은 방향)' },
      { label: '홈', value: '반원 홈 반지름 0.093 — 둥근 줄(0.085)이 바닥에 앉음' },
      { label: '원리', value: '둥근 홈이 둥근 줄을 감싸 옆으로 벗어나지 않게 한다' }
    ],
    update(dt: number, speed: number): void {
      theta += K257.OMEGA * speed * dt;
      apply();
    },
    view: { pos: [3.3, 2.5, 1.6], target: [0, 1.7, 0.2] }
  };
}
