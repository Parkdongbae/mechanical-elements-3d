// 029 원판 나선 기어 — 원판 위 나선 능선이 랙처럼 평기어 이를 한 개씩 민다 (판화 29번)
// 원판(축 Z)이 구동, 평기어(축 Y)가 종동. 원판 1 회전 = 평기어 이 1개 = 1/16 회전.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, scrollDisc, shaftZ, spurGear, tag } from '../kit';
import { castIron, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const D = { x: -0.35, y: 1.75, z: 0.1 }; // 원판 중심·앞면
const RD = 0.62; // 원판 반지름
const MOD = 0.03;
const NZ = 16; // 평기어 잇수
const PITCH = Math.PI * MOD; // 0.0942
const GX = D.x + 0.455; // 평기어 축 x
const ZG = 0.3775; // 평기어 축 z

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM029(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 원판 누적 각

  g.add(displayStand());

  // 원판 + 축
  // 능선 윗 너비 0.20 피치: 기본(0.26)이면 능선 끝이 기어 폭 가장자리에서 이뿌리 필렛에 0.001 박힌다(수치 검산)
  const disc = scrollDisc(RD, 0.5257, PITCH, { driver: true, ridgeTop: 0.2 * PITCH });
  disc.position.set(D.x, D.y, D.z);
  g.add(disc, shaftZ(D.x, D.y, 0.28, 0.045));

  // 평기어: 피벗(Y축 회전) 안에 눕힌 기어 + 세로 축 막대 + 깃
  const gear = new THREE.Group();
  gear.position.set(GX, D.y, ZG);
  const gearMesh = spurGear(NZ, MOD, { width: 0.1, spokes: 4 });
  gearMesh.rotation.x = -Math.PI / 2;
  gear.add(gearMesh, rod(v(0, -0.66, 0), v(0, 0.66, 0), 0.03));
  const flag = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), paint(0xf2b619));
  flag.position.set(0.06, 0.645, 0); // 위 고리(윗면 +0.63) 위에서 돈다 — 전에는 고리·연결 막대를 지나갔다
  gear.add(flag);
  g.add(gear);

  // 브래킷 2개: 뒤판에서 나온 팔 + 연결 막대 + 고리
  for (const y of [D.y + 0.58, D.y - 0.58]) {
    const arm = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.4125), castIron());
    arm.position.set(GX, y, -0.09375);
    const ringGeo = lathe(tubeProfile(0.03, 0.055, -0.05, 0.05, 0.008), 36);
    const ring = mesh(ringGeo, darkSteel());
    ring.position.set(GX, y, ZG);
    // 연결 막대는 고리 벽(반지름 0.03 ~ 0.055)에서 끝난다 — 고리 가운데까지 가면 도는 축 속에 박힌다
    g.add(arm, ring, rod(v(GX, y, 0.1), v(GX, y, ZG - 0.04), 0.025));
  }

  // 회전 화살표(반시계) — 나선 안쪽, 평기어 이끝과 겹치지 않게 작게
  const arrow = rotArrow(0.22, true);
  arrow.position.set(D.x, D.y, 0.19);
  g.add(arrow);

  g.add(
    tag('원판(나선 능선)', v(-0.9, 1.2, 0.3)),
    tag('평기어(축은 세로)', v(0.95, 2.1, 0.55)),
    tag('능선이 톱니를 한 개씩 민다', v(0.1, 2.55, 0.4))
  );

  return {
    group: g,
    view: { pos: [1.7, 3.0, 4.2], target: [-0.1, 1.75, 0.2] },
    notes: () => [
      { label: '원판 1 회전', value: '평기어 톱니 1개 진행' },
      { label: '속도비', value: '16 : 1' },
      { label: '평기어 회전', value: (theta / NZ / (2 * Math.PI)).toFixed(2) + ' 바퀴' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 능선이 이골 가운데를 계속 따라간다
      theta += OMEGA * speed * dt;
      disc.rotation.z = theta;
      gear.rotation.y = Math.PI / 2 - theta / NZ;
    }
  };
}
