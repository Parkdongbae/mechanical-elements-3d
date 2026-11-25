// 173 나사로 바뀌는 왕복 거리 — 원판이 한 바퀴 돌 때마다 태핏 바퀴가 나사를 1/4 바퀴 돌려 너트(핀)가 옮겨 가고 홈 막대의 행정이 달라진다 (판화 173번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rod, rotArrow, shaftZ, tag, wormScrew } from '../kit';
import { bronze, castIron, darkSteel, steel } from '../../models/materials';
import { cylZ172 } from '../kit/k172';
import { extrude, mesh } from '../../models/parts/geom';
import { K173, boxAt173, sleeve173, slottedBar173, step173, tappetWheel173 } from '../kit/k173';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const [CX, CY] = K173.C;
const ZS = K173.zAxis;

export default function buildM173(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());
  g.add(shaftZ(CX, CY, 0.06, 0.05));

  // 회전 그룹: 원판 + 나사 받침 + 나사 + 너트 + 태핏 바퀴
  const disc = new THREE.Group();
  disc.name = 'disc';
  disc.position.set(CX, CY, 0);
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, K173.discR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.052, 0, Math.PI * 2, true);
  plateShape.holes.push(hole);
  const plate = mesh(extrude(plateShape, 0.05, 0.005, 64), bronze());
  plate.position.z = 0.065;
  disc.add(plate);

  const axis = new THREE.Group();
  axis.rotation.z = K173.beta0;
  disc.add(axis);
  // 레일(나사 아래) + 귀 2개
  axis.add(boxAt173(1.9, 0.16, 0.03, 0, 0, 0.105, darkSteel()));
  for (const s of [-1, 1]) axis.add(boxAt173(0.08, 0.16, 0.19, s * 0.97, 0, 0.185, castIron()));
  // 나사(+ 양 끝 축 + 태핏 바퀴)
  const screw = wormScrew(0.045, 0.075, K173.pitch, 1.84);
  screw.name = 'screw';
  screw.add(rod(v(-1.02, 0, 0), v(K173.wheelRho, 0, 0), 0.03));
  const wheel = tappetWheel173();
  wheel.name = 'wheel';
  wheel.position.x = K173.wheelRho;
  screw.add(wheel);
  screw.position.set(0, 0, ZS);
  axis.add(screw);
  // 너트 + 핀
  const nut = new THREE.Group();
  nut.name = 'nut';
  nut.add(boxAt173(0.13, 0.18, 0.162, 0, 0, 0.2035, steel()));
  nut.add(cylZ172(K173.studR, 0.285, 0.46, steel()));
  nut.add(cylZ172(0.06, 0.43, 0.46, darkSteel()));
  axis.add(nut);
  g.add(disc);

  // 홈 막대 + 안내 슬리브 + 받침 기둥
  const bar = slottedBar173();
  bar.name = 'bar';
  g.add(bar);
  const sl = sleeve173();
  sl.position.set(0.825, CY, K173.barZ);
  g.add(sl, boxAt173(0.07, 0.2, 0.63, 0.825, CY, 0.015, castIron()));

  // 태핏(고정): 바퀴 위 핀 + 틀 + 받침 기둥
  const px = CX + K173.wheelRho * Math.cos(K173.beta0);
  const py = CY + K173.wheelRho * Math.sin(K173.beta0);
  const tappet = new THREE.Group();
  tappet.name = 'tappet';
  tappet.add(cylZ172(0.02, 0.375, 0.57, steel()));
  tappet.add(boxAt173(1.0, 0.16, 0.1, px + 0.35, py, 0.6, castIron()), boxAt173(0.12, 0.16, 0.9, 1.1, py, 0.15, castIron()));
  g.add(tappet);

  const arrow = rotArrow(0.35, true);
  arrow.position.set(CX, CY - 0.45, 0.5);
  g.add(arrow);

  const barTag = leaderTo(tag('홈 막대', v(0, 2.7, 0.65)), 'bar');
  const nutTag = leaderTo(tag('나사·너트', v(0, 0, 0.65)), 'nut');
  const wheelTag = leaderTo(tag('태핏 바퀴', v(0, 0, 0.65)), 'wheel');
  g.add(tag('원판(구동)', v(-1.7, 2.8, 0.65)), barTag, nutTag, wheelTag, leaderTo(tag('태핏 핀(고정)', v(0.95, 2.8, 0.65)), 'tappet'));

  let cur = step173(0);
  const apply = (): void => {
    cur = step173(theta);
    disc.rotation.z = theta;
    screw.rotation.x = cur.phiS;
    nut.position.x = cur.rho;
    const a = theta + K173.beta0;
    const pinX = CX + cur.rho * Math.cos(a);
    const nutY = CY + cur.rho * Math.sin(a);
    bar.position.set(pinX, CY, K173.barZ);
    barTag.position.set(pinX, 2.72, 0.65);
    nutTag.position.set(pinX - 0.55, nutY - 0.3, 0.65);
    wheelTag.position.set(CX + K173.wheelRho * Math.cos(a) + 0.3, CY + K173.wheelRho * Math.sin(a) + 0.35, 0.65);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '너트 위치', value: `중심에서 ${(-cur.rho).toFixed(2)}` },
      { label: '행정', value: `${(-2 * cur.rho).toFixed(2)}` },
      { label: '나사 걸음', value: `${cur.tri.toFixed(1)} / 4` },
      { label: '원판 회전수', value: `${(theta / (2 * Math.PI)).toFixed(2)}` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.6, 0] }
  };
}
