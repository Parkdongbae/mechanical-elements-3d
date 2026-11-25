// 114 결손 피니언과 이중 랙 — 이가 일부 빠진 피니언이 위·아래 랙을 번갈아 밀어 회전을 직선 왕복으로 바꾼다 (판화 114번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K114, barGuide113, k114State, mutilatedPinion113, rackFrame113 } from '../kit/k113';

const TAU = Math.PI * 2;
const CY = 1.75; // 피니언 축·틀 가운데선 높이
const ZF = 0.2; // 피니언·틀의 가운데 평면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM114(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 결손 피니언(구동) — 12개 자리 가운데 4개만 이가 있다
  const pinion = mutilatedPinion113(K114.teeth, K114.module, K114.count, 0.1);
  pinion.name = 'pinion';
  pinion.position.set(0, CY, ZF);
  g.add(pinion);

  // 피니언 축 — 뒤판 보스에서 틀의 빈 안쪽을 지나 피니언 앞까지
  g.add(shaftZ(0, CY, 0.3, 0.045));

  // 고리 틀 — 안쪽 위·아래 랙 + 양 끝 납작 막대
  const frame = rackFrame113(K114.frame);
  frame.name = 'frame';
  frame.position.set(0, CY, ZF);
  g.add(frame);

  // 납작 막대 안내 2개(고정, 판화에 없는 최소 보충)
  g.add(barGuide113(-1.36, CY, ZF, 0.09, 0.1), barGuide113(1.36, CY, ZF, 0.09, 0.1));

  // 회전 화살표(반시계) + 이름표
  const arrow = rotArrow(0.14, true);
  arrow.position.set(0, CY, 0.34);
  g.add(arrow);

  const topTag = tag('위 랙(물리면 왼쪽으로)', v(0, 2.45, 0.3));
  const botTag = tag('아래 랙(물리면 오른쪽으로)', v(0, 1.08, 0.3));
  g.add(leaderTo(tag('결손 피니언(구동)', v(0, 0.75, 0.35)), 'pinion'), topTag, botTag, tag('막대 안내', v(1.36, 2.2, 0.35)));

  let state = k114State(0);
  const apply = (): void => {
    state = k114State(theta);
    pinion.rotation.z = state.psi;
    frame.position.x = state.x;
    topTag.position.x = state.x; // 이름표는 틀을 따라간다
    botTag.position.x = state.x;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '피니언', value: '12개 자리 가운데 이 4개만(나머지는 매끈한 둘레)' },
      { label: '지금', value: state.side === 1 ? '위 랙을 미는 중(틀은 왼쪽으로)' : state.side === -1 ? '아래 랙을 미는 중(틀은 오른쪽으로)' : '어느 쪽에도 안 물려 쉬는 중' },
      { label: '틀 이동', value: `${Math.round(state.x * 1000)} mm` },
      { label: '왕복 폭', value: '657 mm(±328)' },
      { label: '피니언 회전수', value: `한 바퀴 ${(TAU / OMEGA).toFixed(2)} s에 틀이 한 번 왕복` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
