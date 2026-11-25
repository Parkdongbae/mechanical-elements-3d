// 131 홈 팔과 이 부채꼴 — 크랭크 원판이 돌면 핀이 홈 팔 안에서 미끄러지며 부채꼴을 흔들고, 랙이 왕복한다 (판화 131번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K131, K131_RACK_Y, crankDisc131, rack131, rackGuide131, rock131, slottedSector131 } from '../kit/k131';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const ZD = K131.zDisc; // 원판 층
const ZA = K131.zArm; // 팔·부채꼴·랙 층

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM131(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 크랭크 원판(구동, 청동) + 축(뒤판 보스에서 나와 원판을 꿴다)
  const disc = crankDisc131(0.2, 0.13);
  disc.position.set(K131.O[0], K131.O[1], ZD);
  g.add(disc, shaftZ(K131.O[0], K131.O[1], 0.105, 0.045));

  // 홈 팔과 한 몸인 이 부채꼴(황동) + 고정 축
  const sector = slottedSector131();
  sector.position.set(K131.P[0], K131.P[1], ZA);
  g.add(sector, shaftZ(K131.P[0], K131.P[1], 0.25, 0.05));

  // 랙(강철) + 안내 둘(고정)
  const rack = rack131();
  rack.position.set(0, K131_RACK_Y, ZA);
  const guideR = rackGuide131(K131.guideX);
  g.add(rack, rackGuide131(-K131.guideX), guideR);

  // 회전 방향 화살표(반시계) — 원판 앞면 바로 앞, 팔보다 뒤
  const arrow = rotArrow(0.3, true);
  arrow.position.set(K131.O[0], K131.O[1], 0.07);
  g.add(arrow);

  // 이름표 5개('랙'만 랙을 따라간다)
  const rackTag = leaderTo(tag('랙', v(0, 0.3, 0.3)), rack);
  g.add(
    tag('크랭크 원판(구동)', v(-1.15, 2.75, 0.25)),
    leaderTo(tag('홈 팔', v(1.2, 2.6, 0.25)), sector),
    leaderTo(tag('이 부채꼴', v(-1.3, 1.45, 0.25)), sector),
    rackTag,
    leaderTo(tag('랙 안내(고정)', v(1.75, 1.05, 0.25)), guideR)
  );

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const A = rock131(theta);
      return [
        { label: '원판', value: `${(theta / TAU).toFixed(1)} 바퀴` },
        { label: '팔 기울기', value: `${(A.gamma * DEG).toFixed(1)}° (최대 37.5°)` },
        { label: '랙 위치', value: `${A.rackX.toFixed(2)} (행정 0.79)` },
        { label: '빠른 되돌림', value: '핀이 팔 끝 쪽을 지날 때 천천히, 축 쪽을 지날 때 빨리' }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const A = rock131(theta);
      disc.rotation.z = A.crank;
      sector.rotation.z = A.gamma;
      rack.position.x = A.rackX;
      rackTag.position.x = A.rackX;
    }
  };
}
