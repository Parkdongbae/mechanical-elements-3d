// 208 핀 휠과 홈 피니언 — 핀 휠 면의 핀 원 셋 중 하나에 홈 피니언을 축 따라 옮겨 물려 세 가지 속도를 얻는다 (판화 208번)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { castIron, paint, steel } from '../../models/materials';
import { annularSector, extrude, mesh } from '../../models/parts/geom';
import { displayStand, leaderTo, rod, rotArrow, shaftZ, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import { setMM } from '../kit/mm';
import { K208, pinion208, pinWheel208, state208 } from '../kit/k208';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const YELLOW = 0xffcc00;
const GRAY = 0x6b7280;
const YR = 2.22; // 포크 안내 막대 높이
const XL = -1.62;
const XR = 1.42;

export default function buildM208(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const { cy, zc } = K208;

  // 핀 휠 + 휠 축
  const { group: wheel, rings } = pinWheel208();
  wheel.name = 'pinWheel';
  wheel.position.set(0, cy, 0);
  g.add(wheel);
  const axle = shaftZ(0, cy, -0.04, 0.062);
  axle.name = 'wheelAxle';
  g.add(axle);

  // 피니언 축(회전) + 노란 깃발
  const shaft = new THREE.Group();
  shaft.name = 'pinShaft';
  shaft.position.set(0, cy, zc);
  shaft.add(rod(v(XL, 0, 0), v(XR, 0, 0), 0.04));
  const key = mesh(new THREE.BoxGeometry(2.4, 0.012, 0.016), steel());
  key.position.set(-0.35, 0, 0.04);
  shaft.add(key);
  const flag = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.05), paint(YELLOW));
  flag.name = 'speedFlag';
  flag.position.set(1.38, 0.1, 0);
  shaft.add(flag);
  g.add(shaft);

  // 축받이 2
  const bl = wallBearing(-1.45, cy, zc, 'x', 0.046);
  bl.name = 'bearingL';
  const br = wallBearing(1.25, cy, zc, 'x', 0.046);
  br.name = 'bearingR';
  g.add(bl, br);

  // 홈 피니언
  const pinion = pinion208();
  pinion.name = 'pinion';
  pinion.position.set(K208.X[0]!, cy, zc);
  setMM(pinion, { kind: 'slottedPinion', slots: K208.slots, rp: K208.rp, axis: 'x' });
  g.add(pinion);

  // 포크 안내 막대(고정)
  const rail = new THREE.Group();
  rail.name = 'forkRail';
  rail.add(rod(v(XL, YR, zc), v(XR, YR, zc), 0.025));
  rail.add(wallBearing(-1.45, YR, zc, 'x', 0.028), wallBearing(1.25, YR, zc, 'x', 0.028));
  g.add(rail);

  // 옮김 포크: 블록(막대가 지남) + 팔 + 반고리 멍에(칼라 홈에 걸림)
  const fork = new THREE.Group();
  fork.name = 'fork';
  const block = mesh(new THREE.BoxGeometry(0.12, 0.09, 0.1), castIron());
  block.position.set(0, YR, zc);
  const arm = mesh(new THREE.BoxGeometry(0.03, 0.43, 0.05), castIron());
  arm.position.set(0, 1.96, zc);
  const yokeGeo = extrude(annularSector(0.072, 0.1, (20 * Math.PI) / 180, (160 * Math.PI) / 180), 0.025, 0.002);
  yokeGeo.rotateY(Math.PI / 2);
  const yoke = mesh(yokeGeo, castIron());
  yoke.position.set(0, cy, zc);
  fork.add(block, arm, yoke);
  g.add(fork);

  const arrow = rotArrow(0.6, true);
  arrow.position.set(0.45, 1.2, 0.05);
  g.add(arrow);

  g.add(
    leaderTo(tag('핀 휠(일정 속도로 돎)', v(1.55, 2.85, 0.3)), 'pinWheel'),
    leaderTo(tag('홈 피니언(10홈)', v(-1.75, 2.65, 0.4)), 'pinion'),
    leaderTo(tag('바깥 핀 원 24', v(-1.6, 0.6, 0.3)), 'ring0'),
    leaderTo(tag('안 핀 원 12', v(1.5, 0.62, 0.3)), 'ring2'),
    leaderTo(tag('옮김 포크', v(-0.2, 2.75, 0.4)), 'fork')
  );

  let tm = 0;
  let st = state208(0);
  const yellow = paint(YELLOW);
  const gray = paint(GRAY);
  const place = (): void => {
    st = state208(tm);
    wheel.rotation.z = st.wheel;
    shaft.rotation.x = st.pinion;
    pinion.rotation.x = st.pinion;
    pinion.position.x = st.x;
    fork.position.x = st.x + 0.13;
    rings.forEach((r, i) => {
      r.material = st.circle === i ? yellow : gray;
    });
  };
  place();

  return {
    group: g,
    view: { pos: [2.3, 2.5, 5.0], target: [-0.2, 1.6, 0.1] },
    notes: () => [
      { label: '물린 핀 원', value: st.circle < 0 ? '옮기는 중' : ['바깥 24핀', '가운데 18핀', '안 12핀'][st.circle]! },
      { label: '피니언 / 휠 속도', value: st.circle < 0 ? '옮기는 중' : ['2.4배', '1.8배', '1.2배'][st.circle]! },
      { label: '피니언 속도', value: (0.6 * st.ratio).toFixed(2) + ' rad/s' },
      { label: '휠 속도', value: '0.60 rad/s (일정)' }
    ],
    update(dt: number, speed: number): void {
      tm += speed * dt;
      place();
    }
  };
}
