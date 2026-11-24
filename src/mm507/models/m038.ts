// 038 일정·변속 기어 — 같은 크기의 두 기어가 한 바퀴의 2/3 는 1:1 로 일정하게, 나머지 1/3 은 속도가 변하며 돈다 (판화 38번)
// 판화: 두 기어 모두 둘레의 일부가 다른 구간(반지름 선 두 개로 나뉨)이다. 원문은 "한 바퀴 중 일부는 일정한 속도, 나머지는 속도가 변한다".
// 해석: 일정 구간은 피치 반지름 d/2 의 보통 이, 변속 구간은 서로 맞물려 구르는 비원형 피치 곡선(rA + rB = d)에 난 이.
// 변속 구간 속도비 1 + 0.3·sin — 평균이 1 이라 두 기어는 한 바퀴에 한 바퀴씩 돌고 매 바퀴 같은 자리에서 다시 물린다.
// (두 기어 모두 이 없는 구간을 두면 피동이 쉬는 동안 위치를 잡아 줄 것이 없고, 한 바퀴에 16/24 바퀴씩 밀려 이가 없는 자리끼리 만나 멈춘다.)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, stadiumShape, TAU } from '../../models/parts/geom';
import { displayStand, rotArrow, shaftZ, tag, varSectorPair, type V2 } from '../kit';

const Z = 24; // 둘레 이 수(두 기어 같음)
const MOD = 0.05; // 이 높이 기준 모듈 — 일정 구간 피치 반지름 0.6
const CA: V2 = [-0.6, 1.75]; // 구동(왼쪽)
const CB: V2 = [0.6, 1.75]; // 피동(오른쪽) — 중심 거리 1.2 = 0.6 + 0.6
const GZ = 0.12;
const SEC0 = 3.403; // 변속 구간 시작(구동 각) — 그 전 2/3 바퀴는 1:1
const SEC = TAU / 3; // 변속 구간 길이 120°
const VARY = 0.3; // 속도비 1 ± 0.3

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM038(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 구동 기어 각(누적)
  let ratio = 1;
  let thB = 0;
  g.add(displayStand());

  const pair = varSectorPair({ teeth: Z, center: CB[0] - CA[0], module: MOD, start: SEC0, sector: SEC, vary: VARY, width: 0.12, spokes: 6 });
  const ga = pair.a;
  ga.position.set(CA[0], CA[1], GZ);
  const gb = pair.b;
  gb.position.set(CB[0], CB[1], GZ);
  g.add(ga, gb, shaftZ(CA[0], CA[1], 0.3, 0.045), shaftZ(CB[0], CB[1], 0.3, 0.045));

  // 두 중심을 잇는 연결대(중심 거리 고정, 기어 뒤) + 양끝 머리
  const link = mesh(extrude(stadiumShape(CA[0], CA[1], CB[0], CB[1], 0.045), 0.03, 0.006), steel());
  link.position.z = 0.0; // 기어 뒤쪽 — 맞물림 자리가 가려지지 않게
  g.add(link);
  for (const c of [CA, CB]) {
    const cap = lathe(rodProfile(0.07, 0, 0.05, 0.01, 0.01), 32);
    cap.rotateX(Math.PI / 2);
    const m = mesh(cap, darkSteel());
    m.position.set(c[0], c[1], -0.03);
    g.add(m);
  }

  const a1 = rotArrow(0.45, true);
  a1.position.set(CA[0], CA[1], 0.33);
  const a2 = rotArrow(0.45, false);
  a2.position.set(CB[0], CB[1], 0.33);
  g.add(a1, a2);
  g.add(
    tag('구동 기어(일정 속도)', v(CA[0], 0.8, 0.4)),
    tag('피동 기어(속도 변함)', v(CB[0], 0.8, 0.4)),
    tag('연결대(기어 뒤)', v(0, 2.55, 0.4))
  );

  return {
    group: g,
    view: { pos: [0.8, 2.3, 6.2], target: [0, 1.75, 0] },
    notes: () => [
      { label: '구간', value: '한 바퀴의 2/3 는 1 : 1 일정, 1/3 은 변속' },
      { label: '지금 속도비', value: `${ratio.toFixed(2)} (피동/구동)${Math.abs(ratio - 1) < 1e-6 ? ' — 일정 구간' : ' — 변속 구간'}` },
      { label: '피동 회전수', value: `${(-thB / TAU).toFixed(2)}바퀴 (구동 ${(theta / TAU).toFixed(2)}바퀴)` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      ratio = pair.ratio(theta);
      thB = pair.angleB(theta);
      ga.rotation.z = theta;
      gb.rotation.z = thB;
    }
  };
}
