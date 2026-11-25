// 143 웜 축으로 왕복시키는 장치 — 풀리·웜 축·웜이 한 몸으로 돌아 바퀴(20:1)를 돌리고,
// 바퀴의 손목 핀이 연결 막대(오른쪽 고정 핀 둘레의 지레)로 이동 틀을 왕복시킨다.
// 웜과 바퀴는 이동 틀 안에 같이 실려 물림이 찢어지지 않는다 (설계표 docs/mm507-sheets/143.md,
// 키트 kit/k143.ts 의 143 공용 부품)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, wormScrew, leaderTo } from '../kit';
import {
  crankWormWheel143,
  fixedFrame143,
  K143,
  keyedShaft143,
  linkBar,
  traversingFrame143,
  traverse143,
  wormSection,
  type Traverse143
} from '../kit/k143';

const TAU = Math.PI * 2;
const frac = (a: number): number => a - Math.floor(a);

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM143(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 틀(기둥 2 + 곡선 받침 + 가로 막대 + 고정 핀) — 좌표가 월드 그대로라 원점에 놓는다
  const frame = fixedFrame143();
  frame.name = 'frame';
  g.add(frame);

  // 웜 축(키 홈 + 왼쪽 풀리 + 너트) — 매 프레임 rotation.x = phi
  const shaft = keyedShaft143();
  shaft.name = 'shaft';
  shaft.position.set(0, K143.SY, K143.ZW);
  g.add(shaft);

  // 이동 틀(슬리브 + 바퀴 축·보스 + 귀 2개) — 가로 막대 위를 x 로만 왕복
  const sledge = traversingFrame143();
  sledge.name = 'sledge';
  sledge.position.set(0, K143.BY, 0);
  g.add(sledge);
  const sledgeBody = sledge.children[0] ?? sledge; // 틀 몸체(웜·웜 바퀴가 올라타기 전의 첫 부품)

  // 웜 — 이동 틀의 자식: 틀과 함께 축 위를 미끄러진다(키 홈)
  const worm = wormScrew(K143.wormRoot, K143.wormOuter, K143.pitch, K143.wormLen, { driver: true });
  worm.name = 'worm';
  worm.position.set(0, K143.centre, K143.ZW);
  sledge.add(worm);

  // 웜 바퀴(민판 + 손목 핀) — 이동 틀의 바퀴 축 위, rotation.z = beta
  const wheel = crankWormWheel143();
  wheel.name = 'wheel';
  wheel.position.set(0, 0, K143.ZW);
  sledge.add(wheel);

  // 연결 막대 — 원점 = 왼쪽 눈(손목 핀), 오른쪽 눈이 고정 핀을 감싼다
  const rod = linkBar(K143.rod, {
    holes: [0, K143.rod],
    holeR: 0.034,
    eyeR: 0.055,
    half: 0.028,
    thick: 0.04,
    names: ['rodWrist', 'rodFixed']
  });
  rod.name = 'rod';
  g.add(rod);

  // 검사 표식(웜 축 단면 다각형, 메시 없음)
  const section = wormSection(K143.wormRoot, K143.wormOuter, K143.pitch, K143.wormLen);
  section.name = 'wormSection';
  g.add(section);

  // 회전 화살표 2개(축: 오른쪽에서 반시계, 바퀴: 반시계 — 이동 틀 따라감)
  const shaftArrow = rotArrow(0.2, true);
  shaftArrow.rotation.y = Math.PI / 2;
  shaftArrow.position.set(2.07, K143.SY, K143.ZW);
  const wheelArrow = rotArrow(0.35, true);
  g.add(shaftArrow, wheelArrow);

  // 이름표 6개 — 웜·바퀴·틀의 셋은 이동 틀을 따라간다. 웜 바퀴·연결 막대·고정 틀은
  // 웜 축 상자(풀리가 y 0.93~1.69 를 덮는 x ±2.0 밴드) 밖의 빈 곳에 둔다
  const tagWorm = tag('웜(축 위 미끄러짐)', v(0, 1.75, 0.35));
  const tagWheel = tag('웜 바퀴', v(-0.72, 0.62, 0.35));
  const tagSledge = leaderTo(tag('이동 틀(왕복)', v(0.62, 0.62, 0.35)), sledgeBody);
  g.add(
    tag('웜 축 풀리(구동)', v(K143.pulleyX, 1.85, 0.35)),
    tagWorm,
    tagWheel,
    tagSledge,
    tag('연결 막대', v(1.42, 0.58, 0.35)),
    tag('고정 틀(기둥·막대)', v(-1.2, 1.78, 0.35))
  );

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (A: Traverse143): void => {
    shaft.rotation.x = A.phi;
    worm.rotation.x = A.phi;
    wheel.rotation.z = A.beta;
    sledge.position.x = A.x;
    rod.position.set(A.pin[0], A.pin[1], K143.ZROD);
    rod.rotation.z = A.rodAngle;
    section.position.set(A.x - K143.pitch * frac(A.phi / TAU), K143.SY, K143.ZW);
    wheelArrow.position.set(A.x, K143.BY, 0.2);
    tagWorm.position.set(A.x, 1.75, 0.35);
    tagWheel.position.set(A.x - 0.72, 0.62, 0.35);
    tagSledge.position.set(A.x + 0.62, 0.62, 0.35);
  };
  pose(traverse143(0));

  return {
    group: g,
    view: { pos: [0, 1.2, 6.4], target: [0, 0.95, 0] },
    notes: () => {
      const A = traverse143(theta);
      return [
        { label: '웜 축 회전수', value: `${(A.phi / TAU).toFixed(1)} 바퀴` },
        { label: '이동 틀', value: `행정의 ${Math.round(A.s * 100)} % · 왕복 한번 9.82 s` },
        { label: '속도비', value: '웜 20바퀴에 웜 바퀴 1바퀴(이 20개, 한 줄 나사)' },
        { label: '웜', value: '축 위에서 미끄러지며(키 홈) 이동 틀과 함께 왕복한다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(traverse143(theta));
    }
  };
}
