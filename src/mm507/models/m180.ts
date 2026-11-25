// 180 한쪽 조임쇠 — 나사 하나로 도는 굽은 조임쇠가 나무토막을 고정 옆판에 눌러 조인다 (판화 180번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K180, cam180, camReach180, clamp180, pivotScrew180, sideBoard180, woodBlock180 } from '../kit/k180';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM180(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const board = sideBoard180();
  board.name = 'board';
  g.add(board);

  // 나무토막의 오른쪽 면 = 닫힌 조임쇠 윤곽의 왼쪽 끝(같은 식에서 계산)
  const faceX = K180.P[0] + camReach180(0);
  const block = woodBlock180(faceX);
  block.name = 'woodBlock';
  g.add(block);

  const screw = pivotScrew180();
  screw.name = 'pivotScrew';
  screw.position.set(K180.P[0], K180.P[1], 0);
  g.add(screw);

  const cam = cam180();
  cam.name = 'clamp';
  cam.position.set(K180.P[0], K180.P[1], 0);
  g.add(cam);

  const ccw = rotArrow(0.22, true);
  const cw = rotArrow(0.22, false);
  for (const a of [ccw, cw]) {
    a.position.set(K180.P[0], K180.P[1], 0.2);
    g.add(a);
  }

  g.add(leaderTo(tag('고정 옆판', v(-0.9, 2.6, 0.3)), 'board'));
  g.add(leaderTo(tag('나무토막', v(-0.9, 0.35, 0.3)), 'woodBlock'));
  g.add(leaderTo(tag('굽은 조임쇠(구동)', v(1.55, 2.85, 0.3)), 'clamp'));
  g.add(leaderTo(tag('조임쇠 나사', v(1.7, 1.2, 0.3)), 'pivotScrew'));

  let gap = 0;
  let alphaDeg = 0;
  const apply = (): void => {
    const s = clamp180(theta);
    cam.rotation.z = s.alpha;
    ccw.visible = s.dir > 0;
    cw.visible = s.dir < 0;
    gap = s.gap;
    alphaDeg = (s.alpha * 180) / Math.PI;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 1.9, 6.4], target: [0, 1.7, 0.1] },
    notes: () => [
      { label: '조임쇠 열림각', value: `${alphaDeg.toFixed(0)}°` },
      { label: '나무토막과의 틈', value: gap < 0.003 ? '0 (조임)' : gap.toFixed(2) },
      { label: '설명', value: '굽은 조임쇠가 나사를 축으로 돌며 나무토막을 옆판에 누른다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
