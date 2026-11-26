// 168 홈 크랭크와 타원 궤도 — 둘째 크랭크가 피트먼을 돌리고, 피트먼 왼끝의 핀이 타원을 그리며
//  주축 홈 크랭크의 홈을 미끄러져 그 크랭크를 돌린다(판화 168번).
//  설계표 docs/mm507-sheets/168.md · 부품·식은 전부 kit/k168 — 이 파일은 배치·자세 대입만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import {
  K168, ZL, crank2, fixedPin, ghostPaths, pitman168, pose168, rocker168, slottedCrank168, topPin,
} from '../kit/k168';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM168(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const F = K168.four;
  const O = K168.O1;

  g.add(displayStand());

  // 벽에 칠한 점선 궤적(P1 타원 · 둘째 크랭크 핀 원 · 주축 둘레 원)
  g.add(ghostPaths(F, O, 0.46));

  // 고정 축 셋: 주축 O1 · 둘째 크랭크 축 S2 · 흔들이 막대의 위 핀 H
  const axisMain = fixedPin(O[0], O[1], 0.045, 0.128, 0.065, 0.02);
  axisMain.name = 'axisMain';
  const axis2 = fixedPin(F.S2[0], F.S2[1], 0.045, 0.128, 0.065, 0.02);
  axis2.name = 'axis2';
  const hPin = topPin(F.H[0], F.H[1]);
  hPin.name = 'hPin';
  g.add(axisMain, axis2, hPin);

  // 움직이는 부품
  const crank1 = slottedCrank168();
  crank1.name = 'crank1';
  crank1.position.set(O[0], O[1], 0);
  const crankB = crank2(F.r2);
  crankB.name = 'crank2';
  crankB.position.set(F.S2[0], F.S2[1], 0);
  const pitman = pitman168(F, { slotPin: true });
  pitman.name = 'pitman';
  const rocker = rocker168(F.Lr);
  rocker.name = 'rocker';
  rocker.position.set(F.H[0], F.H[1], 0);
  g.add(crank1, crankB, pitman, rocker);

  // 회전 방향 화살표 둘(모두 반시계)
  const arrowMain = rotArrow(0.2, true);
  arrowMain.position.set(O[0], O[1], 0.3);
  const arrow2 = rotArrow(0.2, true);
  arrow2.position.set(F.S2[0], F.S2[1], 0.3);
  g.add(arrowMain, arrow2);

  // 이름표 5개 — 피트먼 것은 움직이는 부재(오른끝 P3)를 따라간다
  const tagCrank = tag('홈 크랭크', v(O[0], 0.78, 0.3));
  const tagCrank2 = tag('둘째 크랭크', v(F.S2[0], 0.95, 0.3));
  const tagPitman = tag('피트먼', v(1.3, 1.1, 0.3));
  const tagRocker = tag('흔들이 막대', v(0.35, 2.5, 0.3));
  const tagEllipse = tag('타원 궤도', v(O[0], 2.7, 0.3));
  // 타원 궤도 = 홈 크랭크와 피트먼이 만나는 P1 핀이 그리는 길 → 그 핀을 가리킨다(사용자 지적)
  leaderTo(tagEllipse, 'slotPin');
  g.add(tagCrank, tagCrank2, tagPitman, tagRocker, tagEllipse);

  const pose = (th: number): void => {
    const p = pose168(th);
    crank1.rotation.z = p.alpha;
    crankB.rotation.z = p.phi;
    pitman.position.set(p.c.P1[0], p.c.P1[1], 0);
    pitman.rotation.z = p.c.beta;
    rocker.rotation.z = p.c.rock;
    tagRocker.position.set((F.H[0] + p.c.P3[0]) / 2 - 0.75, (F.H[1] + p.c.P3[1]) / 2 + 0.25, 0.3);
    tagPitman.position.set(p.c.P3[0] - 0.05, p.c.P3[1] - 0.3, 0.3);
  };
  pose(0);
  void ZL;

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const p = pose168(theta);
      return [
        { label: '주축(홈 크랭크) 각', value: `${(((p.alpha * DEG) % 360) + 360) % 360 | 0}°` },
        { label: '홈 속 핀 거리(반지름)', value: `${p.s.toFixed(2)} (0.33 ~ 0.59)` },
        { label: '둘째 크랭크 반지름', value: `${F.r2} (고정)` },
        { label: '설명', value: '핀이 타원 궤도를 돌고, 홈 크랭크는 원을 돈다 — 크랭크가 바깥에 있을 때 힘이 가장 크게 걸린다' },
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    },
  };
}
