// 092 보통의 크랭크 운동 — 크랭크 핀과 미끄럼 블록을 연결봉이 이어 회전 ↔ 직선 왕복을 바꾼다 (판화 92번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { connectingRod, crankWheel, crosshead, guideFrame, K92, sliderCrank92 } from '../kit/k092';

const TAU = Math.PI * 2;
const CX = -1.08; // 바퀴 축 x
const CY = 1.7; // 바퀴 축 y (블록·안내틀 가운데선과 같은 높이)
const ZW = 0.05; // 바퀴·안내틀·블록의 가운데 평면
const ZR = 0.24; // 연결봉 평면
const GX = -0.11; // 안내틀 끝 막이 안쪽 면 x

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM092(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 크랭크 바퀴(구동) — 살 6개, 로컬 +X 살 위의 크랭크 핀(키트가 child 'crankPin' 표식)
  const wheel = crankWheel(K92.R, K92.crank);
  wheel.name = 'wheel';
  wheel.position.set(CX, CY, ZW);
  g.add(wheel);
  const pin92 = wheel.children.find((c) => (c as THREE.Mesh).isMesh === true && Math.abs(c.position.x - K92.crank) < 1e-6) ?? wheel;

  // 축 — 뒤판 보스(받침)에서 허브 앞까지(끝 너트 z ≤ 0.155 라 연결봉 아래로 지나간다)
  g.add(shaftZ(CX, CY, 0.155, 0.08));

  // 연결봉 — 원점 = 크랭크 핀 쪽 고리, +X 를 블록 핀 쪽으로
  const rod = connectingRod(K92.rod);
  rod.name = 'rod';
  g.add(rod);

  // ㄷ자 안내틀(고정) — 뒤판까지 받침 기둥 4개(판화에 없는 최소 보충)
  const guide = guideFrame(2.0, K92.gap, { back: 0.35 });
  guide.name = 'guide';
  guide.position.set(GX, CY, ZW);
  g.add(guide);

  // 미끄럼 블록 — 원점 = 손목 핀(블록 가운데)
  const block = crosshead(K92.blockW, K92.gap - 2 * K92.clear, { faceH: 0.47 });
  block.name = 'block';
  g.add(block);

  // 회전 방향 화살표(반시계) + 이름표
  // 블록 이름표는 블록을 따라 좌우로 움직인다(안내틀 위쪽, 블록 바로 위)
  const blockTag = tag('미끄럼 블록과 안내틀', v(1.0, 2.3, 0.35));
  const arrow = rotArrow(0.33, true);
  arrow.position.set(CX, CY, 0.32);
  g.add(arrow);
  g.add(
    tag('크랭크 바퀴(구동)', v(-1.08, 2.8, 0.3)),
    leaderTo(tag('크랭크 핀', v(-1.6, 0.65, 0.3)), pin92),
    tag('연결봉', v(0.45, 2.78, 0.35)),
    blockTag
  );

  return {
    group: g,
    notes: () => [
      { label: '크랭크 반지름', value: '0.51 → 행정 1.02(바퀴 반지름의 2배)' },
      { label: '연결봉', value: '길이 1.74(크랭크의 3.4배), 기울기 최대 17°' },
      { label: '블록 위치', value: `행정의 ${Math.round(((sliderCrank92(theta).x - 1.23) / 1.02) * 100)} %` },
      { label: '바퀴 회전수', value: `한 바퀴 ${(TAU / OMEGA).toFixed(2)} s (약 15 rpm)` }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도에서 모든 자세를 닫힌 식으로 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const { a, pin, x, rodAngle } = sliderCrank92(theta);
      wheel.rotation.z = a;
      rod.position.set(CX + pin[0], CY + pin[1], ZR);
      rod.rotation.z = rodAngle;
      block.position.set(CX + x, CY, ZW);
      blockTag.position.set(Math.max(CX + x, 0.75), 2.3, 0.35); // 왼쪽 끝에서 바퀴 테를 덮지 않게
    }
  };
}
