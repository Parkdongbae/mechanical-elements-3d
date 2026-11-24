// 103 나사로 미는 슬라이드 — 나사가 돌면 슬라이드가 직선 운동을 한다 (판화 103번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, tag } from '../kit';
import { K103, leadScrew103, screw103, screwFrame103, screwSlide103, turnArrows } from '../kit/k101';

const TAU = Math.PI * 2;
const FX = -1.05; // 틀 원점 x = 기둥 안쪽 면
const FY = 0.5; // 틀 원점 y = 바닥판 밑면
const ZS = 0.15; // 나사 축의 깊이
const SY = FY + K103.axisY; // 나사 축 세계 높이 = 2.05

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM103(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // ㄴ자 틀(기둥·바닥판·베드·안내 레일) — 고정
  const frame = screwFrame103(0.45, 0.4);
  frame.name = 'frame';
  frame.position.set(FX, FY, ZS);
  g.add(frame);

  // 이송 나사(오른나사) — rotation.x = beta 로 제자리 회전
  const screw = leadScrew103();
  screw.name = 'screw';
  screw.position.set(FX, SY, ZS);
  g.add(screw);

  // T자 슬라이드(너트 겸함) — 나사 축 위를 x 로만 미끄러진다
  const slide = screwSlide103();
  slide.name = 'slide';
  g.add(slide);

  // 회전 화살표(왕복이라 방향이 바뀐다) — 네모 끝 둘레에 세운 고리
  const arrows = turnArrows(0.33, 'x');
  arrows.group.position.set(-1.8, SY, ZS);
  g.add(arrows.group);

  // 이름표 — 슬라이드 표만 부품을 따라간다
  const slideTag = tag('슬라이드(너트)', v(0, 2.64, 0.45));
  g.add(tag('이송 나사(구동)', v(-1.25, 3.05, 0.4)));
  g.add(slideTag);
  g.add(tag('안내 레일', v(1.65, 1.62, 0.7)));
  g.add(tag('기둥(나사 받침)', v(-1.25, 0.28, 0.6)));

  let cur = screw103(0);

  // 절대 자세: theta 의 닫힌 식으로 매번 다시 계산
  const apply = (): void => {
    cur = screw103(theta);
    screw.rotation.x = cur.beta;
    slide.position.set(FX + cur.x, SY, ZS);
    arrows.set(cur.dir);
    slideTag.position.x = FX + cur.x;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '나사 회전', value: `${(cur.a / TAU).toFixed(2)} 바퀴 (${cur.dir < 0 ? '가는 중' : '돌아오는 중'})` },
      { label: '슬라이드 위치', value: `행정의 ${Math.round((cur.a / (K103.turns * TAU)) * 100)} %` },
      { label: '피치', value: `한 바퀴에 ${K103.pitch.toFixed(2)}, 행정 ${(K103.turns * K103.pitch).toFixed(1)}` },
      { label: '설명', value: '슬라이드는 레일 때문에 돌지 못하고 밀려만 간다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [1.4, 2.3, 6.4], target: [0, 1.5, 0.1] }
  };
}
