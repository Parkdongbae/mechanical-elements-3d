// 171 선박용 밸브 장치와 역전 장치 — 두 편심륜이 편심 막대 둘로 홈 달린 링크를 흔들고, 링크 가운데 핀에 걸린 밸브 막대가
//  오르내린다. 막대 아래 핀은 트러니언 둘레로 흔들리는 실린더의 곡선 미끄럼판 홈 속에서 움직인다(판화 171번).
//  설계표 docs/mm507-sheets/171.md · 부품·식은 kit/k171 — 이 파일은 배치·자세 대입만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { fixedPin } from '../kit/k168';
import { K171, eccRod171, link171, pose171, shaft171, slide171, valveRod171 } from '../kit/k171';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM171(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const K = K171;

  g.add(displayStand());

  // 고정 핀: 트러니언(실린더 흔들림 축) · 밸브 막대 위 안내 핀
  const trunnion = fixedPin(K.T0[0], K.T0[1], 0.04, 0.185, 0.09, 0.02);
  trunnion.name = 'trunnion';
  const stud = fixedPin(K.stud[0], K.stud[1], 0.025, 0.285, 0.045, 0.015);
  stud.name = 'stud';
  g.add(trunnion, stud);

  const shaft = shaft171();
  shaft.name = 'shaft';
  shaft.position.set(K.C[0], K.C[1], 0);
  const rod1 = eccRod171(1);
  rod1.name = 'eccRod1';
  const rod2 = eccRod171(2);
  rod2.name = 'eccRod2';
  const link = link171();
  link.name = 'link';
  const valve = valveRod171();
  valve.name = 'valveRod';
  const slide = slide171();
  slide.name = 'slide';
  slide.position.set(K.T0[0], K.T0[1], 0);
  g.add(shaft, rod1, rod2, link, valve, slide);

  const arrowShaft = rotArrow(0.3, true);
  arrowShaft.position.set(K.C[0], K.C[1], 0.3);
  g.add(arrowShaft);

  const tagEcc = tag('편심륜(둘)', v(0.95, 2.85, 0.3));
  const tagRod = tag('편심 막대', v(-0.85, 2.3, 0.3));
  const tagLink = tag('홈 링크', v(-0.95, 1.65, 0.3));
  const tagValve = tag('밸브 막대', v(0.75, 2.45, 0.3));
  const tagSlide = tag('곡선 미끄럼판', v(1.25, 1.0, 0.3));
  const tagTrun = tag('트러니언', v(-0.95, 0.5, 0.3));
  g.add(tagEcc, tagRod, tagLink, tagValve, tagSlide, tagTrun);

  const pose = (th: number): void => {
    const p = pose171(th);
    shaft.rotation.z = p.phi;
    rod1.position.set(p.E1[0], p.E1[1], 0);
    rod1.rotation.z = p.rot1;
    rod2.position.set(p.E2[0], p.E2[1], 0);
    rod2.rotation.z = p.rot2;
    link.position.set(0, p.ym, 0);
    link.rotation.z = p.gamma;
    valve.position.set(0, p.ym, 0);
    slide.rotation.z = p.eps;
    tagLink.position.set(-0.95, p.ym, 0.3);
    tagRod.position.set((p.E1[0] + p.A[0]) / 2 - 0.7, (p.E1[1] + p.A[1]) / 2 + 0.1, 0.3);
    tagValve.position.set(0.75, p.ym + 0.8, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.6], target: [0, 1.7, 0] },
    notes: () => {
      const p = pose171(theta);
      return [
        { label: '주축 각', value: `${(((p.phi * DEG) % 360) + 360) % 360 | 0}°` },
        { label: '밸브 막대 높이', value: `${p.ym.toFixed(3)} (1.62 ~ 1.68)` },
        { label: '링크 기울기', value: `${(p.gamma * DEG).toFixed(1)}°` },
        { label: '실린더 흔들림', value: `${(p.eps * DEG).toFixed(1)}° (트러니언 둘레)` },
        { label: '설명', value: '편심 막대 둘이 링크를 흔들어 밸브 막대를 움직이고, 곡선 홈은 트러니언 중심의 원호라 실린더가 흔들려도 간섭하지 않는다' },
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    },
  };
}
