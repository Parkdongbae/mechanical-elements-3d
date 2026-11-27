// 265 원뿔 마찰 변속 — 일정하게 도는 곧은 원뿔 드럼 윗선에 롤러가 닿아 구르고, 포크가 롤러를 굵은 쪽↔가는 쪽으로 옮긴다.
// 닿는 반지름 R(s)가 바뀌어 롤러 속도가 1.48~2.70 배로 바뀐다 — 설계표 docs/mm507-sheets/265.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { pedestalX, wallBearing } from '../kit/gear6';
import { K265, cone265, fork265, guide265, roller265, state265 } from '../kit/k265';
import { darkSteel, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { pulley } from '../kit/pulley';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const K = K265;

export default function buildM265(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // 원뿔 드럼 묶음
  const coneDrum = cone265();
  coneDrum.name = 'coneDrum';
  coneDrum.position.set(K.XL, K.YC, K.ZC);
  g.add(coneDrum);

  // 원뿔 받침(고정)
  const pedL = pedestalX(-1.3, K.YC, K.ZC, -1, 0.18, 0.05);
  pedL.name = 'pedL';
  const pedR = pedestalX(0.7, K.YC, K.ZC, 1, 0.18, 0.05);
  pedR.name = 'pedR';
  g.add(pedL, pedR);

  // 롤러 축 묶음(기운 축)
  const rollerFrame = new THREE.Group();
  rollerFrame.name = 'rollerFrame';
  rollerFrame.position.set(K.C0[0], K.C0[1], K.ZC);
  rollerFrame.rotation.z = -K.ALPHA;
  const rollerShaft = new THREE.Group();
  rollerShaft.name = 'rollerShaft';
  const shaftBody = mesh(lathe(rodProfile(0.03, -0.35, 1.63, 0.003, 0.003), 28).rotateZ(-PI / 2), steel());
  shaftBody.name = 'rollerShaftBody';
  rollerShaft.add(shaftBody);
  for (const [x0, x1] of [
    [-0.34, -0.325],
    [1.555, 1.57]
  ] as [number, number][]) {
    const ring = mesh(lathe(tubeProfile(0.029, 0.05, x0, x1, 0.002), 32).rotateZ(-PI / 2), darkSteel());
    ring.name = 'rollerStopRing';
    rollerShaft.add(ring);
  }
  const roller = roller265();
  roller.name = 'frictionRoller';
  rollerShaft.add(roller);
  const outDisk = new THREE.Group();
  outDisk.name = 'outDisk';
  outDisk.position.x = 1.615;
  outDisk.rotation.y = PI / 2;
  outDisk.add(pulley(0.1, { flat: true, width: 0.04, spokes: 0, hub: 0.03 }));
  rollerShaft.add(outDisk);
  rollerFrame.add(rollerShaft);
  g.add(rollerFrame);

  // 롤러 축받이(고정)
  const gdir = v(K.COS, -K.SIN, 0);
  const brgL = wallBearing(-1.1037, 1.7459, K.ZC, gdir, 0.035);
  brgL.name = 'brgL';
  const brgR = wallBearing(0.5746, 1.3263, K.ZC, gdir.clone(), 0.035);
  brgR.name = 'brgR';
  g.add(brgL, brgR);

  // 옮김 막대 + 포크
  const guide = guide265();
  g.add(guide);
  const fork = fork265();
  guide.getObjectByName('guideFrame')!.add(fork);

  // 원뿔 회전 화살표
  const arrow = rotArrow(0.3, true);
  arrow.rotation.y = PI / 2;
  arrow.position.set(-1.0, K.YC, K.ZC);
  g.add(arrow);

  g.add(
    leaderTo(tag('원뿔 드럼', v(-0.3, 0.36, 0.6)), 'coneBody'),
    leaderTo(tag('마찰 롤러', v(-1.1, 2.4, 0.6)), 'rollerTire'),
    leaderTo(tag('롤러 축', v(0.85, 1.9, 0.6)), 'rollerShaft'),
    leaderTo(tag('옮김 포크', v(0.15, 2.45, 0.6)), 'shiftFork'),
    leaderTo(tag('구동', v(-1.65, 1.55, 0.6)), 'driveWheel')
  );

  let sNow = 0.6;
  let RNow = 0.3345;
  const apply = (): void => {
    const st = state265(tm);
    sNow = st.s;
    RNow = st.R;
    coneDrum.rotation.x = st.phiC;
    roller.position.x = st.s;
    fork.position.x = st.s + 0.065;
    rollerShaft.rotation.x = st.thetaR;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '원뿔 드럼', value: '1.20 rad/s (일정)' },
      { label: '롤러 자리', value: 's = ' + sNow.toFixed(2) + ' (0.20 굵은 쪽 ~ 1.00 가는 쪽)' },
      { label: '롤러 속도', value: (7.5 * RNow).toFixed(2) + ' rad/s (7.5·R, 비 ' + (RNow / 0.16).toFixed(2) + ')' },
      { label: '원리', value: '닿는 반지름이 바뀌어 같은 원뿔 속도에서 롤러 속도가 1.48 ~ 2.70 배로 바뀐다' },
      { label: '모델 메모', value: '판화의 오목한 원뿔을 곧은 원뿔로(곧은 롤러 축이 늘 닿게)' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [0.5, 2.1, 4.6], target: [-0.3, 1.3, 0.28] }
  };
}
