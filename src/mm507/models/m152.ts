// 152 타원 그리개 — 가로막대의 두 스터드가 십자 홈 안을 직선으로만 미끄러지고,
//  막대를 돌리면 끝의 연필이 반축 1.3 × 0.9 짜리 타원을 그린다(트래멜 원리, 판화 152번)
//  설계표 docs/mm507-sheets/152.md · 부품은 전부 kit/k152(배치·trammel152 결과 대입만 한다)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, STAGE, tag } from '../kit';
import { K152, crossPiece152, drawingSheet152, traverseBar152, trammel152 } from '../kit/k152';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

// 배치 상수(세계) — 십자·타원 중심 y 와 층 z (설계표 '부품과 치수')
// z 층은 뒤판 앞면(STAGE.backZ)에서 출발 — 검사 float(뜬 부품) 수정으로 전체를 판면에 붙였다
const O_Y = 1.7;
const PAPER_T = 0.015; // 종이 두께
const Z_PAPER = STAGE.backZ; // 종이 뒷면 = 뒤판 앞면(붙임)
const Z_CROSS = Z_PAPER + PAPER_T; // 십자 바닥(종이 앞면에 닿음)
const Z_BAR = Z_CROSS + K152.floorT + K152.railH + 0.005; // 막대 밑면(십자 윗면 위 틈 0.005)

export default function buildM152(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 종이판(타원 자취선이 얹혀 있다)
  const paper = drawingSheet152(3.3, 2.5, PAPER_T);
  paper.name = 'paper';
  paper.position.set(0, O_Y, Z_PAPER);
  g.add(paper);

  // 십자 홈 받침(고정) — 두 홈이 스터드를 직선으로 잡는다
  const cross = crossPiece152();
  cross.name = 'cross';
  cross.position.set(0, O_Y, Z_CROSS);
  g.add(cross);

  // 가로막대(구동) — 원점 = 세로 홈 스터드 축. 자세마다 y 만 바뀌고 x 는 늘 0
  const bar = traverseBar152({ penDown: 0.122 });
  bar.name = 'bar';
  bar.position.set(0, O_Y, Z_BAR);
  g.add(bar);

  // 회전 방향 화살표(반시계) — 막대·스터드와 겹치지 않는 반지름 0.3 호
  const arrow = rotArrow(0.3, true);
  arrow.position.set(0, O_Y, 0.38);
  g.add(arrow);

  // 이름표 5개(z 0.45) — 막대·연필·스터드 둘은 각 부품을 따라간다
  const tagBar = tag('가로막대(구동)', v(0, 0, 0.45));
  const tagPen = tag('연필', v(0, 0, 0.45));
  const tagStudV = tag('스터드(세로 홈)', v(0, 0, 0.45));
  const tagStudH = tag('스터드(가로 홈)', v(0, 0, 0.45));
  g.add(tag('십자 홈 받침(고정)', v(-1.5, 2.8, 0.45)), tagBar, tagPen, tagStudV, tagStudH);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const A = trammel152(th);
    bar.rotation.z = A.phi;
    bar.position.y = O_Y + A.studV[1]; // 세로 홈이 스터드를 세로 직선 위에 잡는다
    // 막대 방향의 수직(+90°) 단위 벡터 — 이름표를 부품에서 0.34 떨어뜨린다
    const nx = -Math.sin(A.phi);
    const ny = Math.cos(A.phi);
    // 막대 가운데(로컬 x 0.6 = −0.41 ~ 1.61 의 중간)
    tagBar.position.set(0.6 * Math.cos(A.phi) + 0.34 * nx, O_Y + A.studV[1] + 0.6 * Math.sin(A.phi) + 0.34 * ny, 0.45);
    tagPen.position.set(A.pen[0] + 0.34 * nx, O_Y + A.pen[1] + 0.34 * ny, 0.45);
    tagStudV.position.set(0.45, O_Y + A.studV[1], 0.45);
    tagStudH.position.set(A.studH[0], 1.34, 0.45);
  };
  pose(theta);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const A = trammel152(theta);
      const deg = (((A.phi * DEG) % 360) + 360) % 360;
      return [
        { label: '막대 각', value: `${deg.toFixed(1)}°` },
        { label: '연필 자리', value: `(${A.pen[0].toFixed(2)}, ${A.pen[1].toFixed(2)}) — 타원 반축 1.30 × 0.90` },
        { label: '스터드 사이', value: `${(K152.a - K152.b).toFixed(3)} = 긴 반축 − 짧은 반축` },
        { label: '타원 크기 조절', value: '스터드 자리를 옮기면 반축이 바뀐다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
