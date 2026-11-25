// 190 나사 클램프 — 손잡이를 돌려 나사를 조이면 나사 끝이 고정 모루를 눌러 지레(홀더)의 꼬리를 밀어 올리고,
// 지레가 받침점을 축으로 돌아 반대쪽 눌림쇠가 작업대 위의 나무 조각을 누른다 (판화 190번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { ANVIL_TOP190, K190, bench190, block190, clamp190, frame190, jaw190, lever190, pin190, screw190 } from '../kit/k190';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM190(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());
  g.add(bench190());

  const block = block190();
  block.name = 'block';
  g.add(block);

  // 고정 받침(바닥판 + 받침점 뺨 + 모루) + 받침점 핀
  const frame = frame190();
  frame.name = 'frame';
  g.add(frame);
  const pinF = pin190(0.12, 0.38, 0.035);
  pinF.name = 'pinF';
  pinF.position.set(K190.FX, K190.FY, 0);
  g.add(pinF);

  // 지레(받침점 둘레로 회전): 눌림쇠가 J 핀에 매달려 늘 수평으로 눌린다
  const lev = new THREE.Group();
  lev.name = 'lever';
  lev.position.set(K190.FX, K190.FY, 0);
  lev.add(lever190());
  const jaw = jaw190();
  jaw.name = 'jaw';
  jaw.position.set(K190.JX - K190.FX, K190.JY - K190.FY, 0);
  lev.add(jaw);
  const pinJ = pin190(K190.zL0 - 0.004, K190.zJ1, 0.033);
  pinJ.position.set(K190.JX - K190.FX, K190.JY - K190.FY, 0);
  lev.add(pinJ);
  g.add(lev);

  // 나사 + 손잡이(제자리에서 돌기만 한다: 끝이 모루 위에 얹힘)
  const screw = screw190();
  screw.name = 'screw';
  screw.position.set(K190.SX, ANVIL_TOP190, K190.ZS);
  g.add(screw);

  const arrows = new THREE.Group();
  const pos = rotArrow(0.3, true);
  const neg = rotArrow(0.3, false);
  arrows.add(pos, neg);
  arrows.rotation.x = -Math.PI / 2;
  arrows.position.set(K190.SX, 2.62, K190.ZS);
  g.add(arrows);

  g.add(
    leaderTo(tag('지레(홀더)', v(0.0, 2.85, 0.45)), 'lever'),
    leaderTo(tag('눌림쇠', v(-1.65, 2.3, 0.45)), 'jaw'),
    leaderTo(tag('나사·손잡이', v(1.45, 2.95, 0.45)), 'screw'),
    leaderTo(tag('받침(고정)', v(0.8, 0.45, 0.45)), 'frame'),
    leaderTo(tag('나무 조각', v(-1.3, 0.45, 0.45)), 'block')
  );

  let cur = clamp190(0);
  let dir = 0;
  const apply = (): void => {
    cur = clamp190(theta);
    const nxt = clamp190(theta + 0.01);
    dir = Math.sign(nxt.psi - cur.psi);
    lev.rotation.z = cur.lev;
    jaw.rotation.z = -cur.lev;
    screw.rotation.y = cur.psi;
    pos.visible = dir > 0;
    neg.visible = dir < 0;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '나사 회전', value: `${((cur.psi / (2 * Math.PI)) * -1 + K190.turns).toFixed(2)} 바퀴 조임 (최대 ${K190.turns})` },
      { label: '지레 기울기', value: `${((cur.lev * 180) / Math.PI).toFixed(1)}°` },
      { label: '눌림쇠 간격', value: `${Math.max(0, cur.gap).toFixed(3)}` },
      { label: '원리', value: '나사를 조이면 꼬리가 올라가고 지레의 반대쪽 눌림쇠가 내려가 나무를 누른다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 2.0, 6.4], target: [0, 1.6, 0] }
  };
}
