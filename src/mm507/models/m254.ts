// 254 체인 스프로킷 — Y자 갈래 이가 눕는 고리를 한 마디씩 걸어 끌고, 선 고리는 이 사이를 건너간다.
// 설계표 docs/mm507-sheets/254.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { ChainMesh254, K254, chainJoints254, forks254, sprocketProfile254 } from '../kit/k254';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { brass, darkSteel, steel } from '../../models/materials';

const K = K254;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 회전체(Y축 프로파일) → Z축으로 눕힘 */
function zLathe(profile: [number, number][], segs: number): THREE.BufferGeometry {
  const geo = lathe(profile, segs);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function rimProfile(o: number, i: number, w: number): [number, number][] {
  const p = sprocketProfile254(o, i, w);
  return [...p, p[0]!];
}

export default function buildM254(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());
  const [X1, Y1] = K.C1;
  const [X2, Y2] = K.C2;

  // 축
  const bigShaft = shaftZ(X1, Y1, 0.349, 0.06);
  bigShaft.name = 'bigShaft';
  bigShaft.add(mesh(zLathe(tubeProfile(0.06, 0.09, -0.2, -0.095, 0.004), 36), steel()));
  const driveShaft = shaftZ(X2, Y2, 0.3155, 0.045);
  driveShaft.name = 'driveShaft';
  driveShaft.add(mesh(zLathe(tubeProfile(0.045, 0.07, -0.2, -0.075, 0.004), 32), steel()));
  g.add(bigShaft, driveShaft);

  // 고정 테
  const bigRim = mesh(zLathe(rimProfile(0.44, 0.37, 0.156), 72), brass());
  bigRim.name = 'bigRim';
  bigRim.position.set(X1, Y1, K.ZC);
  const driveRim = mesh(zLathe(rimProfile(0.14, 0.11, 0.076), 48), brass());
  driveRim.name = 'driveRim';
  driveRim.position.set(X2, Y2, K.ZC);
  g.add(bigRim, driveRim);

  // 회전부
  const bigSprocket = new THREE.Group();
  bigSprocket.name = 'bigSprocket';
  bigSprocket.position.set(X1, Y1, K.ZC);
  bigSprocket.add(mesh(zLathe(tubeProfile(0.06, 0.16, -0.195, 0.195, 0.006), 48), darkSteel()));
  const bigForks = forks254(14, 0.44, K.RC_BIG, K.FORK_A0_BIG);
  bigForks.name = 'bigForks';
  bigSprocket.add(bigForks);
  const driveSprocket = new THREE.Group();
  driveSprocket.name = 'driveSprocket';
  driveSprocket.position.set(X2, Y2, K.ZC);
  driveSprocket.add(mesh(zLathe(tubeProfile(0.045, 0.08, -0.175, 0.175, 0.006), 36), darkSteel()));
  const driveForks = forks254(6, 0.14, K.RC_DRIVE, K.FORK_A0_DRIVE);
  driveForks.name = 'driveForks';
  driveSprocket.add(driveForks);
  g.add(bigSprocket, driveSprocket);

  const chain = new ChainMesh254();
  g.add(chain.mesh);

  const arrow = rotArrow(0.36, true);
  arrow.position.set(0, Y2, 0.35);
  g.add(arrow);

  g.add(
    leaderTo(tag('Y자 이', v(1.3, 2.7, 0.15)), 'bigForks'),
    leaderTo(tag('체인 스프로킷', v(-1.1, 2.95, 0.5)), 'bigRim'),
    leaderTo(tag('체인', v(-0.8, 1.4, 0.5)), 'chain'),
    leaderTo(tag('구동 스프로킷', v(-1.45, 0.6, 0.5)), 'driveRim')
  );

  const apply = (): void => {
    const p2 = K.OMEGA * t;
    const p1 = K.RATIO * p2;
    driveShaft.rotation.z = p2;
    driveSprocket.rotation.z = p2;
    bigShaft.rotation.z = p1;
    bigSprocket.rotation.z = p1;
    chain.update(chainJoints254(0.22918 * p2));
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '구동 스프로킷', value: '1.00 rad/s (이 6)' },
      { label: '체인 스프로킷', value: '0.429 rad/s (이 14, ×6/14, 같은 방향)' },
      { label: '체인', value: '고리 42 — 눕는 고리는 Y자 이 갈래에, 선 고리는 이 사이를 건너감' },
      { label: '원리', value: 'Y자 이가 눕는 고리를 한 마디씩 걸어 끌므로 미끄러지지 않는다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [3.6, 2.2, 2.6], target: [0, 1.62, 0.1] }
  };
}
