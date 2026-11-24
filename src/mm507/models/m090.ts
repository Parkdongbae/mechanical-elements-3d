// 090 편심 요크 변형 — 편심 원판이 길쭉한 요크의 긴 구멍 안에서 위아래로 미끄러지고,
// 요크는 흔들림 없이 가로로만 왕복한다(89번의 막대 옆흔들림을 없앤 꼴, 판화 90번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { eccentricSheave, rodGuide, slotYoke } from '../kit/k089';

const ZP = 0.1; // 기구 평면 z
const OY = 1.75; // 축 중심 y
const E = 0.25; // 편심량
const PHASE0 = 1.6; // θe = theta − PHASE0 (t = 1 에서 θe = 0 — 판화 자세)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM090(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 축(뒤판 보스에 받쳐 z 0.3 까지)
  g.add(shaftZ(0, OY, 0.3, 0.13));

  // 편심 원판(살 파지 않은 민짜, 청동) — 원점 = 축, 원판 중심 = 로컬 (e, 0)
  const sheave = eccentricSheave(0.5, E, { rim: 0, bore: 0.13, hubR: 0.19 });
  sheave.name = 'sheave';
  sheave.position.set(0, OY, ZP);

  // 길쭉한 요크: 긴 구멍 반폭 0.502(틈 0.002)·곧은 옆변 반길이 0.42, 황동 테 + 강 막대
  const yoke = slotYoke(0.502, 0.42);
  yoke.name = 'yoke';
  yoke.position.set(0, OY, ZP);

  // 고정 안내 2개(판화에 없음 — 원문 fixed guides), 기둥이 뒤판까지
  const guideL = rodGuide('x', { w: 0.14, h: 0.096 }, ZP);
  guideL.name = 'guideL';
  guideL.position.set(-1.1, OY, ZP);
  const guideR = rodGuide('x', { w: 0.14, h: 0.096 }, ZP);
  guideR.name = 'guideR';
  guideR.position.set(1.1, OY, ZP);
  g.add(sheave, yoke, guideL, guideR);

  // 회전 방향 화살표(반시계)
  const arrow = rotArrow(0.3, true);
  arrow.position.set(0, OY, 0.36);
  g.add(arrow);

  // 이름표
  g.add(
    tag('편심 원판', v(-0.75, 2.95, 0.3)),
    tag('길쭉한 요크(원판이 안에서 위아래로 미끄러짐)', v(0.6, 3.05, 0.3)),
    tag('막대(흔들림 없이 가로로만 왕복)', v(1.55, 2.1, 0.3)),
    tag('고정 안내', v(-1.3, 1.3, 0.3))
  );

  // 절대 자세: θe 의 닫힌 식 — 원판은 돌고, 요크는 x = e·cos θe 로만 움직인다
  const apply = (): void => {
    const thE = theta - PHASE0;
    sheave.rotation.z = thE;
    yoke.position.x = E * Math.cos(thE);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '요크 위치', value: '편심량 × cos(회전각)' },
      { label: '지금 요크 위치', value: `x = ${(E * Math.cos(theta - PHASE0) >= 0 ? '+' : '') + (E * Math.cos(theta - PHASE0)).toFixed(3)} (±0.25)` },
      { label: '행정', value: '0.5 = 편심량의 2배' },
      { label: '구동 회전수', value: '약 15 rpm — 한 바퀴 3.93 s 에 왕복 1회' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
