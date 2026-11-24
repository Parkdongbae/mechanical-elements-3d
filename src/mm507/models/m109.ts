// 109 나사 절삭 장치 — 왼쪽 어미나사가 돌면 너트·공구가 고르게 내려가고, 기어 20 : 32 로 돌아가는 오른쪽 소재에 나선 골을 깎는다 (판화 109번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { CYCLE109, K109, frame109, leadScrew109, nutTool109, screwCut109, workPiece109 } from '../kit/k107';

const XL = -0.42; // 어미나사 축 x
const XW = XL + K109.C; // 깎이는 나사 축 x (0.36)
const YS = 1.53; // 나사 구간 가운데 높이
const ZC = 0.28; // 두 축의 z

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM109(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 틀(고정)
  const frame = frame109(ZC);
  frame.name = 'frame';
  frame.position.set(XL, YS, ZC);
  g.add(frame);

  // 어미나사(구동)
  const lead = leadScrew109();
  lead.position.set(XL, YS, ZC);
  g.add(lead);

  // 깎이는 나사 — set 으로만 돌린다
  const work = workPiece109();
  work.group.position.set(XW, YS, ZC);
  g.add(work.group);

  // 너트와 공구
  const nut = nutTool109(ZC);
  nut.position.set(XL, YS, ZC);
  g.add(nut);

  // 회전 화살표(위 판 위) — 되돌리는 동안 뒤집는다
  const arrowL = rotArrow(0.16, false);
  arrowL.position.set(XL, 2.74, ZC);
  arrowL.rotation.x = -1.12;
  const arrowW = rotArrow(0.16, true);
  arrowW.position.set(XW, 2.74, ZC);
  arrowW.rotation.x = -1.12;
  g.add(arrowL, arrowW);

  // 이름표 — 너트 이름표는 너트를 따라간다
  const nutTag = tag('너트와 공구', v(-1.45, YS, 0.4));
  g.add(
    tag('어미나사', v(-1.3, 2.75, 0.3)),
    nutTag,
    tag('깎이는 나사', v(1.35, 1.9, 0.4)),
    tag('바꿈 기어', v(1.55, 1.0, 0.5))
  );

  let s = screwCut109(theta);

  function apply(): void {
    s = screwCut109(theta);
    lead.rotation.y = s.lead;
    work.set(s.work, s.cutY);
    nut.position.set(XL, YS + s.nutY, ZC);
    nutTag.position.set(-1.45, YS + s.nutY, 0.4);
    const sx = s.cutting ? 1 : -1;
    arrowL.scale.x = sx;
    arrowW.scale.x = sx;
  }
  apply();

  return {
    group: g,
    view: { pos: [0.5, 2.3, 6.4], target: [0, 1.6, 0.2] },
    notes: () => [
      { label: '기어', value: '20 : 32 → 깎이는 나사는 반대로 0.625배' },
      { label: '피치', value: '어미나사 0.12 → 깎이는 나사 0.192 (= 0.12 × 32/20)' },
      { label: '감김', value: '어미나사 왼나사 → 깎이는 나사 오른나사(기어 두 개라 반대)' },
      { label: '진행', value: s.cutting ? `깎는 중 ${Math.round(s.progress * 100)} %` : '되돌리는 중' }
    ],
    update(dt: number, speed: number): void {
      // 누적 theta 에서 절대 자세를 닫힌 식으로
      theta += OMEGA * speed * dt;
      if (theta > CYCLE109 * 1000 || theta < -CYCLE109 * 1000) theta %= CYCLE109;
      apply();
    }
  };
}
