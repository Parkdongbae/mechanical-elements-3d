// 093 홈 요크 크랭크 — 크랭크 핀이 홈 파인 요크 속을 좌우로 미끄러지며 요크(막대)를 정확한 사인 운동으로 밀어 올린다 (판화 93번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { crankDisc, K93, rodGuideY, scotchYoke93, slotYoke } from '../kit/k092';

const CY = 1.72; // 축 높이
const ZD = 0.04; // 원판 가운데 평면
const ZY = 0.2; // 요크·막대 평면
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM093(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 크랭크 원판(구동, 청동 판 + 강철 핀) — 핀이 로컬 +X 에서 앞으로 솟아 요크 평면을 지나간다(키트가 child 'crankPin' 표식)
  const disc = crankDisc(K93.R, K93.crank);
  disc.name = 'disc';
  disc.position.set(0, CY, ZD);
  g.add(disc);
  const pin93 = disc.children.find((c) => (c as THREE.Mesh).isMesh === true && Math.abs(c.position.x - K93.crank) < 1e-6) ?? disc;

  // 축 — 끝 너트가 z 0.125 까지라 막대(z 0.14 부터) 뒤로 지나간다
  g.add(shaftZ(0, CY, 0.125, 0.06));

  // 홈 요크(황동 테 + 강철 막대 한 몸) — 원점 = 홈 중심, 위아래로만 움직인다
  const yoke = slotYoke();
  yoke.name = 'yoke';
  // 키트는 홈 윤곽을 outlines.slotHole 로 남기는데, 검사(autocheck poly)는 이름이 소문자 'hole'/'groove' 를 품어야 구멍으로 본다
  // (대문자 H 는 못 알아봐 핀이 '막힌 판'에 박힌 것으로 판정됨) → 같은 윤곽을 'hole' 이름으로 다시 단다
  const outlines = yoke.userData.outlines as { slotHole: [number, number][] };
  yoke.userData.outlines = { hole: outlines.slotHole };
  g.add(yoke);

  // 막대 안내 부시 2개(판화에 없는 최소 보충) — 고정, 뒤판에서 나온 팔 끝의 고리
  const guideUp = rodGuideY(0, 2.37, ZY, K93.rodR);
  guideUp.name = 'guideUp';
  const guideDown = rodGuideY(0, 1.07, ZY, K93.rodR);
  guideDown.name = 'guideDown';
  g.add(guideUp, guideDown);

  // 회전 방향 화살표(반시계) + 이름표
  const arrow = rotArrow(0.3, true);
  arrow.position.set(0, CY, 0.32);
  g.add(arrow);
  g.add(
    tag('크랭크 원판(구동)', v(-1.3, 1.45, 0.3)),
    leaderTo(tag('크랭크 핀', v(1.3, 2.3, 0.3)), pin93),
    tag('홈 요크', v(1.35, 1.72, 0.3)),
    tag('위아래로만 움직이는 막대', v(1.3, 0.55, 0.3))
  );

  // 모든 자세는 theta 의 닫힌 식 — 역회전·누적 오차 없음
  const apply = (): void => {
    const { a, y } = scotchYoke93(theta);
    disc.rotation.z = a;
    yoke.position.set(0, CY + y, ZY);
  };
  apply();

  return {
    group: g,
    notes: () => {
      const { y } = scotchYoke93(theta);
      return [
        { label: '크랭크 반지름', value: '0.4 → 행정 0.8(반지름의 2배)' },
        { label: '요크 높이', value: '반지름 × sin(각) — 정확한 사인 운동' },
        { label: '지금 요크 위치', value: `가운데에서 ${y >= 0 ? '+' : ''}${y.toFixed(2)}` },
        { label: '연결봉', value: '없음(핀이 홈 속을 좌우로 미끄러진다)' },
        { label: '원판 회전수', value: `${(theta / TAU).toFixed(2)}바퀴 (한 바퀴 ${(TAU / OMEGA).toFixed(2)} s)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
