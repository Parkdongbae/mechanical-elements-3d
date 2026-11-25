// 028 브러시 휠(마찰 바퀴) — 수평 원판이 윗바퀴를 마찰로 돌린다. 윗바퀴가 축 위를 미끄러져 속도비가 바뀐다 (판화 28번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { PILLOW_BOSS_Y, displayStand, leaderTo, pillow, pulley, rod, rotArrow, tag } from '../kit';
import { bronze, castIron, darkSteel, paint, rubber } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

type V2 = [number, number];

const ZD = 0.17; // 기구 평면
const DX = -0.3; // 원판 축 x
const YW = 1.75; // 윗바퀴 축 높이
const RW = 0.15; // 윗바퀴 반지름
const KAPPA = 0.4;
const QY90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // 로컬 Z → +X
const XA = new THREE.Vector3(1, 0, 0);

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
const rho = (th: number): number => 0.07 + 0.25 * Math.cos(KAPPA * th);

export default function buildM028(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let curRho = rho(0);

  g.add(displayStand());

  // 원판 피벗(수직축 Y)
  const disc = new THREE.Group();
  disc.position.set(DX, 0, ZD);
  const discPlate = mesh(lathe(tubeProfile(0.047, 0.42, 1.53, 1.59, 0.006), 64), bronze({ roughness: 0.34 }));
  disc.add(discPlate);
  // 고무 덮개는 가운데까지 덮는다 — ρ = 0(멈춤) 을 지날 때도 윗바퀴 아랫점(1.60)이 고무 위에 닿아 있게
  const rubberCover = mesh(lathe(rodProfile(0.405, 1.59, 1.6, 0, 0.002), 64), rubber());
  disc.add(rubberCover);
  const flare: V2[] = [[0.05, 1.28], [0.085, 1.28], [0.09, 1.36], [0.13, 1.47], [0.19, 1.53], [0.05, 1.53], [0.05, 1.28]];
  disc.add(mesh(lathe(flare, 40), darkSteel()));
  disc.add(rod(v(0, 0.28, 0), v(0, 1.5, 0), 0.04));
  for (let k = 0; k < 4; k++) {
    const m = at(
      new THREE.BoxGeometry(0.3, 0.003, 0.014),
      paint(k === 0 ? 0xd8362f : 0xf2b619),
      0.25 * Math.cos((k * Math.PI) / 2),
      1.599, // 윗면 1.6005 — 고무 윗면(1.60)에 박아 넣어 윗바퀴 아랫점(1.60)이 표시줄을 파고들지 않게
      -0.25 * Math.sin((k * Math.PI) / 2)
    );
    m.rotation.y = (k * Math.PI) / 2;
    disc.add(m);
  }
  g.add(disc);

  // 아랫받침 + 가운데 브래킷
  g.add(at(new THREE.BoxGeometry(0.2, 0.1, 0.2), castIron(), DX, 0.23, ZD));
  g.add(at(new THREE.BoxGeometry(0.2, 0.12, 0.405), castIron(), DX, 0.95, -0.0975));
  g.add(at(lathe(tubeProfile(0.045, 0.075, -0.06, 0.06, 0.01), 36), darkSteel(), DX, 0.95, ZD));

  // 윗바퀴 축(수평) — 축 전체가 φw 로 돈다. 왼쪽 필로는 원판 가장자리(x −0.72)를 비켜 x −0.84 에 둔다
  const axle = new THREE.Group();
  axle.position.set(DX, YW, ZD);
  axle.add(rod(v(-0.58, 0, 0), v(0.6, 0, 0), 0.04));
  axle.add(at(new THREE.BoxGeometry(0.02, 0.1, 0.02), paint(0xf2b619), -0.31, 0.05, 0));
  g.add(axle);
  g.add(pillow(-0.84, YW - PILLOW_BOSS_Y, ZD, 'x'), pillow(0.25, YW - PILLOW_BOSS_Y, ZD, 'x'));
  // 필로 받침 선반: 뒤판(z −0.30)에서 나와 받침판을 받친다. 폭 0.22 — 원판 가장자리(x −0.72 ~ 0.12)를 비킨다
  for (const px of [-0.84, 0.25]) {
    g.add(at(new THREE.BoxGeometry(0.22, 0.08, 0.58), castIron(), px, YW - PILLOW_BOSS_Y - 0.04, -0.01));
  }

  // 윗바퀴 + 미끄럼 슬리브
  const wheel = new THREE.Group();
  wheel.add(pulley(RW, { width: 0.08, spokes: 4, flat: true, hub: 0.04 }));
  const sleeve = lathe(tubeProfile(0.04, 0.06, -0.06, 0.06, 0.005), 24);
  sleeve.rotateX(Math.PI / 2);
  wheel.add(mesh(sleeve, darkSteel()));
  g.add(wheel);

  const arrow = rotArrow(0.3, true);
  arrow.position.set(DX, 2.1, ZD);
  arrow.rotation.x = -Math.PI / 2;
  g.add(arrow);

  g.add(
    leaderTo(tag('수평 원판(구동)', v(0.6, 1.25, 0.3)), discPlate),
    tag('윗바퀴(미끄러짐)', v(0.5, 2.05, 0.3)),
    leaderTo(tag('고무 덮개', v(-1.45, 1.45, 0.3)), rubberCover),
    tag('수직축', v(0.25, 0.6, 0.3))
  );

  const q = new THREE.Quaternion();
  return {
    group: g,
    view: { pos: [0.9, 3.2, 3.8], target: [-0.2, 1.4, 0.17] },
    notes: () => [
      { label: '윗바퀴 위치 ρ', value: curRho.toFixed(2) },
      { label: '속도비 (윗바퀴 : 원판)', value: (curRho / RW).toFixed(2) },
      { label: '윗바퀴 방향', value: curRho > 0.01 ? '원판과 같은 쪽' : curRho < -0.01 ? '반대로 돎' : '멈춤' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      curRho = rho(theta);
      const phi = (0.07 * theta + (0.25 / KAPPA) * Math.sin(KAPPA * theta)) / RW;
      disc.rotation.y = theta;
      axle.rotation.x = phi;
      wheel.position.set(DX + curRho, YW, ZD);
      wheel.quaternion.copy(q.setFromAxisAngle(XA, phi).multiply(QY90));
    }
  };
}
