// 096 하트 모양 캠과 작도법 — 하트 캠이 돌면 가로 막대가 일정한 속도로 오간다(판화 96번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { coilSpring, displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { barGuide, camBar, heartCam96, heartRollerX96 } from '../kit/k095';

const CX = -0.85; // 캠 축
const CY = 1.75;
const CZ = 0.1; // 캠 판 가운데 평면
const BZ = 0.215; // 막대 봉 깊이
const G1 = 0.725; // 안내 블록 위치
const G2 = 1.225;
const SPRING_END = 0.65; // guide1 왼쪽 면
const XR0 = 0.334; // 눈에 앉았을 때 롤러 중심 거리
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM096(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const cam = heartCam96();
  cam.name = 'cam';
  cam.position.set(CX, CY, CZ);
  g.add(cam);
  g.add(shaftZ(CX, CY, 0.24, 0.07));

  const bar = camBar(1.9, 0.06, { collarAt: 0.2 });
  bar.name = 'bar';
  bar.position.set(CX + XR0, CY, CZ);
  g.add(bar);

  const guide1 = barGuide(-0.515);
  guide1.name = 'guide1';
  guide1.position.set(G1, CY, BZ);
  const guide2 = barGuide(-0.515);
  guide2.name = 'guide2';
  guide2.position.set(G2, CY, BZ);
  g.add(guide1, guide2);

  const spring = coilSpring(0.075, 0.012, 7);
  spring.name = 'spring';
  g.add(spring);

  const arrow = rotArrow(0.45, true);
  arrow.position.set(CX, CY, 0.2);
  arrow.rotation.z = (118 * Math.PI) / 180; // 화살표의 빈 110° 를 롤러 쪽(+X)으로 — 롤러·눈 접점을 가리지 않게
  g.add(arrow);

  g.add(
    leaderTo(tag('하트 캠(구동)', v(-1.3, 2.95, 0.3)), cam.children[0] as THREE.Object3D),
    tag('작도판: 동심원 6칸·방사선 12개', v(-0.6, 0.55, 0.3)),
    tag('가로 막대(일정한 속도로 왕복)', v(0.9, 2.3, 0.3))
  );
  // 롤러·스프링 이름표는 막대의 자식 — 막대와 함께 오간다(로컬 원점 = 롤러 중심)
  bar.add(leaderTo(tag('롤러', v(0.12, 0.3, 0.2)), 'bar'), tag('되돌림 스프링', v(0.4, -0.3, 0.2)));

  const state = { xr: XR0, psi: 0 };

  const apply = (): void => {
    const psi = theta - 1.6; // ψ = 0 이 판화 자세
    const xr = heartRollerX96(psi);
    state.psi = psi;
    state.xr = xr;
    cam.rotation.z = psi;
    bar.position.x = CX + xr;
    const left = CX + xr + 0.215;
    spring.position.set(left, CY, BZ);
    spring.scale.x = SPRING_END - left;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.9, 6.4], target: [0.1, 1.75, 0.1] },
    notes: () => {
      const m = ((state.psi % TAU) + TAU) % TAU;
      return [
        { label: '원리', value: '반 바퀴마다 반지름이 0.70 씩 고르게 늘고 준다 → 막대가 일정한 속도로 오간다' },
        { label: '막대 위치', value: `${(state.xr - XR0).toFixed(2)} (${m < Math.PI ? '나감' : '돌아옴'})` },
        { label: '작도', value: '이동 거리 6칸, 바깥 원 12칸, 교점을 이은 곡선' },
        { label: '구동 회전수', value: `${((OMEGA * 60) / TAU).toFixed(1)} rpm` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
