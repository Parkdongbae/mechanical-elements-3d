// 199 등롱 피니언 맹글 랙 — 반원에만 핀이 선 등롱 피니언이 한 방향으로 돌며, 핀이 있는 쪽이 틀 안쪽 한 줄과 맞물리는 동안
// 반대쪽은 이 없는 반쪽이 맞은편 줄을 지나간다. 틀은 롤러 사이로 왕복한다 (판화 199번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, pulley, rotArrow, shaftZ, tag } from '../kit';
import { K199, S199, frame199, frameBody199, lantern199 } from '../kit/k199';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM199(): MovementModel {
  const g = new THREE.Group();
  let theta = 1.89;
  const K = K199;
  g.add(displayStand());

  const frame = frameBody199();
  frame.name = 'frame';
  g.add(frame);

  g.add(shaftZ(0, K.YC, 0.2, 0.034));
  const pinion = lantern199();
  pinion.name = 'pinion';
  pinion.position.set(0, K.YC, 0);
  g.add(pinion);

  const rollers: { w: THREE.Group; sgn: number }[] = [];
  for (const sx of [-0.55, 0.55]) {
    for (const sy of [1, -1]) {
      const y = K.YC + sy * (K.frameH + K.rollerR + 0.004);
      g.add(shaftZ(sx, y, 0.16, 0.028));
      const w = pulley(K.rollerR, { width: 0.1, spokes: 0 });
      w.name = `roller${sx > 0 ? 'R' : 'L'}${sy > 0 ? 'U' : 'D'}`;
      w.position.set(sx, y, 0.1);
      g.add(w);
      rollers.push({ w, sgn: sy });
    }
  }

  const arrow = rotArrow(0.44, true);
  arrow.position.set(0, K.YC, 0.225);
  g.add(arrow);

  const tFrame = leaderTo(tag('틀(양쪽에 이 줄)', v(0.6, 2.75, 0.35)), 'frame');
  g.add(
    leaderTo(tag('등롱 피니언(구동)', v(-1.4, 2.75, 0.35)), 'pinion'),
    tFrame,
    leaderTo(tag('안내 롤러(고정)', v(-1.5, 0.65, 0.35)), 'rollerLD'),
    leaderTo(tag('이 없는 반쪽', v(1.45, 0.65, 0.35)), 'pinion')
  );

  let cur = frame199(theta);
  const apply = (): void => {
    cur = frame199(theta);
    frame.position.set(cur.X, K.YC, 0);
    pinion.rotation.z = theta;
    for (const { w, sgn } of rollers) w.rotation.z = (sgn > 0 ? 1 : -1) * (cur.X / K.rollerR);
    tFrame.position.x = cur.X + 0.6;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '틀 위치', value: `${cur.X.toFixed(2)} (행정 ${S199.toFixed(2)})` },
      { label: '물린 줄', value: cur.side === 'bottom' ? '아래 줄 → 틀 오른쪽으로' : '위 줄 → 틀 왼쪽으로' },
      { label: '핀', value: '5개(반 바퀴) — 피니언 한 바퀴에 틀이 한 번 왕복' },
      { label: '원리', value: '핀이 있는 반쪽만 이 줄을 밀고, 이 없는 반쪽은 맞은편 줄을 비켜 지나간다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.75, 6.5], target: [0, 1.7, 0] }
  };
}
