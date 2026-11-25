// 110 양쪽 나사 안내 롤러 — 롤러의 오른나사·왼나사에 반너트 둘이 번갈아 물려 막대가 좌우로 왕복한다 (판화 110번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { K110, frame110, roller110, rockShaft110, traverse110 } from '../kit/k110';

const RX = -0.35; // 롤러 가운데 x
const YR = 2.22; // 롤러 축 높이
const YS = 1.32; // 흔들 축 높이
const ZC = 0.28; // 두 축의 깊이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM110(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 틀(고정) — 옆판 2개 + 축받이 고리 + 받침 다리
  const frame = frame110(0.9);
  frame.name = 'frame';
  frame.position.set(RX, YR, ZC);
  g.add(frame);

  // 롤러(구동) — 축 X, 양쪽 나사부
  const roller = roller110();
  roller.name = 'roller';
  roller.position.set(RX, YR, ZC);
  g.add(roller);

  // 흔들 축 한 몸 — 축 + 팔 2개 + 반너트 2개 + 레버. 좌우로 미끄러지며(막대) 제 축 둘레로 조금 돈다
  const rock = rockShaft110();
  rock.name = 'rock';
  rock.position.set(RX, YS, ZC);
  g.add(rock);

  // 회전 화살표 — 롤러의 가운데 민 부분을 두르는 고리
  const arrow = rotArrow(0.2, true);
  arrow.position.set(RX, YR, ZC);
  arrow.rotation.y = Math.PI / 2;
  g.add(arrow);

  // 이름표 — 앞 너트·뒤 너트·레버는 막대를 따라 좌우로 움직인다
  const tagA = leaderTo(tag('A 앞 너트', v(-1.3, 2.72, 0.5)), 'halfNutA');
  const tagB = leaderTo(tag('B 뒤 너트', v(0.2, 2.72, 0.5)), 'halfNutB');
  const tagL = tag('레버', v(1.44, 2.72, 0.4));
  g.add(tag('양쪽 나사 롤러(구동)', v(RX, 3.12, 0.3)), tagA, tagB, tagL);

  const place = (): ReturnType<typeof traverse110> => {
    const T = traverse110(theta + K110.pose);
    roller.rotation.x = T.spin;
    rock.position.x = RX + T.x;
    rock.rotation.x = T.phi;
    tagA.position.x = -1.3 + T.x;
    tagB.position.x = 0.2 + T.x;
    tagL.position.x = 1.44 + T.x;
    return T;
  };
  place();

  return {
    group: g,
    view: { pos: [0.9, 2.9, 6.3], target: [0, 1.55, 0.2] },
    notes: () => {
      const T = traverse110(theta + K110.pose);
      const eng =
        T.engaged === 'A' ? 'A(앞·왼나사): 막대가 오른쪽으로' : T.engaged === 'B' ? 'B(뒤·오른나사): 막대가 왼쪽으로' : '둘 다 풀림(레버 넘기는 중)';
      const sx = T.x >= 0 ? '+' : '−';
      return [
        { label: '물린 너트', value: eng },
        { label: '막대 위치', value: `가운데에서 ${sx}${Math.abs(T.x).toFixed(2)} (끝은 ±0.18)` },
        { label: '나사', value: '3줄, 리드 0.24: 롤러 한 바퀴에 0.24' },
        { label: '롤러 회전수', value: `${(T.spin / (Math.PI * 2)).toFixed(2)} 바퀴` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt; // 누적 각 — 모든 자세는 theta 의 닫힌 식
      place();
    }
  };
}
