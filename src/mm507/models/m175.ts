// 175 한 행정에 한 바퀴 — 정식 크랭크–막대–슬라이더. 홈이 피스톤의 실린더 구실,
//  피스톤 한 왕복에 크랭크가 정확히 한 바퀴(theta 주기 2π). 판화 175번 · 설계표 docs/mm507-sheets/175.md
//  부품은 전부 kit/k175(이미 구현됨) + 공용 키트 — 모델은 배치와 pose175 결과 대입만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K175, crank175, frame175, link175, piston175, pose175 } from '../kit/k175';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// 사점의 phi(rad) — 아래사점 −58.0°(판화 자세), 위사점 앞 두 자리 2.787. notes 표시용
const DP = [-1.0123, 2.787] as const;

/** phi 를 [0, 2π) 로 감고 사점까지의 최단 각거리(rad) */
function deadDist(phi: number): number {
  let best = TAU;
  for (const dp of DP) {
    const d = Math.abs((((phi - dp) % TAU) + TAU + TAU / 2) % TAU - TAU / 2);
    if (d < best) best = d;
  }
  return best;
}

export default function buildM175(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [ox, oy] = K175.O;

  g.add(displayStand());

  // 프레임 주물(고정) — group 원점 = 세계 원점 그대로
  const frame = frame175();
  frame.name = 'frame';
  g.add(frame);

  // 크랭크 축(고정) — 뒤판 보스에서 나와 허브를 꿰고 앞 너트(z 0.142~0.18)로 막는다
  const axle = shaftZ(ox, oy, 0.18, 0.042);
  axle.name = 'axle';
  g.add(axle);

  // 크랭크(구동) — group 원점 = 축 O, 판 가운데 z K175.zCrank. rotation.z = phi
  const crank = crank175();
  crank.name = 'crank';
  crank.position.set(ox, oy, K175.zCrank);
  g.add(crank);

  // 연결 막대 — position = 핀 P, rotation.z = linkAng
  const link = link175();
  link.name = 'link';
  g.add(link);

  // 피스톤 — group 원점 = 보스 가운데, 홈 세로선 위
  const piston = piston175();
  piston.name = 'piston';
  g.add(piston);

  // 회전 화살표(반시계) — 판화의 점선 궤적 원 구실. 크랭크 판 앞 z 0.13
  const arrow = rotArrow(0.3, true);
  arrow.position.set(ox, oy, 0.13);
  g.add(arrow);

  // 이름표 6개 — 크랭크·막대·피스톤 셋은 움직이는 부품을 따라간다
  const tagCrank = tag('크랭크(구동)', v(0, 0, 0.3));
  const tagLink = tag('연결 막대', v(0, 0, 0.3));
  const tagPiston = tag('피스톤', v(0, 0, 0.3));
  const tagShaft = tag('크랭크 축(고정)', v(-1.35, 2.42, 0.3));
  const tagFrame = tag('프레임(고정)', v(-1.05, 0.62, 0.3));
  const tagSlot = tag('슬라이드 홈(고정)', v(0.92, 2.65, 0.3));
  g.add(tagCrank, tagLink, tagPiston, tagShaft, tagFrame, tagSlot);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const A = pose175(th);
    crank.rotation.z = A.phi;
    link.position.set(A.pin[0], A.pin[1], K175.zLink);
    link.rotation.z = A.linkAng;
    piston.position.set(K175.slotX, A.piston[1], K175.zBoss);
    // 따라가는 이름표 셋
    tagCrank.position.set(A.pin[0] - 0.05, A.pin[1] + 0.34, 0.3);
    tagLink.position.set((A.pin[0] + K175.slotX) / 2 - 0.05, (A.pin[1] + A.piston[1]) / 2 - 0.3, 0.3);
    tagPiston.position.set(0.85, A.piston[1], 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.3, 1.8, 6.4], target: [0, 1.6, 0.1] },
    notes: () => {
      const A = pose175(theta);
      const rev = (((A.phi % TAU) + TAU) % TAU) / TAU;
      return [
        { label: '크랭크', value: `${rev.toFixed(1)} 바퀴` },
        { label: '피스톤 높이', value: `${A.piston[1].toFixed(2)} (행정 0.51~1.59, 행정 크기 1.08)` },
        { label: '사점에서', value: `지금 사점에서 ${deadDist(A.phi).toFixed(2)} rad (사점 = −1.012 · +2.787 rad)` },
        { label: '설명', value: '피스톤 한 왕복에 크랭크가 정확히 한 바퀴 — 홈이 피스톤의 안내면(실린더) 구실' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
