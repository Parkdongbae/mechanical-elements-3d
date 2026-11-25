// 102 볼트와 너트 — 볼트를 돌리면(구동) 돌지 못하게 잡힌 너트가 나사를 따라 오르내린다 (판화 102번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, tag, leaderTo } from '../kit';
import { bolt102, boltShelf102, hexNut102, nutRail102, screwBolt102, turnArrows } from '../kit/k101';

const ZC = 0.3; // 볼트 축의 깊이
const HB = 2.65; // 볼트 머리 밑면 = 선반 윗면의 높이
const NUT_Y = 1.08; // 너트 중심의 가장 낮은 높이(판화 자세)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM102(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 머리 받침 선반(고정, 판화에 없음) — 구멍(반지름 0.275) 가운데로 볼트 나사부가 지난다
  const shelf = boltShelf102(0.6, 0.32);
  shelf.name = 'shelf';
  shelf.position.set(0, HB, ZC);
  g.add(shelf);

  // 돌림 막이 레일(고정, 판화에 없음) — 너트의 납작한 뒷면이 이 앞면에 미끄러진다
  const rail = nutRail102(1.16, 0.237);
  rail.name = 'rail';
  rail.position.set(0, 0.8, -0.3);
  g.add(rail);

  // 볼트(구동) — 머리가 선반에 얹혀 제자리에서만 돈다. rotation.y = beta
  const bolt = screwBolt102();
  bolt.name = 'bolt';
  bolt.position.set(0, HB, ZC);
  g.add(bolt);

  // 너트(종동) — 레일에 막혀 돌지 않고 오르내린다
  const nut = hexNut102();
  nut.name = 'nut';
  nut.position.set(0, NUT_Y, ZC);
  g.add(nut);

  // 회전 화살표 — 선반 아래 눕힌 고리(머리·너트를 가리지 않는다)
  const arrows = turnArrows(0.38, 'y');
  arrows.group.position.set(0, 2.25, ZC);
  g.add(arrows.group);

  // 이름표 — 너트 이름표만 너트를 따라 오르내린다
  const tagNut = tag('너트(오르내림)', v(1.3, NUT_Y, 0.4));
  g.add(
    leaderTo(tag('볼트(구동)', v(-1.2, 2.95, 0.4)), 'bolt'),
    tag('나사산', v(-0.95, 2.25, 0.4)),
    tagNut,
    tag('머리 받침 선반', v(1.4, 2.78, 0.4)),
    leaderTo(tag('돌림 막이', v(-1.1, 0.95, 0.3)), 'rail')
  );

  // 모든 자세는 theta 의 닫힌 식 bolt102 로 다시 계산(누적 오차·역회전 없음)
  const place = (): ReturnType<typeof bolt102> => {
    const s = bolt102(theta);
    bolt.rotation.y = s.beta;
    nut.position.y = NUT_Y + s.rise;
    tagNut.position.y = NUT_Y + s.rise;
    arrows.set(s.dir);
    return s;
  };
  place();

  return {
    group: g,
    view: { pos: [0.8, 2.9, 6.3], target: [0, 1.8, 0.2] },
    notes: () => {
      const s = bolt102(theta);
      return [
        { label: '볼트 회전', value: `${(s.a / (Math.PI * 2)).toFixed(2)} 바퀴 (${s.dir > 0 ? '올라가는 중' : '내려가는 중'})` },
        { label: '너트 높이', value: `+${s.rise.toFixed(2)} (최대 0.60)` },
        { label: '피치', value: '한 바퀴에 0.20' },
        { label: '나사 방향', value: '왼나사(판화의 산 기울기대로)' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      place();
    }
  };
}
