// 179 단일 기관 역전 장치 — 축에 헐겁게 낀 편심을 레버로 들어 올려 밸브 타이밍을 반 바퀴 바꾼다 (판화 179번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import {
  K179,
  eccRod179,
  eccentric179,
  leverArrows179,
  leverStand179,
  lever179,
  link179,
  reverse179,
  shaft179,
  shaftArrows179,
  shaftBearing179,
  spindle179,
  spindleGuide179
} from '../kit/k179';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const E = K179.E;
/** 심축 중심선 높이: 심축 둥근 막대 y = 후크 U 홈 안의 돌기 높이(홈선 − 0.029) − 돌기 높이 0.11 */
const SPINDLE_Y = K179.slotY - 0.029 - 0.11;
const ROD_Z = 0.48;
const LINK_Z = 0.535;
const LEVER_Z = 0.45;

export default function buildM179(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const bearing = shaftBearing179();
  bearing.name = 'bearing';
  bearing.position.set(E[0], E[1], 0);
  g.add(bearing);

  const shaft = shaft179();
  shaft.name = 'shaft';
  shaft.position.set(E[0], E[1], 0);
  g.add(shaft);

  const ecc = eccentric179();
  ecc.name = 'eccentric';
  ecc.position.set(E[0], E[1], 0);
  g.add(ecc);

  const rod = eccRod179();
  rod.name = 'eccRod';
  g.add(rod);

  const head = rod.getObjectByName('hookHead') as THREE.Object3D;
  const spindle = spindle179();
  spindle.name = 'spindle';
  g.add(spindle);

  const guide = spindleGuide179();
  guide.name = 'gland';
  guide.position.set(K179.glandX, SPINDLE_Y, 0);
  g.add(guide);

  const stand = leverStand179();
  stand.name = 'leverStand';
  g.add(stand);

  const lev = lever179();
  lev.name = 'lever';
  lev.position.set(K179.leverP[0], K179.leverP[1], LEVER_Z);
  g.add(lev);

  const link = link179();
  link.name = 'link';
  g.add(link);

  const sArrow = shaftArrows179(0.5);
  sArrow.group.position.set(E[0], E[1], K179.zArrow);
  g.add(sArrow.group);
  const lArrow = leverArrows179(0.24);
  lArrow.group.position.set(K179.leverP[0], K179.leverP[1], K179.zArrow);
  g.add(lArrow.group);

  g.add(leaderTo(tag('기관 축(돌기)', v(1.6, 0.6, 0.6)), 'shaft'));
  g.add(leaderTo(tag('편심(헐겁게 낌)', v(1.5, 2.45, 0.6)), 'eccentric'));
  g.add(leaderTo(tag('세운 레버', v(-1.5, 3.0, 0.6)), 'lever'));
  g.add(leaderTo(tag('밸브 심축', v(-1.55, 1.5, 0.6)), 'spindle'));
  g.add(leaderTo(tag('편심 막대(후크)', v(0.3, 1.0, 0.6)), 'eccRod'));

  let stage = 0;
  let prevAng = K179.leverA0;
  const apply = (): void => {
    const st = reverse179(theta);
    shaft.rotation.z = st.sigma;
    ecc.rotation.z = st.psi;
    rod.position.set(st.pin[0], st.pin[1], ROD_Z);
    rod.rotation.z = Math.atan2(st.hook[1] - st.pin[1], st.hook[0] - st.pin[0]);
    spindle.position.set(st.spindleX, SPINDLE_Y, 0);
    lev.rotation.z = st.leverAng;
    // 링크: 팔 핀(레버) ↔ 후크 위 핀(편심 막대)
    const lp = new THREE.Vector3(K179.leverArm, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), st.leverAng);
    const a: [number, number] = [K179.leverP[0] + lp.x, K179.leverP[1] + lp.y];
    head.rotation.z = -rod.rotation.z;
    const b: [number, number] = [st.hook[0], st.hook[1] + K179.crossDy];
    link.position.set(a[0], a[1], LINK_Z);
    link.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
    sArrow.group.visible = st.dir !== 0;
    sArrow.set(st.dir);
    const dAng = st.leverAng - prevAng;
    prevAng = st.leverAng;
    const ld = Math.abs(dAng) < 1e-5 ? 0 : dAng > 0 ? 1 : -1;
    lArrow.group.visible = ld !== 0;
    lArrow.set(ld);
    stage = st.stage;
  };
  apply();

  const STAGES = ['가: 순행(물림 A)', '나: 레버로 편심 막대를 든다', '다: 축이 반대로 반 바퀴(헐겁게 미끄럼)', '마: 막대를 내려 건다', '라: 역행(물림 B)', '바: 다시 든다', '사: 축이 순행 반 바퀴', '자: 내려 건다'];
  return {
    group: g,
    view: { pos: [0.4, 1.9, 6.4], target: [0, 1.7, 0.1] },
    notes: () => [
      { label: '단계', value: STAGES[stage] ?? '' },
      { label: '설명', value: '편심은 축에 헐겁게 끼어, 축이 반대로 돌면 반 바퀴 뒤 돌기에 다시 물린다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
