// 171 진동식 선박 기관의 밸브 장치와 역전 장치 — 주축의 편심 둘이 편심 막대 둘로 가로 홈 링크를 흔들고, 링크 홈 속 다이 블록에 달린
//  세로 막대가 트러니언 위 굽은 슬라이드를 좌우 세로 안내봉을 따라 오르내리게 한다. 슬라이드의 굽은 홈(트러니언 중심 원호) 속 핀이
//  로커 축 팔을 흔들어 밸브를 움직인다. 역전 손잡이로 링크를 옮기면 다이가 링크 다른 쪽 끝으로 가서 밸브 운동이 뒤집힌다(판화 171번).
//  설계표 docs/mm507-sheets/171.md · 부품·식은 kit/k171 — 이 파일은 배치·자세 대입만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import {
  K171, cylCarrier171, dieBlock171, eccRod171, guideRod171, leverPivot171, link171, pose171, reachBar171,
  reverseLever171, rockerArm171, rodBush171, shaft171, slide171, trunnionBearing171, valveRod171,
} from '../kit/k171';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM171(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const K = K171;

  g.add(displayStand());

  // 고정: 트러니언 베어링 · 세로 안내봉 둘 · 세로 막대 부시 · 역전 레버 축
  const bearing = trunnionBearing171();
  bearing.name = 'trunnionBearing';
  bearing.position.set(K.T[0], K.T[1], 0);
  const guideL = guideRod171(-1);
  guideL.name = 'guideL';
  const guideR = guideRod171(1);
  guideR.name = 'guideR';
  const bush = rodBush171();
  bush.name = 'rodBush';
  bush.position.set(0, K.dieMean + K.bushUp, 0);
  const pivot = leverPivot171();
  pivot.name = 'leverPivot';
  g.add(bearing, guideL, guideR, bush, pivot);

  // 움직이는 부품
  const shaft = shaft171();
  shaft.name = 'shaft';
  shaft.position.set(K.C[0], K.C[1], 0);
  const rod1 = eccRod171(1);
  rod1.name = 'eccRod1';
  const rod2 = eccRod171(2);
  rod2.name = 'eccRod2';
  const link = link171();
  link.name = 'link';
  const die = dieBlock171();
  die.name = 'dieBlock';
  const valve = valveRod171();
  valve.name = 'valveRod';
  const slide = slide171();
  slide.name = 'slide';
  const carrier = cylCarrier171();
  carrier.name = 'cylCarrier';
  carrier.position.set(K.T[0], K.T[1], 0);
  const rocker = rockerArm171();
  rocker.name = 'rockerArm';
  const bar = reachBar171();
  bar.name = 'reachBar';
  const lever = reverseLever171();
  lever.name = 'reverseLever';
  lever.position.set(K.Lp[0], K.Lp[1], 0);
  g.add(shaft, rod1, rod2, link, die, valve, slide, carrier, rocker, bar, lever);

  const arrowShaft = rotArrow(0.3, true);
  arrowShaft.position.set(K.C[0], K.C[1], 0.3);
  g.add(arrowShaft);

  // 이름표 — 각자 가리킬 부품을 직접 정한다
  const ecc2 = shaft.getObjectByName('ecc2') ?? shaft;
  const cap = carrier.getObjectByName('journalCap') ?? carrier;
  const tags: Array<[string, THREE.Vector3, THREE.Object3D]> = [
    ['편심(둘)', v(1.05, 3.05, 0.3), ecc2],
    ['편심 막대', v(1.3, 2.25, 0.3), rod2],
    ['세로 막대', v(-1.0, 2.6, 0.3), valve],
    ['역전 손잡이', v(-1.1, 2.1, 0.3), bar],
    ['홈 링크', v(1.35, 1.6, 0.3), link],
    ['굽은 슬라이드', v(1.45, 1.1, 0.3), slide],
    ['세로 안내봉', v(1.5, 0.68, 0.3), guideR],
    ['트러니언', v(1.5, 0.3, 0.3), cap],
    ['로커 팔', v(-1.65, 0.78, 0.3), rocker],
    ['실린더 쪽 받침', v(-1.3, 0.35, 0.3), carrier],
  ];
  for (const [text, pos, target] of tags) g.add(leaderTo(tag(text, pos), target));

  const pose = (th: number): void => {
    const p = pose171(th);
    shaft.rotation.z = p.phi;
    rod1.position.set(p.E1[0], p.E1[1], 0);
    rod1.rotation.z = p.rot1;
    rod2.position.set(p.E2[0], p.E2[1], 0);
    rod2.rotation.z = p.rot2;
    link.position.set(p.M[0], p.M[1], 0);
    link.rotation.z = p.gamma;
    die.position.set(0, p.yD, 0);
    die.rotation.z = p.dieAng;
    valve.position.set(0, p.yD, 0);
    slide.position.set(0, p.yS, 0);
    carrier.rotation.z = p.eps;
    rocker.position.set(p.R[0], p.R[1], 0);
    rocker.rotation.z = p.armAng;
    bar.position.set(p.H[0], p.H[1], 0);
    bar.rotation.z = p.barAng;
    lever.rotation.z = -p.lam;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [-0.2, 1.75, 6.6], target: [-0.2, 1.7, 0] },
    notes: () => {
      const p = pose171(theta);
      return [
        { label: '주축 각', value: `${(((p.phi * DEG) % 360) + 360) % 360 | 0}°` },
        { label: '역전 손잡이', value: p.state },
        { label: '다이 블록 자리', value: `링크 가운데에서 ${p.s >= 0 ? '오른쪽' : '왼쪽'} ${Math.abs(p.s).toFixed(2)}` },
        { label: '슬라이드 높이', value: `${p.ys >= 0 ? '+' : ''}${p.ys.toFixed(3)}` },
        { label: '밸브(로커 팔) 각', value: `${(p.psi * DEG).toFixed(1)}° (실린더 기준)` },
        { label: '실린더 흔들림', value: `${(p.eps * DEG).toFixed(1)}° (트러니언 둘레)` },
        { label: '설명', value: '편심 → 편심 막대 → 홈 링크 → 세로 막대 → 굽은 슬라이드 → 로커 팔 → 밸브. 홈은 트러니언 중심 원호라 실린더가 흔들려도 밸브가 따라 움직이지 않는다' },
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    },
  };
}
