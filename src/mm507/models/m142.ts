// 142 변하는 이송 거리 장치 — 고정 스터드의 피니언에 물린 평기어가 큰 원판에 실려 돌고(유성),
// 평기어에 볼트된 크랭크가 연결 막대를 밀어 안내 막대의 세로 왕복 폭이 두 바퀴 주기로 짧았다 길어진다
// (설계표 docs/mm507-sheets/142.md, 키트 kit/k142.ts — 모든 자세는 planet142(theta) 의 닫힌 식)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { barGuide142, disk142, guideBar142, K142, planet142, rod142, spurGear142, studPinion142 } from '../kit/k142';

const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 현재 원판 한 바퀴(2π)의 안내 막대 왕복 폭 — planet142 가 순수 함수라 가벼운 스캔으로 정확히 나온다 */
function strokeOf(u: number): number {
  const u0 = Math.floor(u / TAU) * TAU;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 64; i++) {
    const y = planet142(K142.pose + u0 + (i / 64) * TAU).barY;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return hi - lo;
}

export default function buildM142(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 피니언(스터드 위, 고정)·원판(구동) — 같은 축 (0, 1.9)
  const stud = studPinion142();
  stud.name = 'stud';
  stud.position.set(K142.O[0], K142.O[1], 0);
  const disk = disk142();
  disk.name = 'disk';
  disk.position.set(K142.O[0], K142.O[1], 0);
  // 평기어(유성)·연결 막대·안내 막대 — 자리는 pose() 가 매 프레임 계산
  const gear = spurGear142();
  gear.name = 'gear';
  const rod = rod142();
  rod.name = 'rod';
  const bar = guideBar142();
  bar.name = 'bar';
  // 안내 둘(고정, 판화에 없어 보충)
  const guideL = barGuide142(-1);
  guideL.name = 'guideL';
  const guideR = barGuide142(1);
  guideR.name = 'guideR';
  g.add(stud, disk, gear, rod, bar, guideL, guideR);

  // 회전 방향 화살표(반시계) — 원판 앞·연결 막대 뒤 z 0.29
  const arrow = rotArrow(0.55, true);
  arrow.position.set(K142.O[0], K142.O[1], 0.29);
  g.add(arrow);

  // 이름표 6개 — 평기어·연결 막대·안내 막대 셋은 움직이는 부품을 따라간다
  const tagDisk = tag('원판(구동)', v(-1.15, 2.75, 0.3));
  const tagStud = tag('고정 피니언', v(1.15, 2.05, 0.3));
  const tagGear = tag('평기어(자전·공전)', v(-0.6, 1.6, 0.3));
  const tagRod = tag('연결 막대', v(-0.4, 1.05, 0.3));
  const tagBar = tag('안내 막대(왕복)', v(0.95, 0.7, 0.3));
  const tagGuide = tag('안내(고정)', v(1.18, 1.62, 0.3));
  g.add(tagDisk, tagStud, tagGear, tagRod, tagBar, tagGuide);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (): void => {
    const P = planet142(theta);
    disk.rotation.z = P.disk; // 원판 자전 — 누락이면 spurStud 표식·속도비가 어긋난다
    gear.position.set(P.S[0], P.S[1], 0);
    gear.rotation.z = P.spur;
    rod.position.set(P.pin[0], P.pin[1], 0);
    rod.rotation.z = P.rod;
    bar.position.set(0, P.barY, 0);
    tagGear.position.set(P.S[0] - 0.6, P.S[1] - 0.3, 0.3);
    tagRod.position.set(P.pin[0] + 0.45, P.pin[1] - 0.55, 0.3);
    tagBar.position.set(0.95, P.barY - 0.08, 0.3);
  };
  pose();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const P = planet142(theta);
      const u = theta - K142.pose;
      return [
        { label: '원판 회전', value: `${(u / TAU).toFixed(1)} 바퀴` },
        { label: '평기어 자전', value: '원판 1바퀴에 1.5바퀴(피니언 8 · 평기어 16)' },
        { label: '핀과 원판 중심 사이', value: `R ${P.R.toFixed(2)} (0.21~0.39)` },
        { label: '안내 막대 행정', value: `${strokeOf(u).toFixed(2)} (한 바퀴 0.73 ↔ 0.53 — 이송 거리가 변한다)` }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
