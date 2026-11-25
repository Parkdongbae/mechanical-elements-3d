// 117 요크 안의 캠과 롤러 — 지름이 일정한 캠이 두 롤러 사이에서 요크를 위아래로 왕복시킨다 (판화 117번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { rollerTurn117, rollerYoke117, slideGuide116, valveCam117, yokeLift117 } from '../kit/k116';

const CY = 1.75; // 캠 축 높이
const ZC = 0.16; // 캠·롤러 평면
const C0 = 1.6; // t = 1 에서 c = 0 (판화 자세)
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM117(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const shaft = shaftZ(0, CY, 0.34, 0.12);
  shaft.name = 'shaft';
  const cam = valveCam117();
  cam.name = 'cam';
  cam.position.set(0, CY, ZC);
  g.add(shaft, cam);

  const { group: yoke, rollerTop, rollerBottom } = rollerYoke117();
  yoke.name = 'yoke';
  yoke.position.set(0, CY, ZC);
  g.add(yoke);

  // 고정 안내 2개
  const upGuide = slideGuide116('y', 0.054, ZC);
  upGuide.name = 'guideTop';
  upGuide.position.set(0, CY + 1.04, ZC);
  const lowGuide = slideGuide116('y', { w: 0.108, d: 0.108 }, ZC, { span: 0.6 });
  lowGuide.name = 'guideBottom';
  lowGuide.position.set(0, CY - 1.11, ZC);
  g.add(upGuide, lowGuide);

  // 회전 화살표(반시계)
  const arrow = rotArrow(0.19, true);
  arrow.position.set(0, CY, 0.42);
  g.add(arrow);

  // 이름표 — 요크를 따라가는 것은 요크 그룹 안에(요크 로컬 = 세계 − (0, CY, ZC))
  yoke.add(
    leaderTo(tag('롤러', v(0.64, 0.51, 0.3 - ZC)), 'rollerTop'),
    tag('요크(위아래 왕복)', v(-0.8, 0.95, 0.3 - ZC))
  );
  g.add(tag('캠(구동)', v(-0.92, 1.95, 0.3)), tag('막대 안내(고정)', v(0.82, 0.64, 0.3)));

  let lift = 0;
  let c = 0;
  const apply = (): void => {
    c = theta - C0;
    cam.rotation.z = c;
    shaft.rotation.z = c;
    lift = yokeLift117(c);
    yoke.position.y = CY + lift;
    rollerTop.rotation.z = rollerTurn117(c, true);
    rollerBottom.rotation.z = rollerTurn117(c, false);
  };
  apply();

  const stateText = (): string => {
    const deg = ((((c % TAU) + TAU) % TAU) * 180) / Math.PI;
    if (deg < 139.5) return '오름';
    if (deg < 180) return '꼭대기에서 머묾';
    if (deg < 319.5) return '내림';
    return '바닥에서 머묾';
  };

  return {
    group: g,
    view: { pos: [0, 1.75, 6.5], target: [0, 1.7, 0.1] },
    notes: () => [
      { label: '캠 폭', value: '어느 방향으로 재도 0.78(롤러 사이)' },
      { label: '요크 위치', value: `${lift >= 0 ? '+' : ''}${lift.toFixed(2)} (행정 0.28)` },
      { label: '상태', value: stateText() },
      { label: '캠 회전수', value: `분당 약 ${Math.round((OMEGA * 60) / TAU)} 회전` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
