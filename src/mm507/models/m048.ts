// 048 톱니 맞물림 클러치 — 위 피니언이 아래 기어를 돌리고, 기어에 붙은 턱 반쪽에 레버로 밀린 축 쪽 턱 반쪽이 물렸다 떨어진다 (판화 48번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { dogClutchAssembly, DOG_DEPTH } from '../kit/gear6';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM048(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const asm = dogClutchAssembly();
  g.add(asm.group);

  const a1 = rotArrow(0.18, false);
  a1.rotation.y = Math.PI / 2;
  a1.position.set(-1.12, 2.276, 0.28);
  const a2 = rotArrow(0.3, true);
  a2.rotation.y = Math.PI / 2;
  a2.position.set(1.3, 1.7, 0.28);
  g.add(a1, a2);

  const an = asm.anchors;
  g.add(
    tag('피니언(구동)', an.pinion ?? v(-1.3, 2.62, 0.6)),
    tag('기어 A(축에 헐거움)', v(-1.45, 1.08, 0.9)),
    tag('클러치 반쪽 A(기어에 붙음)', v(-0.5, 1.3, 0.9)), // 피니언·기어 물림을 가리지 않게 슬리브 아래로(검증 후 수정)
    tag('클러치 반쪽 B(깃에 미끄러짐)', v(0.45, 2.2, 0.9)),
    tag('축(깃)', v(1.4, 2.05, 0.9)),
    tag('레버', an.lever ?? v(1.35, 0.42, 0.45))
  );

  let st = asm.set(0);
  const PHASE = ['떨어져 있음', '레버가 밀고 있음', '턱이 맞는 자리를 기다림', '턱이 들어가는 중', '맞물려 같이 돎', '뽑는 중', '축이 관성으로 느려짐', '떨어져 있음'];
  return {
    group: g,
    notes: () => [
      { label: '상태', value: PHASE[st.phase] ?? '' },
      { label: '맞물림 깊이', value: `${(Math.max(0, st.d / DOG_DEPTH) * 100).toFixed(0)} %` },
      { label: '기어 : 피니언', value: '1 : 5 (60:12)' },
      { label: '축 B 회전각(도)', value: ((st.phiRel * 180) / Math.PI).toFixed(0) }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      st = asm.set(theta);
    }
  };
}
