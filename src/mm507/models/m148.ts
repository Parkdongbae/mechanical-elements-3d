// 148 교대 회전 기어 장치 — 핀니언(이 12, 구동)이 큰 기어(이 48 · 살 8)를 4:1 로 돌리고,
//  큰 기어 면의 타원 홈을 롤러 핀이 따라가 프레임 눈 E 에 받쳐진 부러진 레버를
//  기어 1회전에 한 번 왔다 갔다 흔든다 (판화 148번 · 설계표 docs/mm507-sheets/148.md)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, spurGear, tag, leaderTo } from '../kit';
import { crankLever148, frame148, gearWeb148, K148, lever148 } from '../kit/k148';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM148(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 프레임(고정): 바닥판 + 면판 2 + 오른쪽 팔(E 구멍) + 교량 + 베어링 링 + E 축. child pivotE
  const frame = frame148();
  frame.name = 'frame';
  g.add(frame);

  // 핀니언(구동, 청동 — driver): 이 12, 피치 반지름 0.27
  const pinion = spurGear(K148.zPin, K148.m, { width: 0.09, spokes: 0, driver: true });
  pinion.name = 'pinion';
  pinion.position.set(K148.P[0], K148.P[1], 0);
  g.add(pinion, shaftZ(K148.P[0], K148.P[1], 0.115, 0.035));

  // 큰 기어: 이 48 · 살 8 · 타원 홈(리브 2) — 원점 = 축
  const gear = gearWeb148();
  gear.name = 'gear';
  gear.position.set(K148.G[0], K148.G[1], 0);
  g.add(gear, shaftZ(K148.G[0], K148.G[1], 0.115, 0.05));

  // 크랭크 레버: 원점 = E, 레버 판 z 0.10~0.18 — 리브(0.085)·축 너트(0.115) 위를 지난다
  const lever = crankLever148();
  lever.name = 'lever';
  lever.position.set(K148.E[0], K148.E[1], 0.14);
  g.add(lever);

  // 회전 방향 화살표: 핀니언 시계, 큰 기어 반시계
  const arrowP = rotArrow(0.14, false);
  arrowP.position.set(K148.P[0], K148.P[1], 0.055);
  const arrowG = rotArrow(0.3, true);
  arrowG.position.set(K148.G[0], K148.G[1], 0.075);
  g.add(arrowP, arrowG);

  // 이름표 5개 — 크랭크 레버·롤러 핀 표는 움직이는 부품을 따라간다
  const tagPinion = leaderTo(tag('핀니언(구동)', v(-1.75, 1.85, 0.3)), pinion);
  const tagGear = tag('큰 기어(4:1)', v(0.9, 2.6, 0.3));
  const tagLever = tag('크랭크 레버', v(0, 0, 0.3));
  const tagRoller = leaderTo(tag('롤러 핀', v(0, 0, 0.3)), lever);
  const tagFrame = leaderTo(tag('프레임(고정)', v(1.85, 1.05, 0.3)), frame);
  g.add(tagPinion, tagGear, tagLever, tagRoller, tagFrame);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산 — 누적 오차·역회전 없음 */
  const pose = (th: number): void => {
    const A = lever148(th);
    pinion.rotation.z = A.phiP;
    gear.rotation.z = A.phiG;
    lever.rotation.z = A.alpha;
    tagLever.position.set(A.joint[0] + 0.55, A.joint[1] + 0.45, 0.3);
    tagRoller.position.set(A.pin[0] - 0.15, A.pin[1] + 0.42, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.3, 1.8, 6.4], target: [0, 1.5, 0] },
    notes: () => {
      const A = lever148(theta);
      return [
        { label: '속도비', value: '핀니언 4바퀴에 큰 기어 1바퀴' },
        { label: '레버 흔들림', value: '±7.5° (기어 1바퀴에 한 번)' },
        { label: '크랭크 레버 각', value: `${(A.alpha * DEG).toFixed(1)}°` },
        { label: '원리', value: '기어가 계속 돌아도 크랭크는 왔다 갔다(교대 원운동)' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
