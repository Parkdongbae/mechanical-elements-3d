// 275 웜과 랙 — 세로로 선 웜(나사)이 돌면 나란히 선 랙(톱니 막대)이 곧게 오르내린다(웜 한 바퀴에 0.20)
// 설계표 docs/mm507-sheets/275.md — 웜 앞으로 3 바퀴 뒤로 3 바퀴(20초 주기)
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { displayStand, leaderTo, pulley, rotArrow, setMM, tag, wormScrew } from '../kit';
import { K275, bearing275, rack275, rackGuide275, state275 } from '../kit/k275';
import { glow, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM275(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  const [WX, WZ] = K275.W;

  // 웜 묶음: 로컬 x → 세계 +y
  const mount = new THREE.Group();
  mount.name = 'wormMount';
  mount.position.set(WX, K275.YW, WZ);
  mount.rotation.z = Math.PI / 2;
  g.add(mount);
  const spin = new THREE.Group();
  spin.name = 'wormSpin';
  mount.add(spin);

  const worm = wormScrew(0.11, 0.23, K275.P, 0.7, { driver: true });
  worm.name = 'worm';
  spin.add(worm);

  const shaftGeo = lathe(rodProfile(0.04, -0.6, 1.49), 32);
  shaftGeo.rotateZ(-Math.PI / 2);
  const shaft = mesh(shaftGeo, steel());
  shaft.name = 'wormShaft';
  spin.add(shaft);

  // 칼라 둘(세계 y 1.082 ~ 1.112, 2.808 ~ 2.838)
  for (const [y0, y1] of [
    [1.082, 1.112],
    [2.808, 2.838]
  ] as [number, number][]) {
    const cg = lathe(tubeProfile(0.04, 0.065, y0 - K275.YW, y1 - K275.YW, 0.003), 32);
    cg.rotateZ(-Math.PI / 2);
    spin.add(mesh(cg, steel()));
  }

  // 손바퀴(세계 높이 3.00) + 붉은 손잡이
  const hwG = new THREE.Group();
  hwG.position.set(1.45, 0, 0);
  hwG.rotation.y = Math.PI / 2;
  spin.add(hwG);
  const handWheel = pulley(0.18, { width: 0.08, spokes: 4, hub: 0.04, driver: true });
  handWheel.name = 'handWheel';
  const rim = handWheel.children[0];
  if (rim) rim.name = 'handRim';
  hwG.add(handWheel);
  const knobGeo = lathe(rodProfile(0.02, 0, 0.1, 0, 0.006), 20);
  knobGeo.rotateZ(-Math.PI / 2);
  const knob = mesh(knobGeo, paint(0xd2352b));
  knob.position.set(1.485, 0.14, 0);
  spin.add(knob);

  // 노란 표시: 웜 바로 위 축 표면
  const mark = mesh(new THREE.BoxGeometry(0.03, 0.006, 0.03), paint(0xf2b619));
  mark.position.set(0.4, 0.0405, 0);
  spin.add(mark);

  // 축 받침 둘
  const bLow = bearing275(1.0, 1.08);
  bLow.name = 'bearingLow';
  const bTop = bearing275(2.84, 2.92);
  bTop.name = 'bearingTop';
  g.add(bLow, bTop);

  // 랙 + 노란 띠 + 안내 고리 둘
  const rack = rack275();
  rack.name = 'rack';
  const band = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.006), paint(0xf2b619));
  band.position.set(-0.066, 0, 0.1625);
  rack.add(band);
  rack.position.set(0, K275.YR0, 0);
  g.add(rack);
  const gLow = rackGuide275(1.0);
  gLow.name = 'guideLow';
  const gTop = rackGuide275(2.0);
  gTop.name = 'guideTop';
  g.add(gLow, gTop);

  // 화살표: 손바퀴 위 회전(늘 때·줄 때), 랙 왼쪽 세로 화살
  const arrUp = rotArrow(0.24, true);
  const arrDown = rotArrow(0.24, false);
  const arrG = new THREE.Group();
  arrG.position.set(0.25, 3.08, 0.1);
  arrG.rotation.x = -Math.PI / 2;
  arrG.add(arrUp, arrDown);
  g.add(arrG);

  const lineArrow = new THREE.Group();
  const lmat = glow(0xf2b619, 0.9);
  const shaftA = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 14), lmat);
  shaftA.position.y = -0.04;
  const headA = mesh(new THREE.ConeGeometry(0.05, 0.12, 16), lmat);
  headA.position.y = 0.12;
  lineArrow.add(shaftA, headA);
  lineArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(lineArrow, { kind: 'arrow', r: 0.1, ccw: true });
  g.add(lineArrow);

  // 이름표 5개(이름표 표대로)
  g.add(
    leaderTo(tag('랙(톱니 막대)', v(-1.05, 2.35, 0.3)), 'rack'),
    leaderTo(tag('웜(나사)', v(1.15, 1.55, 0.3)), 'worm'),
    leaderTo(tag('손바퀴', v(1.05, 2.95, 0.3)), 'handRim'),
    leaderTo(tag('안내 고리', v(-1.05, 1.05, 0.3)), 'guideLow'),
    leaderTo(tag('축 받침', v(1.15, 0.9, 0.3)), 'bearingLow')
  );

  const apply = (): void => {
    const s = state275(t);
    spin.rotation.x = s.theta;
    rack.position.y = s.rackY;
    const tt = ((t % K275.PERIOD) + K275.PERIOD) % K275.PERIOD;
    const growing = tt < K275.PERIOD / 2;
    arrUp.visible = growing;
    arrDown.visible = !growing;
    lineArrow.position.set(-0.3, s.rackY, 0.2);
    lineArrow.rotation.z = growing ? Math.PI : 0;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.1, 1.65, 5.2], target: [0.05, 1.6, 0.1] },
    notes: () => {
      const s = state275(t);
      return [
        { label: '웜', value: (s.theta / (2 * Math.PI)).toFixed(2) + ' 바퀴' },
        { label: '랙 높이', value: s.rackY.toFixed(3) },
        { label: '원리', value: '웜 한 바퀴에 나사산이 한 피치(0.20)만큼 나아가 랙을 그만큼 밀어 올리거나 내린다 — 웜 축과 랙이 나란하다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += speed * dt;
      apply();
    }
  };
}
