// 108 역나사 홈 실린더 — 한 방향으로 고르게 도는 실린더의 겉면에 반대로 감긴 나선 홈 두 줄이 파여 있다.
// 홈에 꽂힌 따름 핀이 달린 미끄럼 블록은 안내 막대를 따라 끝에서 끝까지 고르게 왕복한다 (판화 108번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { K108, frame108, reverseCylinder108, slider108, traverse108 } from '../kit/k107';

const XC = 0.25; // 실린더 축 x
const YM = 1.56; // 홈 구간 가운데 높이
const ZC = 0.28; // 실린더 축·안내 막대의 z
const XG = XC - K108.rodDX; // 안내 막대 x (−0.60)
const CYCLE = 9 * Math.PI; // 실린더 9바퀴(θ 기준 9π 가 아니라 psi 18π 에 닫힘 → θ 주기 9π)
// 판화 자세 맞춤(검증 후 수정): 두 홈의 교차점은 실린더 재료각 0·π 에 있어 실린더와 함께 돈다.
// 키트 기본 자세(t = 1 에 psi 11.96)에서는 교차점이 양 옆 윤곽 근처라 정면에서 마름모 격자가 안 보이고
// 쐐기 띠처럼 보인다 → t = 1(θ = OMEGA) 에 psi = 3.5π 가 되게 θ 를 밀어 교차점이 앞면 가운데에 오게 한다.
const TH0 = (3.5 * Math.PI - (2 * OMEGA + K108.pose)) / 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 양수 나머지 */
function pmod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

export default function buildM108(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 선반 틀(고정) — 위·아래 판과 안내 막대
  const frame = frame108(ZC);
  frame.name = 'frame';
  frame.children[2]!.name = 'guideRod108';
  frame.position.set(XC, YM, ZC);
  g.add(frame);

  // 홈 실린더(구동 기어 포함) — 돌릴 때는 set 만 부른다
  const cyl = reverseCylinder108();
  cyl.group.position.set(XC, YM, ZC);
  g.add(cyl.group);

  // 미끄럼 블록과 뾰족 팔 — 안내 막대를 따라 위아래로만 간다
  const slider = slider108();
  slider.name = 'slider';
  slider.position.set(XG, YM, ZC);
  g.add(slider);

  // 회전 화살표(위 판 위, 실린더 축 꼭지 둘레) — 실린더가 반시계로 돈다
  const arrow = rotArrow(0.2, true);
  arrow.position.set(0.25, 2.62, 0.28);
  arrow.rotation.x = -1.12;
  g.add(arrow);

  // 이름표 — 따름 블록 이름표는 블록을 따라간다
  const blockTag = tag('따름 블록', v(-1.45, YM, 0.4));
  g.add(
    tag('홈 실린더', v(1.3, 1.8, 0.5)),
    tag('구동 기어', v(1.45, 0.95, 0.5)),
    blockTag,
    leaderTo(tag('안내 막대', v(-1.35, 2.62, 0.3)), 'guideRod108')
  );

  let s = traverse108(theta + TH0);

  function apply(): void {
    s = traverse108(theta + TH0);
    cyl.set(s.psi);
    slider.position.set(XG, YM + s.y, ZC);
    blockTag.position.set(-1.45, YM + s.y, 0.4);
  }
  apply();

  return {
    group: g,
    view: { pos: [0.5, 2.3, 6.4], target: [0, 1.6, 0.2] },
    notes: () => [
      { label: '홈', value: '오른·왼 나선 한 줄씩, 한 바퀴에 2번 교차' },
      { label: '왕복', value: '실린더 9바퀴에 한 번(곧은 나선 4바퀴 + 되돌이 반 바퀴)' },
      { label: '행정', value: `1.105 (리드 ${K108.lead} 의 4.25배)` },
      { label: '블록', value: s.up ? '올라가는 중' : '내려가는 중' }
    ],
    update(dt: number, speed: number): void {
      // θ 를 실린더 한 왕복(psi 18π = θ 9π)마다 되감아 누적 오차와 큰 수를 막는다
      theta = pmod(theta + OMEGA * speed * dt, CYCLE);
      apply();
    }
  };
}
