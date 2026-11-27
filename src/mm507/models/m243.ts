// 243 수평 축에서 수직 축 둘로 — 가운데 수평 축 풀리가 1/4 비틀린 벨트로 좌우 세로 축 둘을 같은 방향으로 1.36배 돌린다.
// 설계표 docs/mm507-sheets/243.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { Belt, displayStand, leaderTo, pulley, rotArrow, tag } from '../kit';
import { K243, twistBeltPath243, verticalDrum243 } from '../kit/k243';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const K = K243;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const TAG_Z = 0.4;

/** z 축 원기둥(중심 (x, y), z0 ~ z1) */
function cylZ(r: number, z0: number, z1: number, mat: THREE.Material, x = 0, y = 0): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, z1 - z0, 32);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.set(x, y, (z0 + z1) / 2);
  return m;
}

export default function buildM243(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // 가운데 풀리 + 수평 축 + 앞 칼라(돎)
  const pulleyC = pulley(0.33, { flat: true, width: 0.16, spokes: 4, driver: true });
  pulleyC.name = 'pulleyC';
  pulleyC.position.set(0, K.Y_C, K.ZF);
  g.add(pulleyC);
  const hShaft = new THREE.Group();
  hShaft.name = 'hShaft';
  hShaft.position.set(0, K.Y_C, 0);
  hShaft.add(cylZ(0.045, -0.3, 0.5, steel()), cylZ(0.07, 0.39, 0.43, steel()));
  g.add(hShaft);
  const hBearing = new THREE.Group();
  hBearing.name = 'hBearing';
  hBearing.position.set(0, K.Y_C, 0);
  hBearing.add(cylZ(0.15, -0.3, -0.27, darkSteel()), cylZ(0.09, -0.27, -0.12, darkSteel()));
  g.add(hBearing);

  // 안내 풀리 2 + 고정 짧은 축
  const guides: THREE.Group[] = [];
  for (const [nm, sx] of [['L', -1], ['R', 1]] as [string, number][]) {
    const gp = pulley(0.19, { flat: true, width: 0.16, spokes: 0 });
    gp.name = `guide${nm}`;
    gp.position.set(sx * K.X_GUIDE, K.Y_GUIDE, K.ZF);
    g.add(gp);
    guides.push(gp);
    const ax = new THREE.Group();
    ax.name = `guideAxle${nm}`;
    ax.position.set(sx * K.X_GUIDE, K.Y_GUIDE, 0);
    ax.add(cylZ(0.025, -0.3, 0.41, steel()), cylZ(0.07, -0.3, -0.28, steel()), cylZ(0.045, 0.39, 0.42, steel()));
    g.add(ax);
  }

  // 세로 드럼 2(회전 그룹) + 세로 축 2 + 받침 4
  const drums: THREE.Group[] = [];
  const shafts: THREE.Group[] = [];
  for (const [nm, sx] of [['L', -1], ['R', 1]] as [string, number][]) {
    const drum = new THREE.Group();
    drum.name = `drum${nm}`;
    drum.position.set(sx * K.X_DRUM, K.Y0, K.Z_DRUM);
    const vd = verticalDrum243();
    vd.children[0]!.name = `drum${nm}Rim`; // 안의 풀리(검사가 바퀴 이름으로 읽는다)
    drum.add(vd);
    g.add(drum);
    drums.push(drum);

    const vs = new THREE.Group();
    vs.name = `vShaft${nm}`;
    vs.position.set(sx * K.X_DRUM, 0, K.Z_DRUM);
    const body = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 32), steel());
    body.position.y = 1.95;
    const band = mesh(new THREE.BoxGeometry(0.082, 0.04, 0.01), paint(0xf2b619));
    band.position.set(0, 2.55, 0.04);
    const collar = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 32), steel());
    collar.position.y = 1.075;
    vs.add(body, band, collar);
    g.add(vs);
    shafts.push(vs);

    for (const [pos, by] of [['low', 1.03], ['top', 2.85]] as [string, number][]) {
      const b = new THREE.Group();
      b.name = `vBearing${nm}${pos}`;
      const arm = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.29), darkSteel());
      arm.position.set(sx * K.X_DRUM, by, -0.155);
      const ring = mesh(lathe(tubeProfile(0.042, 0.085, -0.03, 0.03, 0.005), 32), darkSteel());
      ring.position.set(sx * K.X_DRUM, by, K.Z_DRUM);
      b.add(arm, ring);
      g.add(b);
    }
  }

  // 벨트
  const bp = twistBeltPath243();
  const belt = new Belt(bp.pts, { style: 'flat', width: 0.1, thickness: 0.02, widthDirs: bp.dirs, marks: 8 });
  belt.group.name = 'belt';
  g.add(belt.group);

  // 회전 표시: 가운데 풀리 앞, 반시계
  const arrow = rotArrow(0.22, true);
  arrow.position.set(0, K.Y_C, 0.52);
  g.add(arrow);

  g.add(
    leaderTo(tag('수직 축 풀리', v(-0.5, 2.55, TAG_Z)), 'drumL'),
    leaderTo(tag('1/4 꼬인 벨트', v(0.3, 2.95, TAG_Z)), 'belt'),
    leaderTo(tag('안내 풀리', v(-0.75, 0.85, TAG_Z)), 'guideL'),
    leaderTo(tag('가운데 풀리', v(0.7, 0.85, TAG_Z)), 'pulleyC'),
    leaderTo(tag('수평 축(돌린다)', v(0.3, 0.4, TAG_Z)), 'hShaft'),
    leaderTo(tag('수직 축', v(-1.3, 0.35, TAG_Z)), 'vShaftL')
  );

  const apply = (): void => {
    const phi = K.OMEGA * tm;
    pulleyC.rotation.z = phi;
    hShaft.rotation.z = phi;
    for (const gp of guides) gp.rotation.z = -1.7 * phi;
    for (const d of drums) d.rotation.y = 1.36 * phi;
    for (const s of shafts) s.rotation.y = 1.36 * phi;
    belt.setOffset(K.R_C_PATH * phi);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '수평 축', value: '0.60 rad/s' },
      { label: '수직 축 둘', value: '0.816 rad/s (×1.36, 같은 방향)' },
      { label: '안내 풀리', value: '1.02 rad/s (×1.7)' },
      { label: '원리', value: '앞 가닥이 드럼 평면과 안내 풀리 평면이 만나는 선 위에 있어 1/4 비틀려도 벗어나지 않는다' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [0.6, 2.9, 5.6], target: [0, 1.85, 0.06] }
  };
}
