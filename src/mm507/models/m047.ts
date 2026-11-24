// 047 마찰 클러치 — 구동 상자의 고리 홈에 원판의 고리 테가 박혀 마찰로 축을 돌린다 (판화 47번)
// 판화는 단면도: 상자는 1/4 을 잘라 단면을 보이고, 레버(꺾쇠)로 원판을 밀고 당긴다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { frictionClutchAssembly, type FrictionState } from '../kit/gear6';

const PHASE_TEXT = ['떨어져 있음', '레버로 밀어 넣는 중', '마찰로 미끄러지며 가속', '박혀서 같이 돎', '떼었다(관성으로 느려짐)', '떨어져 있음'];

export default function buildM047(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 상자의 90° 단면 창은 θ ≡ −π/4 에서 정면(+z)을 향한다. t=1(θ 1.6)·t=5(θ 8.0, 박힘) 에 창이 앞을 보도록 위상을 옮긴다.
  const asm = frictionClutchAssembly(-Math.PI / 4 - 1.66);
  g.add(asm.group);

  // 회전 방향 화살표(+X 둘레)
  const a1 = rotArrow(0.45, true);
  a1.rotation.y = Math.PI / 2;
  a1.position.set(-1.25, 1.7, 0.28);
  const a2 = rotArrow(0.3, true);
  a2.rotation.y = Math.PI / 2;
  a2.position.set(1.1, 1.7, 0.28);
  g.add(a1, a2);

  const a = asm.anchors;
  g.add(
    tag('구동 상자(고리 홈)', a.housing!.clone().setX(-1.35)),
    tag('원판(고리 테가 홈에 박힘)', a.disk!.clone().setX(0.1)),
    tag('축(깃이 있음)', a.shaft!.clone().set(1.55, 2.25, 0.45)),
    tag('레버(꺾쇠)', a.lever!)
  );

  let st: FrictionState = asm.set(0);
  return {
    group: g,
    view: { pos: [0, 2.0, 6.0], target: [0, 1.5, 0.25] },
    notes: () => [
      { label: '상태', value: PHASE_TEXT[st.phase] ?? '' },
      { label: '축 속도 / 상자 속도', value: `${(st.ratio * 100).toFixed(0)}%` },
      { label: '고리 테가 물러난 거리', value: st.gap.toFixed(2) },
      { label: '누르는 힘', value: `${(st.press * 100).toFixed(0)}%` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      st = asm.set(theta);
    }
  };
}
