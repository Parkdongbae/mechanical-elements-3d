// 112 페르시아식 드릴 — 손잡이 너트를 급한 나사 몸통을 따라 오르내리면 몸통이 번갈아 돈다 (판화 112번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { drill112, drillHead112, drillNut112, drillStock112, setSection112, stockSpan112, workBlock112 } from '../kit/k110';

const ZC = 0.3; // 모든 부품의 깊이
const TIP = 0.4; // 날 끝 높이
const NUT0 = 1.74; // 너트 가운데 기준 높이(몸통 가운데)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM112(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const sp = stockSpan112();

  g.add(displayStand());

  // 받침 나무(고정, 판화에 없음) — 날 끝이 얹힌다
  const work = workBlock112(0.22);
  work.name = 'work';
  work.position.set(0, TIP, ZC);
  g.add(work);

  // 드릴 몸통 — 날 + 물림쇠 + 급한 나사 + 핀. 돈다
  const stock = drillStock112();
  stock.name = 'stock';
  stock.position.set(0, TIP, ZC);
  g.add(stock);

  // 머리(고정) — 몸통 위 끝에 얹힌 버섯 머리, 받침 팔로 뒤판에 붙는다
  const head = drillHead112(0.6);
  head.name = 'head';
  head.position.set(0, 2.544, ZC);
  g.add(head);

  // 손잡이 너트 — 돌지 않고 오르내리기만 한다
  const nut = drillNut112();
  nut.name = 'nut';
  nut.position.set(0, TIP + sp.mid, ZC);
  g.add(nut);

  // 회전 화살표 — 방향이 바뀌므로 번갈아 보인다
  const arrCw = rotArrow(0.24, false);
  const arrCcw = rotArrow(0.24, true);
  for (const a of [arrCw, arrCcw]) {
    a.rotation.x = -Math.PI / 2;
    a.position.set(0, 0.84, ZC);
    g.add(a);
  }

  const nutTag = tag('손잡이 너트', v(1.25, NUT0, ZC));
  g.add(
    tag('머리(고정)', v(1.2, 2.75, ZC)),
    tag('급한 나사 몸통', v(-1.3, 2.2, ZC)),
    nutTag,
    tag('드릴 날', v(-1.0, 0.75, ZC))
  );

  let D = drill112(0);
  const apply = (): void => {
    D = drill112(theta);
    stock.rotation.y = D.psi;
    setSection112(stock, sp.mid + D.nutY);
    nut.position.y = TIP + sp.mid + D.nutY;
    nutTag.position.y = NUT0 + D.nutY;
    arrCw.visible = D.dir === 1;
    arrCcw.visible = D.dir === -1;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.9, 2.2, 6.3], target: [0, 1.6, 0.2] },
    notes: () => [
      { label: '너트', value: `${D.dir === 1 ? '올라가는' : '내려가는'} 중, 가운데에서 ${D.nutY >= 0 ? '+' : ''}${D.nutY.toFixed(2)} (끝은 ±0.5)` },
      { label: '몸통', value: `위에서 보아 ${D.dir === 1 ? '시계로' : '반시계로'} 도는 중, 지금 ${(D.psi / (Math.PI * 2)).toFixed(2)} 바퀴` },
      { label: '나사', value: '6줄, 리드 0.8: 너트를 0.8 밀면 한 바퀴' },
      { label: '한 번 훑기', value: '너트 1.0 → 몸통 1.25 바퀴' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
