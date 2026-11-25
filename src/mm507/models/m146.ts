// 146 요크 막대 왕복 장치 — 원판의 뒤로 솟은 크랭크 핀이 요크의 닫힌 고리 홈 윗길을 오가며
// 요크 막대를 위아래로 왕복시킨다(정확한 사인 운동). 요크는 원판 뒤, 판화와 같은 자세.
// (설계표 docs/mm507-sheets/146.md, 키트 kit/k146.ts — 새 부품 없음, 배치만)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { frontBearing146, grooveYoke146, K146, pinDisc146, scotchYoke146, stemGuide146 } from '../kit/k146';

const DEG = 180 / Math.PI;
/** 배치 상수: 축 높이, 요크 홈 바닥 z, 원판 뒷면 z, 앞 축받이 고리 z */
const CY = 1.82;
const ZY = 0.02;
const ZD = 0.12;
const ZB = 0.48;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM146(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 요크(고리 홈 판 + 위·아래 막대, 한 몸) — 원점 = 홈 윗길 가운데, 세로로만 미끄러진다
  const yoke = grooveYoke146();
  yoke.name = 'yoke';
  yoke.position.set(0, CY, ZY);
  g.add(yoke);

  // 핀 원판 — 반투명 판, 축은 앞으로, 핀은 뒤로 요크 홈에 든다
  const disc = pinDisc146(0.44);
  disc.name = 'disc';
  disc.position.set(0, CY, ZD);
  g.add(disc);

  // 앞 축받이(A 꼴, 고정 — 판화에 없는 보충) + 막대 안내 고리 둘(고정)
  const bearing = frontBearing146(CY, ZB, 0.9, K146.shaftR);
  bearing.name = 'bearing';
  const guideUp = stemGuide146(0, 2.42, 0.025, K146.stemR);
  guideUp.name = 'guideUp';
  const guideDown = stemGuide146(0, 0.965, 0.025, K146.stemR);
  guideDown.name = 'guideDown';
  g.add(bearing, guideUp, guideDown);

  // 회전 방향 화살표(반시계) — 허브와 핀 자리 사이 빈 띠
  const arrow = rotArrow(0.22, true);
  arrow.position.set(0, CY, 0.25);
  g.add(arrow);

  // 이름표 5개 — 요크 이름표만 요크를 따라 오르내린다
  const tagDisc = tag('핀 원판(구동)', v(-1.3, 1.5, 0.3));
  const tagYoke = tag('고리 홈이 파인 요크', v(1.35, CY, 0.2));
  const tagStem = tag('위아래로 왕복하는 막대', v(1.2, 2.95, 0.2));
  const tagGuide = leaderTo(tag('막대 안내(고정)', v(-1.0, 2.42, 0.2)), guideUp);
  const tagBearing = tag('앞 축받이', v(1.45, 0.75, 0.5));
  g.add(tagDisc, tagYoke, tagStem, tagGuide, tagBearing);

  /** theta 의 닫힌 식으로 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (): void => {
    const m = scotchYoke146(theta);
    disc.rotation.z = m.a;
    yoke.position.y = CY + m.y; // x 는 늘 0 — 핀이 홈 윗길 안에서 좌우로 미끄러질 뿐
    tagYoke.position.y = CY + m.y;
  };
  pose();

  return {
    group: g,
    view: { pos: [0.5, 2.0, 6.4], target: [0, 1.7, 0.1] },
    notes: () => {
      const m = scotchYoke146(theta);
      const deg = ((m.a * DEG) % 360 + 360) % 360;
      return [
        { label: '크랭크 반지름', value: '0.342 → 행정 0.684(원판 반지름의 2배)' },
        { label: '요크 높이', value: `크랭크 반지름 × sin ${deg.toFixed(0)}° — 사인 운동` },
        { label: '요크 위치', value: `가운데에서 ${m.y >= 0 ? '+' : ''}${m.y.toFixed(2)}` },
        { label: '홈', value: '닫힌 고리 꼴 — 핀은 윗길만 오간다' },
        { label: '원판 회전수', value: `${(theta / (Math.PI * 2)).toFixed(2)} 회` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
