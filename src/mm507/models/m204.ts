// 204 비스듬한 축의 구름 접촉 — 엇갈린(꼬인) 두 축의 쌍곡면 롤러 둘이 곧은 접촉선 하나를 따라 맞닿아 구른다
// 설계표 docs/mm507-sheets/204.md
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import { rod } from '../kit/shaft';
import { K204, hyperRoller204, rulings204 } from '../kit/k204';
import { brass, bronze, castIron, paint, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const AL = K204.alpha;
const YL = K204.yL;
const ZC = K204.zc;
const A = K204.a;

export default function buildM204(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let spd = 1;
  g.add(displayStand());

  // 위 롤러(구동): 피벗(rotation.y) → 롤러(rotation.x)
  const pivotU = new THREE.Group();
  pivotU.position.set(0, YL + A, ZC);
  pivotU.rotation.y = -AL;
  const rollerU = hyperRoller204(brass());
  rollerU.name = 'rollerU';
  rollerU.add(rulings204(1));
  pivotU.add(rollerU);

  const pivotL = new THREE.Group();
  pivotL.position.set(0, YL - A, ZC);
  pivotL.rotation.y = AL;
  const rollerL = hyperRoller204(bronze());
  rollerL.name = 'rollerL';
  rollerL.add(rulings204(-1));
  pivotL.add(rollerL);
  g.add(pivotU, pivotL);

  // 손잡이 크랭크(위 롤러 자식)
  const crank = new THREE.Group();
  crank.name = 'crank';
  const arm = mesh(new THREE.BoxGeometry(0.03, 0.2, 0.04), castIron());
  arm.position.set(-1.12, 0.1, 0);
  const hg = new THREE.CylinderGeometry(0.022, 0.022, 0.1);
  hg.rotateZ(Math.PI / 2);
  const handle = mesh(hg, wood());
  handle.position.set(-1.17, 0.19, 0);
  crank.add(arm, handle);
  rollerU.add(crank);

  // 축받이 4개(고정)
  const dU = v(Math.cos(AL), 0, Math.sin(AL));
  const dL = v(Math.cos(AL), 0, -Math.sin(AL));
  const bx = Math.cos(AL);
  const bz = Math.sin(AL);
  const bearing = (x: number, y: number, z: number, d: THREE.Vector3, name: string): void => {
    const b = wallBearing(x, y, z, d, 0.042);
    b.name = name;
    g.add(b);
  };
  bearing(bx, YL + A, ZC + bz, dU, 'bearingU1');
  bearing(-bx, YL + A, ZC - bz, dU, 'bearingU2');
  bearing(bx, YL - A, ZC - bz, dL, 'bearingL1');
  bearing(-bx, YL - A, ZC + bz, dL, 'bearingL2');

  // 접촉선 표시
  const line = rod(v(-0.79, YL, ZC), v(0.79, YL, ZC), 0.005);
  line.material = paint(0xffcc00);
  line.name = 'contactLine';
  g.add(line);

  // 회전 화살표
  const arrU = rotArrow(0.36, true);
  arrU.position.set(0.88, 0, 0);
  arrU.rotation.y = Math.PI / 2;
  pivotU.add(arrU);
  const arrL = rotArrow(0.36, false);
  arrL.position.set(-0.88, 0, 0);
  arrL.rotation.y = Math.PI / 2;
  pivotL.add(arrL);

  g.add(
    leaderTo(tag('위 쌍곡면 롤러(구동)', v(-1.35, 2.55, 0.35)), 'rollerU'),
    leaderTo(tag('아래 쌍곡면 롤러', v(1.35, 0.75, 0.35)), 'rollerL'),
    leaderTo(tag('접촉선(곧은 선)', v(1.55, 1.6, 0.4)), 'contactLine'),
    leaderTo(tag('축받이(고정)', v(1.55, 2.45, 0.35)), 'bearingU1')
  );

  const apply = (): void => {
    rollerU.rotation.x = theta;
    rollerL.rotation.x = -theta;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '축 사이 각(위에서 본)', value: '30°' },
      { label: '속도비', value: '1 : 1 (반대 방향)' },
      { label: '접촉', value: '곧은 접촉선 하나를 따라 구른다' },
      { label: '접촉선 방향 미끄럼', value: (2 * 0.22 * Math.sin(0.261799) * 1.6 * Math.abs(spd)).toFixed(3) + ' /s' }
    ],
    update(dt: number, speed: number): void {
      spd = speed;
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [1.5, 2.9, 4.9], target: [0, 1.6, 0.28] }
  };
}
