// 153 스터드로 미는 왕복 장치 — 도는 원판의 스터드가 막대 아래 돌출부를 밀어 한쪽으로 보내고,
//  반대쪽 스터드가 벨 크랭크의 아래팔 끝을 아래에서 받쳐 들어 올리면 윗팔이 막대 앞 스터드를 쳐 되보낸다(원판 한 바퀴에 막대 두 왕복)
//  설계표 docs/mm507-sheets/153.md · 부품은 전부 kit/k153(배치 + bell153(theta) 결과 대입만 한다)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import {
  bell153,
  bellCrank153,
  guideRod153,
  K153,
  K153V,
  slideBar153,
  studDisc153,
  type Bell153
} from '../kit/k153';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;
const MODE_KR: Record<Bell153['mode'], string> = { push: '밀기', strike: '두드림', dwell: '쉼' };

export default function buildM153(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 스터드 원판(구동, 시계) — 축 (0, 1.64), 판 층 z 0.12~0.20, 스터드는 z 0.20~0.34 로 돌출
  const disk = studDisc153();
  disk.name = 'disk';
  disk.position.set(K153.O[0], K153.O[1], 0);
  g.add(disk);

  // 벨 크랭크 — 꼭지 핀 P (−1.53, 1.71), 층 z 0.315~0.365
  const lever = bellCrank153();
  lever.name = 'lever';
  lever.position.set(K153.P[0], K153.P[1], 0.34);
  g.add(lever);

  // 가로막대 — 원점 = 막대 아랫면 한가운데, 아랫면 y 2.74, X 왕복
  const bar = slideBar153();
  bar.name = 'bar';
  bar.position.set(0, K153.barBot, 0);
  g.add(bar);

  // 안내 봇(고정) — 지오메트리가 세계 좌표로 만들어져 원점 (0,0,0)
  const guide = guideRod153();
  guide.name = 'guide';
  g.add(guide);

  // 축 둘 — 원판 축(뒤판 보스 → 너트 앞 끝 z 0.28)·꼭지 핀(너트 앞 끝 z 0.425)
  g.add(shaftZ(K153.O[0], K153.O[1], 0.28, 0.05), shaftZ(K153.P[0], K153.P[1], 0.425, 0.05));

  // 회전 방향 화살표(시계) — 원판 앞면 바로 앞, 스터드 감김 원·돌출부와 안 겹치게
  const arrow = rotArrow(0.55, false);
  arrow.position.set(K153.O[0], K153.O[1], 0.22);
  g.add(arrow);

  // 이름표 5개 — 막대·막대 스터드·아래팔 끝은 각 부품을 따라간다. 막대 둘은 상자 위(y 3.08)로 가림을 피한다
  const tagBar = tag('가로 막대', v(0, 3.08, 0.3));
  const tagStud = tag('막대 스터드', v(0, 3.08, 0.3));
  const tagLo = tag('레버 아래팔', v(-1.3, 1.0, 0.3));
  g.add(
    tag('스터드 원판(구동)', v(1.15, 1.9, 0.3)),
    tag('벨 크랭크', v(-2.0, 1.35, 0.3)),
    tagBar,
    tagStud,
    tagLo
  );

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const A = bell153(th);
    disk.rotation.z = A.disk;
    bar.position.x = A.bar;
    lever.rotation.z = A.gamma;
    tagBar.position.set(A.bar + 1.28, 3.08, 0.3);
    tagStud.position.set(A.bar - 0.85, 3.08, 0.3);
    tagLo.position.set(A.tipLo[0] - 0.62, A.tipLo[1] - 0.6, 0.3); // 원판 상자 밖(왼쪽 아래)으로 — 패드가 원판 안쪽에 앉으므로
  };
  pose(theta);

  return {
    group: g,
    view: { pos: [0, 1.9, 6.4], target: [0, 1.7, 0.1] },
    notes: () => {
      const A = bell153(theta);
      return [
        { label: '막대 위치', value: `${A.bar >= 0 ? '+' : ''}${A.bar.toFixed(2)} (행정 ${K153V.stroke.toFixed(2)})` },
        { label: '지금 구간', value: MODE_KR[A.mode] },
        { label: '원판', value: `${(theta / (2 * Math.PI)).toFixed(1)} 바퀴` },
        { label: '레버 각', value: `${(A.gamma * DEG).toFixed(1)}° (${(K153.gRest * DEG).toFixed(0)}°~+${(K153V.gStay * DEG).toFixed(0)}°)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
