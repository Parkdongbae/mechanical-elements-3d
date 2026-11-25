// 151 웜과 좌우 나사 — 위 축의 웜이 나사 축에 달린 웜 휠을 물어 천천히 돌리고,
//  왼쪽 오른나사·오른쪽 왼나사가 두 너트를 회전 방향에 따라 모이거나 벌어지게 한다
//  (판화 151번, 설계표 docs/mm507-sheets/151.md — 새 부품은 kit/k149.ts 에 이미 있음)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, wormScrew, wormWheel, leaderTo } from '../kit';
import { pedestalX } from '../kit/gear6';
import { K151, guideRail151, screwNuts151, slideNut151, twinScrew151 } from '../kit/k149';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM151(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 물림 묶음: rotation.y = −π/2 로 로컬 X → 세계 +Z(웜 축 앞뒤), 로컬 Z → 세계 −X(휠 축 좌우)
  const drive = new THREE.Group();
  drive.name = 'drive';
  drive.position.set(0, K151.YS, K151.ZC);
  drive.rotation.y = -Math.PI / 2;
  // 웜 휠(24잇수, 피치 반지름 0.456 · 이끝 0.494) — 묶음 가운데
  const wheel = wormWheel(K151.NW, K151.MOD, { width: 0.16, spokes: 6, tanLead: 0.1267 });
  wheel.name = 'wormWheel';
  // 웜(구동): 한 줄 왼나사, 피치 = π·모듈, 뿌리 0.1025 · 바깥 0.188, 휠 위 0.606
  const worm = wormScrew(0.1025, 0.188, Math.PI * K151.MOD, 0.46, { driver: true, leftHand: true });
  worm.name = 'worm';
  worm.position.set(0, 0.606, 0);
  drive.add(wheel, worm);
  g.add(drive);

  // 웜 축 — 뒤판 보스에서 웜 앞(z 0.66)까지, 웜과 함께 돈다
  const wormShaft = shaftZ(0, K151.YS + 0.606, 0.66, 0.05);
  wormShaft.name = 'wormShaft';
  g.add(wormShaft);

  // 나사 축(왼쪽 오른나사 · 오른쪽 왼나사, 휠과 한 몸)과 너트 둘
  const screw = twinScrew151();
  screw.name = 'screw';
  screw.position.set(0, K151.YS, K151.ZC);
  const nutL = slideNut151();
  nutL.name = 'nutL';
  const nutR = slideNut151();
  nutR.name = 'nutR';
  g.add(screw, nutL, nutR);

  // 너트 안내 레일 2개(판화에 없는 최소 보충 — 너트가 따라 돌지 않게): 원점 = 레일 윗면 가운데
  for (const sx of [-1, 1] as const) {
    const rail = guideRail151(1.14, 0.925);
    rail.position.set(sx * 1.13, K151.YS + K151.railTop, K151.ZC);
    g.add(rail);
  }

  // 나사 축 양 끝 축받이(판화에 없는 최소 보충): 고리 구멍이 X 방향, 저널 0.062 가 든다
  g.add(pedestalX(-K151.endX, K151.YS, K151.ZC, -1, 0.18, 0.07));
  g.add(pedestalX(K151.endX, K151.YS, K151.ZC, 1, 0.18, 0.07));

  // 회전 방향 화살표 2개 — dir 로 하나만 보인다(+1 모이는 중 = 정면 시계)
  const arrowCW = rotArrow(0.24, false);
  arrowCW.position.set(0, K151.YS + 0.606, 0.72);
  const arrowCCW = rotArrow(0.24, true);
  arrowCCW.position.set(0, K151.YS + 0.606, 0.72);
  g.add(arrowCW, arrowCCW);

  // 이름표 4개 — 너트 둘은 움직이는 너트를 따라간다
  const tagNutL = tag('오른나사 너트', v(0, 0, 0.6));
  const tagNutR = tag('왼나사 너트', v(0, 0, 0.6));
  g.add(tag('웜(구동)', v(0.85, 2.4, 0.5)), leaderTo(tag('웜 휠 24', v(0.62, 0.55, 0.6)), 'wormWheel'), tagNutL, tagNutR);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const s = screwNuts151(th);
    worm.rotation.x = s.worm;
    wormShaft.rotation.z = s.worm; // 웜 축도 같은 각
    wheel.rotation.z = s.wheel; // 웜 한 바퀴에 이 한 개(31번과 같은 물림 위상)
    screw.rotation.x = s.beta; // 묶음 로컬 Z = 세계 −X — 휠과 나사 축은 한 몸
    nutL.position.set(s.xL, K151.YS, K151.ZC);
    nutR.position.set(s.xR, K151.YS, K151.ZC);
    arrowCW.visible = s.dir === 1;
    arrowCCW.visible = s.dir === -1;
    tagNutL.position.set(s.xL, K151.YS + 0.5, 0.6);
    tagNutR.position.set(s.xR, K151.YS + 0.5, 0.6);
  };
  pose(theta);

  return {
    group: g,
    view: { pos: [0.6, 2.5, 6.4], target: [0, 1.3, 0.2] },
    notes: () => {
      const s = screwNuts151(theta);
      const turns = Math.max(0, (K151.KW * (theta - 1.6)) / (2 * Math.PI)); // 웜 누적 회전수
      return [
        { label: '속도비', value: '웜 24바퀴에 나사 축 1바퀴' },
        { label: '나사', value: '왼쪽 오른나사 · 오른쪽 왼나사, 리드 0.36' },
        { label: '두 너트 사이', value: (s.xR - s.xL - K151.nutW).toFixed(2) },
        { label: '방향', value: s.dir === 1 ? '모이는 중' : '벌어지는 중' },
        { label: '웜 회전수', value: `${turns.toFixed(1)}바퀴` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
