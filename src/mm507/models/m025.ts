// 025 베벨기어 — 같은 크기 마이터 베벨 2개가 직각으로 맞물려 1:1로 돈다 (판화 25번)
// 위 기어 A(수직 축)가 구동, 왼쪽 기어 B(가로 축)가 따라 돈다. 정면에서는 ㄱ자 띠 두 개.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { bevelGear, displayStand, leaderTo, rod, rotArrow, tag } from '../kit';
import { darkSteel, paint, steel } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const TEETH = 20;
const MOD = 0.038; // 피치 반지름 0.38, 이끝 0.414, 뿌리 0.346
const HALF_PITCH = Math.PI / 20; // 반 피치 — B 맞물림 위상(이-이골이 마주 물림)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 기어 축 어셈블리 — spin 그룹(기어 로컬 좌표, 축 = 로컬 Z) 안에 들어간다. −Z 쪽으로 뻗는다 */
function shaftAssembly(): THREE.Group {
  const g = new THREE.Group();
  // 축 몸통: 로컬 z −0.15 ~ −0.75 (기어 뒷면 쪽)
  const body = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 24), steel());
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, -0.45);
  g.add(body);
  // 밝은 키 — 회전이 보이게
  const key = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), paint(0xf2b619));
  key.position.set(0.05, 0, -0.65);
  g.add(key);
  // 판화의 칼라(짧은 원통)
  const collar = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24), darkSteel());
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0, -0.30);
  g.add(collar);
  return g;
}

export default function buildM025(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 세계 회전각 φ — A(+Y축)·B(+X축) 공간

  g.add(displayStand());

  // A(위, 구동): 피벗이 로컬 +Z → 세계 −Y, 이가 아래로 꼭짓점 O(0.30, 1.35, 0.18)에서 만난다
  const pivA = new THREE.Group();
  pivA.position.set(0.3, 1.73, 0.18);
  pivA.rotation.x = Math.PI / 2;
  const spinA = new THREE.Group();
  spinA.add(bevelGear(TEETH, MOD, { width: 0.24, spokes: 0, driver: true }), shaftAssembly());
  pivA.add(spinA);
  g.add(pivA);

  // B(왼쪽): 피벗이 로컬 +Z → 세계 +X, 이가 오른쪽으로 O에서 만난다
  const pivB = new THREE.Group();
  pivB.position.set(-0.08, 1.35, 0.18);
  pivB.rotation.y = Math.PI / 2;
  const spinB = new THREE.Group();
  const gearB = bevelGear(TEETH, MOD, { width: 0.24, spokes: 0 });
  spinB.add(gearB, shaftAssembly());
  pivB.add(spinB);
  g.add(pivB);

  // 축 받침(고정, 회전 안 함): 베어링 + 뒤판까지 고정 봉
  const bearingA = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 24), darkSteel()); // 축 Y
  bearingA.position.set(0.3, 2.18, 0.18);
  const bearingB = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 24), darkSteel()); // 축 X
  bearingB.rotation.z = Math.PI / 2;
  bearingB.position.set(-0.53, 1.35, 0.18);
  g.add(
    bearingA,
    bearingB,
    rod(v(0.3, 2.18, 0.1), v(0.3, 2.18, -0.28), 0.04),
    rod(v(-0.53, 1.35, 0.1), v(-0.53, 1.35, -0.28), 0.04)
  );

  // 회전 방향 화살표(둘 다 반시계 — 위에서/오른쪽에서 봄)
  const arrowA = rotArrow(0.3, true);
  arrowA.position.set(0.3, 2.58, 0.18);
  arrowA.rotation.x = -Math.PI / 2; // 로컬 Z → +Y
  const arrowB = rotArrow(0.3, true);
  arrowB.position.set(-0.95, 1.35, 0.18);
  arrowB.rotation.y = Math.PI / 2; // 로컬 Z → +X
  g.add(arrowA, arrowB);

  // 이름표
  g.add(
    tag('구동 베벨 A', v(1.3, 1.95, 0.4)),
    leaderTo(tag('베벨 B', v(-0.95, 0.95, 0.4)), gearB),
    tag('수직 축', v(0.95, 2.45, 0.4)),
    tag('가로 축', v(-1.0, 1.72, 0.4)),
    // 실제 맞물림 점은 왼쪽 위 모서리 (−0.08, 1.73) — 그 바로 위에 둔다
    tag('맞물림', v(-0.5, 2.1, 0.4))
  );

  return {
    group: g,
    view: { pos: [2.6, 3.0, 3.6], target: [0.2, 1.6, 0.18] },
    notes: () => [
      { label: '속도비', value: '1 : 1 (마이터)' },
      { label: '축 사이 각도', value: '90°' },
      { label: '회전 방향', value: '위에서 보아 반시계 ↔ 오른쪽에서 보아 반시계' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각 — 매 프레임 재계산(역회전·누적 오차 없음)
      theta += OMEGA * speed * dt;
      // 구름 조건: ωA−ωB ∥ 접촉선 (−1,1,0)/√2 → A는 +Y축으로 φ, B는 +X축으로 같은 φ
      // 로컬 Z 회전은 축 방향에 맞게 부호 조정(A: 로컬Z = 세계 −Y, B: 로컬Z = 세계 +X)
      spinA.rotation.z = -theta;
      spinB.rotation.z = theta + HALF_PITCH;
    }
  };
}
