// 119 미끄럼 홈의 이중 랙 피니언 — 한 방향으로 도는 피니언이 타원 무한 랙의 위·아래를 번갈아 물어 랙을 왕복시킨다 (판화 119번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import {
  K119, PERIOD119, barGuide119, frameBeam119, mangle119, manglePinion119, oblongRack119, slottedBar119
} from '../kit/k119';

const CY = 1.72; // 랙 가운데선 높이 = 홈 가운데
const ZR = 0.1; // 랙·피니언의 가운데 평면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM119(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 들보 둘(고정)
  const top = frameBeam119(2.3, 0.22, 0.52);
  top.position.set(0, 2.58, -0.04);
  const bottom = frameBeam119(2.3, 0.22, 0.52);
  bottom.position.set(0, 0.86, -0.04);
  g.add(top, bottom);

  // 홈 막대(고정)
  const bar = slottedBar119(0.94, 0.94, 0.48, 0.22);
  bar.position.set(0, CY, 0.25);
  g.add(bar);

  // 랙 막대 안내(고정, 판화에 없는 보충)
  const guide = barGuide119(0.304);
  guide.position.set(0, CY, 0.004);
  g.add(guide);

  // 랙(왕복)
  const rack = oblongRack119();
  rack.name = 'rack';
  g.add(rack);

  // 피니언(구동) — 기어 표식 그룹
  const pinion = manglePinion119(0.12, 0.18);
  pinion.name = 'pinion';
  g.add(pinion);

  const arrow = rotArrow(0.16, true);
  g.add(arrow);

  const pinionTag = tag('피니언(구동)', v(0, 0, 0.45));
  const rackTag = tag('타원 무한 랙', v(0.36, CY - 0.17, 0.45));
  g.add(pinionTag, rackTag, tag('홈 막대', v(1.0, 3.0, 0.3)), tag('틀(고정)', v(-1.55, 0.5, 0.3)));

  let state = mangle119(theta);
  const apply = (): void => {
    state = mangle119(theta);
    const { x, y, spin, n } = state;
    rack.position.set(x, CY, ZR);
    pinion.position.set(0, CY + y, ZR);
    pinion.rotation.z = spin;
    arrow.position.set(0, CY + y, 0.43);
    pinionTag.position.set(0.95 * n[0], CY + y + 0.42 * n[1], 0.45);
    rackTag.position.set(x + 0.36, CY - 0.17, 0.45); // 홈 막대·홈·리벳을 피해 랙 판 오른쪽 아래에
  };
  apply();

  const phaseName = ['위 변을 묾 → 랙 오른쪽으로', '왼쪽 끝을 도는 중', '아래 변을 묾 → 랙 왼쪽으로', '오른쪽 끝을 도는 중'];

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => [
      { label: '상태', value: phaseName[state.phase] ?? '' },
      { label: '랙 위치', value: `x = ${state.x.toFixed(2)} (행정 2.09 중)` },
      { label: '잇수', value: `피니언 ${K119.teeth}, 랙 ${K119.nRack}(곧은 변 9 + 9, 끝 8 + 8)` },
      { label: '주기', value: `피니언 5.25바퀴에 랙 한 번 왕복(${(PERIOD119 / OMEGA).toFixed(2)} s)` },
      { label: '피니언 축 높이(홈 안)', value: `${Math.round(((state.y + 0.48) / 0.96) * 100)} %` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
