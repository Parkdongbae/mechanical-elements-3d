// 180 한쪽 죔쇠(목수 작업대 죔쇠) — 174 와 같은 원리를 굽은 죔쇠 하나 + 고정 옆판으로 (판화 180번).
// 작업물이 아래에서 올라오며 윗모서리로 죔쇠 위쪽 안쪽 면을 밀면 죔쇠가 축 나사를 중심으로 시계 방향으로 돌고,
// 아래의 둥근 갈고리가 작업물을 옆판 쪽으로 눌러 문다. 작업물을 내리면 죔쇠가 되돌아 풀린다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { K180, clamp180, clamp180Body, screw180, sidePiece180, workpiece180 } from '../kit/k180';
import { STAGE } from '../kit/stand';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM180(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 옆판(앞 층) + 고정 나사 둘
  const side = sidePiece180();
  side.name = 'sidePiece';
  g.add(side);
  const fixScrews = K180.fix.map(([x, y], i) => {
    const s = screw180(x, y, K180.zSide[1], K180.fixR, i === 0 ? 1.1 : 1.0, STAGE.backZ);
    s.name = `fixScrew${i + 1}`;
    g.add(s);
    return s;
  });

  // 작업물(나무 판) — 옆판과 죔쇠 사이를 오르내린다
  const work = workpiece180();
  work.name = 'workpiece';
  g.add(work);

  // 굽은 죔쇠(가운데 층, 위 끝이 옆판 뒤로 지나감) + 축 나사(뒤판 보스에서 나와 죔쇠 앞면에 머리)
  const clamp = clamp180Body();
  clamp.name = 'clamp';
  clamp.position.set(K180.P[0], K180.P[1], 0);
  g.add(clamp);
  const pivot = screw180(K180.P[0], K180.P[1], K180.zClamp[1], K180.headR, Math.PI / 2, K180.zClamp[0]);
  pivot.name = 'pivotScrew';
  g.add(pivot);

  const workTag = leaderTo(tag('작업물', v(-1.45, 1.0, 0.35)), 'workpiece');
  g.add(
    leaderTo(tag('고정 옆판', v(-1.5, 2.85, 0.35)), 'sidePiece'),
    leaderTo(tag('고정 나사', v(-1.55, 2.2, 0.35)), fixScrews[0] as THREE.Object3D),
    workTag,
    leaderTo(tag('회전 죔쇠', v(1.45, 2.75, 0.35)), 'clamp'),
    leaderTo(tag('축 나사', v(1.5, 1.4, 0.35)), 'pivotScrew')
  );

  let cur = clamp180(0);
  const apply = (): void => {
    cur = clamp180(theta);
    clamp.rotation.z = cur.phi;
    work.position.set(0, cur.top, 0);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '작업물 높이', value: `${cur.top.toFixed(2)}` },
      { label: '죔쇠 각', value: `${((cur.phi * 180) / Math.PI).toFixed(1)}° (풀림 ${((K180.open * 180) / Math.PI).toFixed(1)}°)` },
      { label: '갈고리 틈', value: cur.gap < 0.006 ? '0 (물림)' : cur.gap.toFixed(2) },
      { label: '원리', value: '작업물 윗모서리가 죔쇠 위쪽 안쪽 면을 밀면 죔쇠가 돌아 아래 갈고리가 작업물을 옆판에 눌러 문다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [-0.05, 1.7, 6.4], target: [-0.05, 1.65, 0] }
  };
}

