// 129 중국식 윈들러스(차동 권양기) — 통을 돌리면 큰 통은 감고 작은 통은 풀어 움직도르래가 천천히 오른다 (판화 129번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, leaderTo, rotArrow, tag } from '../kit';
import {
  K129,
  diffBarrel129,
  hookBlock129,
  ropeCoil129,
  setCoil129,
  windlass129,
  windlassFrame129,
  windlassRopePath129
} from '../kit/k128';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM129(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 틀(고정)
  const frame = windlassFrame129();
  frame.name = 'frame';
  g.add(frame);

  // 차동 통(구동) + 감긴 줄 둘(통과 함께 돈다)
  const barrel = diffBarrel129();
  barrel.name = 'barrel';
  barrel.position.set(0, K129.YA, K129.ZC);
  const coilBig = ropeCoil129(true);
  coilBig.name = 'coilBig';
  const coilSmall = ropeCoil129(false);
  coilSmall.name = 'coilSmall';
  barrel.add(coilBig, coilSmall);
  g.add(barrel);

  // 풀린 줄
  const rope = new Rope(0.045);
  rope.group.name = 'rope';
  g.add(rope.group);

  // 움직도르래
  const block = hookBlock129();
  block.name = 'block';
  g.add(block);
  const sheave = block.getObjectByName('sheave') as THREE.Object3D;

  // 회전 화살표 — 감는 동안 / 푸는 동안(방향이 바뀐다)
  const arrowWind = rotArrow(0.2, false);
  const arrowUnwind = rotArrow(0.2, true);
  for (const a of [arrowWind, arrowUnwind]) {
    a.rotation.y = Math.PI / 2;
    a.position.set(1.75, K129.YA, K129.ZC);
    g.add(a);
  }

  const blockTag = leaderTo(tag('움직도르래', v(0.95, 1.14, 0.75)), block);
  g.add(leaderTo(tag('큰 통', v(-1.8, 2.95, 0.5)), coilBig), tag('작은 통', v(0.7, 3.4, 0.5)), tag('크랭크', v(1.75, 2.15, 0.5)), blockTag);

  let winding = true;
  let lift = 0;
  let n1 = 0;
  let n2 = 0;

  function apply(): void {
    const st = windlass129(theta);
    barrel.rotation.x = -st.beta;
    setCoil129(coilBig, st.n1);
    setCoil129(coilSmall, st.n2);
    rope.setPath(windlassRopePath129(st));
    block.position.copy(st.block);
    block.rotation.y = st.yaw;
    sheave.rotation.z = st.spin;
    blockTag.position.set(st.block.x + 0.95, st.block.y, 0.75);
    winding = Math.sin(theta / K129.kappa) >= 0;
    arrowWind.visible = winding;
    arrowUnwind.visible = !winding;
    lift = st.lift;
    n1 = st.n1;
    n2 = st.n2;
  }
  apply();

  return {
    group: g,
    view: { pos: [0.6, 2.0, 6.4], target: [0, 1.65, 0.2] },
    notes: () => [
      { label: '지금', value: winding ? '감는 중(올림)' : '푸는 중(내림)' },
      { label: '통 한 바퀴에 도르래', value: '0.471 = (큰 둘레 2.168 − 작은 둘레 1.225) ÷ 2' },
      { label: '도르래 높이', value: `+${lift.toFixed(3)} (0 ~ 0.542)` },
      { label: '감긴 바퀴 수', value: `큰 통 ${n1.toFixed(2)} / 작은 통 ${n2.toFixed(2)}` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
