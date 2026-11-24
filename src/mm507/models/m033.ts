// 033 타원 기어 — 같은 타원꼴 기어 두 개가 가운데 축으로 돌며 맞물려, 한 바퀴 안에서 속도가 두 번 빨라졌다 느려진다 (판화 33번)
// 판화처럼 축이 가운데에 있고 왼쪽은 세로, 오른쪽은 가로로 놓인다. 가운데 축으로 맞물리려면 피치 곡선이
// 진짜 타원이 아니라 2차 타원(오벌 기어, kit ovalPitch)이어야 축간 거리 a+b 가 일정하다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, ellipticalGear, ovalPitch, pitchRoll, rotArrow, shaftZ, tag } from '../kit';

const A = 0.95; // 긴반지름
const B = 0.59; // 짧은반지름 (판화의 비 약 0.62) — 축간 거리 d = a + b = 1.54
const NT = 26; // 잇수: 4k+2 이면 같은 기어 둘을 90° 돌려 놓았을 때 이와 이골이 만난다
const PIT = ovalPitch(A, B);
const C1: [number, number] = [-0.8, 1.75]; // 기어 1 의 축(가운데)
const C2: [number, number] = [C1[0] + PIT.d, 1.75];
const Z = 0.12;
const TH0 = Math.PI / 2; // 처음엔 판화처럼 기어 1 이 세로, 기어 2 가 가로
const W1 = OMEGA / 2; // 구동 각속도(일정)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM033(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let ratio = 0; // 현재 |ω2/ω1|

  g.add(displayStand());

  const g1 = ellipticalGear(PIT, NT, { width: 0.14, driver: true, thick: 0.22 });
  g1.position.set(C1[0], C1[1], Z);
  const g2 = ellipticalGear(PIT, NT, { width: 0.14, thick: 0.22 });
  g2.position.set(C2[0], C2[1], Z);
  g.add(g1, g2, shaftZ(C1[0], C1[1], 0.34, 0.05), shaftZ(C2[0], C2[1], 0.34, 0.05));

  const a1 = rotArrow(0.3, true);
  a1.position.set(C1[0], C1[1], 0.3);
  const a2 = rotArrow(0.3, false);
  a2.position.set(C2[0], C2[1], 0.3);
  g.add(a1, a2);
  g.add(tag('구동 타원 기어', v(-1.6, 3.0, 0.3)), tag('피동 타원 기어', v(1.6, 3.0, 0.3)));

  return {
    group: g,
    notes: () => [
      { label: '잇수', value: `${NT} : ${NT}` },
      { label: '속도비 범위', value: `${(B / A).toFixed(2)} ~ ${(A / B).toFixed(2)}배 (한 바퀴에 두 번)` },
      { label: '지금 속도비', value: `${ratio.toFixed(2)}배` },
      { label: '회전 방향', value: '서로 반대' }
    ],
    update(dt: number, speed: number): void {
      theta += W1 * speed * dt;
      const th1 = TH0 + theta;
      g1.rotation.z = th1;
      // 미끄럼 없는 굴림: 두 피치 곡선에서 지나간 호 길이가 같다(기어 1 의 긴 끝 ↔ 기어 2 의 짧은 옆, 호 길이 L/4)
      g2.rotation.z = pitchRoll(PIT, th1, PIT.L / 4);
      // ω2/ω1 = r1/r2 (접점까지의 반지름 비), r1 + r2 = d
      const r1 = PIT.r(-th1);
      ratio = r1 / (PIT.d - r1);
    }
  };
}
