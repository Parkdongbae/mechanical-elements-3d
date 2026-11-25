// 132 프레스의 비스듬한 막대 — 윗 원판이 제자리에서 비틀리면 막대 둘이 곧게 서면서 누름판을 내린다 (판화 132번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { K132, aimBar132, ballBar132, pressFrame132, pressPlaten132, swingArrows131, twist132, twistHead132 } from '../kit/k131';

const DEG = Math.PI / 180;
const YT = K132.yT; // 윗 원판 아랫면 높이(고정)
const ZC = K132.ZC; // 프레스 축의 깊이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM132(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 틀(기둥 둘 + 윗보 + 바닥 받침대, 고정)
  const frame = pressFrame132();
  frame.name = 'frame';
  frame.position.set(0, 0, ZC);
  g.add(frame);

  // 윗 원판(도는 것은 비틀림뿐 — 위아래로는 못 움직인다)
  const head = twistHead132();
  head.name = 'head';
  head.position.set(0, YT, ZC);
  g.add(head);

  // 누름판(기둥을 타고 위아래로만)
  const platen = pressPlaten132();
  platen.name = 'platen';
  g.add(platen);

  // 비스듬한 막대 둘(공 끝 — 구멍에 반쯤 묻히는 공 이음)
  const barA = ballBar132();
  barA.name = 'barA';
  const barB = ballBar132();
  barB.name = 'barB';
  g.add(barA, barB);

  // 흔들림 방향 화살표 — 눕혀서 세로축 둘레에(원뿔 목 높이, 원판·지레를 가리지 않는다)
  const swing = swingArrows131(0.4);
  swing.group.rotation.x = -Math.PI / 2;
  swing.group.position.set(0, 2.25, ZC);
  g.add(swing.group);

  // 이름표 — '누름판' 하나만 부품을 따라 내려간다
  const platenTag = tag('누름판', v(1.75, 1.05, 0.3));
  g.add(
    platenTag,
    leaderTo(tag('지레(구동)', v(1.65, 2.42, 0.3)), head),
    leaderTo(tag('윗 원판(제자리에서 돈다)', v(-1.75, 2.15, 0.3)), head),
    leaderTo(tag('비스듬한 막대 2개', v(-1.75, 1.7, 0.3)), barA),
    tag('틀(고정)', v(1.75, 3.05, 0.3))
  );

  // theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 안전)
  const apply = (): void => {
    const A = twist132(theta);
    head.rotation.y = A.psi;
    platen.position.set(0, YT - A.H, ZC);
    aimBar132(barA, v(A.bot[0][0], YT + A.bot[0][1], ZC + A.bot[0][2]), v(A.top[0][0], YT + A.top[0][1], ZC + A.top[0][2]));
    aimBar132(barB, v(A.bot[1][0], YT + A.bot[1][1], ZC + A.bot[1][2]), v(A.top[1][0], YT + A.top[1][1], ZC + A.top[1][2]));
    platenTag.position.set(1.75, 1.05 - A.drop, 0.3);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const A = twist132(theta);
      const tilt = Math.asin((2 * K132.rb * Math.sin(A.phi / 2)) / K132.L) / DEG; // 막대의 세로 기울기
      const force = (K132.lever * A.H) / (0.09 * Math.sin(A.phi)); // 지레 끝 이동 : 누름판 이동
      return [
        { label: '지레', value: `${(A.psi / DEG).toFixed(0)}° (비틀림 ${(A.phi / DEG).toFixed(0)}°)` },
        { label: '막대 기울기', value: `${tilt.toFixed(0)}° (설수록 세게 누른다)` },
        { label: '누름판', value: `${A.drop.toFixed(2)} 내려감 (행정 0.18)` },
        { label: '힘 배율', value: `약 ${force.toFixed(1)}배` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
      swing.set(Math.sign(-Math.sin(theta - 1.6) * speed)); // psi 의 변화 부호(위에서 보아 반시계 +)
    }
  };
}
