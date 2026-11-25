// 189 분리 장치 변형 3 — 위에서 당김 막대를 끌어올리면 링크가 가로 막대(편심 막대)의 오른쪽 끝을 들어 올려
// 막대가 받침점 핀을 축으로 돌고, 왼쪽의 갈라진 끝(gab)이 내려가 밸브 장치에서 분리된다 (판화 189번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K189, D0_189, gear189, guide189, link189, pinE189, pivotPin189, puller189, rod189 } from '../kit/k189';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM189(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정: 받침점 핀(뒤판에서 나와 막대 허브 구멍을 꿴다), 당김 막대 안내
  const pivot = pivotPin189();
  pivot.name = 'pivotPin';
  pivot.position.set(K189.PX, K189.PY, 0);
  const guide = guide189();
  guide.name = 'guide';
  guide.position.set(D0_189[0] - K189.ARM, 2.78, 0);
  g.add(pivot, guide);

  // 움직이는 것: 막대(받침점 둘레로 회전), 링크, 당김판(위아래로만), E 핀
  const rod = rod189();
  rod.name = 'rod';
  rod.position.set(K189.PX, K189.PY, 0);
  const link = link189();
  link.name = 'link';
  const puller = puller189();
  puller.name = 'puller';
  const pinE = pinE189();
  pinE.name = 'pinE';
  g.add(rod, link, puller, pinE);

  // 회전 화살표(막대가 지금 도는 방향) — 받침점 둘레
  const arrows = new THREE.Group();
  const pos = rotArrow(0.4, true);
  const neg = rotArrow(0.4, false);
  arrows.add(pos, neg);
  arrows.position.set(K189.PX, K189.PY, 0.3);
  g.add(arrows);

  const tRod = leaderTo(tag('편심 막대(갈라진 끝)', v(-1.0, 0.45, 0.35)), 'rod');
  const tPin = leaderTo(tag('받침점 핀(고정)', v(0.5, 0.45, 0.35)), 'pivotPin');
  const tPull = leaderTo(tag('당김 막대', v(1.55, 2.95, 0.35)), 'puller');
  const tLink = leaderTo(tag('링크', v(1.9, 1.65, 0.35)), 'link');
  g.add(tRod, tPin, tPull, tLink);

  let cur = gear189(0);
  let dir = 0;
  const apply = (): void => {
    cur = gear189(theta);
    const nxt = gear189(theta + 0.01);
    dir = Math.sign(nxt.phi - cur.phi);
    rod.rotation.z = cur.phi;
    pinE.position.set(cur.e[0], cur.e[1], 0);
    link.position.set(cur.e[0], cur.e[1], 0);
    link.rotation.z = -cur.link;
    puller.position.set(cur.d[0] - K189.ARM, cur.d[1], 0);
    pos.visible = dir > 0;
    neg.visible = dir < 0;
    tPull.position.y = 2.95 + cur.lift;
    tLink.position.y = 1.65 + cur.lift / 2;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '당김 막대 오름', value: `${(cur.lift * 100).toFixed(1)} cm` },
      { label: '막대 기울기', value: `${((cur.phi * 180) / Math.PI).toFixed(1)}° (최대 ${((K189.PHI * 180) / Math.PI).toFixed(1)}°)` },
      { label: '갈라진 끝 높이', value: `${cur.tipY.toFixed(2)} (걸림 ${K189.PY.toFixed(2)})` },
      { label: '원리', value: '막대를 끌어올리면 링크가 오른쪽 끝을 들어 올려 왼쪽 갈라진 끝이 내려가 분리된다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.9, 6.4], target: [0, 1.8, 0] }
  };
}
