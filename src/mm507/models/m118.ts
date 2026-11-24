// 118 행정을 두 배로 늘리기 — 연결봉이 미는 피니언이 고정 랙 위를 굴러, 윗랙이 두 배로 간다 (판화 118번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import {
  crankDisc118,
  fixedRackBed118,
  hangerRod118,
  K118,
  pitman118,
  rollingPinion118,
  slideRail118,
  slidingRack118,
  spindleBlock118,
  state118
} from '../kit/k116';

const PX = 0.5; // 피니언 행정의 가운데 x
const YP = 1.35; // 피니언 중심 높이
const ZP = 0.1; // 랙·피니언 평면
const ZROD = 0.215; // 연결봉 평면
const CXC = -1.2; // 크랭크 축 x

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM118(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 랙 + 받침대(바닥에 고정)
  const bed = fixedRackBed118(0.7575);
  bed.name = 'bed';
  bed.position.set(PX, YP - K118.RP, ZP);
  g.add(bed);

  // 윗랙(움직임)
  const rackTop = slidingRack118();
  rackTop.name = 'rackTop';
  g.add(rackTop);

  // 안내봉(고정)
  const hanger = hangerRod118(-0.68, 1.68, ZP);
  hanger.name = 'hanger';
  hanger.position.set(0, 2.07, ZP);
  g.add(hanger);

  // 피니언
  const pinion = rollingPinion118();
  pinion.name = 'pinion';
  g.add(pinion);

  // 스핀들 + 뒤 블록(돌지 않음)
  const spBlock = spindleBlock118(-0.35, 0.17, 0.115);
  spBlock.name = 'spindleBlock';
  g.add(spBlock);

  // 뒤 안내 레일(고정, 판화에 없음)
  const rail = slideRail118(0.4);
  rail.name = 'rail';
  rail.position.set(PX, YP, -0.25);
  g.add(rail);

  // 크랭크 원판 + 축(판화에 없는 구동 보충)
  const crank = crankDisc118(0.17, 0.115);
  crank.name = 'crank';
  crank.position.set(CXC, YP, ZP);
  g.add(crank);
  const crankShaft = shaftZ(CXC, YP, 0.185, 0.06);
  g.add(crankShaft);

  // 연결봉
  const rod = pitman118();
  rod.name = 'rod';
  g.add(rod);

  // 회전 화살표(크랭크 반시계) + 이름표
  const arrow = rotArrow(0.2, true);
  arrow.position.set(CXC, YP, 0.3);
  g.add(arrow);
  const topTag = tag('윗랙(두 배 이동)', v(PX, 2.45, 0.3));
  const pinTag = tag('구르는 피니언', v(PX, 0.28, 0.35));
  g.add(topTag, pinTag, tag('고정 랙', v(1.7, 1.2, 0.3)), tag('크랭크(보충)', v(-1.2, 0.75, 0.3)));

  const apply = (): void => {
    const k = state118(theta);
    crank.rotation.z = k.a;
    crankShaft.rotation.z = k.a;
    pinion.position.set(PX + k.s, YP, ZP);
    pinion.rotation.z = k.roll;
    spBlock.position.set(PX + k.s, YP, ZP);
    rackTop.position.set(PX + k.rack, YP + K118.RP, ZP);
    rod.position.set(CXC + k.pin[0], YP + k.pin[1], ZROD);
    rod.rotation.z = k.rodAngle;
    topTag.position.set(PX + k.rack, 2.45, 0.3);
    pinTag.position.set(PX + k.s, 0.28, 0.35);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.6, 6.4], target: [0, 1.5, 0.1] },
    notes: () => {
      const k = state118(theta);
      const turns = ((theta - K118.T0) / (Math.PI * 2)).toFixed(2);
      return [
        { label: '피니언 이동', value: `s = ${k.s >= 0 ? '+' : ''}${k.s.toFixed(2)} (행정 0.50)` },
        { label: '윗랙 이동', value: `${k.rack >= 0 ? '+' : ''}${k.rack.toFixed(2)} (행정 1.00)` },
        { label: '비', value: '윗랙 : 피니언 = 2 : 1' },
        { label: '크랭크 회전수', value: `${turns} 바퀴 (한 바퀴 ${((Math.PI * 2) / OMEGA).toFixed(2)} s)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
